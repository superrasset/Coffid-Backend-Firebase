// Test script for OCR Service abstraction
const {createOCRService, OCR_CONFIG} = require('./src/documentCheck/ocrService');

async function testOCRService() {
  console.log('Testing OCR Service Abstraction...');
  console.log('Current OCR Provider:', OCR_CONFIG.OCR_PROVIDER);
  
  try {
    const ocrService = createOCRService();
    console.log('OCR Service created successfully');
    
    // Test with mock data
    const result = await ocrService.processDocument(
      'https://example.com/image.jpg',
      'Traditional ID',
      'recto'
    );
    
    console.log('OCR Result:', {
      isValid: result.isValid,
      provider: result.provider,
      confidence: result.confidence,
      hasExtractedData: Object.keys(result.extractedData).length > 0,
      errorCount: result.errors.length
    });
    
    console.log('✅ OCR Service test completed successfully');
    
  } catch (error) {
    console.error('❌ OCR Service test failed:', error.message);
  }
}

// Run test if called directly
if (require.main === module) {
  testOCRService();
}

module.exports = { testOCRService };
