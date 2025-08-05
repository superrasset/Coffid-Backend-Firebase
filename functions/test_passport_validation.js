#!/usr/bin/env node

/**
 * Test passport validation and rejection scenarios
 * Verify that uploadedDocument gets proper validity status
 */

require('dotenv').config();
const { createOCRService } = require('./src/documentCheck/ocrService');
const { verifyPassport } = require('./src/documentCheck/verifyPassportDocument');

async function testPassportValidation() {
  console.log('🛂 Testing Passport Validation and Rejection...\n');

  const ocrService = createOCRService();

  // Test cases for different validation scenarios
  const testCases = [
    {
      name: 'Valid Passport (Mindee Test Data)',
      imageUrl: 'https://github.com/mindee/client-lib-test-data/raw/main/products/passport/default_sample.jpg',
      documentType: 'Passport',
      expectedValid: true
    },
    {
      name: 'Invalid URL (Should be rejected)',
      imageUrl: 'https://example.com/nonexistent-passport.jpg',
      documentType: 'Passport',
      expectedValid: false
    },
    {
      name: 'Empty/Invalid Image',
      imageUrl: 'https://via.placeholder.com/100x100/000000/FFFFFF?text=INVALID',
      documentType: 'Passport',
      expectedValid: false
    }
  ];

  for (const testCase of testCases) {
    console.log(`📄 Testing: ${testCase.name}`);
    console.log(`   Image URL: ${testCase.imageUrl}`);
    console.log(`   Expected Valid: ${testCase.expectedValid}\n`);

    try {
      const result = await verifyPassport(testCase.imageUrl, testCase.documentType);

      console.log('📊 Verification Result:');
      console.log(`   ✨ Provider: ${result.provider}`);
      console.log(`   ✅ Is Valid: ${result.isValid}`);
      console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   ❌ Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}`);
      
      // Show what would be stored in uploadedDocument
      const uploadedDocumentUpdate = {
        status: result.isValid ? 'verified' : 'rejected',
        validity: result.isValid ? 'validated' : 'rejected'
      };
      
      console.log('   📝 UploadedDocument Update:');
      console.log(`      • status: "${uploadedDocumentUpdate.status}"`);
      console.log(`      • validity: "${uploadedDocumentUpdate.validity}"`);
      
      // Show key extracted data
      if (result.extractedData && Object.keys(result.extractedData).length > 0) {
        console.log('   📄 Key Extracted Data:');
        const keyFields = ['surname', 'givenNames', 'birthDate', 'passportNumber', 'nationality'];
        keyFields.forEach(field => {
          const value = result.extractedData[field];
          if (value !== null && value !== undefined) {
            console.log(`      • ${field}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
          }
        });
      }

      // Validate expectations
      const validationMatch = result.isValid === testCase.expectedValid;
      console.log(`   🎯 Validation Match: ${validationMatch ? '✅' : '❌'} (Expected: ${testCase.expectedValid}, Got: ${result.isValid})`);

      if (!validationMatch) {
        console.log('   ⚠️  Unexpected validation result!');
      }

    } catch (error) {
      console.error(`   ❌ Test failed: ${error.message}`);
    }

    console.log('\n' + '─'.repeat(80) + '\n');
  }

  console.log('🎉 Passport Validation Testing Complete!');
  console.log('\n💡 Key Points:');
  console.log('   • Valid passports get: status="verified", validity="validated"');
  console.log('   • Invalid passports get: status="rejected", validity="rejected"');
  console.log('   • Full verification details are stored in verifiedDocument');
  console.log('   • UploadedDocument only contains basic status for app consumption');
}

// Run the test
testPassportValidation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
