const {info: logInfo, error: logError} = require("firebase-functions/logger");
const mindee = require("mindee");
const { BaseOCRService } = require('./baseOCRService');
const { OCRResult } = require('./ocrResult');

/**
 * Mindee OCR Service Implementation
 * Uses official Mindee SDK for document processing
 */
class MindeeOCRService extends BaseOCRService {
  constructor(config) {
    super();
    this.apiKey = config.API_KEY;
    this.endpoints = config.ENDPOINTS;
    this.timeout = config.TIMEOUT;
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

      // Use official Mindee SDK for both passport and ID documents
      if (documentType?.toLowerCase() === 'passport') {
        return await this.processPassportWithSDK(imageUrl);
      } else if (this.isIDCardType(documentType)) {
        return await this.processIDCardWithSDK(imageUrl, side);
      }

      // Fallback to HTTP API for unknown document types
      const endpoint = this.getEndpointForDocumentType(documentType);
      const mindeeResponse = await this.callMindeeAPI(imageUrl, endpoint);
      
      // Extract and validate data from Mindee response
      const extractedData = this.parseMindeeResponse(mindeeResponse, side, documentType);
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

  async processPassportWithSDK(imageUrl) {
    try {
      logInfo('Processing passport with official Mindee SDK');

      // Initialize Mindee client
      const mindeeClient = new mindee.Client({ apiKey: this.apiKey });

      // Download image and create input source
      const axios = require('axios');
      const imageResponse = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: this.timeout 
      });
      
      const imageBuffer = Buffer.from(imageResponse.data);
      const inputSource = mindeeClient.docFromBuffer(imageBuffer, 'passport.jpg');

      // Parse the passport document
      const apiResponse = await mindeeClient.parse(mindee.product.PassportV1, inputSource);
      const passportData = apiResponse.document;

      logInfo('Mindee SDK passport processing completed', {
        hasDocument: !!passportData,
        confidence: passportData.inference?.prediction?.confidenceScore
      });

      // Extract data from SDK response
      const extractedData = this.extractPassportDataFromSDK(passportData);
      const isValid = this.validateDocumentData(extractedData, 'passport', 'recto');
      const confidence = this.calculateSDKConfidence(passportData);

      return new OCRResult({
        isValid,
        confidence,
        extractedData,
        errors: isValid ? [] : this.getValidationErrors(extractedData, 'recto'),
        provider: 'mindee-sdk',
        rawResponse: passportData
      });

    } catch (error) {
      logError('Mindee SDK passport processing failed:', error);
      return new OCRResult({
        isValid: false,
        errors: [`Passport SDK processing failed: ${error.message}`],
        provider: 'mindee-sdk'
      });
    }
  }

  /**
   * Check if the document type is an ID card type
   */
  isIDCardType(documentType) {
    const normalizedType = documentType?.toLowerCase().trim();
    return normalizedType === 'traditional id' || 
           normalizedType === 'new id' || 
           normalizedType === 'id' ||
           normalizedType === 'idcard' ||
           normalizedType === 'carte nationale d\'identité' ||
           normalizedType === 'cni';
  }

  async processIDCardWithSDK(imageUrl, side) {
    try {
      logInfo('Processing French ID card with official Mindee SDK');

      // Initialize Mindee client
      const mindeeClient = new mindee.Client({ apiKey: this.apiKey });

      // Download image and create input source
      const axios = require('axios');
      const imageResponse = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: this.timeout 
      });
      
      const imageBuffer = Buffer.from(imageResponse.data);
      const inputSource = mindeeClient.docFromBuffer(imageBuffer, 'id-card.jpg');

      // Parse the French ID card document using the French ID card API
      const apiResponse = await mindeeClient.parse(mindee.product.fr.IdCardV2, inputSource);
      const idCardData = apiResponse.document;

      logInfo('Mindee SDK French ID card processing completed', {
        hasDocument: !!idCardData,
        confidence: idCardData.inference?.prediction?.confidenceScore
      });

      // Extract data from SDK response
      const extractedData = this.extractIDCardDataFromSDK(idCardData);
      const isValid = this.validateDocumentData(extractedData, 'id', side);
      const confidence = this.calculateSDKConfidence(idCardData);

      return new OCRResult({
        isValid,
        confidence,
        extractedData,
        errors: isValid ? [] : this.getValidationErrors(extractedData, side),
        provider: 'mindee-sdk',
        rawResponse: idCardData
      });

    } catch (error) {
      logError('Mindee SDK French ID card processing failed:', error);
      return new OCRResult({
        isValid: false,
        errors: [`French ID card SDK processing failed: ${error.message}`],
        provider: 'mindee-sdk'
      });
    }
  }

  extractIDCardDataFromSDK(idCardDocument) {
    try {
      const prediction = idCardDocument.inference?.prediction;
      if (!prediction) {
        logError('No prediction data in ID card document');
        return {};
      }

      // Extract ID card data using SDK field accessors
      const extractedData = {
        // Basic identification
        documentType: 'ID',
        documentSide: prediction.documentSide?.value || null,
        
        // Personal information
        surname: prediction.surname?.value || null,
        givenNames: prediction.givenNames ? prediction.givenNames.map(name => name.value) : [],
        birthDate: prediction.birthDate?.value || null,
        birthPlace: prediction.birthPlace?.value || null,
        gender: prediction.gender?.value || null,
        nationality: prediction.nationality?.value || null,
        
        // Document information
        documentNumber: prediction.documentNumber?.value || null,
        issueDate: prediction.issueDate?.value || null,
        expiryDate: prediction.expiryDate?.value || null,
        authority: prediction.authority?.value || null,
        cardAccessNumber: prediction.cardAccessNumber?.value || null,
        
        // MRZ data (machine readable zone)
        mrz1: prediction.mrz1?.value || null,
        mrz2: prediction.mrz2?.value || null,
        mrz3: prediction.mrz3?.value || null,
        
        // Confidence scores for key fields
        confidenceScores: {
          surname: prediction.surname?.confidence || 0,
          givenNames: (prediction.givenNames && prediction.givenNames[0]) ? prediction.givenNames[0].confidence : 0,
          birthDate: prediction.birthDate?.confidence || 0,
          documentNumber: prediction.documentNumber?.confidence || 0,
          overall: this.calculateSDKConfidence(idCardDocument)
        }
      };

      logInfo('Mindee SDK French ID card data extracted successfully', {
        hasName: !!(extractedData.surname && extractedData.givenNames.length > 0),
        hasBirthDate: !!extractedData.birthDate,
        hasDocumentNumber: !!extractedData.documentNumber,
        documentSide: extractedData.documentSide
      });

      // Clean the extracted data to ensure no undefined values for Firestore
      return this.cleanExtractedData(extractedData);

    } catch (error) {
      logError('Failed to extract ID card data from SDK response:', error);
      return {};
    }
  }

  async callMindeeAPI(imageUrl, endpoint) {
    const axios = require('axios');
    const FormData = require('form-data');
    
    try {
      logInfo(`Calling Mindee API`, {
        endpoint,
        hasApiKey: !!this.apiKey
      });

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

      // Call Mindee API with the specified endpoint
      const response = await axios.post(endpoint, formData, {
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
        statusText: error.response?.statusText,
        endpoint
      });
      throw new Error(`Mindee API call failed: ${error.message}`);
    }
  }

  /**
   * Get the appropriate Mindee API endpoint for a document type
   */
  getEndpointForDocumentType(documentType) {
    const normalizedType = documentType?.toLowerCase().trim();
    
    if (normalizedType === 'passport') {
      return this.endpoints.PASSPORT;
    } else if (normalizedType === 'traditional id' || 
               normalizedType === 'new id' || 
               normalizedType === 'id' ||
               normalizedType === 'idcard') {
      return this.endpoints.IDCARD_FR;
    } else {
      // Default to ID card endpoint for unknown document types
      logInfo(`Unknown document type: ${documentType}, defaulting to ID card endpoint`);
      return this.endpoints.IDCARD_FR;
    }
  }

  parseMindeeResponse(mindeeResponse, side, documentType) {
    try {
      const prediction = mindeeResponse.document?.inference?.prediction;
      if (!prediction) {
        throw new Error('Invalid Mindee response structure');
      }

      // Determine if this is a passport or ID card response based on available fields
      const isPassport = documentType?.toLowerCase() === 'passport' || 
                        prediction.passport_number || 
                        prediction.country_of_issue ||
                        prediction.machine_readable_zone;

      if (isPassport) {
        return this.parsePassportResponse(prediction, mindeeResponse);
      } else {
        return this.parseIDCardResponse(prediction, mindeeResponse);
      }

    } catch (error) {
      logError('Failed to parse Mindee response:', error);
      throw new Error(`Mindee response parsing failed: ${error.message}`);
    }
  }

  parseIDCardResponse(prediction, mindeeResponse) {
    // Parse detected document side from Mindee
    const detectedSide = prediction.document_side?.value;
    const detectedType = prediction.document_type?.value;

    // Extract data based on what Mindee detected for ID cards
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

    logInfo('Mindee ID Card data extracted successfully', {
      detectedType,
      detectedSide,
      hasName: !!(extractedData.surname && extractedData.givenNames.length > 0),
      hasBirthDate: !!extractedData.birthDate,
      hasDocumentNumber: !!extractedData.documentNumber
    });

    // Clean the extracted data to ensure no undefined values for Firestore
    return this.cleanExtractedData(extractedData);
  }

  parsePassportResponse(prediction, mindeeResponse) {
    // Extract data for passport documents
    const extractedData = {
      // Basic identification - passport structure
      documentType: 'PASSPORT',
      
      // Personal information
      surname: prediction.surname?.value || null,
      givenNames: prediction.given_names ? prediction.given_names.map(name => name.value) : [],
      birthDate: prediction.birth_date?.value || null,
      birthPlace: prediction.birth_place?.value || null,
      gender: prediction.gender?.value || null,
      nationality: prediction.nationality?.value || null,
      
      // Passport-specific information
      passportNumber: prediction.passport_number?.value || prediction.document_number?.value || null,
      countryOfIssue: prediction.country_of_issue?.value || null,
      issueDate: prediction.issue_date?.value || null,
      expiryDate: prediction.expiry_date?.value || null,
      
      // MRZ data (Machine Readable Zone - at bottom of passport)
      mrz1: prediction.machine_readable_zone?.line1?.value || null,
      mrz2: prediction.machine_readable_zone?.line2?.value || null,
      
      // Confidence scores for key fields
      confidenceScores: {
        surname: prediction.surname?.confidence || 0,
        givenNames: (prediction.given_names && prediction.given_names[0]) ? prediction.given_names[0].confidence : 0,
        birthDate: prediction.birth_date?.confidence || 0,
        passportNumber: prediction.passport_number?.confidence || prediction.document_number?.confidence || 0,
        overall: this.calculateConfidence(mindeeResponse)
      }
    };

    logInfo('Mindee Passport data extracted successfully', {
      hasName: !!(extractedData.surname && extractedData.givenNames.length > 0),
      hasBirthDate: !!extractedData.birthDate,
      hasPassportNumber: !!extractedData.passportNumber,
      countryOfIssue: extractedData.countryOfIssue
    });

    // Clean the extracted data to ensure no undefined values for Firestore
    return this.cleanExtractedData(extractedData);
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

  calculateSDKConfidence(passportDocument) {
    try {
      const prediction = passportDocument.inference?.prediction;
      if (!prediction) return 0;

      // Extract confidence scores from SDK response
      const keyFields = [
        prediction.surname?.confidence,
        prediction.givenNames && prediction.givenNames.length > 0 ? prediction.givenNames[0].confidence : null,
        prediction.birthDate?.confidence,
        prediction.passportNumber?.confidence,
        prediction.nationality?.confidence
      ].filter(conf => conf !== undefined && conf !== null && !isNaN(conf));

      return keyFields.length > 0 
        ? keyFields.reduce((sum, conf) => sum + conf, 0) / keyFields.length 
        : 0;

    } catch (error) {
      logError('Failed to calculate SDK confidence:', error);
      return 0;
    }
  }

  extractPassportDataFromSDK(passportDocument) {
    try {
      const prediction = passportDocument.inference?.prediction;
      if (!prediction) {
        logError('No prediction data in passport document');
        return {};
      }

      // Extract passport data using SDK field accessors
      const extractedData = {
        // Basic identification
        passportNumber: prediction.passportNumber?.value || null,
        documentType: 'passport',
        
        // Personal information
        surname: prediction.surname?.value || null,
        givenNames: prediction.givenNames ? prediction.givenNames.map(name => name.value) : [],
        birthDate: prediction.birthDate?.value || null,
        birthPlace: prediction.birthPlace?.value || null,
        gender: prediction.gender?.value || null,
        nationality: prediction.nationality?.value || null,
        
        // Document information
        countryOfIssue: prediction.countryOfIssue?.value || null,
        issueDate: prediction.issueDate?.value || null,
        expiryDate: prediction.expiryDate?.value || null,
        
        // Machine readable zone
        mrz1: prediction.mrz1?.value || null,
        mrz2: prediction.mrz2?.value || null,
        
        // Confidence scores for key fields
        confidenceScores: {
          surname: prediction.surname?.confidence || 0,
          givenNames: (prediction.givenNames && prediction.givenNames[0]) ? prediction.givenNames[0].confidence : 0,
          birthDate: prediction.birthDate?.confidence || 0,
          passportNumber: prediction.passportNumber?.confidence || 0,
          overall: this.calculateSDKConfidence(passportDocument)
        }
      };

      logInfo('Mindee SDK Passport data extracted successfully', {
        hasName: !!(extractedData.surname && extractedData.givenNames.length > 0),
        hasBirthDate: !!extractedData.birthDate,
        hasPassportNumber: !!extractedData.passportNumber,
        countryOfIssue: extractedData.countryOfIssue
      });

      // Clean the extracted data to ensure no undefined values for Firestore
      return this.cleanExtractedData(extractedData);

    } catch (error) {
      logError('Failed to extract passport data from SDK response:', error);
      return {};
    }
  }

  validateDocumentData(extractedData, documentType, side) {
    // Different validation logic based on document type and side
    const normalizedType = documentType?.toLowerCase().trim();
    
    if (normalizedType === 'passport') {
      return this.validatePassportData(extractedData);
    } else {
      // For ID cards, validate based on side
      return this.validateIDCardData(extractedData, side);
    }
  }

  validatePassportData(extractedData) {
    // Passport validation: require at least surname and given names
    const hasRequiredPersonalInfo = !!(extractedData?.surname && extractedData?.givenNames?.length > 0);
    
    // Optional but recommended fields
    const hasBirthDate = !!extractedData?.birthDate;
    const hasPassportNumber = !!extractedData?.passportNumber;
    const hasNationality = !!extractedData?.nationality;
    
    // Consider valid if has personal info and at least one additional field
    const additionalFieldCount = [hasBirthDate, hasPassportNumber, hasNationality].filter(Boolean).length;
    
    return hasRequiredPersonalInfo && additionalFieldCount >= 1;
  }

  validateIDCardData(extractedData, side) {
    // ID card validation logic
    const normalizedSide = side?.toLowerCase().trim();
    
    if (normalizedSide === 'recto') {
      // Recto validation: require basic personal information
      return !!(extractedData?.surname && extractedData?.givenNames?.length > 0 && extractedData?.birthDate);
    } else if (normalizedSide === 'verso') {
      // Verso validation: require issue date and expiry date
      return !!(extractedData?.issueDate && extractedData?.expiryDate);
    } else {
      // For unknown side, require basic personal info
      return !!(extractedData?.surname && extractedData?.givenNames?.length > 0);
    }
  }

  getValidationErrors(extractedData, side) {
    const errors = [];
    
    if (!extractedData.surname) {
      errors.push('Surname not detected');
    }
    
    if (!extractedData.givenNames || extractedData.givenNames.length === 0) {
      errors.push('Given names not detected');
    }
    
    if (!extractedData.birthDate) {
      errors.push('Birth date not detected');
    }
    
    if (side === 'recto' && !extractedData.documentNumber) {
      errors.push('Document number not detected');
    }
    
    if (side === 'verso') {
      if (!extractedData.issueDate) {
        errors.push('Issue date not detected');
      }
      if (!extractedData.expiryDate) {
        errors.push('Expiry date not detected');
      }
    }
    
    return errors;
  }

  generateMockData(documentType, side) {
    // Reuse the mock data generation logic for development when API key is not available
    const { MockOCRService } = require('./mockOCRService');
    const mockService = new MockOCRService();
    return mockService.generateMockData(documentType, side);
  }
}

module.exports = { MindeeOCRService };
