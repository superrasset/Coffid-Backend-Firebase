// Quick test to debug passport validation
const { createOCRService } = require('./src/documentCheck/ocrService');

async function debugPassportValidation() {
  const ocrService = createOCRService();
  const mockImageUrl = 'https://example.com/test-passport.jpg';
  
  console.log('=== Debugging Passport Validation ===');
  
  const result = await ocrService.processDocument(mockImageUrl, 'passport', 'recto');
  
  console.log('Result:', {
    isValid: result.isValid,
    confidence: result.confidence,
    provider: result.provider,
    errors: result.errors
  });
  
  console.log('\nExtracted Data:');
  console.log('- surname:', result.extractedData?.surname);
  console.log('- givenNames:', result.extractedData?.givenNames);
  console.log('- birthDate:', result.extractedData?.birthDate);
  console.log('- passportNumber:', result.extractedData?.passportNumber);
  console.log('- nationality:', result.extractedData?.nationality);
  
  // Manual validation check
  const hasRequiredPersonalInfo = !!(result.extractedData?.surname && result.extractedData?.givenNames?.length > 0);
  const hasBirthDate = !!result.extractedData?.birthDate;
  const hasPassportNumber = !!result.extractedData?.passportNumber;
  const hasNationality = !!result.extractedData?.nationality;
  const additionalFieldCount = [hasBirthDate, hasPassportNumber, hasNationality].filter(Boolean).length;
  
  console.log('\nValidation Check:');
  console.log('- hasRequiredPersonalInfo:', hasRequiredPersonalInfo);
  console.log('- hasBirthDate:', hasBirthDate);
  console.log('- hasPassportNumber:', hasPassportNumber);
  console.log('- hasNationality:', hasNationality);
  console.log('- additionalFieldCount:', additionalFieldCount);
  console.log('- Should be valid:', hasRequiredPersonalInfo && additionalFieldCount >= 1);
}

debugPassportValidation().catch(console.error);
