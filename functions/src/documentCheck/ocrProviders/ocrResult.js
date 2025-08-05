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

module.exports = { OCRResult };
