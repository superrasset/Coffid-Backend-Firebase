const AWS = require('aws-sdk');
const {info: logInfo, error: logError} = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const fetch = require('node-fetch');

// Define secrets for AWS credentials
const awsAccessKeyId = defineSecret("AWS_ACCESS_KEY_ID");
const awsSecretAccessKey = defineSecret("AWS_SECRET_ACCESS_KEY");

/**
 * AWS Rekognition Service for face comparison
 * Compares two face images and returns similarity score
 */
class AWSRekognitionService {
  constructor() {
    this.region = 'eu-west-1'; // Ireland region (Rekognition not available in eu-west-3 Paris)
    this.similarityThreshold = 80; // Minimum similarity percentage to consider a match
    this.rekognition = null;
  }

  /**
   * Initialize AWS Rekognition client
   * Must be called with secret values in Cloud Function context
   */
  initialize(accessKeyId, secretAccessKey) {
    try {
      AWS.config.update({
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        region: this.region
      });

      this.rekognition = new AWS.Rekognition();
      
      logInfo('AWS Rekognition service initialized', {
        region: this.region,
        threshold: this.similarityThreshold
      });
    } catch (error) {
      logError('Failed to initialize AWS Rekognition service', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Download image from URL and return as Buffer
   */
  async downloadImage(imageUrl) {
    try {
      logInfo('Downloading image from URL', { imageUrl });
      
      // Handle Firebase Storage URLs
      if (imageUrl.startsWith('gs://')) {
        // Download directly from Firebase Storage (no signed URL needed)
        const admin = require('firebase-admin');
        const bucket = admin.storage().bucket();
        const filePath = imageUrl.replace(/^gs:\/\/[^\/]+\//, '');
        const file = bucket.file(filePath);
        
        logInfo('Downloading from Firebase Storage', {
          filePath,
          original: imageUrl
        });
        
        const [buffer] = await file.download();
        logInfo('Image downloaded successfully from Storage', {
          size: buffer.length,
          url: imageUrl
        });
        
        return buffer;
      }

      // Handle HTTPS URLs
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      logInfo('Image downloaded successfully', {
        size: buffer.length,
        url: imageUrl
      });

      return buffer;
    } catch (error) {
      logError('Failed to download image', {
        error: error.message,
        imageUrl
      });
      throw error;
    }
  }

  /**
   * Compare two face images using AWS Rekognition
   * @param {string} sourceImageUrl - URL or gs:// path of the source image (selfie)
   * @param {string} targetImageUrl - URL or gs:// path of the target image (ID/passport photo)
   * @returns {Promise<Object>} Comparison result with similarity score and match status
   */
  async compareFaces(sourceImageUrl, targetImageUrl) {
    try {
      if (!this.rekognition) {
        throw new Error('AWS Rekognition service not initialized. Call initialize() first.');
      }

      logInfo('Starting face comparison', {
        sourceImage: sourceImageUrl,
        targetImage: targetImageUrl,
        threshold: this.similarityThreshold
      });

      // Download both images
      const [sourceImageBuffer, targetImageBuffer] = await Promise.all([
        this.downloadImage(sourceImageUrl),
        this.downloadImage(targetImageUrl)
      ]);

      // Prepare parameters for Rekognition API
      const params = {
        SourceImage: {
          Bytes: sourceImageBuffer
        },
        TargetImage: {
          Bytes: targetImageBuffer
        },
        SimilarityThreshold: this.similarityThreshold
      };

      // Call AWS Rekognition CompareFaces API
      const result = await this.rekognition.compareFaces(params).promise();

      logInfo('Face comparison completed', {
        matchesFound: result.FaceMatches?.length || 0,
        unmatchedFaces: result.UnmatchedFaces?.length || 0
      });

      // Process results
      if (result.FaceMatches && result.FaceMatches.length > 0) {
        const match = result.FaceMatches[0];
        const similarity = match.Similarity;
        
        logInfo('Face match found', {
          similarity: similarity.toFixed(2),
          threshold: this.similarityThreshold,
          faceDetails: {
            boundingBox: match.Face?.BoundingBox,
            confidence: match.Face?.Confidence
          }
        });

        return {
          isMatch: true,
          similarity: parseFloat(similarity.toFixed(2)),
          confidence: match.Face?.Confidence || 0,
          details: {
            boundingBox: match.Face?.BoundingBox,
            landmarks: match.Face?.Landmarks
          },
          timestamp: new Date()
        };
      } else {
        logInfo('No face match found', {
          unmatchedFaces: result.UnmatchedFaces?.length || 0,
          threshold: this.similarityThreshold
        });

        return {
          isMatch: false,
          similarity: 0,
          confidence: 0,
          details: {
            unmatchedFaces: result.UnmatchedFaces?.length || 0,
            reason: 'No matching face found above threshold'
          },
          timestamp: new Date()
        };
      }

    } catch (error) {
      logError('Face comparison failed', {
        error: error.message,
        stack: error.stack,
        sourceImage: sourceImageUrl,
        targetImage: targetImageUrl
      });

      // Return error result instead of throwing
      const errorDetails = {
        errorMessage: error.message
      };
      
      // Only include errorCode if it exists (avoid undefined in Firestore)
      if (error.code !== undefined) {
        errorDetails.errorCode = error.code;
      }
      
      return {
        isMatch: false,
        similarity: 0,
        confidence: 0,
        error: error.message,
        details: errorDetails,
        timestamp: new Date()
      };
    }
  }

  /**
   * Set custom similarity threshold
   */
  setSimilarityThreshold(threshold) {
    if (threshold < 0 || threshold > 100) {
      throw new Error('Similarity threshold must be between 0 and 100');
    }
    this.similarityThreshold = threshold;
    logInfo('Similarity threshold updated', { threshold });
  }
}

// Export singleton instance and secrets
const rekognitionService = new AWSRekognitionService();

module.exports = {
  rekognitionService,
  awsAccessKeyId,
  awsSecretAccessKey
};
