// OCR Service Abstraction Layer
// Designed for easy switching between OCR providers (Mindee -> Custom OCR)

const { MindeeOCRService, CustomOCRService, MockOCRService } = require('./ocrProviders');
const { OCRResult } = require('./ocrProviders/ocrResult');

/**
 * OCR Service Configuration
 * Change OCR_PROVIDER to switch between different implementations
 */
const OCR_CONFIG = {
  // Switch between: 'mindee', 'custom', 'mock'
  OCR_PROVIDER: process.env.OCR_PROVIDER || 'mindee',
  
  // Mindee configuration with multiple endpoints for different document types
  MINDEE: {
    API_KEY: process.env.MINDEE_API_KEY,
    ENDPOINTS: {
      // French ID Card endpoint (Traditional ID, New ID, Carte nationale d'identité)
      IDCARD_FR: process.env.MINDEE_IDCARD_ENDPOINT || 'https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict',
      // International Passport endpoint
      PASSPORT: process.env.MINDEE_PASSPORT_ENDPOINT || 'https://api.mindee.net/v1/products/mindee/passport/v1/predict'
    },
    TIMEOUT: 30000
  },
  
  // Future custom OCR configuration
  CUSTOM: {
    API_ENDPOINT: process.env.CUSTOM_OCR_ENDPOINT,
    API_KEY: process.env.CUSTOM_OCR_API_KEY
  }
};

/**
 * Main OCR Service Factory
 * Returns the appropriate OCR implementation based on configuration
 */
function createOCRService() {
  const provider = OCR_CONFIG.OCR_PROVIDER;
  
  switch (provider) {
    case 'mindee':
      return new MindeeOCRService(OCR_CONFIG.MINDEE);
    case 'custom':
      return new CustomOCRService(OCR_CONFIG.CUSTOM);
    case 'mock':
    default:
      return new MockOCRService();
  }
}

// Export the factory and result class
module.exports = {
  createOCRService,
  OCRResult,
  OCR_CONFIG
};
