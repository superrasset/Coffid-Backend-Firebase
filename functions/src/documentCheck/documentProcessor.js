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

    // Route to appropriate verification handler based on document type
    logInfo(`Comparing documentType: "${documentType}" with expected values`);
    
    // Debug character codes to detect hidden characters
    const charCodes = documentType ? Array.from(documentType).map(char => char.charCodeAt(0)) : [];
    logInfo(`Document type character analysis:`, {
      documentType,
      length: documentType?.length,
      charCodes,
      trimmed: documentType?.trim(),
      trimmedLength: documentType?.trim()?.length
    });
    
    // Normalize the document type by trimming whitespace
    const normalizedType = documentType?.trim();
    
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
