// Test French ID card validation with both sides
const { createOCRService } = require('./src/documentCheck/ocrService');

async function testIDCardSideValidation() {
  console.log('=== Testing French ID Card Side Validation ===\n');

  const ocrService = createOCRService();
  const mockImageUrl = 'https://example.com/test-id.jpg';
  
  // Test recto side
  console.log('--- Testing Recto Side ---');
  const rectoResult = await ocrService.processDocument(mockImageUrl, 'Traditional ID', 'recto');
  
  console.log('Recto Results:');
  console.log('- Is Valid:', rectoResult.isValid);
  console.log('- Confidence:', rectoResult.confidence);
  console.log('- Provider:', rectoResult.provider);
  console.log('- Errors:', rectoResult.errors);
  
  if (rectoResult.extractedData) {
    console.log('- Has surname:', !!rectoResult.extractedData.surname);
    console.log('- Has given names:', !!(rectoResult.extractedData.givenNames && rectoResult.extractedData.givenNames.length > 0));
    console.log('- Has birth date:', !!rectoResult.extractedData.birthDate);
  }
  
  // Test verso side
  console.log('\n--- Testing Verso Side ---');
  const versoResult = await ocrService.processDocument(mockImageUrl, 'Traditional ID', 'verso');
  
  console.log('Verso Results:');
  console.log('- Is Valid:', versoResult.isValid);
  console.log('- Confidence:', versoResult.confidence);
  console.log('- Provider:', versoResult.provider);
  console.log('- Errors:', versoResult.errors);
  
  if (versoResult.extractedData) {
    console.log('- Has mrz1:', !!versoResult.extractedData.mrz1);
    console.log('- Has mrz2:', !!versoResult.extractedData.mrz2);
    console.log('- Has issue date:', !!versoResult.extractedData.issueDate);
    console.log('- Has expiry date:', !!versoResult.extractedData.expiryDate);
  }
  
  console.log('\n=== Validation Analysis ===');
  console.log('Recto should pass (has name + birth date):', rectoResult.isValid);
  console.log('Verso should pass with corrected validation logic:', versoResult.isValid);
  
  console.log('\n=== Test Complete ===');
}

testIDCardSideValidation().catch(console.error);
