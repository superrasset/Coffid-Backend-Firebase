// Video validation endpoint for completing document verification

const {onRequest} = require("firebase-functions/v2/https");
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const { completeDocumentWithVideo } = require('../documentCheck/verifyIDDocument');

/**
 * HTTP endpoint to handle video validation and complete document verification
 * Expects: POST request with JSON body containing userId, documentType, and video validation result
 */
const processVideoValidation = onRequest({
  cors: true,
  region: 'us-central1'
}, async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed. Use POST.',
        allowedMethods: ['POST']
      });
    }

    // Extract data from request body
    const { userId, documentType, videoValidationResult, videoData } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: userId'
      });
    }

    if (!documentType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: documentType'
      });
    }

    if (!videoValidationResult) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: videoValidationResult'
      });
    }

    // Validate videoValidationResult structure
    if (typeof videoValidationResult.isValid !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'videoValidationResult.isValid must be a boolean'
      });
    }

    logInfo('Processing video validation request', {
      userId,
      documentType,
      videoValid: videoValidationResult.isValid,
      confidence: videoValidationResult.confidence || 0,
      hasVideoData: !!videoData,
      videoDataKeys: videoData ? Object.keys(videoData) : []
    });

    // Call the completeDocumentWithVideo function
    const result = await completeDocumentWithVideo(userId, documentType, videoValidationResult, videoData || {});

    logInfo('Video validation processing completed', {
      userId,
      documentType,
      result: result
    });

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Video validation processed successfully',
      data: result
    });

  } catch (error) {
    logError('Error processing video validation:', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body
    });

    // Return error response
    return res.status(500).json({
      success: false,
      error: 'Internal server error processing video validation',
      details: error.message
    });
  }
});

module.exports = processVideoValidation;
