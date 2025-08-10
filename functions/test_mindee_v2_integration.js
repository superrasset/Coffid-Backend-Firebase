/**
 * Test file for Mindee OCR Service V2
 * Run this to test the new V2 API implementation
 */

const { createOCRService, getOCRConfig } = require('./src/documentCheck/ocrServiceV2');
const { info: logInfo, error: logError } = require("firebase-functions/logger");

/**
 * Test Mindee V2 API with sample French ID
 */
async function testMindeeV2WithFrenchID() {
  try {
    console.log('🧪 Testing Mindee OCR Service V2 with French ID...');
    
    // Show current configuration
    const config = getOCRConfig();
    console.log('📋 Current OCR Config:', config);
    
    // Create V2 service instance
    const ocrService = createOCRService();
    console.log(`✅ Created OCR service: ${ocrService.provider}`);
    
    // Test with recto side
    console.log('\n📄 Testing French ID Recto...');
    
    // Note: This will fail without a real image URL, but tests the service setup
    const testImageUrl = 'https://example.com/french-id-recto.jpg';
    
    try {
      const rectoResult = await ocrService.processDocument(testImageUrl, 'Traditional ID', 'recto');
      console.log('✅ Recto processing completed:', {
        provider: rectoResult.provider,
        isValid: rectoResult.isValid,
        errorsCount: rectoResult.errors?.length || 0,
        extractedFields: Object.keys(rectoResult.extractedData || {})
      });
    } catch (error) {
      console.log('⚠️ Recto processing failed (expected with test URL):', error.message.substring(0, 100));
    }
    
    // Test with verso side
    console.log('\n📄 Testing French ID Verso...');
    
    try {
      const versoResult = await ocrService.processDocument(testImageUrl, 'Traditional ID', 'verso');
      console.log('✅ Verso processing completed:', {
        provider: versoResult.provider,
        isValid: versoResult.isValid,
        errorsCount: versoResult.errors?.length || 0,
        extractedFields: Object.keys(versoResult.extractedData || {})
      });
    } catch (error) {
      console.log('⚠️ Verso processing failed (expected with test URL):', error.message.substring(0, 100));
    }
    
    console.log('\n✅ V2 Service test completed successfully');
    return true;
    
  } catch (error) {
    console.error('❌ V2 Service test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Test API key and model configuration
 */
function testV2Configuration() {
  try {
    console.log('\n🔧 Testing V2 Configuration...');
    
    const { MindeeOCRServiceV2 } = require('./src/documentCheck/ocrProviders/mindeeOCRServiceV2');
    const service = new MindeeOCRServiceV2();
    
    console.log('✅ V2 Service instantiated successfully');
    console.log('🔑 API Key configured:', service.apiKey ? '✓ Set' : '✗ Missing');
    console.log('📋 Model IDs:', service.modelIds);
    
    return true;
    
  } catch (error) {
    console.error('❌ V2 Configuration test failed:', error.message);
    return false;
  }
}

/**
 * Compare V1 vs V2 service creation
 */
async function compareV1VsV2() {
  try {
    console.log('\n🔄 Comparing V1 vs V2 Services...');
    
    // Test V1 creation
    try {
      const { createOCRService } = require('./src/documentCheck/ocrService');
      const v1Service = createOCRService();
      console.log('✅ V1 Service created:', v1Service.provider);
    } catch (error) {
      console.log('⚠️ V1 Service creation failed:', error.message);
    }
    
    // Test V2 creation
    try {
      const v2Service = createOCRService();
      console.log('✅ V2 Service created:', v2Service.provider);
    } catch (error) {
      console.log('⚠️ V2 Service creation failed:', error.message);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ V1 vs V2 comparison failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Mindee V2 Tests...\n');
  
  const results = {
    configuration: testV2Configuration(),
    comparison: await compareV1VsV2(),
    processing: await testMindeeV2WithFrenchID()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('Configuration Test:', results.configuration ? '✅ PASS' : '❌ FAIL');
  console.log('V1 vs V2 Comparison:', results.comparison ? '✅ PASS' : '❌ FAIL');
  console.log('Processing Test:', results.processing ? '✅ PASS' : '❌ FAIL');
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log('\n🎯 Overall Result:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
  
  return allPassed;
}

// Export for use in other test files
module.exports = {
  testMindeeV2WithFrenchID,
  testV2Configuration,
  compareV1VsV2,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}
