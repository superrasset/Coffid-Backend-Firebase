const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const { processIDDocument } = require('./verifyIDDocument');
const { processPassportDocument } = require('./verifyPassportDocument');

/**
 * Firestore trigger that processes newly uploaded documents
 * Routes documents to appropriate verification handlers based on documentType only
 */
const processUploadedDocument = onDocumentCreated("uploadedDocument/{docId}", async (event) => {
  const docId = event.params.docId;
  const newData = event.data.data();

  logInfo(`Document created with ID: ${docId}`, {docId});

  try {
    if (!newData) {
      logError(`No data found for document ${docId}`);
      return;
    }

    // Extract basic document details
    const documentType = newData.documentType;
    const userId = newData.userId;

    logInfo(`Routing ${documentType} document for user ${userId}`, {
      documentType: documentType,
      documentTypeLength: documentType?.length,
      documentTypeType: typeof documentType
    });

    // Validate required fields
    if (!userId || !documentType) {
      logError(`Missing required fields for document ${docId}`, {
        userId: !!userId,
        documentType: !!documentType
      });
      return;
    }

    // Route to appropriate verification handler based on document type and side
    logInfo(`Comparing documentType: "${documentType}" with expected values`);
    
    // Normalize the document type by trimming whitespace
    const normalizedType = documentType?.trim();
    
    // Check if this is a face/video upload (no side field, has video-specific fields)
    if (newData.faceRecordingUrl || newData.videoUrl || (!newData.side && (newData.filename?.includes('video') || newData.filename?.includes('face')))) {
      logInfo(`Detected face/video upload for user ${newData.userId}`, {
        side: newData.side || 'none',
        hasFaceRecordingUrl: !!newData.faceRecordingUrl,
        hasVideoUrl: !!newData.videoUrl,
        filename: newData.filename,
        documentType: normalizedType
      });
      
      try {
        // For face recordings, assume video validation is successful
        // In a real implementation, you would process the video here
        const videoValidationResult = {
          isValid: true,
          confidence: 0.95,
          errors: []
        };
        
        // Prepare video data to store in verifiedDocument
        const videoData = {
          faceRecordingUrl: newData.faceRecordingUrl,
          videoUrl: newData.videoUrl,
          filename: newData.filename
        };
        
        // Route to appropriate video completion function based on document type
        if (normalizedType === 'Passport') {
          // Import and call passport video processing function
          const { completePassportWithVideo } = require('./verifyPassportDocument');
          
          const result = await completePassportWithVideo(newData.userId, normalizedType, videoValidationResult, videoData);
          logInfo(`Passport video validation completed for user ${newData.userId}`, {
            success: result.success,
            finalStatus: result.finalStatus,
            documentId: result.documentId,
            videoDataStored: {
              hasFaceRecordingUrl: !!videoData.faceRecordingUrl,
              hasVideoUrl: !!videoData.videoUrl,
              filename: videoData.filename
            }
          });
        } else {
          // Import and call ID document video processing function
          const { completeDocumentWithVideo } = require('./verifyIDDocument');
          
          const result = await completeDocumentWithVideo(newData.userId, normalizedType, videoValidationResult, videoData);
          logInfo(`ID document video validation completed for user ${newData.userId}`, {
            success: result.success,
            finalStatus: result.finalStatus,
            documentId: result.documentId,
            videoDataStored: {
              hasFaceRecordingUrl: !!videoData.faceRecordingUrl,
              hasVideoUrl: !!videoData.videoUrl,
              filename: videoData.filename
            }
          });
        }
        
      } catch (videoError) {
        logError(`Error processing video validation for user ${newData.userId}:`, {
          error: videoError.message,
          stack: videoError.stack
        });
      }
      
      return;
    }
    
    // Debug character codes to detect hidden characters
    const charCodes = documentType ? Array.from(documentType).map(char => char.charCodeAt(0)) : [];
    logInfo(`Document type character analysis:`, {
      documentType,
      length: documentType?.length,
      charCodes,
      trimmed: documentType?.trim(),
      trimmedLength: documentType?.trim()?.length
    });
    
    if (normalizedType === 'Traditional ID' || normalizedType === 'New ID') {
      logInfo(`Routing to ID processing for type: ${normalizedType}`);
      await processIDDocument(docId, newData);
    } else if (normalizedType === 'Passport') {
      logInfo(`Routing to passport processing for type: ${normalizedType}`);
      await processPassportDocument(docId, newData);
    } else {
      logError(`Unknown document type: ${documentType}`, {
        receivedType: documentType,
        normalizedType,
        typeOf: typeof documentType,
        length: documentType?.length,
        charCodes,
        expectedTypes: ['Traditional ID', 'New ID', 'Passport']
      });
      return;
    }

    logInfo(`Document processing completed successfully for ${docId}`);

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

// Export the trigger function
module.exports = {
  processUploadedDocument
};
