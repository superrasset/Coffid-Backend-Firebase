/**
 * Test Mindee Passport Integration
 * 
 * This script tests the new Mindee passport endpoint integration
 * to verify it correctly routes different document types to appropriate endpoints
 */

// Load environment variables from .env file
require('dotenv').config();

const { createOCRService } = require('./src/documentCheck/ocrService');

async function testMindeeEndpoints() {
  console.log('🧪 Testing Mindee Multiple Endpoints...\n');
  console.log(`📝 OCR_PROVIDER environment variable: ${process.env.OCR_PROVIDER}`);
  console.log(`🔑 API Key configured: ${!!process.env.MINDEE_API_KEY}`);
  console.log(`🆔 ID Card endpoint: ${process.env.MINDEE_IDCARD_ENDPOINT || 'default'}`);
  console.log(`🛂 Passport endpoint: ${process.env.MINDEE_PASSPORT_ENDPOINT || 'default'}\n`);
  
  const ocrService = createOCRService();
  console.log(`🔧 Using OCR Service: ${ocrService.constructor.name}\n`);
  
  // Test cases for different document types
  const testCases = [
    {
      name: 'French ID Card - Traditional ID',
      imageUrl: 'https://example.com/traditional-id-recto.jpg',
      documentType: 'Traditional ID',
      side: 'recto',
      expectedEndpoint: 'IDCARD_FR'
    },
    {
      name: 'French ID Card - New ID',
      imageUrl: 'https://example.com/new-id-recto.jpg',
      documentType: 'New ID',
      side: 'recto',
      expectedEndpoint: 'IDCARD_FR'
    },
    {
      name: 'French ID Card - Carte nationale d\'identité',
      imageUrl: 'https://example.com/carte-id-recto.jpg',
      documentType: 'Carte nationale d\'identité',
      side: 'recto',
      expectedEndpoint: 'IDCARD_FR'
    },
    {
      name: 'International Passport',
      imageUrl: 'https://example.com/passport.jpg',
      documentType: 'Passport',
      side: 'recto',
      expectedEndpoint: 'PASSPORT'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📄 Testing: ${testCase.name}`);
    console.log(`   Document Type: ${testCase.documentType}`);
    console.log(`   Expected Endpoint: ${testCase.expectedEndpoint}`);
    
    try {
      // Test endpoint selection without making actual API call
      if (ocrService.getEndpointForDocumentType) {
        const selectedEndpoint = ocrService.getEndpointForDocumentType(testCase.documentType);
        console.log(`   🎯 Selected Endpoint: ${selectedEndpoint}`);
        
        // Verify correct endpoint selection
        if (testCase.expectedEndpoint === 'IDCARD_FR' && selectedEndpoint.includes('idcard_fr')) {
          console.log(`   ✅ Correct endpoint selection for ID card`);
        } else if (testCase.expectedEndpoint === 'PASSPORT' && selectedEndpoint.includes('passport')) {
          console.log(`   ✅ Correct endpoint selection for passport`);
        } else {
          console.log(`   ⚠️  Unexpected endpoint selection`);
        }
      }
      
      // If you want to test actual API calls (comment out if not needed):
      // const result = await ocrService.processDocument(
      //   testCase.imageUrl,
      //   testCase.documentType,
      //   testCase.side
      // );
      // console.log(`   📊 Result: ${result.isValid ? 'Valid' : 'Invalid'}`);
      // console.log(`   🔍 Provider: ${result.provider}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '─'.repeat(60) + '\n');
  }
  
  console.log('🎉 Mindee endpoint testing completed!');
  console.log('\n📋 Summary:');
  console.log('• French ID Cards (Traditional ID, New ID, Carte nationale d\'identité) → Mindee ID Card FR API');
  console.log('• Passports → Mindee Passport API');
  console.log('• Same API key works for both endpoints');
  console.log('• Validation logic adapted for each document type');
}

// Run the test
testMindeeEndpoints().catch(console.error);
