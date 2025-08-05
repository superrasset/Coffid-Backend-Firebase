#!/usr/bin/env node

/**
 * Production-like testing with real Mindee API
 * This test uses a real image URL to test the complete OCR pipeline
 */

require('dotenv').config();
const { createOCRService } = require('./src/documentCheck/ocrService');

async function testMindeeProduction() {
  console.log('🔥 Testing Mindee Production Service...\n');

  // Check environment configuration
  console.log('📝 Environment Configuration:');
  console.log(`   OCR_PROVIDER: ${process.env.OCR_PROVIDER}`);
  console.log(`   API Key configured: ${!!process.env.MINDEE_API_KEY}`);
  console.log(`   ID Card endpoint: ${process.env.MINDEE_IDCARD_ENDPOINT}`);
  console.log(`   Passport endpoint: ${process.env.MINDEE_PASSPORT_ENDPOINT}\n`);

  const ocrService = createOCRService();

  // Test with a real accessible image URL (this is a sample identity card image from Mindee's documentation)
  const testImageUrl = 'https://github.com/mindee/client-lib-test-data/raw/main/products/idcard_fr/default_sample.jpg';

  try {
    console.log('🆔 Testing French ID Card processing...');
    console.log(`   Image URL: ${testImageUrl}`);
    console.log('   Document Type: Traditional ID');
    console.log('   Side: recto\n');

    const idResult = await ocrService.processDocument(testImageUrl, 'Traditional ID', 'recto');

    console.log('📊 ID Card Result:');
    console.log(`   ✨ Provider: ${idResult.provider}`);
    console.log(`   ✅ Is Valid: ${idResult.isValid}`);
    console.log(`   🎯 Confidence: ${idResult.confidence}`);
    console.log(`   ❌ Errors: ${idResult.errors.length > 0 ? idResult.errors.join(', ') : 'None'}`);
    
    if (idResult.extractedData && Object.keys(idResult.extractedData).length > 0) {
      console.log('   📄 Extracted Data Fields:');
      Object.keys(idResult.extractedData).forEach(key => {
        const value = idResult.extractedData[key];
        if (value !== null && value !== undefined) {
          console.log(`      • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      });
    }

    console.log('\n' + '─'.repeat(80) + '\n');

    console.log('🛂 Testing Passport processing...');
    console.log(`   Image URL: ${testImageUrl}`);
    console.log('   Document Type: Passport');
    console.log('   Side: recto\n');

    const passportResult = await ocrService.processDocument(testImageUrl, 'Passport', 'recto');

    console.log('📊 Passport Result:');
    console.log(`   ✨ Provider: ${passportResult.provider}`);
    console.log(`   ✅ Is Valid: ${passportResult.isValid}`);
    console.log(`   🎯 Confidence: ${passportResult.confidence}`);
    console.log(`   ❌ Errors: ${passportResult.errors.length > 0 ? passportResult.errors.join(', ') : 'None'}`);
    
    if (passportResult.extractedData && Object.keys(passportResult.extractedData).length > 0) {
      console.log('   📄 Extracted Data Fields:');
      Object.keys(passportResult.extractedData).forEach(key => {
        const value = passportResult.extractedData[key];
        if (value !== null && value !== undefined) {
          console.log(`      • ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      });
    }

    console.log('\n' + '─'.repeat(80) + '\n');

    console.log('🎉 Mindee Production Testing Results:');
    console.log(`   • ID Card processing: ${idResult.isValid ? '✅ Success' : '❌ Failed'}`);
    console.log(`   • Passport processing: ${passportResult.isValid ? '✅ Success' : '❌ Failed'}`);
    console.log(`   • Both used provider: ${idResult.provider} / ${passportResult.provider}`);
    
    if (idResult.provider === 'mindee' && passportResult.provider === 'mindee') {
      console.log('   🌟 Successfully using real Mindee API for both document types!');
    } else {
      console.log('   ⚠️  One or both requests fell back to mock data (likely due to API issues)');
    }

  } catch (error) {
    console.error('❌ Production test failed:', error.message);
  }
}

// Run the test
testMindeeProduction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
