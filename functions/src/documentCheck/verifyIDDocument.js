// Handles all logic for Traditional ID and New ID verification (recto/verso)

const {getFirestore} = require("firebase-admin/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");

/**
 * Process ID document verification workflow
 * Handles Traditional ID and New ID types, manages recto/verso sides
 */
async function processIDDocument(docId, documentData) {
  try {
    const { userId, documentType, side, imageUrl } = documentData;
    
    logInfo(`Starting ID document processing for user ${userId}`, {
      documentType,
      side,
      docId
    });

    // Validate required fields for ID documents
    if (!userId || !imageUrl || !side) {
      throw new Error(`Missing required fields: userId=${!!userId}, imageUrl=${!!imageUrl}, side=${!!side}`);
    }

    // Validate document type
    if (documentType !== 'Traditional ID' && documentType !== 'New ID') {
      throw new Error(`Invalid ID document type: ${documentType}`);
    }

    // Validate side
    if (side !== 'recto' && side !== 'verso') {
      throw new Error(`Invalid side: ${side}. Must be 'recto' or 'verso'`);
    }

    // 1. Verify the document side
    const verificationResult = await verifyIDSide(imageUrl, side, documentType, docId, documentData.filename);

    // 2. Update the uploaded document with basic status
    const db = getFirestore();
    await db.collection('uploadedDocument').doc(docId).update({
      verifiedAt: new Date(),
      status: verificationResult.isValid ? 'verified' : 'rejected'
    });

    // 3. Create or update the verified document
    const verificationStatus = await updateVerifiedDocumentForID(userId, side, verificationResult, db, docId, documentType);

    // 4. Update uploadedDocument validity if this individual document is valid
    if (verificationResult.isValid) {
      await db.collection('uploadedDocument').doc(docId).update({
        validity: 'validated',
        validatedAt: new Date()
      });
      logInfo(`Updated uploadedDocument ${docId} validity to 'validated'`);
    }

    logInfo(`ID document processing completed for user ${userId}`, {
      documentType,
      side,
      isValid: verificationResult.isValid,
      uploadedDocumentId: docId,
      isComplete: verificationStatus?.isComplete,
      overallValid: verificationStatus?.overallValid
    });

    return {
      success: true,
      verificationResult,
      verificationStatus
    };

  } catch (error) {
    logError(`Error processing ID document:`, {
      error: error.message,
      stack: error.stack,
      docId,
      documentData
    });
    throw error;
  }
}

/**
 * Core ID document verification function
 * Verifies a single side of Traditional ID or New ID
 */
async function verifyIDSide(imageUrl, side, documentType, docId, filename) {
  try {
    logInfo(`Verifying ${documentType} ${side} side...`);
    
    // Basic document validation logic
    let verificationResult = {
      isValid: false,
      processedAt: new Date().toISOString(),
      side: side,
      uploadedDocumentId: docId,
      filename: filename || null,
      imageUrl: imageUrl
    };

    // Simulate verification process (replace with actual verification logic)
    if (imageUrl && side && documentType) {
      verificationResult.isValid = true;
    }

    logInfo(`${documentType} ${side} verification completed:`, {
      isValid: verificationResult.isValid,
      uploadedDocumentId: docId
    });

    return verificationResult;

  } catch (error) {
    logError(`Error in ${documentType} ${side} verification:`, error);
    throw error;
  }
}

/**
 * Create or update verified document for ID based on which side was processed
 * Creates document with new ID after recto verification, updates it after verso verification
 */
async function updateVerifiedDocumentForID(userId, side, verificationResult, db, docId, documentType) {
  try {
    logInfo(`Updating verified document for user ${userId} - ${side} side processed`);

    let verifiedDocRef;
    let existingDoc;

    if (side === 'recto') {
      // For recto (first side), create a new document with auto-generated ID
      verifiedDocRef = db.collection('verifiedDocument').doc(); // Auto-generate new ID
      existingDoc = { exists: false }; // New document doesn't exist yet
    } else {
      // For verso (second side), find the existing document for this user and document type
      const querySnapshot = await db.collection('verifiedDocument')
        .where('userId', '==', userId)
        .where('documentType', '==', documentType)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        verifiedDocRef = doc.ref;
        existingDoc = { exists: true, data: () => doc.data() };
      } else {
        // No partial document found, create new one with auto-generated ID
        verifiedDocRef = db.collection('verifiedDocument').doc();
        existingDoc = { exists: false };
      }
    }
    
    if (side === 'recto') {
      // First side (recto) processed - create new document with auto-generated ID
      await verifiedDocRef.set({
        userId,
        documentType: documentType, // Store document type at document level
        uploadedDocuments: {
          recto: verificationResult,
          rectoProcessedAt: new Date(),
          overallValid: false, // Not complete yet, waiting for verso
          status: 'partial' // Indicates only one side processed
        },
        createdAt: new Date()
      });
      logInfo(`Created new verified document with auto-generated ID ${verifiedDocRef.id} for user ${userId}`);
      
      // Return status for recto processing (not complete yet)
      return {
        isComplete: false,
        overallValid: false,
        documentId: verifiedDocRef.id
      };
    } 
    else if (side === 'verso') {
      // Second side (verso) processed - update existing document
      if (existingDoc.exists) {
        const existingData = existingDoc.data();
        const rectoResult = existingData.uploadedDocuments?.recto;
        
        if (rectoResult) {
          // Both sides now available - complete the verification
          const overallValid = rectoResult.isValid && verificationResult.isValid;
          
          await verifiedDocRef.update({
            'uploadedDocuments.verso': verificationResult,
            'uploadedDocuments.versoProcessedAt': new Date(),
            'uploadedDocuments.overallValid': overallValid,
            'uploadedDocuments.status': 'complete',
            'uploadedDocuments.completedAt': new Date(),
            updatedAt: new Date()
          });
          
          logInfo(`Completed ID verification for document ${verifiedDocRef.id} - user ${userId}`, {
            rectoValid: rectoResult.isValid,
            versoValid: verificationResult.isValid,
            overallValid: overallValid
          });

          // Return completion status
          return {
            isComplete: true,
            overallValid: overallValid,
            documentId: verifiedDocRef.id
          };
        } else {
          // Verso processed before recto (unusual case) - update document
          await verifiedDocRef.update({
            'uploadedDocuments.verso': verificationResult,
            'uploadedDocuments.versoProcessedAt': new Date(),
            'uploadedDocuments.overallValid': false,
            'uploadedDocuments.status': 'partial',
            updatedAt: new Date()
          });
          logInfo(`Updated verified document ${verifiedDocRef.id} with verso data (recto pending) for user ${userId}`);
          
          // Return status for verso without recto (not complete)
          return {
            isComplete: false,
            overallValid: false,
            documentId: verifiedDocRef.id
          };
        }
      } else {
        // Verso processed but no partial document exists - create with verso data
        await verifiedDocRef.set({
          userId,
          documentType: documentType, // Store document type at document level
          uploadedDocuments: {
            verso: verificationResult,
            versoProcessedAt: new Date(),
            overallValid: false, // Not complete yet, waiting for recto
            status: 'partial' // Indicates only one side processed
          },
          createdAt: new Date()
        });
        logInfo(`Created new verified document with auto-generated ID ${verifiedDocRef.id} (verso first) for user ${userId}`);
        
        // Return status for verso-first processing (not complete)
        return {
          isComplete: false,
          overallValid: false,
          documentId: verifiedDocRef.id
        };
      }
    }

  } catch (error) {
    logError(`Error updating verified document for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId,
      side
    });
    throw error;
  }
}

// Export the main processing function
module.exports = {
  processIDDocument,
  verifyIDSide,
  updateVerifiedDocumentForID
};
