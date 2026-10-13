const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const { processLLMIDDocument, processLLMPassportDocument } = require('./processLLMDocument');
const { processSelfieDocument } = require('../faceMatching/verifySelfieDocument');
const { awsAccessKeyId, awsSecretAccessKey } = require('../faceMatching/awsRekognitionService');

// Mindee secret kept for reference — Mindee handlers are no longer routed but preserved in:
// verifyIDDocument.js / verifyPassportDocument.js / ocrServiceV2.js
const mindeeApiKey = defineSecret("MINDEE_API_KEY");

/**
 * Firestore trigger that processes newly uploaded documents
 * Routes documents to appropriate verification handlers based on documentType only
 * Uses Gemini (Vertex AI) via Genkit for document OCR, AWS Rekognition for selfie face matching
 * Requires secrets: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 */
const processUploadedDocument = onDocumentCreated(
  {
    document: "uploadedDocument/{docId}",
    secrets: [awsAccessKeyId, awsSecretAccessKey],
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (event) => {
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
    
    // Debug character codes to detect hidden characters
    const charCodes = documentType ? Array.from(documentType).map(char => char.charCodeAt(0)) : [];
    logInfo(`Document type character analysis:`, {
      documentType,
      length: documentType?.length,
      charCodes,
      trimmed: documentType?.trim(),
      trimmedLength: documentType?.trim()?.length
    });
    
    // Route to appropriate handler based on document type
    if (normalizedType === 'selfie') {
      logInfo(`Routing to selfie face matching for user: ${userId}`);
      await processSelfieDocument(docId, newData);
    } else if (normalizedType === 'ID' || normalizedType === 'Traditional ID' || normalizedType === 'New ID') {
      logInfo(`Routing to LLM ID processing for type: ${normalizedType}`);
      await processLLMIDDocument(docId, newData);
    } else if (normalizedType === 'Passport') {
      logInfo(`Routing to LLM Passport processing`);
      await processLLMPassportDocument(docId, newData);
    } else {
      logError(`Unknown document type: ${documentType}`, {
        receivedType: documentType,
        normalizedType,
        typeOf: typeof documentType,
        length: documentType?.length,
        charCodes,
        expectedTypes: ['ID', 'Traditional ID', 'New ID', 'Passport', 'selfie']
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
