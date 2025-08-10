/**
 * OCR Service V2 - Enhanced factory with support for both V1 and V2 Mindee APIs
 * Provides easy switching between different OCR providers and API versions
 */

const { info: logInfo, error: logError } = require("firebase-functions/logger");

// Import all available OCR services
const { MindeeOCRService } = require('./ocrProviders/mindeeOCRService');
const { MindeeOCRServiceV2 } = require('./ocrProviders/mindeeOCRServiceV2');
const { CustomOCRService } = require('./ocrProviders/customOCRService');
const { MockOCRService } = require('./ocrProviders/mockOCRService');

// Configuration for OCR service selection
const OCR_CONFIG = {
  // Primary provider selection: 'mindee-v1', 'mindee-v2', 'custom', 'mock'
  PRIMARY_PROVIDER: process.env.OCR_PROVIDER || 'mindee-v2', // Default to V2
  
  // Mindee API version selection: 'v1' or 'v2'
  MINDEE_VERSION: process.env.MINDEE_API_VERSION || 'v2', // Default to V2
  
  // Fallback provider if primary fails
  FALLBACK_PROVIDER: process.env.OCR_FALLBACK_PROVIDER || 'mock',
  
  // Enable automatic fallback on errors - DISABLED for V2 production use
  ENABLE_FALLBACK: process.env.OCR_ENABLE_FALLBACK === 'true' // Only enable if explicitly set to 'true'
};

/**
 * Create OCR service instance based on configuration
 * @param {Object} options - Optional configuration overrides
 * @returns {BaseOCRService} OCR service instance
 */
function createOCRService(options = {}) {
  const config = { ...OCR_CONFIG, ...options };
  
  try {
    const provider = config.PRIMARY_PROVIDER;
    
    logInfo('Creating OCR service instance', {
      provider: provider,
      mindeeVersion: config.MINDEE_VERSION,
      fallbackEnabled: config.ENABLE_FALLBACK,
      fallbackProvider: config.FALLBACK_PROVIDER
    });

    let ocrService;

    switch (provider) {
      case 'mindee-v1':
        ocrService = new MindeeOCRService();
        break;
        
      case 'mindee-v2':
        ocrService = new MindeeOCRServiceV2();
        break;
        
      case 'mindee':
        // Auto-select based on MINDEE_VERSION
        if (config.MINDEE_VERSION === 'v2') {
          ocrService = new MindeeOCRServiceV2();
        } else {
          ocrService = new MindeeOCRService();
        }
        break;
        
      case 'custom':
        ocrService = new CustomOCRService();
        break;
        
      case 'mock':
        ocrService = new MockOCRService();
        break;
        
      default:
        logError(`Unknown OCR provider: ${provider}. Falling back to mock service.`);
        ocrService = new MockOCRService();
    }

    // Wrap with fallback if enabled
    if (config.ENABLE_FALLBACK && provider !== config.FALLBACK_PROVIDER) {
      logInfo('Fallback enabled', {
        primaryProvider: provider,
        fallbackProvider: config.FALLBACK_PROVIDER
      });
      return new FallbackOCRService(ocrService, config.FALLBACK_PROVIDER);
    }

    logInfo('Fallback disabled - using direct OCR service', {
      provider: provider,
      fallbackEnabled: config.ENABLE_FALLBACK
    });

    return ocrService;

  } catch (error) {
    logError('Error creating OCR service:', {
      error: error.message,
      provider: config.PRIMARY_PROVIDER,
      fallbackProvider: config.FALLBACK_PROVIDER
    });
    
    // Return mock service as last resort
    return new MockOCRService();
  }
}

/**
 * Wrapper service that provides automatic fallback functionality
 */
class FallbackOCRService {
  constructor(primaryService, fallbackProviderName) {
    this.primaryService = primaryService;
    this.fallbackProviderName = fallbackProviderName;
    this.provider = `${primaryService.provider} (with ${fallbackProviderName} fallback)`;
  }

  async processDocument(imageUrl, documentType, side) {
    try {
      logInfo('Attempting primary OCR service', {
        primaryProvider: this.primaryService.provider,
        documentType,
        side
      });

      // Try primary service first
      const result = await this.primaryService.processDocument(imageUrl, documentType, side);
      
      // If primary service succeeds and returns valid result, use it
      if (result && result.isValid) {
        logInfo('Primary OCR service succeeded', {
          provider: this.primaryService.provider,
          confidence: result.confidence
        });
        return result;
      }

      // If primary service returns invalid result, log and try fallback
      logInfo('Primary OCR service returned invalid result, trying fallback', {
        primaryProvider: this.primaryService.provider,
        fallbackProvider: this.fallbackProviderName,
        primaryErrors: result ? result.errors : ['Unknown error']
      });

    } catch (error) {
      logError('Primary OCR service failed, trying fallback', {
        primaryProvider: this.primaryService.provider,
        fallbackProvider: this.fallbackProviderName,
        error: error.message
      });
    }

    // Try fallback service
    try {
      const fallbackService = this.createFallbackService();
      const fallbackResult = await fallbackService.processDocument(imageUrl, documentType, side);
      
      logInfo('Fallback OCR service completed', {
        fallbackProvider: this.fallbackProviderName,
        isValid: fallbackResult.isValid,
        confidence: fallbackResult.confidence
      });

      return fallbackResult;

    } catch (fallbackError) {
      logError('Fallback OCR service also failed', {
        fallbackProvider: this.fallbackProviderName,
        error: fallbackError.message
      });

      // Return mock result as final fallback
      const MockOCRService = require('./ocrProviders/mockOCRService');
      const mockService = new MockOCRService();
      return await mockService.processDocument(imageUrl, documentType, side);
    }
  }

  createFallbackService() {
    switch (this.fallbackProviderName) {
      case 'mindee-v1':
        return new MindeeOCRService();
      case 'mindee-v2':
        return new MindeeOCRServiceV2();
      case 'custom':
        return new CustomOCRService();
      case 'mock':
      default:
        return new MockOCRService();
    }
  }
}

/**
 * Get available OCR providers
 * @returns {Array} List of available providers
 */
function getAvailableProviders() {
  return [
    { name: 'mindee-v1', description: 'Mindee API V1 (Traditional)' },
    { name: 'mindee-v2', description: 'Mindee API V2 (New ClientV2)' },
    { name: 'custom', description: 'Custom OCR Implementation' },
    { name: 'mock', description: 'Mock OCR for Testing' }
  ];
}

/**
 * Get current OCR configuration
 * @returns {Object} Current configuration
 */
function getOCRConfig() {
  return {
    ...OCR_CONFIG,
    availableProviders: getAvailableProviders()
  };
}

/**
 * Create specific OCR service by provider name
 * @param {string} providerName - Name of the provider
 * @returns {BaseOCRService} OCR service instance
 */
function createSpecificOCRService(providerName) {
  switch (providerName) {
    case 'mindee-v1':
      return new MindeeOCRService();
    case 'mindee-v2':
      return new MindeeOCRServiceV2();
    case 'custom':
      return new CustomOCRService();
    case 'mock':
      return new MockOCRService();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}

module.exports = {
  createOCRService,
  createSpecificOCRService,
  getAvailableProviders,
  getOCRConfig,
  FallbackOCRService
};
