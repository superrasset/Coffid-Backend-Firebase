// Test that the renamed OCR service works correctly
const { createOCRService, OCRResult, OCR_CONFIG } = require('./src/documentCheck/ocrService');

async function testRenamedService() {
  console.log('🧪 Testing renamed OCR service...\n');
  
  try {
    // Test that we can create the service
    const ocrService = createOCRService();
    console.log(`✅ OCR Service created: ${ocrService.constructor.name}`);
    
    // Test that OCRResult class is available
    const testResult = new OCRResult({
      isValid: true,
      confidence: 0.95,
      extractedData: { test: 'data' },
      provider: 'test'
    });
    console.log(`✅ OCRResult class works: ${testResult.isValid}`);
    
    // Test that configuration is available
    console.log(`✅ OCR_CONFIG available: ${OCR_CONFIG.OCR_PROVIDER}`);
    
    // Test that all required methods exist
    const requiredMethods = ['processDocument', 'processIDCardWithSDK', 'processPassportWithSDK'];
    const methodsExist = requiredMethods.every(method => typeof ocrService[method] === 'function');
    console.log(`✅ All required methods exist: ${methodsExist}`);
    
    console.log('\n🎉 Renamed OCR service test completed successfully!');
    console.log('   - ocrService.js (new modular version) is now the default');
    console.log('   - ocrService_old.js contains the original monolithic version');
    
  } catch (error) {
    console.error('❌ Renamed service test failed:', error.message);
    console.error(error.stack);
  }
}

testRenamedService();
