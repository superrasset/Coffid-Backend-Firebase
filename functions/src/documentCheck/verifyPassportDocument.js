const {getFirestore} = require("firebase-admin/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const { createOCRService } = require('./ocrService');

/**
 * Process passport document verification workflow
 * Step 1: Document verification (creates verifiedDocument with "partial 1/3" status)
 * Step 2: Video validation (handled by completePassportWithVideo)
 */
async function processPassportDocument(docId, documentData) {
  try {
    const { userId, documentType, imageUrl } = documentData;
    
    logInfo(`Starting passport document processing for user ${userId}`, {
      documentType,
      docId
    });

    // Validate required fields for passport documents
    if (!userId || !imageUrl) {
      throw new Error(`Missing required fields: userId=${!!userId}, imageUrl=${!!imageUrl}`);
    }

    // Validate document type
    if (documentType !== 'Passport') {
      throw new Error(`Invalid passport document type: ${documentType}`);
    }

    // 1. Verify the passport document using OCR service
    const verificationResult = await verifyPassport(imageUrl, documentType);

    // 2. Update the uploaded document with basic status (similar to ID flow)
    const db = getFirestore();
    const uploadedDocUpdate = {
      verifiedAt: new Date(),
      status: verificationResult.isValid ? 'verified' : 'rejected'
    };

    // Add validity field to indicate the validation result for the app
    if (verificationResult.isValid) {
      uploadedDocUpdate.validity = 'validated';
      uploadedDocUpdate.validatedAt = new Date();
    } else {
      uploadedDocUpdate.validity = 'rejected';
      uploadedDocUpdate.rejectedAt = new Date();
    }

    await db.collection('uploadedDocument').doc(docId).update(uploadedDocUpdate);

    logInfo(`Updated uploadedDocument ${docId} with validation result`, {
      status: uploadedDocUpdate.status,
      validity: uploadedDocUpdate.validity,
      isValid: verificationResult.isValid
    });

    // 3. Create or update the verified document with initial status
    await createVerifiedPassportDocument(userId, verificationResult, db);

    logInfo(`Passport document processing completed for user ${userId}`, {
      isValid: verificationResult.isValid,
      confidence: verificationResult.confidence,
      status: verificationResult.isValid ? 'partial 1/2' : 'rejected',
      validity: verificationResult.isValid ? 'validated' : 'rejected',
      uploadedDocumentId: docId
    });

    return {
      success: true,
      verificationResult
    };

  } catch (error) {
    logError(`Error processing passport document:`, {
      error: error.message,
      stack: error.stack,
      docId,
      documentData
    });
    throw error;
  }
}

/**
 * Core passport verification function
 * Uses OCR service to verify passport document
 */
async function verifyPassport(imageUrl, documentType) {
  try {
    logInfo(`Verifying passport document using OCR service...`);
    
    // Use OCR service to process the passport
    const ocrService = createOCRService();
    const ocrResult = await ocrService.processDocument(imageUrl, documentType, 'recto');
    
    if (!ocrResult.isValid) {
      logError('Passport OCR processing failed', {
        errors: ocrResult.errors,
        confidence: ocrResult.confidence
      });
      
      return {
        isValid: false,
        confidence: ocrResult.confidence || 0,
        extractedData: ocrResult.extractedData || {},
        errors: ocrResult.errors || ['Passport verification failed'],
        processedAt: new Date().toISOString(),
        documentType: 'passport',
        provider: ocrResult.provider
      };
    }

    // Build verification result from OCR data
    const verificationResult = {
      isValid: true,
      confidence: ocrResult.confidence,
      extractedData: ocrResult.extractedData,
      errors: ocrResult.errors || [],
      processedAt: new Date().toISOString(),
      documentType: 'passport',
      provider: ocrResult.provider
    };

    logInfo(`Passport verification completed successfully:`, {
      isValid: verificationResult.isValid,
      confidence: verificationResult.confidence,
      provider: ocrResult.provider,
      hasPassportNumber: !!(ocrResult.extractedData?.passportNumber),
      hasPersonalInfo: !!(ocrResult.extractedData?.surname && ocrResult.extractedData?.givenNames)
    });

    return verificationResult;

  } catch (error) {
    logError(`Error in passport document verification:`, {
      error: error.message,
      stack: error.stack
    });
    
    return {
      isValid: false,
      confidence: 0,
      extractedData: {},
      errors: [`Passport verification failed: ${error.message}`],
      processedAt: new Date().toISOString(),
      documentType: 'passport'
    };
  }
}

/**
 * Create verified document for passport (Step 1 - partial 1/2 status)
 * Always creates a new verifiedDocument for each passport upload
 */
async function createVerifiedPassportDocument(userId, verificationResult, db) {
  try {
    logInfo(`Creating new verified passport document for user ${userId}`);

    // Always create a new document for passport verification
    const verifiedDocRef = db.collection('verifiedDocument').doc();
    
    const status = verificationResult.isValid ? 'partial 1/2' : 'rejected';
    
    // Extract document-level fields from passport data
    const documentLevelFields = extractDocumentLevelFields(verificationResult.extractedData);
    
    await verifiedDocRef.set({
      userId,
      documentType: 'Passport',
      status: status, // Top-level status field
      uploadedDocuments: {
        passport: verificationResult,
        processedAt: new Date(),
        overallValid: verificationResult.isValid
      },
      // Document-level aggregated fields
      ...documentLevelFields,
      createdAt: new Date()
    });
    
    logInfo(`Created new verified document with auto-generated ID ${verifiedDocRef.id} for passport - user ${userId}`, {
      status: status,
      isValid: verificationResult.isValid,
      documentLevelFields: Object.keys(documentLevelFields),
      freshDocument: true
    });

  } catch (error) {
    logError(`Error creating verified passport document for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId
    });
    throw error;
  }
}

/**
 * Extract document-level fields from passport data
 * Similar to ID document extraction
 */
function extractDocumentLevelFields(extractedData) {
  const documentFields = {};
  
  // Map passport fields to document-level fields
  if (extractedData?.passportNumber) {
    documentFields.passportNumber = extractedData.passportNumber;
  }
  
  if (extractedData?.surname) {
    documentFields.lastname = extractedData.surname;
  }
  
  if (extractedData?.givenNames && extractedData.givenNames.length > 0) {
    documentFields.firstname = extractedData.givenNames[0]; // Take first given name
  }
  
  if (extractedData?.birthDate) {
    documentFields.birthDate = extractedData.birthDate;
  }
  
  if (extractedData?.issueDate) {
    documentFields.issueDate = extractedData.issueDate;
  }
  
  if (extractedData?.expiryDate) {
    documentFields.expiryDate = extractedData.expiryDate;
  }
  
  if (extractedData?.mrz1) {
    documentFields.MRZ1 = extractedData.mrz1;
  }
  
  if (extractedData?.mrz2) {
    documentFields.MRZ2 = extractedData.mrz2;
  }
  
  if (extractedData?.nationality) {
    documentFields.nationality = extractedData.nationality;
  }
  
  if (extractedData?.countryOfIssue) {
    documentFields.countryOfIssue = extractedData.countryOfIssue;
  }
  
  logInfo(`Extracted document-level fields for passport:`, {
    fields: Object.keys(documentFields),
    hasPassportNumber: !!documentFields.passportNumber,
    hasPersonalInfo: !!(documentFields.firstname && documentFields.lastname)
  });
  
  return documentFields;
}

/**
 * Complete passport verification with video validation (Step 2)
 * Similar to completeDocumentWithVideo for ID documents
 */
async function completePassportWithVideo(userId, documentType, videoValidationResult, videoData = {}) {
  try {
    const db = getFirestore();
    
    logInfo(`Starting video validation completion for passport - user ${userId}`, {
      documentType,
      videoValid: videoValidationResult.isValid,
      hasVideoData: Object.keys(videoData).length > 0
    });

    // Find the passport document with status "partial 1/2" for this user
    const querySnapshot = await db.collection('verifiedDocument')
      .where('userId', '==', userId)
      .where('documentType', '==', 'Passport')
      .where('status', '==', 'partial 1/2')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      throw new Error(`No passport document found with status "partial 1/2" for user ${userId}`);
    }

    const verifiedDoc = querySnapshot.docs[0];
    const verifiedDocRef = verifiedDoc.ref;
    const existingData = verifiedDoc.data();

    // Determine final status based on video validation
    const finalStatus = videoValidationResult.isValid ? 'completed' : 'rejected';
    
    // Prepare video validation update
    const videoValidationUpdate = {
      isValid: videoValidationResult.isValid,
      processedAt: new Date(),
      confidence: videoValidationResult.confidence || 0,
      errors: videoValidationResult.errors || []
    };

    // Add video reference if available
    if (videoData.faceRecordingUrl) {
      videoValidationUpdate.faceRecordingUrl = videoData.faceRecordingUrl;
    }
    if (videoData.videoUrl) {
      videoValidationUpdate.videoUrl = videoData.videoUrl;
    }
    if (videoData.filename) {
      videoValidationUpdate.filename = videoData.filename;
    }
    
    // Update document with video validation results and final status
    await verifiedDocRef.update({
      status: finalStatus, // Final status: completed or rejected
      'uploadedDocuments.videoValidation': videoValidationUpdate,
      'uploadedDocuments.finalCompletedAt': new Date(),
      'uploadedDocuments.finalValid': videoValidationResult.isValid && existingData.uploadedDocuments?.overallValid,
      updatedAt: new Date()
    });

    // If video validation is successful and document is completed, update user data
    if (videoValidationResult.isValid && finalStatus === 'completed') {
      try {
        const userUpdateResult = await updateUserDataFromVerifiedPassport(userId, existingData, db);
        logInfo(`User data update completed for passport verification - user ${userId}`, {
          documentId: verifiedDoc.id,
          updatedFields: userUpdateResult.updatedFields,
          success: userUpdateResult.success
        });
      } catch (userUpdateError) {
        // Log error but don't fail the entire operation
        logError(`Failed to update user data for passport verification - user ${userId}, but document processing completed:`, {
          error: userUpdateError.message,
          documentId: verifiedDoc.id,
          finalStatus: finalStatus
        });
      }
    }

    logInfo(`Passport verification completed with video validation for user ${userId}`, {
      documentId: verifiedDoc.id,
      finalStatus: finalStatus,
      videoValid: videoValidationResult.isValid,
      overallValid: existingData.uploadedDocuments?.overallValid,
      finalValid: videoValidationResult.isValid && existingData.uploadedDocuments?.overallValid
    });

    return {
      success: true,
      documentId: verifiedDoc.id,
      finalStatus: finalStatus,
      finalValid: videoValidationResult.isValid && existingData.uploadedDocuments?.overallValid
    };

  } catch (error) {
    logError(`Error completing passport with video validation for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      documentType,
      videoValid: videoValidationResult?.isValid
    });
    throw error;
  }
}

/**
 * Update user data from verified passport document
 * Similar to updateUserDataFromVerifiedDocument but for passport data
 */
async function updateUserDataFromVerifiedPassport(userId, verifiedDocumentData, db) {
  try {
    logInfo(`Updating user data from verified passport for user ${userId}`);
    
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new Error(`User document not found for userId: ${userId}`);
    }
    
    const updateData = {};
    const updatedFields = [];
    const timestamp = new Date();
    
    // Extract data from the document-level fields (not from uploadedDocuments)
    const documentData = verifiedDocumentData;
    
    // Update firstname (from passport given names)
    if (documentData.firstname) {
      const firstnameUpdate = {
        value: documentData.firstname,
        origin: 'passport',
        updatedAt: timestamp
      };
      
      updateData.firstname = userDoc.data().firstname || [];
      updateData.firstname.push(firstnameUpdate);
      updatedFields.push('firstname');
    }
    
    // Update lastname (from passport surname)
    if (documentData.lastname) {
      const lastnameUpdate = {
        value: documentData.lastname,
        origin: 'passport',
        updatedAt: timestamp
      };
      
      updateData.lastname = userDoc.data().lastname || [];
      updateData.lastname.push(lastnameUpdate);
      updatedFields.push('lastname');
    }
    
    // Update birthDate
    if (documentData.birthDate) {
      const birthDateUpdate = {
        value: documentData.birthDate,
        origin: 'passport',
        updatedAt: timestamp
      };
      
      updateData.birthDate = userDoc.data().birthDate || [];
      updateData.birthDate.push(birthDateUpdate);
      updatedFields.push('birthDate');
    }
    
    // Update nationality if available // TODO récupérer cette logique pour la partie ID
    if (documentData.nationality) {
      const nationalityUpdate = {
        value: documentData.nationality,
        origin: 'passport',
        updatedAt: timestamp
      };
      
      updateData.nationality = userDoc.data().nationality || [];
      updateData.nationality.push(nationalityUpdate);
      updatedFields.push('nationality');
    }
    
    // Perform the update if there are fields to update
    if (updatedFields.length > 0) {
      updateData.updatedAt = timestamp;
      await userRef.update(updateData);
      
      logInfo(`Successfully updated user data for user ${userId}`, {
        updatedFields,
        fieldsCount: updatedFields.length
      });
      
      return {
        success: true,
        updatedFields,
        timestamp
      };
    } else {
      logInfo(`No valid data found to update for user ${userId} from passport verification`);
      return {
        success: false,
        updatedFields: [],
        reason: 'No valid data to update'
      };
    }
    
  } catch (error) {
    logError(`Error updating user data from passport for user ${userId}:`, {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

// Export the main processing functions
module.exports = {
  processPassportDocument,
  verifyPassport,
  createVerifiedPassportDocument,
  completePassportWithVideo,
  updateUserDataFromVerifiedPassport,
  extractDocumentLevelFields
};
