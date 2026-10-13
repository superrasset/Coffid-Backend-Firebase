const {getFirestore} = require("firebase-admin/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const { createOCRService } = require('./ocrServiceV2');

/**
 * Process passport document verification workflow
 * Step 1: Document verification (creates verifiedDocument with "partial 1/2" status)
 * Step 2: Selfie face matching (completes to "complete" status)
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

    return { documentId: verifiedDocRef.id };

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
 * Get passport number length based on nationality
 * @param {string} nationality - The nationality from the passport
 * @returns {number} - Number of characters to extract from passport number
 */
function getPassportNumberLength(nationality) {
  if (!nationality) return 9; // Default length
  
  const nationalityLower = nationality.toLowerCase();
  
  // Mapping of nationalities to passport number lengths
  const lengthMapping = {
    'française': 9,
    'francaise': 9,
    'french': 9,
    'france': 9,
    'belge': 8,
    'belgian': 8,
    'belgium': 8,
    'belgique': 8,
    'suisse': 8,
    'swiss': 8,
    'switzerland': 8,
    'allemande': 9,
    'german': 9,
    'germany': 9,
    'allemagne': 9,
    'italienne': 9,
    'italian': 9,
    'italy': 9,
    'italie': 9,
    'espagnole': 9,
    'spanish': 9,
    'spain': 9,
    'espagne': 9,
    'britannique': 9,
    'british': 9,
    'royaume-uni': 9,
    'united kingdom': 9,
    'uk': 9,
    'américaine': 9,
    'american': 9,
    'etats-unis': 9,
    'united states': 9,
    'usa': 9,
    'canadienne': 8,
    'canadian': 8,
    'canada': 8,
    'australienne': 8,
    'australian': 8,
    'australia': 8,
    'australie': 8,
    'chinoise': 9,
    'chinese': 9,
    'china': 9,
    'chine': 9,
    'japonaise': 9,
    'japanese': 9,
    'japan': 9,
    'japon': 9
  };
  
  return lengthMapping[nationalityLower] || 9; // Default to 9 if nationality not found
}

/**
 * Extract document-level fields from passport data
 * Similar to ID document extraction
 */
function extractDocumentLevelFields(extractedData) {
  const documentFields = {};
  
  // Map passport fields to document-level fields
  if (extractedData?.passportNumber) {
    // Determine how many characters to take based on nationality
    const nationality = extractedData?.nationality;
    const passportLength = getPassportNumberLength(nationality);
    documentFields.passportNumber = extractedData.passportNumber.substring(0, passportLength);
    
    logInfo(`Passport number truncated based on nationality:`, {
      nationality: nationality,
      originalLength: extractedData.passportNumber.length,
      truncatedLength: passportLength,
      originalNumber: extractedData.passportNumber,
      truncatedNumber: documentFields.passportNumber
    });
  }
  
  if (extractedData?.surname) {
    documentFields.lastname = extractedData.surname;
  }
  
  if (extractedData?.givenNames && extractedData.givenNames.length > 0) {
    // Take only the first part of the first given name (before space or comma)
    const firstGivenName = extractedData.givenNames[0];
    documentFields.firstname = firstGivenName.split(/[\s,]+/)[0];
  }
  
  if (extractedData?.birthDate) {
    documentFields.birthDate = extractedData.birthDate;
  }
  
  if (extractedData?.birthPlace) {
    documentFields.birthPlace = extractedData.birthPlace;
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

// Export the main processing functions
module.exports = {
  processPassportDocument,
  verifyPassport,
  createVerifiedPassportDocument,
  extractDocumentLevelFields,
  getPassportNumberLength
};
