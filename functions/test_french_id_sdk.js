// Test French ID Card SDK Integration
// This script tests the new Mindee SDK integration for French ID cards

const { createOCRService } = require('./src/documentCheck/ocrService');

async function testFrenchIDCardSDK() {
  console.log('=== Testing French ID Card SDK Integration ===\n');

  try {
    // Create OCR service (should use Mindee)
    const ocrService = createOCRService();
    console.log('OCR Service created:', ocrService.constructor.name);

    // Test document type detection
    console.log('\n--- Testing Document Type Detection ---');
    const testDocumentTypes = [
      'Traditional ID',
      'New ID', 
      'id',
      'idcard',
      'carte nationale d\'identité',
      'cni',
      'passport'
    ];

    testDocumentTypes.forEach(docType => {
      const isIDCard = ocrService.isIDCardType && ocrService.isIDCardType(docType);
      console.log(`Document type "${docType}": ${isIDCard ? 'ID Card' : 'Other'}`);
    });

    // Test with mock image URL (this will fail gracefully for testing)
    console.log('\n--- Testing SDK Method Availability ---');
    const mockImageUrl = 'https://example.com/test-id-card.jpg';
    
    // Check if SDK methods exist
    console.log('processIDCardWithSDK method exists:', typeof ocrService.processIDCardWithSDK === 'function');
    console.log('processPassportWithSDK method exists:', typeof ocrService.processPassportWithSDK === 'function');
    console.log('extractIDCardDataFromSDK method exists:', typeof ocrService.extractIDCardDataFromSDK === 'function');
    console.log('extractPassportDataFromSDK method exists:', typeof ocrService.extractPassportDataFromSDK === 'function');

    // Test OCR service configuration
    console.log('\n--- OCR Configuration ---');
    console.log('OCR Provider:', process.env.OCR_PROVIDER || 'mindee (default)');
    console.log('Mindee API Key configured:', !!process.env.MINDEE_API_KEY);
    
    if (process.env.MINDEE_API_KEY) {
      console.log('API Key length:', process.env.MINDEE_API_KEY.length);
      console.log('API Key preview:', process.env.MINDEE_API_KEY.substring(0, 8) + '...');
    }

    // Test document processing with French ID (will use mock data if no API key)
    console.log('\n--- Testing French ID Card Processing ---');
    try {
      const result = await ocrService.processDocument(mockImageUrl, 'Traditional ID', 'recto');
      
      console.log('Processing completed successfully');
      console.log('Provider used:', result.provider);
      console.log('Is valid:', result.isValid);
      console.log('Confidence:', result.confidence);
      console.log('Errors:', result.errors);
      
      if (result.extractedData) {
        console.log('Extracted data keys:', Object.keys(result.extractedData));
        console.log('Document type:', result.extractedData.documentType);
        console.log('Has surname:', !!result.extractedData.surname);
        console.log('Has given names:', !!(result.extractedData.givenNames && result.extractedData.givenNames.length > 0));
      }
      
    } catch (error) {
      console.log('Expected error (no valid image):', error.message);
    }

    // Test passport processing for comparison
    console.log('\n--- Testing Passport Processing ---');
    try {
      const passportResult = await ocrService.processDocument(mockImageUrl, 'passport', 'recto');
      
      console.log('Passport processing completed');
      console.log('Provider used:', passportResult.provider);
      console.log('Is valid:', passportResult.isValid);
      console.log('Confidence:', passportResult.confidence);
      
    } catch (error) {
      console.log('Expected error (no valid image):', error.message);
    }

    console.log('\n=== SDK Integration Test Completed ===');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testFrenchIDCardSDK().catch(console.error);
}

module.exports = { testFrenchIDCardSDK };
