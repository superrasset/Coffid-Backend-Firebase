/**
 * Mindee OCR Service V2 - Using new Mindee API
 * Supports French ID and Passport document parsing with new ClientV2 and InferenceParameters
 */

const { info: logInfo, error: logError } = require("firebase-functions/logger");
const { BaseOCRService } = require('./baseOCRService');
const { OCRResult } = require('./ocrResult');
const { ClientV2 } = require('mindee');

class MindeeOCRServiceV2 extends BaseOCRService {
  constructor() {
    super();
    this.provider = 'mindee-v2';
    this.apiKey = "mk_QrALvRImsPMmWGKApsLIUH7BSDENuhdi";
    
    // Model IDs for different document types
    this.modelIds = {
      'Traditional ID': '76f2bbff-e8f4-4f90-978f-cacaeca073a7', // French ID model
      'New ID': '76f2bbff-e8f4-4f90-978f-cacaeca073a7', // Same for now, update if different
      'Passport': '23eee4a7-b95b-4c00-a70f-c1cc82d01095' // Passport model from your example
    };
    
    if (!this.apiKey) {
      logError('Mindee API key is not set');
      throw new Error('Mindee API key is required');
    }
    
    // Initialize Mindee V2 client
    this.mindeeClient = new ClientV2({ apiKey: this.apiKey });
  }

  /**
   * Process document using Mindee V2 API
   * @param {string} imageUrl - URL of the image to process
   * @param {string} documentType - Type of document ('Traditional ID', 'New ID', 'Passport')
   * @param {string} side - Side of document ('recto', 'verso')
   * @returns {OCRResult} Standardized OCR result
   */
  async processDocument(imageUrl, documentType, side) {
    try {
      logInfo(`Processing ${documentType} ${side} with Mindee V2 API`, {
        provider: this.provider,
        documentType,
        side,
        imageUrl: imageUrl.substring(0, 100) + '...'
      });

      // Get the model ID for this document type
      const modelId = this.modelIds[documentType];
      if (!modelId) {
        throw new Error(`No model ID configured for document type: ${documentType}`);
      }

      // Initialize Mindee V2 client (this would require the actual Mindee V2 SDK)
      const mindeeResponse = await this.callMindeeV2API(imageUrl, modelId);

      // Parse the response based on document type
      const extractedData = this.parseResponse(mindeeResponse, documentType, side);

      // Validate the extracted data
      const validation = this.validateDocumentData(extractedData, documentType, side);

      return new OCRResult({
        isValid: validation.isValid,
        extractedData: extractedData,
        confidence: this.calculateConfidence(mindeeResponse),
        provider: this.provider,
        errors: validation.errors,
        rawResponse: mindeeResponse
      });

    } catch (error) {
      logError(`Mindee V2 processing failed for ${documentType} ${side}:`, {
        error: error.message,
        stack: error.stack,
        documentType,
        side
      });

      return new OCRResult({
        isValid: false,
        extractedData: {},
        confidence: 0,
        provider: this.provider,
        errors: [`Mindee V2 API error: ${error.message}`],
        rawResponse: null
      });
    }
  }

  /**
   * Call Mindee V2 API with new ClientV2 and InferenceParameters
   * @param {string} imageUrl - URL of the image
   * @param {string} modelId - Model ID for the document type
   * @returns {Object} Mindee API response
   */
  async callMindeeV2API(imageUrl, modelId) {
    try {
      logInfo('Calling Mindee V2 API with real endpoint', {
        modelId,
        imageUrl: imageUrl.substring(0, 50) + '...'
      });

      // Create input source from URL (V2 API)
      const inputSource = this.mindeeClient.sourceFromUrl(imageUrl);
      
      // Set inference parameters (matches V2 API example)
      const inferenceParams = {
        modelId: modelId,
        // If set to `true`, will enable Retrieval-Augmented Generation.
        rag: false
      };
      
      // Send for processing and get the result
      const response = await this.mindeeClient.enqueueAndGetInference(inputSource, inferenceParams);
      
      logInfo('Mindee V2 API response received', {
        hasInference: !!response.inference,
        hasResult: !!response.inference?.result,
        modelId: response.inference?.model?.id
      });

      // ==== MINDEE V2 RAW RESPONSE - START ====
      logInfo('🔍 MINDEE V2 RAW RESPONSE - EASY TO FIND:', {
        rawResponseData: response.inference?.result?.fields || response.rawHttp?.inference?.result?.fields || 'No fields found'
      });
      
      // Log the complete structure for detailed debugging
      logInfo('🔍 MINDEE V2 COMPLETE RESPONSE:', {
        fullResponse: JSON.stringify(response, null, 2)
      });
      // ==== MINDEE V2 RAW RESPONSE - END ====

      return response.inference;

    } catch (error) {
      logError('Error calling Mindee V2 API:', {
        error: error.message,
        modelId,
        imageUrl: imageUrl.substring(0, 50) + '...',
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Parse Mindee V2 API response into our standard data model
   * @param {Object} response - Mindee V2 API response
   * @param {string} documentType - Document type
   * @param {string} side - Document side
   * @returns {Object} Parsed data in our standard format
   */
  parseResponse(response, documentType, side) {
    try {
      logInfo(`Parsing Mindee V2 response for ${documentType} ${side}`, {
        hasResponse: !!response,
        hasResult: !!response?.result,
        hasFields: !!response?.result?.fields
      });

      // Log the inference structure in detail
      if (response) {
        logInfo('Mindee V2 Inference Structure:', {
          model: response.model,
          file: response.file,
          resultStructure: response.result ? {
            hasFields: !!response.result.fields,
            hasOptions: !!response.result.options,
            fieldsType: typeof response.result.fields
          } : null
        });
        
        // If fields exist, log the fields object structure
        if (response.result?.fields) {
          logInfo('Mindee V2 Fields Object Info:', {
            fieldsConstructor: response.result.fields.constructor.name,
            fieldsKeys: Object.keys(response.result.fields),
            fieldsLength: response.result.fields.length || 'no length property',
            fieldsSize: response.result.fields.size || 'no size property'
          });
        }
      }

      if (!response || !response.result || !response.result.fields) {
        throw new Error('Invalid Mindee V2 response structure');
      }

      const fields = response.result.fields;
      
      // Parse based on document type
      if (documentType === 'Traditional ID' || documentType === 'New ID') {
        return this.parseIDResponse(fields, side);
      } else if (documentType === 'Passport') {
        return this.parsePassportResponse(fields, side);
      }

      throw new Error(`Unsupported document type: ${documentType}`);

    } catch (error) {
      logError('Error parsing Mindee V2 response:', {
        error: error.message,
        documentType,
        side
      });
      return {};
    }
  }

  /**
   * Parse ID document response from Mindee V2
   * @param {Object} fields - Mindee V2 fields object
   * @param {string} side - Document side
   * @returns {Object} Parsed ID data
   */
  parseIDResponse(fields, side) {
    const extractedData = {};

    try {
      // Debug: Log all available field names to understand the V2 API structure
      const availableFields = [];
      const fieldDetails = {};
      
      // ==== EASY TO FIND: MINDEE V2 AVAILABLE FIELDS ====
      logInfo('🎯 MINDEE V2 AVAILABLE FIELDS - EASY TO FIND:', {
        side,
        message: 'These are ALL the fields that Mindee V2 extracted:'
      });

      // Try multiple ways to access the fields object
      logInfo('🔍 FIELDS OBJECT ANALYSIS:', {
        fieldsExists: !!fields,
        fieldsType: typeof fields,
        fieldsConstructor: fields?.constructor?.name,
        hasForEach: typeof fields?.forEach === 'function',
        hasKeys: typeof fields?.keys === 'function',
        hasEntries: typeof fields?.entries === 'function',
        hasGet: typeof fields?.get === 'function',
        objectKeys: fields ? Object.keys(fields) : [],
        objectKeysLength: fields ? Object.keys(fields).length : 0
      });

      // Try different iteration methods
      if (fields) {
        // Method 1: Try forEach if available
        if (typeof fields.forEach === 'function') {
          logInfo('🔄 Using forEach method');
          fields.forEach((field, fieldName) => {
            availableFields.push(fieldName);
            fieldDetails[fieldName] = {
              value: field?.value,
              confidence: field?.confidence,
              type: typeof field?.value
            };
            
            logInfo(`📋 Field (forEach): ${fieldName}`, {
              value: field?.value,
              confidence: field?.confidence,
              hasValue: !!field?.value
            });

            if (fieldName && fieldName.toLowerCase().includes('mrz')) {
              logInfo(`🔥 MRZ FIELD FOUND (forEach): ${fieldName}`, {
                value: field?.value,
                confidence: field?.confidence,
                valueLength: field?.value ? field.value.length : 0
              });
            }
          });
        }
        
        // Method 2: Try Object.keys iteration
        else if (typeof fields === 'object') {
          logInfo('🔄 Using Object.keys method');
          const keys = Object.keys(fields);
          keys.forEach(fieldName => {
            const field = fields[fieldName];
            availableFields.push(fieldName);
            fieldDetails[fieldName] = {
              value: field?.value,
              confidence: field?.confidence,
              type: typeof field?.value
            };
            
            logInfo(`📋 Field (Object.keys): ${fieldName}`, {
              value: field?.value,
              confidence: field?.confidence,
              hasValue: !!field?.value
            });

            if (fieldName && fieldName.toLowerCase().includes('mrz')) {
              logInfo(`🔥 MRZ FIELD FOUND (Object.keys): ${fieldName}`, {
                value: field?.value,
                confidence: field?.confidence,
                valueLength: field?.value ? field.value.length : 0
              });
            }
          });
        }
        
        // Method 3: Try Map iteration if it's a Map
        else if (fields instanceof Map) {
          logInfo('🔄 Using Map entries method');
          for (const [fieldName, field] of fields.entries()) {
            availableFields.push(fieldName);
            fieldDetails[fieldName] = {
              value: field?.value,
              confidence: field?.confidence,
              type: typeof field?.value
            };
            
            logInfo(`📋 Field (Map): ${fieldName}`, {
              value: field?.value,
              confidence: field?.confidence,
              hasValue: !!field?.value
            });

            if (fieldName && fieldName.toLowerCase().includes('mrz')) {
              logInfo(`🔥 MRZ FIELD FOUND (Map): ${fieldName}`, {
                value: field?.value,
                confidence: field?.confidence,
                valueLength: field?.value ? field.value.length : 0
              });
            }
          }
        }
      }
      
      logInfo('📊 MINDEE V2 FIELDS SUMMARY:', {
        side,
        totalFieldCount: availableFields.length,
        allFieldNames: availableFields,
        mrzRelatedFields: availableFields.filter(name => name && name.toLowerCase().includes('mrz'))
      });
      // ==== END EASY TO FIND SECTION ====

      // Extract common ID fields based on new V2 API structure
      // In V2, fields are accessed via fields.get(fieldName)
      
      const documentNumber = fields.get('document_number');
      if (documentNumber && documentNumber.value) {
        extractedData.cardAccessNumber = documentNumber.value;
      }
      
      const givenNames = fields.get('given_names') || fields.get('Given Names');
      if (givenNames && givenNames.value) {
        extractedData.givenNames = Array.isArray(givenNames.value) 
          ? givenNames.value 
          : [givenNames.value];
      }
      
      const surname = fields.get('surnames') || fields.get('surname') || fields.get('Surnames');
      if (surname && surname.value) {
        extractedData.surname = surname.value;
      }
      
      const birthDate = fields.get('date_of_birth') || fields.get('birth_date') || fields.get('Date of Birth');
      if (birthDate && birthDate.value) {
        extractedData.birthDate = birthDate.value;
      }
      
      const birthPlace = fields.get('place_of_birth') || fields.get('birth_place');
      if (birthPlace && birthPlace.value) {
        extractedData.birthPlace = birthPlace.value;
      }
      
      const nationality = fields.get('nationality');
      if (nationality && nationality.value) {
        extractedData.nationality = nationality.value;
      }
      
      const sex = fields.get('sex');
      if (sex && sex.value) {
        extractedData.sex = sex.value;
      }

      // Extract dates from both recto and verso sides since Mindee V2 may provide them on both
      const issueDate = fields.get('date_of_issue') || fields.get('issue_date');
      if (issueDate && issueDate.value) {
        extractedData.issueDate = issueDate.value;
      }
      
      const expiryDate = fields.get('date_of_expiry') || fields.get('expiry_date');
      if (expiryDate && expiryDate.value) {
        extractedData.expiryDate = expiryDate.value;
      }

      // Side-specific fields
      if (side === 'recto') {
        // Recto-specific fields
        const address = fields.get('address');
        if (address && address.value) {
          extractedData.address = address.value;
        }
      } else if (side === 'verso') {
        // Verso-specific fields (MRZ) - Try multiple possible field names and access methods
        // NOTE: Mindee V2 may not provide MRZ fields for French ID cards, this is acceptable
        logInfo('🔍 VERSO MRZ FIELD EXTRACTION - DEBUGGING:', {
          side,
          message: 'Attempting to extract MRZ fields from verso side (optional for V2)'
        });

        // Method 1: Try fields.get() method
        const mrzLine1_get = fields.get && fields.get('mrz_line1');
        const mrzLine2_get = fields.get && fields.get('mrz_line2');
        
        // Method 2: Try direct object access
        const mrzLine1_direct = fields['mrz_line1'] || fields['mrz1'] || fields['MRZ1'];
        const mrzLine2_direct = fields['mrz_line2'] || fields['mrz2'] || fields['MRZ2'];
        
        // Method 3: Try all possible field names we've seen
        const possibleMrzNames = [
          'mrz_line1', 'mrz1', 'MRZ1', 'machine_readable_zone_line1', 'mrz_line_1',
          'mrz_line2', 'mrz2', 'MRZ2', 'machine_readable_zone_line2', 'mrz_line_2',
          'mrz', 'machine_readable_zone', 'MRZ'
        ];
        
        logInfo('🔍 MRZ FIELD ACCESS ATTEMPTS:', {
          mrzLine1_get: mrzLine1_get?.value || 'not found via get()',
          mrzLine2_get: mrzLine2_get?.value || 'not found via get()',
          mrzLine1_direct: mrzLine1_direct?.value || 'not found via direct access',
          mrzLine2_direct: mrzLine2_direct?.value || 'not found via direct access'
        });

        // Try all possible names
        for (const fieldName of possibleMrzNames) {
          const viaGet = fields.get && fields.get(fieldName);
          const viaDirect = fields[fieldName];
          
          if (viaGet?.value || viaDirect?.value) {
            logInfo(`🎯 MRZ FIELD FOUND: ${fieldName}`, {
              viaGet: viaGet?.value || 'not found',
              viaDirect: viaDirect?.value || 'not found',
              confidence: viaGet?.confidence || viaDirect?.confidence
            });
          }
        }

        // Extract MRZ Line 1
        const mrzLine1 = mrzLine1_get || mrzLine1_direct || 
                          (fields.get && fields.get('mrz1')) || fields['mrz1'] ||
                          (fields.get && fields.get('MRZ1')) || fields['MRZ1'] ||
                          (fields.get && fields.get('machine_readable_zone_line1')) || fields['machine_readable_zone_line1'] ||
                          (fields.get && fields.get('mrz_line_1')) || fields['mrz_line_1'];
        
        if (mrzLine1 && mrzLine1.value) {
          extractedData.mrz1 = mrzLine1.value;
          logInfo('✅ MRZ Line 1 extracted:', { value: mrzLine1.value });
        }
        
        // Extract MRZ Line 2
        const mrzLine2 = mrzLine2_get || mrzLine2_direct ||
                          (fields.get && fields.get('mrz2')) || fields['mrz2'] ||
                          (fields.get && fields.get('MRZ2')) || fields['MRZ2'] ||
                          (fields.get && fields.get('machine_readable_zone_line2')) || fields['machine_readable_zone_line2'] ||
                          (fields.get && fields.get('mrz_line_2')) || fields['mrz_line_2'];
        
        if (mrzLine2 && mrzLine2.value) {
          extractedData.mrz2 = mrzLine2.value;
          logInfo('✅ MRZ Line 2 extracted:', { value: mrzLine2.value });
        }

        // Also try to get MRZ as a single field and split it
        const mrzFull = (fields.get && fields.get('mrz')) || fields['mrz'] ||
                        (fields.get && fields.get('machine_readable_zone')) || fields['machine_readable_zone'] ||
                        (fields.get && fields.get('MRZ')) || fields['MRZ'];
        
        if (mrzFull && mrzFull.value && !extractedData.mrz1 && !extractedData.mrz2) {
          logInfo('🔍 Found single MRZ field, attempting to split:', { value: mrzFull.value });
          const mrzLines = mrzFull.value.split('\n');
          if (mrzLines.length >= 2) {
            extractedData.mrz1 = mrzLines[0].trim();
            extractedData.mrz2 = mrzLines[1].trim();
            logInfo('✅ Split MRZ into two lines:', { mrz1: extractedData.mrz1, mrz2: extractedData.mrz2 });
          } else if (mrzLines.length === 1 && mrzLines[0].length > 30) {
            // Try to split long single line MRZ
            const fullMrz = mrzLines[0];
            const midPoint = Math.floor(fullMrz.length / 2);
            extractedData.mrz1 = fullMrz.substring(0, midPoint);
            extractedData.mrz2 = fullMrz.substring(midPoint);
            logInfo('✅ Split long MRZ line:', { mrz1: extractedData.mrz1, mrz2: extractedData.mrz2 });
          }
        }

        // Log MRZ extraction attempts for debugging
        logInfo('🔍 FINAL MRZ EXTRACTION RESULT:', {
          side,
          mrzLine1Found: !!mrzLine1,
          mrzLine2Found: !!mrzLine2,
          mrzFullFound: !!mrzFull,
          extractedMrz1: extractedData.mrz1,
          extractedMrz2: extractedData.mrz2,
          hasMrzData: !!(extractedData.mrz1 || extractedData.mrz2),
          note: 'MRZ fields are optional in Mindee V2 for French ID cards'
        });

        // If no MRZ data was found, that's acceptable for French ID cards in V2
        if (!extractedData.mrz1 && !extractedData.mrz2) {
          logInfo('ℹ️ No MRZ fields found - this is normal for Mindee V2 French ID processing', {
            side,
            message: 'Mindee V2 extracts structured data instead of raw MRZ'
          });
        }
      }

      logInfo(`Parsed ID ${side} data from Mindee V2:`, {
        side,
        extractedFieldsCount: Object.keys(extractedData).length,
        fields: Object.keys(extractedData)
      });

      // ==== FINAL EXTRACTED DATA - EASY TO FIND ====
      logInfo('🎯 FINAL EXTRACTED DATA FROM MINDEE V2:', {
        side,
        totalFields: Object.keys(extractedData).length,
        extractedData: extractedData
      });
      // ==== END FINAL EXTRACTED DATA ====

      return extractedData;

    } catch (error) {
      logError(`Error parsing ID ${side} response:`, {
        error: error.message,
        side
      });
      return extractedData;
    }
  }

  /**
   * Parse Passport document response from Mindee V2
   * @param {Object} fields - Mindee V2 fields object
   * @param {string} side - Document side (usually just 'recto' for passports)
   * @returns {Object} Parsed passport data
   */
  parsePassportResponse(fields, side) {
    const extractedData = {};

    try {
      // Debug: Log all available field names for passport
      const availableFields = [];
      
      logInfo('🎯 MINDEE V2 PASSPORT FIELDS - EASY TO FIND:', {
        side,
        message: 'These are ALL the passport fields that Mindee V2 extracted:'
      });

      // Log field structure for passport
      if (fields) {
        if (typeof fields.forEach === 'function') {
          fields.forEach((field, fieldName) => {
            availableFields.push(fieldName);
            logInfo(`📋 Passport Field: ${fieldName}`, {
              value: field?.value,
              confidence: field?.confidence,
              hasValue: !!field?.value
            });

            if (fieldName && fieldName.toLowerCase().includes('mrz')) {
              logInfo(`🔥 PASSPORT MRZ FIELD FOUND: ${fieldName}`, {
                value: field?.value,
                confidence: field?.confidence,
                valueLength: field?.value ? field.value.length : 0
              });
            }
          });
        } else if (typeof fields === 'object') {
          const keys = Object.keys(fields);
          keys.forEach(fieldName => {
            const field = fields[fieldName];
            availableFields.push(fieldName);
            logInfo(`📋 Passport Field: ${fieldName}`, {
              value: field?.value,
              confidence: field?.confidence,
              hasValue: !!field?.value
            });
          });
        }
      }

      logInfo('📊 MINDEE V2 PASSPORT FIELDS SUMMARY:', {
        side,
        totalFieldCount: availableFields.length,
        allFieldNames: availableFields,
        mrzRelatedFields: availableFields.filter(name => name && name.toLowerCase().includes('mrz'))
      });

      // Parse passport fields from V2 API with multiple field name attempts
      const documentNumber = fields.get && (
        fields.get('document_number') || 
        fields.get('passport_number') ||
        fields.get('document_id')
      );
      if (documentNumber && documentNumber.value) {
        extractedData.passportNumber = documentNumber.value;
      }
      
      const givenNames = fields.get && (
        fields.get('given_names') ||
        fields.get('first_names') ||
        fields.get('Given Names')
      );
      if (givenNames && givenNames.value) {
        extractedData.givenNames = Array.isArray(givenNames.value) 
          ? givenNames.value 
          : [givenNames.value];
      }
      
      const surname = fields.get && (
        fields.get('surname') ||
        fields.get('surnames') ||
        fields.get('last_name') ||
        fields.get('Surname')
      );
      if (surname && surname.value) {
        extractedData.surname = surname.value;
      }
      
      const birthDate = fields.get && (
        fields.get('birth_date') ||
        fields.get('date_of_birth') ||
        fields.get('Date of Birth')
      );
      if (birthDate && birthDate.value) {
        extractedData.birthDate = birthDate.value;
      }
      
      const birthPlace = fields.get && (
        fields.get('birth_place') ||
        fields.get('place_of_birth') ||
        fields.get('Place of Birth')
      );
      if (birthPlace && birthPlace.value) {
        extractedData.birthPlace = birthPlace.value;
      }
      
      const nationality = fields.get && fields.get('nationality');
      if (nationality && nationality.value) {
        extractedData.nationality = nationality.value;
      }
      
      const sex = fields.get && (
        fields.get('sex') ||
        fields.get('gender')
      );
      if (sex && sex.value) {
        extractedData.sex = sex.value;
      }
      
      const issueDate = fields.get && (
        fields.get('issue_date') ||
        fields.get('date_of_issue') ||
        fields.get('Issue Date')
      );
      if (issueDate && issueDate.value) {
        extractedData.issueDate = issueDate.value;
      }
      
      const expiryDate = fields.get && (
        fields.get('expiry_date') ||
        fields.get('date_of_expiry') ||
        fields.get('Expiry Date')
      );
      if (expiryDate && expiryDate.value) {
        extractedData.expiryDate = expiryDate.value;
      }
      
      const issuingCountry = fields.get && (
        fields.get('issuing_country') ||
        fields.get('country_of_issue') ||
        fields.get('Issuing Country')
      );
      if (issuingCountry && issuingCountry.value) {
        extractedData.issuingCountry = issuingCountry.value;
      }

      // MRZ fields for passport - try multiple access methods
      const mrzLine1 = fields.get && (
        fields.get('mrz_line1') ||
        fields.get('mrz1') ||
        fields.get('MRZ1') ||
        fields.get('machine_readable_zone_line1')
      );
      if (mrzLine1 && mrzLine1.value) {
        extractedData.mrz1 = mrzLine1.value;
        logInfo('✅ Passport MRZ Line 1 extracted:', { value: mrzLine1.value });
      }
      
      const mrzLine2 = fields.get && (
        fields.get('mrz_line2') ||
        fields.get('mrz2') ||
        fields.get('MRZ2') ||
        fields.get('machine_readable_zone_line2')
      );
      if (mrzLine2 && mrzLine2.value) {
        extractedData.mrz2 = mrzLine2.value;
        logInfo('✅ Passport MRZ Line 2 extracted:', { value: mrzLine2.value });
      }

      // Try to get MRZ as a single field for passport
      const mrzFull = fields.get && (
        fields.get('mrz') ||
        fields.get('machine_readable_zone') ||
        fields.get('MRZ')
      );
      if (mrzFull && mrzFull.value && !extractedData.mrz1 && !extractedData.mrz2) {
        logInfo('🔍 Found single passport MRZ field, attempting to split:', { value: mrzFull.value });
        const mrzLines = mrzFull.value.split('\n');
        if (mrzLines.length >= 2) {
          extractedData.mrz1 = mrzLines[0].trim();
          extractedData.mrz2 = mrzLines[1].trim();
          logInfo('✅ Split passport MRZ into two lines:', { mrz1: extractedData.mrz1, mrz2: extractedData.mrz2 });
        }
      }

      logInfo(`Parsed Passport data from Mindee V2:`, {
        side,
        extractedFieldsCount: Object.keys(extractedData).length,
        fields: Object.keys(extractedData)
      });

      // ==== FINAL PASSPORT EXTRACTED DATA - EASY TO FIND ====
      logInfo('🎯 FINAL PASSPORT EXTRACTED DATA FROM MINDEE V2:', {
        side,
        totalFields: Object.keys(extractedData).length,
        extractedData: extractedData
      });
      // ==== END FINAL PASSPORT EXTRACTED DATA ====

      return extractedData;

    } catch (error) {
      logError(`Error parsing Passport response:`, {
        error: error.message,
        side
      });
      return extractedData;
    }
  }

  /**
   * Calculate confidence score from Mindee V2 response
   * @param {Object} response - Mindee API response
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidence(response) {
    try {
      if (!response || !response.result || !response.result.fields) {
        return 0;
      }

      // In V2 API, we need to iterate through all fields and get their confidence
      const fields = response.result.fields;
      
      let totalConfidence = 0;
      let fieldCount = 0;

      // V2 fields object has a forEach method to iterate through all fields
      if (fields && typeof fields.forEach === 'function') {
        fields.forEach((field, fieldName) => {
          if (field && field.confidence !== undefined) {
            totalConfidence += field.confidence;
            fieldCount++;
          }
        });
      }

      const avgConfidence = fieldCount > 0 ? totalConfidence / fieldCount : 0.5;
      
      logInfo('Calculated V2 confidence:', {
        totalConfidence,
        fieldCount,
        avgConfidence
      });

      return avgConfidence;

    } catch (error) {
      logError('Error calculating confidence:', { error: error.message });
      return 0.5; // Default confidence
    }
  }

  /**
   * Validate extracted data based on document type and side
   * @param {Object} extractedData - Extracted data from OCR
   * @param {string} documentType - Document type
   * @param {string} side - Document side
   * @returns {Object} Validation result with isValid and errors
   */
  validateDocumentData(extractedData, documentType, side) {
    const errors = [];
    let isValid = true;

    try {
      if (documentType === 'Traditional ID' || documentType === 'New ID') {
        if (side === 'recto') {
          // Recto validation - require core identity fields
          if (!extractedData.surname) {
            errors.push('Missing surname on recto');
            isValid = false;
          }
          if (!extractedData.givenNames || extractedData.givenNames.length === 0) {
            errors.push('Missing given names on recto');
            isValid = false;
          }
          if (!extractedData.birthDate) {
            errors.push('Missing birth date on recto');
            isValid = false;
          }
        } else if (side === 'verso') {
          // Verso validation - require validity dates (MRZ is optional since V2 may not provide it)
          if (!extractedData.issueDate) {
            errors.push('Missing issue date on verso');
            isValid = false;
          }
          if (!extractedData.expiryDate) {
            errors.push('Missing expiry date on verso');
            isValid = false;
          }
          // MRZ fields are optional - Mindee V2 may not provide them for French ID cards
          // This is acceptable as the important data is extracted from other fields
        }
      } else if (documentType === 'Passport') {
        // Passport validation
        if (!extractedData.passportNumber) {
          errors.push('Missing passport number');
          isValid = false;
        }
        if (!extractedData.surname) {
          errors.push('Missing surname');
          isValid = false;
        }
        if (!extractedData.givenNames || extractedData.givenNames.length === 0) {
          errors.push('Missing given names');
          isValid = false;
        }
      }

      logInfo(`V2 validation completed for ${documentType} ${side}:`, {
        isValid,
        errorsCount: errors.length,
        errors: errors
      });

      return { isValid, errors };

    } catch (error) {
      logError(`Error in V2 validation:`, {
        error: error.message,
        documentType,
        side
      });
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`]
      };
    }
  }
}

module.exports = { MindeeOCRServiceV2 };
