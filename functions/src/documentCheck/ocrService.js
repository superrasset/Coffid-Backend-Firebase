// OCR Service Abstraction Layer
// Designed for easy switching between OCR providers (Mindee -> Custom OCR)

const {info: logInfo, error: logError} = require("firebase-functions/logger");

/**
 * OCR Service Configuration
 * Change OCR_PROVIDER to switch between different implementations
 */
const OCR_CONFIG = {
  // Switch between: 'mindee', 'custom', 'mock'
  OCR_PROVIDER: process.env.OCR_PROVIDER || 'mindee',
  
  // Mindee configuration (temporary)
  MINDEE: {
    API_KEY: process.env.MINDEE_API_KEY,
    ENDPOINT: process.env.MINDEE_ENDPOINT || 'https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict',
    TIMEOUT: 30000
  },
  
  // Future custom OCR configuration
  CUSTOM: {
    API_ENDPOINT: process.env.CUSTOM_OCR_ENDPOINT,
    API_KEY: process.env.CUSTOM_OCR_API_KEY
  }
};

/**
 * Standard OCR Result Interface
 * All OCR providers must return data in this format
 */
class OCRResult {
  constructor({
    isValid = false,
    confidence = 0,
    extractedData = {},
    errors = [],
    rawResponse = null,
    provider = null,
    processedAt = new Date().toISOString()
  }) {
    this.isValid = isValid;
    this.confidence = confidence;
    this.extractedData = extractedData;
    this.errors = errors;
    this.rawResponse = rawResponse; // For debugging/future use
    this.provider = provider;
    this.processedAt = processedAt;
  }
}

/**
 * Main OCR Service Factory
 * Returns the appropriate OCR implementation based on configuration
 */
function createOCRService() {
  const provider = OCR_CONFIG.OCR_PROVIDER;
  
  switch (provider) {
    case 'mindee':
      return new MindeeOCRService();
    case 'custom':
      return new CustomOCRService();
    case 'mock':
    default:
      return new MockOCRService();
  }
}

/**
 * Base OCR Service Interface
 * All OCR implementations must extend this class
 */
class BaseOCRService {
  async processDocument(imageUrl, documentType, side) {
    throw new Error('processDocument method must be implemented by OCR service');
  }
  
  validateDocumentData(extractedData, documentType, side) {
    throw new Error('validateDocumentData method must be implemented by OCR service');
  }
}

/**
 * Mindee OCR Service (Temporary Implementation)
 * Will be replaced with custom OCR solution
 */
class MindeeOCRService extends BaseOCRService {
  constructor() {
    super();
    this.apiKey = OCR_CONFIG.MINDEE.API_KEY;
    this.endpoint = OCR_CONFIG.MINDEE.ENDPOINT;
    this.timeout = OCR_CONFIG.MINDEE.TIMEOUT;
  }

  async processDocument(imageUrl, documentType, side) {
    try {
      logInfo(`Processing document with Mindee OCR`, {
        documentType,
        side,
        provider: 'mindee'
      });

      if (!this.apiKey) {
        logError('Mindee API key not configured, falling back to mock data');
        // For development, return mock data when API key is not available
        const mockExtractedData = this.generateMockData(documentType, side);
        const isValid = this.validateDocumentData(mockExtractedData, documentType, side);
        
        return new OCRResult({
          isValid,
          confidence: 0.85,
          extractedData: mockExtractedData,
          errors: ['API key not configured - using mock data'],
          provider: 'mindee-mock',
          rawResponse: { mock: true }
        });
      }

      // Make actual Mindee API call
      const mindeeResponse = await this.callMindeeAPI(imageUrl);
      
      // Extract and validate data from Mindee response
      const extractedData = this.parseMindeeResponse(mindeeResponse, side);
      const isValid = this.validateDocumentData(extractedData, documentType, side);
      const confidence = this.calculateConfidence(mindeeResponse);

      return new OCRResult({
        isValid,
        confidence,
        extractedData,
        errors: isValid ? [] : this.getValidationErrors(extractedData, side),
        provider: 'mindee',
        rawResponse: mindeeResponse
      });

    } catch (error) {
      logError('Mindee OCR processing failed:', error);
      return new OCRResult({
        isValid: false,
        errors: [`OCR processing failed: ${error.message}`],
        provider: 'mindee'
      });
    }
  }

  async callMindeeAPI(imageUrl) {
    const axios = require('axios');
    const FormData = require('form-data');
    
    try {
      // Download image from URL
      const imageResponse = await axios.get(imageUrl, { 
        responseType: 'stream',
        timeout: this.timeout 
      });
      
      // Prepare form data for Mindee API
      const formData = new FormData();
      formData.append('document', imageResponse.data, {
        filename: 'document.jpg',
        contentType: 'image/jpeg'
      });

      // Call Mindee API
      const response = await axios.post(this.endpoint, formData, {
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          ...formData.getHeaders()
        },
        timeout: this.timeout
      });

      return response.data;

    } catch (error) {
      logError('Mindee API call failed:', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw new Error(`Mindee API call failed: ${error.message}`);
    }
  }

  parseMindeeResponse(mindeeResponse, side) {
    try {
      const prediction = mindeeResponse.document?.inference?.prediction;
      if (!prediction) {
        throw new Error('Invalid Mindee response structure');
      }

      // Parse detected document side from Mindee
      const detectedSide = prediction.document_side?.value;
      const detectedType = prediction.document_type?.value;

      // Extract data based on what Mindee detected
      const extractedData = {
        // Basic identification
        documentType: detectedType || null, // "NEW" or "OLD" from Mindee
        documentSide: detectedSide || null, // "RECTO", "VERSO", or "RECTO & VERSO"
        
        // Personal information (mainly from recto)
        surname: prediction.surname?.value || null,
        givenNames: prediction.given_names ? prediction.given_names.map(name => name.value) : [],
        alternativeName: prediction.alternate_name?.value || null,
        birthDate: prediction.birth_date?.value || null,
        birthPlace: prediction.birth_place?.value || null,
        gender: prediction.gender?.value || null,
        nationality: prediction.nationality?.value || null,
        
        // Document information
        documentNumber: prediction.document_number?.value || null,
        issueDate: prediction.issue_date?.value || null,
        expiryDate: prediction.expiry_date?.value || null,
        authority: prediction.authority?.value || null,
        cardAccessNumber: prediction.card_access_number?.value || null,
        
        // MRZ data (machine readable zone - mainly verso)
        mrz1: prediction.mrz1?.value || null,
        mrz2: prediction.mrz2?.value || null,
        mrz3: prediction.mrz3?.value || null,
        
        // Confidence scores for key fields
        confidenceScores: {
          surname: prediction.surname?.confidence || 0,
          givenNames: (prediction.given_names && prediction.given_names[0]) ? prediction.given_names[0].confidence : 0,
          birthDate: prediction.birth_date?.confidence || 0,
          documentNumber: prediction.document_number?.confidence || 0,
          overall: this.calculateConfidence(mindeeResponse)
        }
      };

      logInfo('Mindee data extracted successfully', {
        detectedType,
        detectedSide,
        hasName: !!(extractedData.surname && extractedData.givenNames.length > 0),
        hasBirthDate: !!extractedData.birthDate,
        hasDocumentNumber: !!extractedData.documentNumber
      });

      // Clean the extracted data to ensure no undefined values for Firestore
      return this.cleanExtractedData(extractedData);

    } catch (error) {
      logError('Failed to parse Mindee response:', error);
      throw new Error(`Mindee response parsing failed: ${error.message}`);
    }
  }

  /**
   * Clean extracted data to ensure no undefined values for Firestore
   */
  cleanExtractedData(data) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Ensure arrays don't contain undefined values
          cleaned[key] = value.filter(item => item !== undefined);
        } else if (value !== null && typeof value === 'object') {
          // Recursively clean nested objects
          cleaned[key] = this.cleanExtractedData(value);
        } else {
          cleaned[key] = value;
        }
      }
    }
    
    return cleaned;
  }

  calculateConfidence(mindeeResponse) {
    try {
      const prediction = mindeeResponse.document?.inference?.prediction;
      if (!prediction) return 0;

      // Calculate average confidence from key fields
      const keyFields = [
        prediction.surname?.confidence,
        (prediction.given_names && prediction.given_names[0]) ? prediction.given_names[0].confidence : null,
        prediction.birth_date?.confidence,
        prediction.document_number?.confidence,
        prediction.nationality?.confidence
      ].filter(conf => conf !== undefined && conf !== null && !isNaN(conf));

      return keyFields.length > 0 
        ? keyFields.reduce((sum, conf) => sum + conf, 0) / keyFields.length 
        : 0;

    } catch (error) {
      logError('Failed to calculate confidence:', error);
      return 0;
    }
  }

  validateDocumentData(extractedData, documentType, side) {
    // Different validation logic based on document side
    if (side === 'recto') {
      return this.validateRectoData(extractedData, side);
    } else if (side === 'verso') {
      return this.validateVersoData(extractedData, side);
    }
    
    return false;
  }

  validateRectoData(extractedData, side) {
    // Strict validation for recto - all required fields must be present
    // verifiedDocument will only be created if recto passes this validation
    const hasRequiredFields = !!(
      extractedData.birthDate &&
      extractedData.cardAccessNumber &&
      extractedData.givenNames && extractedData.givenNames.length > 0 &&
      extractedData.surname &&
      extractedData.mrz1 &&
      extractedData.mrz2
    );

    if (hasRequiredFields) {
      logInfo('Recto validation passed - all required fields present', {
        side,
        hasFields: {
          birthDate: !!extractedData.birthDate,
          cardAccessNumber: !!extractedData.cardAccessNumber,
          givenNames: extractedData.givenNames?.length > 0,
          surname: !!extractedData.surname,
          mrz1: !!extractedData.mrz1,
          mrz2: !!extractedData.mrz2
        },
        confidence: extractedData.confidenceScores?.overall
      });
      return true;
    }

    // Log what's missing for debugging
    const missingFields = [];
    if (!extractedData.birthDate) missingFields.push('birthDate');
    if (!extractedData.cardAccessNumber) missingFields.push('cardAccessNumber');
    if (!extractedData.givenNames || extractedData.givenNames.length === 0) missingFields.push('givenNames');
    if (!extractedData.surname) missingFields.push('surname');
    if (!extractedData.mrz1) missingFields.push('mrz1');
    if (!extractedData.mrz2) missingFields.push('mrz2');

    logInfo('Recto validation failed - missing required fields', {
      side,
      missingFields,
      confidence: extractedData.confidenceScores?.overall
    });

    return false;
  }

  validateVersoData(extractedData, side) {
    // Specific validation for verso - requires issueDate and expiryDate
    const hasRequiredFields = !!(
      extractedData.issueDate && 
      extractedData.expiryDate
    );

    if (hasRequiredFields) {
      logInfo('Verso validation passed - required fields present', {
        side,
        hasFields: {
          issueDate: !!extractedData.issueDate,
          expiryDate: !!extractedData.expiryDate
        },
        confidence: extractedData.confidenceScores?.overall
      });
      return true;
    }

    // Log what's missing for debugging
    const missingFields = [];
    if (!extractedData.issueDate) missingFields.push('issueDate');
    if (!extractedData.expiryDate) missingFields.push('expiryDate');

    logInfo('Verso validation failed - missing required fields', {
      side,
      missingFields,
      confidence: extractedData.confidenceScores?.overall
    });

    return false;
  }

  getValidationErrors(extractedData, side) {
    const errors = [];
    
    if (side === 'recto') {
      // Check for required fields for recto (strict validation)
      if (!extractedData.birthDate) errors.push('Missing birthDate');
      if (!extractedData.cardAccessNumber) errors.push('Missing cardAccessNumber');
      if (!extractedData.givenNames || extractedData.givenNames.length === 0) errors.push('Missing givenNames');
      if (!extractedData.surname) errors.push('Missing surname');
      if (!extractedData.mrz1) errors.push('Missing mrz1');
      if (!extractedData.mrz2) errors.push('Missing mrz2');
    } else if (side === 'verso') {
      // Check for required fields for verso (issueDate and expiryDate)
      if (!extractedData.issueDate) errors.push('Missing issueDate');
      if (!extractedData.expiryDate) errors.push('Missing expiryDate');
    }

    return errors;
  }

  generateMockData(documentType, side) {
    // Generate realistic mock data for development/testing
    // Include all required fields for validation
    if (side === 'recto') {
      return {
        documentType: 'NEW',
        documentSide: 'RECTO',
        surname: 'MARTIN',
        givenNames: ['Marie'],
        birthDate: '1990-07-13',
        birthPlace: 'PARIS',
        gender: 'F',
        nationality: 'FRA',
        documentNumber: 'D2H6862M2',
        issueDate: '2020-02-12',
        expiryDate: '2030-02-11',
        cardAccessNumber: '546497', // Required field
        mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<', // Required field
        mrz2: '9007138F3002119FRA<<<<<<<<<<<6', // Required field
        confidenceScores: {
          surname: 0.99,
          givenNames: 0.99,
          birthDate: 0.99,
          documentNumber: 0.99,
          overall: 0.99
        }
      };
    } else {
      return {
        documentType: 'NEW',
        documentSide: 'VERSO',
        surname: 'MARTIN',
        givenNames: ['Marie'],
        birthDate: '1990-07-13',
        authority: 'Préfecture de Paris',
        cardAccessNumber: '546497',
        issueDate: '2020-02-12', // Required field for verso validation
        expiryDate: '2030-02-11', // Required field for verso validation
        mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<',
        mrz2: '9007138F3002119FRA<<<<<<<<<<<6',
        mrz3: 'MARTIN<<MAELYS<GAELLE<MARIE<<<',
        confidenceScores: {
          overall: 0.99
        }
      };
    }
  }
}

/**
 * Future Custom OCR Service
 * Placeholder for your own OCR implementation
 */
class CustomOCRService extends BaseOCRService {
  constructor() {
    super();
    this.endpoint = OCR_CONFIG.CUSTOM.API_ENDPOINT;
    this.apiKey = OCR_CONFIG.CUSTOM.API_KEY;
  }

  async processDocument(imageUrl, documentType, side) {
    try {
      logInfo(`Processing document with Custom OCR`, {
        documentType,
        side,
        provider: 'custom'
      });

      // TODO: Implement your custom OCR logic here
      // This is where you'll integrate your own OCR solution
      
      throw new Error('Custom OCR service not yet implemented');

    } catch (error) {
      logError('Custom OCR processing failed:', error);
      return new OCRResult({
        isValid: false,
        errors: [`Custom OCR processing failed: ${error.message}`],
        provider: 'custom'
      });
    }
  }

  validateDocumentData(extractedData, documentType, side) {
    // Implement your custom validation logic
    return false;
  }
}

/**
 * Mock OCR Service for Testing
 * Simulates OCR processing without external API calls
 */
class MockOCRService extends BaseOCRService {
  async processDocument(imageUrl, documentType, side) {
    try {
      logInfo(`Processing document with Mock OCR`, {
        documentType,
        side,
        provider: 'mock'
      });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simple validation based on URL presence
      const isValid = !!(imageUrl && documentType && side);

      return new OCRResult({
        isValid,
        confidence: 0.9,
        extractedData: {
          mockField: 'mock value',
          documentType,
          side
        },
        errors: isValid ? [] : ['Mock validation failed'],
        provider: 'mock'
      });

    } catch (error) {
      logError('Mock OCR processing failed:', error);
      return new OCRResult({
        isValid: false,
        errors: [`Mock OCR processing failed: ${error.message}`],
        provider: 'mock'
      });
    }
  }

  validateDocumentData(extractedData, documentType, side) {
    return true; // Mock service always validates as true
  }
}

// Export the factory and classes
module.exports = {
  createOCRService,
  OCRResult,
  BaseOCRService,
  MindeeOCRService,
  CustomOCRService,
  MockOCRService,
  OCR_CONFIG
};
