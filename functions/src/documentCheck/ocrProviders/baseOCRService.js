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

module.exports = { BaseOCRService };
