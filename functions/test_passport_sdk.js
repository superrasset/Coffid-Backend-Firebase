#!/usr/bin/env node

/**
 * Test passport processing with official Mindee SDK
 * This test verifies the new SDK integration for passport documents
 */

require('dotenv').config();
const { createOCRService } = require('./src/documentCheck/ocrService');

async function testPassportSDK() {
  console.log('🛂 Testing Passport Processing with Mindee SDK...\n');

  // Check environment configuration
  console.log('📝 Environment Configuration:');
  console.log(`   OCR_PROVIDER: ${process.env.OCR_PROVIDER}`);
  console.log(`   API Key configured: ${!!process.env.MINDEE_API_KEY}`);
  console.log(`   Using official Mindee SDK for passport processing\n`);

  const ocrService = createOCRService();

  // Test with a sample passport image from Mindee's test data
  const testImageUrl = 'https://github.com/mindee/client-lib-test-data/raw/main/products/passport/default_sample.jpg';

  try {
    console.log('🛂 Testing Passport processing with official Mindee SDK...');
    console.log(`   Image URL: ${testImageUrl}`);
    console.log('   Document Type: Passport');
    console.log('   Processing method: Official Mindee SDK\n');

    const passportResult = await ocrService.processDocument(testImageUrl, 'Passport', 'recto');

    console.log('📊 Passport SDK Result:');
    console.log(`   ✨ Provider: ${passportResult.provider}`);
    console.log(`   ✅ Is Valid: ${passportResult.isValid}`);
    console.log(`   🎯 Confidence: ${(passportResult.confidence * 100).toFixed(1)}%`);
    console.log(`   ❌ Errors: ${passportResult.errors.length > 0 ? passportResult.errors.join(', ') : 'None'}`);
    
    if (passportResult.extractedData && Object.keys(passportResult.extractedData).length > 0) {
      console.log('   📄 Extracted Data Fields:');
      Object.keys(passportResult.extractedData).forEach(key => {
        const value = passportResult.extractedData[key];
        if (value !== null && value !== undefined && key !== 'confidenceScores') {
          console.log(`      • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      });
      
      if (passportResult.extractedData.confidenceScores) {
        console.log('   🎯 Confidence Scores:');
        Object.keys(passportResult.extractedData.confidenceScores).forEach(key => {
          const confidence = passportResult.extractedData.confidenceScores[key];
          console.log(`      • ${key}: ${(confidence * 100).toFixed(1)}%`);
        });
      }
    }

    console.log('\n' + '─'.repeat(80) + '\n');

    console.log('🎉 Passport SDK Testing Results:');
    console.log(`   • Processing: ${passportResult.isValid ? '✅ Success' : '❌ Failed'}`);
    console.log(`   • Provider: ${passportResult.provider}`);
    console.log(`   • Confidence: ${(passportResult.confidence * 100).toFixed(1)}%`);
    
    if (passportResult.provider === 'mindee-sdk') {
      console.log('   🌟 Successfully using official Mindee SDK for passport processing!');
      
      // Check for key passport fields
      const hasPassportNumber = !!passportResult.extractedData?.passportNumber;
      const hasPersonalInfo = !!(passportResult.extractedData?.surname && passportResult.extractedData?.givenNames?.length > 0);
      const hasBirthDate = !!passportResult.extractedData?.birthDate;
      
      console.log(`   📋 Data Completeness:`);
      console.log(`      • Passport Number: ${hasPassportNumber ? '✅' : '❌'}`);
      console.log(`      • Personal Info: ${hasPersonalInfo ? '✅' : '❌'}`);
      console.log(`      • Birth Date: ${hasBirthDate ? '✅' : '❌'}`);
      
    } else {
      console.log('   ⚠️  SDK processing failed, check logs for details');
    }

  } catch (error) {
    console.error('❌ Passport SDK test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testPassportSDK()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
