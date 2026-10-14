const {getFirestore} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const {rekognitionService, awsAccessKeyId, awsSecretAccessKey} = require("./awsRekognitionService");
const {updatePendingRequestFromVerifiedDocument, updateUserDataFromVerifiedDocument} = require("../documentCheck/verifyIDDocument");

/**
 * Process selfie document verification workflow
 * Compares selfie with ID/Passport photo using AWS Rekognition
 */
async function processSelfieDocument(docId, documentData) {
  try {
    const { userId, documentMatchingType, imageUrl, taskId } = documentData;
    
    logInfo(`Starting selfie verification for user ${userId}`, {
      documentMatchingType,
      docId
    });

    // Validate required fields
    if (!userId || !imageUrl || !documentMatchingType) {
      throw new Error(`Missing required fields: userId=${!!userId}, imageUrl=${!!imageUrl}, documentMatchingType=${!!documentMatchingType}`);
    }

    // Validate document matching type
    if (documentMatchingType !== 'id' && documentMatchingType !== 'passport') {
      throw new Error(`Invalid documentMatchingType: ${documentMatchingType}. Must be 'id' or 'passport'`);
    }

    // Initialize AWS Rekognition service with credentials
    rekognitionService.initialize(
      awsAccessKeyId.value(),
      awsSecretAccessKey.value()
    );

    // 1. Find the corresponding document image (recto for ID, main photo for passport)
    const documentImageUrl = await findDocumentImage(userId, documentMatchingType);
    
    if (!documentImageUrl) {
      throw new Error(`No ${documentMatchingType} document image found for user ${userId}`);
    }

    logInfo(`Found document image for comparison`, {
      userId,
      documentMatchingType,
      documentImageUrl
    });

    // 2. Compare faces using AWS Rekognition
    const comparisonResult = await rekognitionService.compareFaces(
      imageUrl, // selfie (source)
      documentImageUrl // document photo (target)
    );

    logInfo(`Face comparison completed`, {
      userId,
      isMatch: comparisonResult.isMatch,
      similarity: comparisonResult.similarity,
      confidence: comparisonResult.confidence
    });

    // 3. Update the uploaded document with validation result
    const db = getFirestore();
    const uploadedDocUpdate = {
      verifiedAt: new Date(),
      status: comparisonResult.isMatch ? 'verified' : 'rejected',
      faceMatchResult: {
        isMatch: comparisonResult.isMatch,
        similarity: comparisonResult.similarity,
        confidence: comparisonResult.confidence
      }
    };

    if (comparisonResult.isMatch) {
      uploadedDocUpdate.validity = 'validated';
      uploadedDocUpdate.validatedAt = new Date();
    } else {
      uploadedDocUpdate.validity = 'rejected';
      uploadedDocUpdate.rejectedAt = new Date();
    }

    await db.collection('uploadedDocument').doc(docId).update(uploadedDocUpdate);

    logInfo(`Updated uploadedDocument ${docId} with face match result`, {
      status: uploadedDocUpdate.status,
      validity: uploadedDocUpdate.validity,
      isMatch: comparisonResult.isMatch
    });

    // 4. Update the verified document with face match result
    const verificationResult = await updateVerifiedDocumentWithFaceMatch(userId, documentMatchingType, comparisonResult, imageUrl, db);

    // 5. If selfie is validated and status is complete, update user data
    if (comparisonResult.isMatch && verificationResult.status === 'complete') {
      try {
        // Get the verified document to extract user data
        const verifiedDoc = await db.collection('verifiedDocument')
          .doc(verificationResult.documentId)
          .get();
        
        if (verifiedDoc.exists) {
          const verifiedDocData = verifiedDoc.data();
          
          logInfo(`📋 Using verifiedDocument for user data update`, {
            documentId: verificationResult.documentId,
            userId: userId,
            documentType: verifiedDocData.documentType,
            birthDate: verifiedDocData.birthDate,
            firstname: verifiedDocData.firstname,
            lastname: verifiedDocData.lastname,
            createdAt: verifiedDocData.createdAt
          });
          
          const [pendingResult, userResult] = await Promise.allSettled([
            updatePendingRequestFromVerifiedDocument(taskId, verifiedDocData, db),
            updateUserDataFromVerifiedDocument(userId, verifiedDocData, db),
          ]);

          logInfo(`Post-validation updates completed`, {
            taskId,
            documentId: verificationResult.documentId,
            pendingRequest: pendingResult.status,
            userData: userResult.status,
          });
        }
      } catch (userUpdateError) {
        logError(`Failed to run post-validation updates:`, {
          error: userUpdateError.message,
          stack: userUpdateError.stack,
          taskId,
          documentId: verificationResult.documentId
        });
      }
    }

    logInfo(`Selfie verification completed for user ${userId}`, {
      isMatch: comparisonResult.isMatch,
      similarity: comparisonResult.similarity,
      uploadedDocumentId: docId,
      finalStatus: verificationResult.status,
      userDataUpdated: comparisonResult.isMatch && verificationResult.status === 'complete'
    });

    return {
      success: true,
      comparisonResult
    };

  } catch (error) {
    logError(`Error processing selfie document:`, {
      error: error.message,
      stack: error.stack,
      docId,
      documentData
    });
    
    // Update uploadedDocument with error status
    try {
      const db = getFirestore();
      await db.collection('uploadedDocument').doc(docId).update({
        status: 'error',
        error: error.message,
        errorAt: new Date()
      });
    } catch (updateError) {
      logError(`Failed to update uploadedDocument with error`, {
        error: updateError.message
      });
    }
    
    throw error;
  }
}

/**
 * Find the document image (ID recto or passport) for the user
 * Searches Firebase Storage for the most recent document image
 */
async function findDocumentImage(userId, documentMatchingType) {
  try {
    const bucket = getStorage().bucket();
    
    // Determine the storage path prefix based on document type
    const prefix = documentMatchingType === 'id' 
      ? `ids/recto_${userId}_`
      : `passports/passport_${userId}_`;

    logInfo(`Searching for document image in Storage`, {
      userId,
      documentMatchingType,
      prefix
    });

    // List files matching the prefix
    const [files] = await bucket.getFiles({
      prefix: prefix
    });

    if (!files || files.length === 0) {
      logError(`No document image found in Storage`, {
        userId,
        documentMatchingType,
        prefix
      });
      return null;
    }

    // Sort by creation time and get the most recent
    files.sort((a, b) => {
      const timeA = new Date(a.metadata.timeCreated).getTime();
      const timeB = new Date(b.metadata.timeCreated).getTime();
      return timeB - timeA; // Most recent first
    });

    const mostRecentFile = files[0];
    
    logInfo(`Found document image`, {
      fileName: mostRecentFile.name,
      createdAt: mostRecentFile.metadata.timeCreated,
      totalFilesFound: files.length
    });

    // Return the gs:// URL
    return `gs://${bucket.name}/${mostRecentFile.name}`;

  } catch (error) {
    logError(`Error finding document image in Storage`, {
      error: error.message,
      userId,
      documentMatchingType
    });
    throw error;
  }
}

/**
 * Update verified document with face match result
 * Finds the most recent verifiedDocument for the user and updates it
 */
async function updateVerifiedDocumentWithFaceMatch(userId, documentMatchingType, comparisonResult, selfieImageUrl, db) {
  try {
    logInfo(`Updating verified document with face match result`, {
      userId,
      documentMatchingType,
      isMatch: comparisonResult.isMatch
    });

    // Determine the document type to search for
    // documentMatchingType 'id' could be 'Traditional ID' or 'New ID'
    // documentMatchingType 'passport' is 'Passport'
    
    // ⚠️ IMPORTANT: We must find the document waiting for selfie validation
    // For ID: status should be "partial 2/3" (both recto/verso validated, waiting for selfie)
    // For Passport: status should be "partial 1/2" (passport validated, waiting for selfie)
    
    let querySnapshot;
    if (documentMatchingType === 'id') {
      // Search for ID document waiting for selfie validation (status: partial 2/3)
      querySnapshot = await db.collection('verifiedDocument')
        .where('userId', '==', userId)
        .where('documentType', 'in', ['Traditional ID', 'New ID', 'ID'])
        .where('status', '==', 'partial 2/3')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    } else {
      // Search for Passport waiting for selfie validation (status: partial 1/2)
      querySnapshot = await db.collection('verifiedDocument')
        .where('userId', '==', userId)
        .where('documentType', '==', 'Passport')
        .where('status', '==', 'partial 1/2')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
    }

    if (querySnapshot.empty) {
      // Log all documents for debugging
      const expectedStatus = documentMatchingType === 'id' ? 'partial 2/3' : 'partial 1/2';
      
      // Query all documents for this user to help debug
      const allDocsQuery = await db.collection('verifiedDocument')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      
      const allDocs = allDocsQuery.docs.map(doc => ({
        id: doc.id,
        documentType: doc.data().documentType,
        status: doc.data().status,
        birthDate: doc.data().birthDate,
        createdAt: doc.data().createdAt
      }));
      
      logError(`No verified document with expected status found for user`, {
        userId,
        documentMatchingType,
        expectedStatus,
        allDocumentsFound: allDocs,
        message: `Expected to find a document with status "${expectedStatus}" but none was found`
      });
      throw new Error(`No verified document with status "${expectedStatus}" found for user ${userId}. Check that recto/verso (for ID) or passport document has been validated first.`);
    }

    const verifiedDoc = querySnapshot.docs[0];
    const verifiedDocRef = verifiedDoc.ref;
    const existingData = verifiedDoc.data();
    
    logInfo(`✅ Found verifiedDocument for selfie validation`, {
      documentId: verifiedDoc.id,
      userId,
      documentType: existingData.documentType,
      status: existingData.status,
      birthDate: existingData.birthDate,
      firstname: existingData.firstname,
      lastname: existingData.lastname,
      createdAt: existingData.createdAt
    });

    // Prepare selfie verification data (filter out undefined values)
    const selfieData = {
      imageUrl: selfieImageUrl,
      isMatch: comparisonResult.isMatch,
      similarity: comparisonResult.similarity,
      confidence: comparisonResult.confidence,
      timestamp: comparisonResult.timestamp
    };
    
    // Only include details if it exists
    if (comparisonResult.details !== undefined) {
      selfieData.details = comparisonResult.details;
    }
    
    // Only include error if it exists
    if (comparisonResult.error !== undefined) {
      selfieData.error = comparisonResult.error;
    }

    // Update the document status based on face match result
    let newStatus = existingData.status;
    if (comparisonResult.isMatch) {
      // Face match successful - complete verification
      if (existingData.status === 'partial 2/3') {
        newStatus = 'complete'; // ID Cards: recto + verso + selfie = complete
      } else if (existingData.status === 'partial 1/2') {
        newStatus = 'complete'; // Passport: passport + selfie = complete
      }
    } else {
      // Face match failed - mark as rejected
      newStatus = 'rejected';
    }

    // Update verified document
    await verifiedDocRef.update({
      'uploadedDocuments.selfie': selfieData,
      'uploadedDocuments.selfieProcessedAt': new Date(),
      'status': newStatus,
      'updatedAt': new Date()
    });

    logInfo(`Updated verified document with face match result`, {
      documentId: verifiedDoc.id,
      userId,
      isMatch: comparisonResult.isMatch,
      similarity: comparisonResult.similarity,
      oldStatus: existingData.status,
      newStatus: newStatus
    });

    return {
      success: true,
      documentId: verifiedDoc.id,
      status: newStatus
    };

  } catch (error) {
    logError(`Error updating verified document with face match`, {
      error: error.message,
      stack: error.stack,
      userId,
      documentMatchingType
    });
    throw error;
  }
}

module.exports = {
  processSelfieDocument
};
