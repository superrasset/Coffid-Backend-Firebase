const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {getFirestore} = require("firebase-admin/firestore");
const {info: logInfo, error: logError, warn: logWarn} = require("firebase-functions/logger");
const { processDocumentVerification } = require('./verifyIDDocument');
const { processPassportVerification } = require('./verifyPassportDocument');

/**
 * Firestore trigger that processes newly uploaded documents
 * Triggers only on document creation in the uploadedDocument collection
 * Each recto and verso side is stored as a separate document
 */
const processUploadedDocument = onDocumentCreated("uploadedDocument/{docId}", async (event) => {
  const db = getFirestore();
  const docId = event.params.docId;
  const newData = event.data.data();

  logInfo(`Document created with ID: ${docId}`, {docId});

  try {
    if (!newData) {
      logError(`No data found for document ${docId}`);
      return;
    }

    // Extract document details
    const documentType = newData.documentType;
    const side = newData.side; // 'recto' or 'verso' for ID documents, not used for passport
    const userId = newData.userId;
    const imageUrl = newData.imageUrl;

    logInfo(`Processing ${documentType} document${side ? ` - ${side} side` : ''} for user ${userId}`);

    // Validate required fields
    if (!userId || !imageUrl || !documentType) {
      logError(`Missing required fields for document ${docId}`, {
        userId: !!userId,
        imageUrl: !!imageUrl,
        documentType: !!documentType
      });
      return;
    }

    // Verify the uploaded document
    let verificationResult;
    
    if (documentType === 'passport') {
      verificationResult = await processPassportVerification(imageUrl);
    } else if (documentType === 'id') {
      if (!side) {
        logError(`Missing side information for ID document ${docId}`);
        return;
      }
      verificationResult = await processDocumentVerification(imageUrl, side);
    } else {
      logError(`Unknown document type: ${documentType}`);
      return;
    }

    // Update the uploaded document with verification results
    await event.data.ref.update({
      verificationResult,
      verifiedAt: new Date(),
      status: 'verified'
    });

    logInfo(`Verification completed for ${documentType}${side ? ` - ${side}` : ''}`, {
      docId,
      userId,
      isValid: verificationResult?.isValid
    });

    // For ID documents, check if we need to aggregate results
    if (documentType === 'id') {
      await checkAndAggregateIDResults(userId, db);
    } else if (documentType === 'passport') {
      // For passport, directly create the verified document
      await createVerifiedDocument(userId, {
        passport: verificationResult
      }, db);
    }

  } catch (error) {
    logError(`Error processing document ${docId}:`, {
      error: error.message,
      stack: error.stack,
      docId
    });
    
    // Update document with error status
    try {
      await event.data.ref.update({
        status: 'error',
        error: error.message,
        errorAt: new Date()
      });
    } catch (updateError) {
      logError(`Failed to update document with error status:`, {
        error: updateError.message,
        docId
      });
    }
  }
});

/**
 * Check if both recto and verso sides of an ID document have been verified
 * and aggregate the results into the verifiedDocument collection
 */
async function checkAndAggregateIDResults(userId, db) {
  try {
    logInfo(`Checking for complete ID verification for user ${userId}`);

    // Query for all verified ID documents for this user
    const uploadedDocsQuery = await db.collection('uploadedDocument')
      .where('userId', '==', userId)
      .where('documentType', '==', 'id')
      .where('status', '==', 'verified')
      .get();

    if (uploadedDocsQuery.empty) {
      logInfo(`No verified ID documents found for user ${userId}`);
      return;
    }

    const verifiedDocs = {};
    uploadedDocsQuery.forEach(doc => {
      const data = doc.data();
      if (data.side) {
        verifiedDocs[data.side] = data.verificationResult;
      }
    });

    logInfo(`Found verified sides for user ${userId}:`, {
      recto: !!verifiedDocs.recto,
      verso: !!verifiedDocs.verso
    });

    // Check if we have both sides
    if (verifiedDocs.recto && verifiedDocs.verso) {
      logInfo(`Both sides verified for user ${userId}, creating aggregated result`);
      
      // Aggregate the results
      const aggregatedResult = {
        recto: verifiedDocs.recto,
        verso: verifiedDocs.verso,
        overallValid: verifiedDocs.recto.isValid && verifiedDocs.verso.isValid,
        aggregatedAt: new Date()
      };

      await createVerifiedDocument(userId, {
        id: aggregatedResult
      }, db);
    } else {
      logInfo(`Waiting for remaining sides for user ${userId}`, {
        hasRecto: !!verifiedDocs.recto,
        hasVerso: !!verifiedDocs.verso
      });
    }

  } catch (error) {
    logError(`Error checking ID results for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId
    });
  }
}

/**
 * Create or update a verified document in the verifiedDocument collection
 */
async function createVerifiedDocument(userId, verificationData, db) {
  try {
    logInfo(`Creating verified document for user ${userId}`);

    const verifiedDocRef = db.collection('verifiedDocument').doc(userId);
    
    // Check if document already exists
    const existingDoc = await verifiedDocRef.get();
    
    if (existingDoc.exists) {
      // Update existing document
      await verifiedDocRef.update({
        ...verificationData,
        updatedAt: new Date()
      });
      logInfo(`Updated verified document for user ${userId}`);
    } else {
      // Create new document
      await verifiedDocRef.set({
        userId,
        ...verificationData,
        createdAt: new Date()
      });
      logInfo(`Created verified document for user ${userId}`);
    }

  } catch (error) {
    logError(`Error creating verified document for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId
    });
    throw error;
  }
}

// Export the trigger function
module.exports = {
    processUploadedDocument
};
