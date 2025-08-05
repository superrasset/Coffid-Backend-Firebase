// Test modular OCR service structure
const { createOCRService } = require('./src/documentCheck/ocrService_new');

async function testModularStructure() {
  console.log('🧪 Testing modular OCR service structure...\n');
  
  try {
    // Test factory creation
    const ocrService = createOCRService();
    console.log(`✅ OCR Service created: ${ocrService.constructor.name}`);
    
    // Test that all required methods exist
    const requiredMethods = [
      'processDocument',
      'processIDCardWithSDK',
      'processPassportWithSDK',
      'extractIDCardDataFromSDK',
      'extractPassportDataFromSDK'
    ];
    
    console.log('\n📋 Checking required methods:');
    requiredMethods.forEach(method => {
      const exists = typeof ocrService[method] === 'function';
      console.log(`  ${exists ? '✅' : '❌'} ${method}: ${exists ? 'exists' : 'missing'}`);
    });
    
    // Test provider switching
    console.log('\n🔄 Testing provider switching:');
    const originalProvider = process.env.OCR_PROVIDER;
    
    // Test mock provider
    process.env.OCR_PROVIDER = 'mock';
    const mockService = createOCRService();
    console.log(`  Mock: ${mockService.constructor.name}`);
    
    // Test mindee provider
    process.env.OCR_PROVIDER = 'mindee';
    const mindeeService = createOCRService();
    console.log(`  Mindee: ${mindeeService.constructor.name}`);
    
    // Restore original provider
    if (originalProvider) {
      process.env.OCR_PROVIDER = originalProvider;
    } else {
      delete process.env.OCR_PROVIDER;
    }
    
    console.log('\n✅ Modular structure test completed successfully!');
    
  } catch (error) {
    console.error('❌ Modular structure test failed:', error.message);
    console.error(error.stack);
  }
}

testModularStructure();
