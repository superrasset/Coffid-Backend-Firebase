#!/usr/bin/env node

/**
 * Debug passport validation - see why status is rejected
 */

require('dotenv').config();
const { createOCRService } = require('./src/documentCheck/ocrService');

async function debugPassportValidation() {
  console.log('🔍 Debugging Passport Validation...\n');

  const ocrService = createOCRService();

  // Test with the same image that worked before
  const testImageUrl = 'https://github.com/mindee/client-lib-test-data/raw/main/products/passport/default_sample.jpg';

  try {
    console.log('📄 Processing passport for validation debug...');
    console.log(`   Image URL: ${testImageUrl}\n`);

    const result = await ocrService.processDocument(testImageUrl, 'Passport', 'recto');

    console.log('📊 OCR Result:');
    console.log(`   ✨ Provider: ${result.provider}`);
    console.log(`   ✅ Is Valid: ${result.isValid}`);
    console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   ❌ Errors: ${result.errors.length > 0 ? result.errors.join(', ') : 'None'}\n`);

    if (result.extractedData) {
      console.log('📄 Extracted Data:');
      Object.keys(result.extractedData).forEach(key => {
        const value = result.extractedData[key];
        if (value !== null && value !== undefined && key !== 'confidenceScores') {
          console.log(`   • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      });
      console.log();

      // Debug validation logic step by step
      console.log('🔍 Validation Debug:');
      
      const hasRequiredPersonalInfo = !!(result.extractedData?.surname && result.extractedData?.givenNames?.length > 0);
      console.log(`   • Has surname: ${!!result.extractedData?.surname} (${result.extractedData?.surname || 'none'})`);
      console.log(`   • Has given names: ${!!(result.extractedData?.givenNames?.length > 0)} (${JSON.stringify(result.extractedData?.givenNames || [])})`);
      console.log(`   • Required personal info: ${hasRequiredPersonalInfo}`);
      
      const hasBirthDate = !!result.extractedData?.birthDate;
      const hasPassportNumber = !!result.extractedData?.passportNumber;
      const hasNationality = !!result.extractedData?.nationality;
      
      console.log(`   • Has birth date: ${hasBirthDate} (${result.extractedData?.birthDate || 'none'})`);
      console.log(`   • Has passport number: ${hasPassportNumber} (${result.extractedData?.passportNumber || 'none'})`);
      console.log(`   • Has nationality: ${hasNationality} (${result.extractedData?.nationality || 'none'})`);
      
      const additionalFieldCount = [hasBirthDate, hasPassportNumber, hasNationality].filter(Boolean).length;
      console.log(`   • Additional fields count: ${additionalFieldCount}/3`);
      
      const shouldBeValid = hasRequiredPersonalInfo && additionalFieldCount >= 1;
      console.log(`   • Should be valid: ${shouldBeValid} (needs personal info + 1 additional field)`);
      console.log(`   • Actual validation result: ${result.isValid}`);
      
      if (shouldBeValid !== result.isValid) {
        console.log('   ⚠️  MISMATCH! Validation logic may have an issue');
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the debug
debugPassportValidation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Debug execution failed:', error);
    process.exit(1);
  });
