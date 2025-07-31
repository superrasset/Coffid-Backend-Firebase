// Handles all logic for Traditional ID and New ID verification (recto/verso)

const {getFirestore} = require("firebase-admin/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const {createOCRService} = require("./ocrService");

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
 * Verifies a single side of Traditional ID or New ID using configurable OCR service
 */
async function verifyIDSide(imageUrl, side, documentType, docId, filename) {
  try {
    logInfo(`Verifying ${documentType} ${side} side with OCR...`);
    
    // Initialize OCR service (can be Mindee, Custom, or Mock based on config)
    const ocrService = createOCRService();
    
    // Process document with OCR
    const ocrResult = await ocrService.processDocument(imageUrl, documentType, side);
    
    // Build verification result with OCR data
    const verificationResult = {
      isValid: ocrResult.isValid,
      processedAt: ocrResult.processedAt,
      side: side,
      uploadedDocumentId: docId,
      filename: filename || null,
      imageUrl: imageUrl,
      
      // Store extracted data directly in verification result
      extractedData: ocrResult.extractedData,
      
      // OCR-specific metadata (for debugging/future use)
      ocrData: {
        provider: ocrResult.provider,
        confidence: ocrResult.confidence,
        errors: ocrResult.errors
      }
    };

    // Log all extracted data for debugging
    logInfo(`${documentType} ${side} OCR data extracted:`, {
      uploadedDocumentId: docId,
      ocrProvider: ocrResult.provider,
      confidence: ocrResult.confidence,
      isValid: verificationResult.isValid,
      extractedData: ocrResult.extractedData // Full extracted data in logs
    });

    logInfo(`${documentType} ${side} verification completed:`, {
      isValid: verificationResult.isValid,
      uploadedDocumentId: docId,
      ocrProvider: ocrResult.provider,
      confidence: ocrResult.confidence
    });

    return verificationResult;

  } catch (error) {
    logError(`Error in ${documentType} ${side} verification:`, {
      error: error.message,
      stack: error.stack,
      imageUrl,
      side,
      documentType
    });
    
    // Return failed verification result
    return {
      isValid: false,
      processedAt: new Date().toISOString(),
      side: side,
      uploadedDocumentId: docId,
      filename: filename || null,
      imageUrl: imageUrl,
      ocrData: {
        provider: 'unknown',
        confidence: 0,
        extractedData: {},
        errors: [`Verification failed: ${error.message}`]
      }
    };
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
      // For recto: only create verifiedDocument if validation passes
      if (!verificationResult.isValid) {
        logInfo(`Recto validation failed - verifiedDocument will NOT be created for user ${userId}`, {
          extractedData: verificationResult.extractedData,
          errors: verificationResult.ocrData?.errors
        });
        
        // Return status indicating no verifiedDocument was created
        return {
          isComplete: false,
          overallValid: false,
          documentId: null,
          reason: 'Recto validation failed - required fields missing'
        };
      }

      // Extract document-level fields from recto data
      const documentLevelFields = extractDocumentLevelFields(verificationResult.extractedData);

      // Recto validation passed - create new document with auto-generated ID
      await verifiedDocRef.set({
        userId,
        documentType: documentType, // Store document type at document level
        status: 'partial 1/3', // Step 1: Recto uploaded and validated
        // Document-level aggregated fields (populated from recto, updated with verso)
        ...documentLevelFields,
        uploadedDocuments: {
          recto: {
            ...verificationResult,
            extractedData: verificationResult.extractedData // Store extracted data here
          },
          rectoProcessedAt: new Date(),
          overallValid: false // Not complete yet, waiting for verso
        },
        createdAt: new Date()
      });
      logInfo(`Created new verified document with auto-generated ID ${verifiedDocRef.id} for user ${userId}`, {
        extractedData: verificationResult.extractedData, // Log extracted data
        status: 'partial 1/3'
      });
      
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
          // Both sides now available - verso uploaded and validated
          const overallValid = rectoResult.isValid && verificationResult.isValid;
          
          // Extract additional document-level fields from verso data
          const updateFields = {
            status: 'partial 2/3', // Step 2: Both recto and verso uploaded
            'uploadedDocuments.verso': {
              ...verificationResult,
              extractedData: verificationResult.extractedData // Store extracted data here
            },
            'uploadedDocuments.versoProcessedAt': new Date(),
            'uploadedDocuments.overallValid': overallValid,
            'uploadedDocuments.bothSidesCompletedAt': new Date(),
            updatedAt: new Date(),
            // Add any missing document-level fields from verso
            ...createDocumentLevelUpdateFields(verificationResult.extractedData, existingData)
          };

          await verifiedDocRef.update(updateFields);
          
          logInfo(`Both sides completed for document ${verifiedDocRef.id} - user ${userId}`, {
            rectoValid: rectoResult.isValid,
            versoValid: verificationResult.isValid,
            overallValid: overallValid,
            status: 'partial 2/3',
            rectoExtractedData: rectoResult.extractedData,
            versoExtractedData: verificationResult.extractedData
          });

          // Return completion status for both sides (waiting for video)
          return {
            isComplete: false, // Still waiting for video validation
            overallValid: overallValid,
            documentId: verifiedDocRef.id,
            bothSidesComplete: true
          };
        } else {
          // Verso processed before recto (unusual case)
          // Only update if verso validation passes (lenient validation)
          if (!verificationResult.isValid) {
            logInfo(`Verso validation failed - will not update existing document for user ${userId}`, {
              versoExtractedData: verificationResult.extractedData,
              errors: verificationResult.ocrData?.errors
            });
            
            // Return status indicating no update was made
            return {
              isComplete: false,
              overallValid: false,
              documentId: verifiedDocRef.id,
              reason: 'Verso validation failed'
            };
          }

          // Verso validation passed - update document
          const updateFields = {
            status: 'partial 1/3', // Still waiting for recto to complete
            'uploadedDocuments.verso': {
              ...verificationResult,
              extractedData: verificationResult.extractedData
            },
            'uploadedDocuments.versoProcessedAt': new Date(),
            'uploadedDocuments.overallValid': false,
            updatedAt: new Date(),
            // Add any document-level fields from verso data
            ...createDocumentLevelUpdateFields(verificationResult.extractedData, existingData)
          };

          await verifiedDocRef.update(updateFields);
          logInfo(`Updated verified document ${verifiedDocRef.id} with verso data (recto pending) for user ${userId}`, {
            versoExtractedData: verificationResult.extractedData,
            status: 'partial 1/3'
          });
          
          // Return status for verso without recto (not complete)
          return {
            isComplete: false,
            overallValid: false,
            documentId: verifiedDocRef.id
          };
        }
      } else {
        // Verso processed but no partial document exists
        // This means either:
        // 1. Recto was rejected (didn't create verifiedDocument)
        // 2. Verso is being processed before recto
        
        if (!verificationResult.isValid) {
          logInfo(`Verso validation failed and no existing verifiedDocument found for user ${userId}`, {
            versoExtractedData: verificationResult.extractedData,
            reason: 'No verifiedDocument to update (likely recto was rejected)'
          });
          
          // Return status indicating no document created/updated
          return {
            isComplete: false,
            overallValid: false,
            documentId: null,
            reason: 'Verso failed and no existing verifiedDocument found'
          };
        }

        // Verso is valid but no existing document - this could be verso-first scenario
        // Create new document with verso data (waiting for recto)
        const documentLevelFields = extractDocumentLevelFields(verificationResult.extractedData);

        await verifiedDocRef.set({
          userId,
          documentType: documentType, // Store document type at document level
          status: 'partial 1/3', // Step 1: One side uploaded (verso first, waiting for recto)
          // Document-level aggregated fields (populated from verso, will be updated with recto)
          ...documentLevelFields,
          uploadedDocuments: {
            verso: {
              ...verificationResult,
              extractedData: verificationResult.extractedData
            },
            versoProcessedAt: new Date(),
            overallValid: false // Not complete yet, waiting for recto
          },
          createdAt: new Date()
        });
        logInfo(`Created new verified document with auto-generated ID ${verifiedDocRef.id} (verso first) for user ${userId}`, {
          versoExtractedData: verificationResult.extractedData,
          status: 'partial 1/3'
        });
        
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

/**
 * Complete document verification after video validation
 * Updates status from "partial 2/3" to "completed"
 */
async function completeDocumentWithVideo(userId, documentType, videoValidationResult, videoData = {}) {
  try {
    const db = getFirestore();
    
    logInfo(`Starting video validation completion for user ${userId}`, {
      documentType,
      videoValid: videoValidationResult.isValid,
      hasVideoData: Object.keys(videoData).length > 0
    });

    // Find the document with status "partial 2/3" for this user and document type
    const querySnapshot = await db.collection('verifiedDocument')
      .where('userId', '==', userId)
      .where('documentType', '==', documentType)
      .where('status', '==', 'partial 2/3')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      throw new Error(`No document found with status "partial 2/3" for user ${userId} and type ${documentType}`);
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
        const userUpdateResult = await updateUserDataFromVerifiedDocument(userId, existingData, db);
        logInfo(`User data update completed for user ${userId}`, {
          documentId: verifiedDoc.id,
          updatedFields: userUpdateResult.updatedFields,
          success: userUpdateResult.success
        });
      } catch (userUpdateError) {
        // Log error but don't fail the entire operation
        logError(`Failed to update user data for user ${userId}, but document processing completed:`, {
          error: userUpdateError.message,
          documentId: verifiedDoc.id,
          finalStatus: finalStatus
        });
      }
    }

    logInfo(`Document verification completed with video validation for user ${userId}`, {
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
    logError(`Error completing document with video validation for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId,
      documentType
    });
    throw error;
  }
}

/**
 * Helper function to extract document-level fields from OCR extracted data
 * @param {Object} extractedData - The extracted data from OCR
 * @returns {Object} - Document-level fields for aggregation
 */
function extractDocumentLevelFields(extractedData) {
  if (!extractedData) return {};
  
  return {
    cardNumber: extractedData.cardAccessNumber || null,
    firstname: Array.isArray(extractedData.givenNames) && extractedData.givenNames.length > 0 
      ? extractedData.givenNames[0] : null,
    lastname: extractedData.surname || null,
    birthDate: extractedData.birthDate || null,
    issueDate: extractedData.issueDate || null,
    expiryDate: extractedData.expiryDate || null,
    MRZ1: extractedData.mrz1 || null,
    MRZ2: extractedData.mrz2 || null
  };
}

/**
 * Helper function to create update fields for document-level data
 * Only includes fields that are not null and not already present in existing data
 * @param {Object} extractedData - The extracted data from OCR 
 * @param {Object} existingData - The existing document data
 * @returns {Object} - Update fields object for Firestore
 */
function createDocumentLevelUpdateFields(extractedData, existingData = {}) {
  const newFields = extractDocumentLevelFields(extractedData);
  const updateFields = {};
  
  // Only update fields that have values and are missing in existing data
  Object.keys(newFields).forEach(key => {
    if (newFields[key] && !existingData[key]) {
      updateFields[key] = newFields[key];
    }
  });
  
  return updateFields;
}

/**
 * Update user data in users collection with verified document information
 * Updates firstname, lastname, and birthDate as arrays with value, origin, and updatedAt
 * @param {string} userId - The user ID
 * @param {Object} verifiedDocData - The verified document data
 * @param {Object} db - Firestore database instance
 */
async function updateUserDataFromVerifiedDocument(userId, verifiedDocData, db) {
  try {
    logInfo(`Updating user data for user ${userId} from verified document`, {
      documentType: verifiedDocData.documentType,
      firstname: verifiedDocData.firstname,
      lastname: verifiedDocData.lastname,
      birthDate: verifiedDocData.birthDate
    });

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    const currentTime = new Date();
    const origin = verifiedDocData.documentType; // e.g., "Traditional ID", "New ID"
    
    // Prepare the update data structure
    const updateData = {};
    
    // Helper function to create field entry
    const createFieldEntry = (value) => ({
      value: value,
      origin: origin,
      updatedAt: currentTime
    });
    
    // Update firstname if available
    if (verifiedDocData.firstname) {
      const existingUser = userDoc.exists ? userDoc.data() : {};
      const existingFirstnames = existingUser.firstname || [];
      
      // Add new firstname entry
      const newFirstnameEntry = createFieldEntry(verifiedDocData.firstname);
      updateData.firstname = [...existingFirstnames, newFirstnameEntry];
    }
    
    // Update lastname if available
    if (verifiedDocData.lastname) {
      const existingUser = userDoc.exists ? userDoc.data() : {};
      const existingLastnames = existingUser.lastname || [];
      
      // Add new lastname entry
      const newLastnameEntry = createFieldEntry(verifiedDocData.lastname);
      updateData.lastname = [...existingLastnames, newLastnameEntry];
    }
    
    // Update birthDate if available
    if (verifiedDocData.birthDate) {
      const existingUser = userDoc.exists ? userDoc.data() : {};
      const existingBirthDates = existingUser.birthDate || [];
      
      // Add new birthDate entry
      const newBirthDateEntry = createFieldEntry(verifiedDocData.birthDate);
      updateData.birthDate = [...existingBirthDates, newBirthDateEntry];
    }
    
    // Only update if we have data to update
    if (Object.keys(updateData).length > 0) {
      // Add metadata
      updateData.updatedAt = currentTime;
      if (!userDoc.exists) {
        updateData.createdAt = currentTime;
      }
      
      // Update or create user document
      await userRef.set(updateData, { merge: true });
      
      logInfo(`Successfully updated user data for user ${userId}`, {
        updatedFields: Object.keys(updateData),
        origin: origin,
        firstname: verifiedDocData.firstname,
        lastname: verifiedDocData.lastname,
        birthDate: verifiedDocData.birthDate
      });
      
      return {
        success: true,
        updatedFields: Object.keys(updateData).filter(key => key !== 'updatedAt' && key !== 'createdAt')
      };
    } else {
      logInfo(`No user data to update for user ${userId} - all required fields missing`, {
        documentType: verifiedDocData.documentType
      });
      
      return {
        success: true,
        updatedFields: [],
        reason: 'No valid data fields to update'
      };
    }
    
  } catch (error) {
    logError(`Error updating user data for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      userId,
      documentType: verifiedDocData.documentType
    });
    throw error;
  }
}

// Export the main processing function
module.exports = {
  processIDDocument,
  verifyIDSide,
  updateVerifiedDocumentForID,
  completeDocumentWithVideo,
  updateUserDataFromVerifiedDocument
};
