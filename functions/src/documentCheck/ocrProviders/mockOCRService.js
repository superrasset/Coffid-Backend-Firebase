const {info: logInfo, error: logError} = require("firebase-functions/logger");
const { BaseOCRService } = require('./baseOCRService');
const { OCRResult } = require('./ocrResult');

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

      // Generate realistic test data based on document type and side
      const extractedData = this.generateMockData(documentType, side);

      return new OCRResult({
        isValid,
        confidence: 0.95,
        extractedData,
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

  generateMockData(documentType, side) {
    const mockData = {
      documentType: documentType,
      side: side,
      processed_at: new Date().toISOString()
    };

    if (documentType === 'Traditional ID' || documentType === 'New ID') {
      if (side === 'recto') {
        return {
          ...mockData,
          // Recto side data - match expected field structure
          surname: 'DUPONT',
          givenNames: ['Jean'],
          birthDate: '1990-05-15',
          cardAccessNumber: 'FR12345678901',
          expiryDate: '2030-05-15',
          issueDate: '2020-05-15',
          nationality: 'Française',
          gender: 'M',
          documentNumber: 'FR123456789',
          validity: {
            isValid: true,
            confidence: 0.95
          }
        };
      } else if (side === 'verso') {
        return {
          ...mockData,
          // Verso side data - match expected field structure
          mrz1: 'IDFRAFR1234567890123456789012345',
          mrz2: '9005155M3005155FRA<<<<<<<<<<<<<<08',
          address: '123 RUE DE LA PAIX, 75001 PARIS',
          issueLocation: 'PREFECTURE DE PARIS',
          documentNumber: 'FR123456789',
          validity: {
            isValid: true,
            confidence: 0.93
          }
        };
      }
    } else if (documentType === 'Passport' || documentType === 'passport') {
      if (side === 'recto') {
        return {
          ...mockData,
          // Passport data - match expected field structure
          surname: 'MARTIN',
          givenNames: ['Marie'],
          birthDate: '1985-12-20',
          passportNumber: '20AB12345',
          expiryDate: '2028-12-20',
          issueDate: '2018-12-20',
          nationality: 'Française',
          gender: 'F',
          birthPlace: 'Lyon, France',
          mrz1: 'P<FRAMARIE<<MARTIN<<<<<<<<<<<<<<<<<<<<<<',
          mrz2: '20AB12345<FRA8512204F2812205<<<<<<<<<<<<<08',
          validity: {
            isValid: true,
            confidence: 0.96
          }
        };
      }
    }

    return mockData;
  }

  validateDocumentData(extractedData, documentType, side) {
    return true; // Mock service always validates as true
  }
}

module.exports = { MockOCRService };
