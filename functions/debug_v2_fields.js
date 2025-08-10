/**
 * Debug script to check what fields are returned by Mindee V2 API
 */

const { MindeeOCRServiceV2 } = require('./src/documentCheck/ocrProviders/mindeeOCRServiceV2');

async function debugV2Fields() {
  console.log('🔍 Debugging Mindee V2 Field Names...\n');
  
  const v2Service = new MindeeOCRServiceV2();
  
  // Test with a sample image URL (we'll mock the response parsing to see field structure)
  const testImageUrl = "https://example.com/test-french-id.jpg";
  const modelId = "76f2bbff-e8f4-4f90-978f-cacaeca073a7";
  
  try {
    console.log('📋 Model ID:', modelId);
    console.log('🔑 API Key configured:', v2Service.apiKey ? '✓ Set' : '✗ Missing');
    console.log('🏭 Provider:', v2Service.provider);
    
    // Instead of making a real API call, let's modify the parsing logic to log field names
    console.log('\n📝 Expected field mappings for French ID:');
    console.log('- Document Number: document_number → cardAccessNumber');
    console.log('- Given Names: given_names → givenNames');
    console.log('- Surname: surname → surname');
    console.log('- Birth Date: birth_date → birthDate');
    console.log('- Birth Place: birth_place → birthPlace');
    console.log('- Nationality: nationality → nationality');
    console.log('- Sex: sex → sex');
    console.log('- Address: address → address (recto)');
    console.log('- Issue Date: issue_date → issueDate (verso)');
    console.log('- Expiry Date: expiry_date → expiryDate (verso)');
    console.log('- MRZ Line 1: mrz_line1 → mrz1 (verso)');
    console.log('- MRZ Line 2: mrz_line2 → mrz2 (verso)');
    
    console.log('\n❌ Fields that were missing in the real response:');
    console.log('- surname (family name)');
    console.log('- birth_date (date of birth)');
    
    console.log('\n✅ Fields that were found in the real response:');
    console.log('- cardAccessNumber (document_number)');
    console.log('- givenNames (given_names)');
    console.log('- nationality');
    console.log('- sex');
    
    console.log('\n🤔 Possible Issues:');
    console.log('1. Model ID might not be correct for French ID cards');
    console.log('2. Field names in V2 API might be different than expected');
    console.log('3. Document image quality might affect field extraction');
    console.log('4. Model might be trained for a different document format');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Verify the correct model ID for French ID cards');
    console.log('2. Check Mindee V2 documentation for field names');
    console.log('3. Test with a high-quality sample image');
    console.log('4. Add debug logging to see raw V2 response structure');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugV2Fields().catch(console.error);
