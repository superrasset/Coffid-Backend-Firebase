/**
 * Test script for Mindee OCR Service V2
 * Tests the new V2 API integration and compares with V1 output format
 */

const { info: logInfo, error: logError } = require("firebase-functions/logger");
const { createOCRService, createSpecificOCRService, getOCRConfig } = require('./ocrServiceV2');

/**
 * Test V2 OCR service with sample data
 */
async function testMindeeV2() {
  try {
    logInfo('Starting Mindee V2 OCR service test...');

    // Test configuration
    const testImageUrl = 'https://example.com/test-id-image.jpg';
    const documentType = 'Traditional ID';
    const side = 'recto';

    // Test 1: Create V2 service directly
    logInfo('Test 1: Creating Mindee V2 service directly');
    const mindeeV2Service = createSpecificOCRService('mindee-v2');
    const v2Result = await mindeeV2Service.processDocument(testImageUrl, documentType, side);
    
    logInfo('Mindee V2 Result:', {
      provider: v2Result.provider,
      isValid: v2Result.isValid,
      confidence: v2Result.confidence,
      extractedData: v2Result.extractedData,
      errors: v2Result.errors
    });

    // Test 2: Create V1 service for comparison
    logInfo('Test 2: Creating Mindee V1 service for comparison');
    const mindeeV1Service = createSpecificOCRService('mindee-v1');
    const v1Result = await mindeeV1Service.processDocument(testImageUrl, documentType, side);
    
    logInfo('Mindee V1 Result:', {
      provider: v1Result.provider,
      isValid: v1Result.isValid,
      confidence: v1Result.confidence,
      extractedData: v1Result.extractedData,
      errors: v1Result.errors
    });

    // Test 3: Test with environment variable configuration
    logInfo('Test 3: Testing with environment configuration');
    
    // Temporarily set environment to use V2
    process.env.OCR_PROVIDER = 'mindee-v2';
    const configuredService = createOCRService();
    const configuredResult = await configuredService.processDocument(testImageUrl, documentType, side);
    
    logInfo('Configured Service Result:', {
      provider: configuredResult.provider,
      isValid: configuredResult.isValid,
      confidence: configuredResult.confidence
    });

    // Test 4: Test fallback functionality
    logInfo('Test 4: Testing fallback functionality');
    
    process.env.OCR_PROVIDER = 'mindee-v2';
    process.env.OCR_FALLBACK_PROVIDER = 'mock';
    process.env.OCR_ENABLE_FALLBACK = 'true';
    
    const fallbackService = createOCRService();
    const fallbackResult = await fallbackService.processDocument(testImageUrl, documentType, side);
    
    logInfo('Fallback Service Result:', {
      provider: fallbackResult.provider,
      isValid: fallbackResult.isValid,
      confidence: fallbackResult.confidence
    });

    // Test 5: Compare data structure compatibility
    logInfo('Test 5: Comparing V1 and V2 data structure compatibility');
    
    const v1Fields = Object.keys(v1Result.extractedData);
    const v2Fields = Object.keys(v2Result.extractedData);
    
    logInfo('Data structure comparison:', {
      v1Fields: v1Fields,
      v2Fields: v2Fields,
      commonFields: v1Fields.filter(field => v2Fields.includes(field)),
      v1OnlyFields: v1Fields.filter(field => !v2Fields.includes(field)),
      v2OnlyFields: v2Fields.filter(field => !v1Fields.includes(field))
    });

    // Test 6: Test verso side
    logInfo('Test 6: Testing verso side processing');
    
    const versoV2Result = await mindeeV2Service.processDocument(testImageUrl, documentType, 'verso');
    
    logInfo('Verso V2 Result:', {
      provider: versoV2Result.provider,
      isValid: versoV2Result.isValid,
      extractedData: versoV2Result.extractedData
    });

    logInfo('✅ All Mindee V2 tests completed successfully');

    return {
      success: true,
      v1Result,
      v2Result,
      configuredResult,
      fallbackResult,
      versoV2Result
    };

  } catch (error) {
    logError('❌ Error in Mindee V2 test:', {
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Test current OCR configuration
 */
function testOCRConfig() {
  try {
    logInfo('Current OCR Configuration:', getOCRConfig());
    
    // Test all available providers
    const providers = ['mindee-v1', 'mindee-v2', 'custom', 'mock'];
    
    providers.forEach(provider => {
      try {
        const service = createSpecificOCRService(provider);
        logInfo(`✅ ${provider} service created successfully:`, {
          provider: service.provider
        });
      } catch (error) {
        logError(`❌ Failed to create ${provider} service:`, {
          error: error.message
        });
      }
    });

  } catch (error) {
    logError('Error testing OCR configuration:', {
      error: error.message
    });
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    logInfo('🚀 Starting comprehensive OCR V2 tests...');
    
    // Test configuration
    testOCRConfig();
    
    // Test V2 functionality
    const testResults = await testMindeeV2();
    
    logInfo('🏁 All tests completed:', {
      success: testResults.success
    });
    
    return testResults;
    
  } catch (error) {
    logError('Error running tests:', {
      error: error.message,
      stack: error.stack
    });
    return { success: false, error: error.message };
  }
}

// Export test functions
module.exports = {
  testMindeeV2,
  testOCRConfig,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(results => {
    console.log('Test Results:', results);
    process.exit(results.success ? 0 : 1);
  });
}
