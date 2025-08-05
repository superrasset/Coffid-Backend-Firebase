// Test verso validation issue
const { createOCRService } = require('./src/documentCheck/ocrService');

async function testVersoValidation() {
  console.log('=== Testing Verso Validation Issue ===\n');

  const ocrService = createOCRService();
  const mockImageUrl = 'https://example.com/test-id-verso.jpg';
  
  // Test verso processing
  console.log('Testing Traditional ID verso processing...');
  const result = await ocrService.processDocument(mockImageUrl, 'Traditional ID', 'verso');
  
  console.log('\n--- Results ---');
  console.log('Is Valid:', result.isValid);
  console.log('Confidence:', result.confidence);
  console.log('Provider:', result.provider);
  console.log('Errors:', result.errors);
  
  console.log('\n--- Extracted Data ---');
  const data = result.extractedData;
  console.log('Available fields:', Object.keys(data));
  
  console.log('\n--- Key Verso Fields ---');
  console.log('mrz1:', data.mrz1);
  console.log('mrz2:', data.mrz2);
  console.log('address:', data.address);
  console.log('issueLocation:', data.issueLocation);
  console.log('documentNumber:', data.documentNumber);
  
  console.log('\n--- Current Validation Logic Checks ---');
  console.log('issueDate exists:', !!data.issueDate);
  console.log('deliveryDate exists:', !!data.deliveryDate);
  console.log('Current validation (issueDate && deliveryDate):', !!(data.issueDate && data.deliveryDate));
  
  console.log('\n--- Better Validation Logic Would Be ---');
  console.log('mrz1 exists:', !!data.mrz1);
  console.log('mrz2 exists:', !!data.mrz2);
  console.log('Better validation (mrz1 || mrz2 || documentNumber):', !!(data.mrz1 || data.mrz2 || data.documentNumber));
  
  console.log('\n=== Analysis Complete ===');
}

testVersoValidation().catch(console.error);
