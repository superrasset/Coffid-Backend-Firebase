const {getFirestore} = require("firebase-admin/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");

/**
 * Process passport document verification workflow
 * Handles complete passport verification and creates verifiedDocument
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

    // 1. Verify the passport document
    const verificationResult = await verifyPassport(imageUrl);

    // 2. Update the uploaded document with verification results
    const db = getFirestore();
    await db.collection('uploadedDocument').doc(docId).update({
      verificationResult,
      verifiedAt: new Date(),
      status: verificationResult.isValid ? 'verified' : 'rejected'
    });

    // 3. Create or update the verified document
    await createVerifiedPassportDocument(userId, verificationResult, db);

    logInfo(`Passport document processing completed for user ${userId}`, {
      isValid: verificationResult.isValid,
      confidence: verificationResult.confidence
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
 * Verifies a passport document
 */
async function verifyPassport(imageUrl) {
  try {
    logInfo(`Verifying passport document...`);
    
    // Basic document validation logic
    let verificationResult = {
      isValid: false,
      confidence: 0,
      extractedData: {},
      errors: [],
      processedAt: new Date().toISOString(),
      documentType: 'passport'
    };

    // Simulate verification process (replace with actual verification logic)
    if (imageUrl) {
      verificationResult.isValid = true;
      verificationResult.confidence = 0.93;
      verificationResult.extractedData = {
        documentType: 'passport',
        imageProcessed: true,
        firstName: 'Sample',
        lastName: 'Name',
        passportNumber: 'P123456789',
        nationality: 'Sample Country',
        birthDate: '1990-01-01',
        expiryDate: '2030-01-01',
        issueDate: '2020-01-01',
        placeOfBirth: 'Sample City'
      };
    } else {
      verificationResult.errors.push('Missing required image URL');
    }

    logInfo(`Passport verification completed:`, {
      isValid: verificationResult.isValid,
      confidence: verificationResult.confidence
    });

    return verificationResult;

  } catch (error) {
    logError(`Error in passport document verification:`, error);
    throw error;
  }
}

/**
 * Create or update verified document for passport
 */
async function createVerifiedPassportDocument(userId, verificationResult, db) {
  try {
    logInfo(`Creating verified passport document for user ${userId}`);

    const verifiedDocRef = db.collection('verifiedDocument').doc(userId);
    
    // Check if document already exists
    const existingDoc = await verifiedDocRef.get();
    
    if (existingDoc.exists) {
      // Update existing document with passport data
      await verifiedDocRef.update({
        passport: verificationResult,
        updatedAt: new Date()
      });
      logInfo(`Updated verified document with passport data for user ${userId}`);
    } else {
      // Create new document with passport data
      await verifiedDocRef.set({
        userId,
        passport: verificationResult,
        createdAt: new Date()
      });
      logInfo(`Created new verified document with passport data for user ${userId}`);
    }

  } catch (error) {
    logError(`Error creating verified passport document for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId
    });
    throw error;
  }
}

// Export the main processing function
module.exports = {
  processPassportDocument,
  verifyPassport,
  createVerifiedPassportDocument
};
