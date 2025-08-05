/**
 * Test Mock OCR Service
 * 
 * This script tests the mock OCR service to ensure it returns proper test data
 * for debugging document upload processes
 */

// Load environment variables from .env file
require('dotenv').config();

const { createOCRService, MockOCRService } = require('./src/documentCheck/ocrService');

async function testMockOCRService() {
  console.log('🧪 Testing Mock OCR Service...\n');
  console.log(`📝 OCR_PROVIDER environment variable: ${process.env.OCR_PROVIDER}\n`);
  
  // Create the OCR service (should be mock based on environment)
  const ocrService = createOCRService();
  console.log(`🔧 Using OCR Service: ${ocrService.constructor.name}\n`);
  
  // Also test the MockOCRService directly for comparison
  const mockService = new MockOCRService();
  
  // Test cases for different document types and sides
  const testCases = [
    {
      name: 'Traditional ID - Recto',
      imageUrl: 'https://example.com/traditional-id-recto.jpg',
      documentType: 'Traditional ID',
      side: 'recto'
    },
    {
      name: 'Traditional ID - Verso', 
      imageUrl: 'https://example.com/traditional-id-verso.jpg',
      documentType: 'Traditional ID',
      side: 'verso'
    },
    {
      name: 'New ID - Recto',
      imageUrl: 'https://example.com/new-id-recto.jpg',
      documentType: 'New ID',
      side: 'recto'
    },
    {
      name: 'New ID - Verso',
      imageUrl: 'https://example.com/new-id-verso.jpg', 
      documentType: 'New ID',
      side: 'verso'
    },
    {
      name: 'Passport - Recto',
      imageUrl: 'https://example.com/passport.jpg',
      documentType: 'Passport',
      side: 'recto'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`📄 Testing: ${testCase.name}`);
    console.log(`   Document Type: ${testCase.documentType}`);
    console.log(`   Side: ${testCase.side}`);
    
    try {
      // Test with the mock service directly
      const result = await mockService.processDocument(
        testCase.imageUrl,
        testCase.documentType,
        testCase.side
      );
      
      console.log(`   ✅ Success: ${result.isValid}`);
      console.log(`   📊 Confidence: ${result.confidence}`);
      console.log(`   🔍 Provider: ${result.provider}`);
      console.log(`   📋 Extracted Data:`, JSON.stringify(result.extractedData, null, 4));
      
      if (result.errors && result.errors.length > 0) {
        console.log(`   ⚠️  Errors:`, result.errors);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '─'.repeat(50) + '\n');
  }
  
  console.log('🎉 Mock OCR Service testing completed!');
}

// Run the test
testMockOCRService().catch(console.error);
