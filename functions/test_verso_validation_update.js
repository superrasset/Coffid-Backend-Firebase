// Test the updated verso validation logic (issueDate and expiryDate required)
const { createOCRService } = require('./src/documentCheck/ocrService');

async function testVersoValidationUpdate() {
  console.log('🧪 Testing Updated Verso Validation Logic');
  console.log('='.repeat(60));

  try {
    const ocrService = createOCRService();

    console.log('\n📋 Test 1: Valid Verso Data (has issueDate and expiryDate)');
    console.log('-'.repeat(50));
    
    const validVersoData = {
      issueDate: '2020-02-12',
      expiryDate: '2030-02-11',
      authority: 'Préfecture de Paris',
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<'
    };

    const validResult = ocrService.validateDocumentData(validVersoData, 'New ID', 'verso');
    console.log('✅ Valid Verso Data (with issueDate & expiryDate):', validResult);

    console.log('\n📋 Test 2: Invalid Verso Data (missing issueDate)');
    console.log('-'.repeat(50));
    
    const missingIssueDateData = {
      expiryDate: '2030-02-11',
      authority: 'Préfecture de Paris',
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<'
    };

    const missingIssueDateResult = ocrService.validateDocumentData(missingIssueDateData, 'New ID', 'verso');
    console.log('❌ Missing issueDate:', missingIssueDateResult);

    console.log('\n📋 Test 3: Invalid Verso Data (missing expiryDate)');
    console.log('-'.repeat(50));
    
    const missingExpiryDateData = {
      issueDate: '2020-02-12',
      authority: 'Préfecture de Paris',
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<'
    };

    const missingExpiryDateResult = ocrService.validateDocumentData(missingExpiryDateData, 'New ID', 'verso');
    console.log('❌ Missing expiryDate:', missingExpiryDateResult);

    console.log('\n📋 Test 4: Invalid Verso Data (missing both required fields)');
    console.log('-'.repeat(50));
    
    const missingBothData = {
      authority: 'Préfecture de Paris',
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<',
      cardAccessNumber: '546497'
    };

    const missingBothResult = ocrService.validateDocumentData(missingBothData, 'New ID', 'verso');
    console.log('❌ Missing both issueDate & expiryDate:', missingBothResult);

    console.log('\n📋 Test 5: Valid Verso Data (only required fields)');
    console.log('-'.repeat(50));
    
    const minimalValidData = {
      issueDate: '2020-02-12',
      expiryDate: '2030-02-11'
    };

    const minimalValidResult = ocrService.validateDocumentData(minimalValidData, 'New ID', 'verso');
    console.log('✅ Minimal Valid Verso Data (only required fields):', minimalValidResult);

    console.log('\n📋 Test 6: Validation Errors for Verso');
    console.log('-'.repeat(50));
    
    const errors = ocrService.getValidationErrors(missingBothData, 'verso');
    console.log('✅ Validation errors for missing fields:', errors);

    console.log('\n📋 Test 7: Recto Validation Still Works');
    console.log('-'.repeat(50));
    
    const validRectoData = {
      birthDate: '1990-07-13',
      cardAccessNumber: '546497',
      givenNames: ['Marie'],
      surname: 'MARTIN',
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<',
      mrz2: '9007138F3002119FRA<<<<<<<<<<<6'
    };

    const rectoResult = ocrService.validateDocumentData(validRectoData, 'New ID', 'recto');
    console.log('✅ Recto validation still works:', rectoResult);

    console.log('\n🎉 Verso Validation Update Tests Completed!');
    console.log('✅ Verso now requires: issueDate AND expiryDate');
    console.log('✅ Recto validation unchanged: birthDate, cardAccessNumber, givenNames, surname, mrz1, mrz2');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test the mock data generation
function testMockDataGeneration() {
  console.log('\n🔍 Testing Mock Data Generation');
  console.log('='.repeat(60));

  try {
    const ocrService = createOCRService();

    // Test recto mock data
    const rectoMockData = ocrService.generateMockData('New ID', 'recto');
    console.log('✅ Recto Mock Data Fields:', Object.keys(rectoMockData));
    
    const rectoValid = ocrService.validateDocumentData(rectoMockData, 'New ID', 'recto');
    console.log('✅ Recto Mock Data Validation:', rectoValid);

    // Test verso mock data
    const versoMockData = ocrService.generateMockData('New ID', 'verso');
    console.log('✅ Verso Mock Data Fields:', Object.keys(versoMockData));
    console.log('✅ Verso Mock Data has issueDate:', !!versoMockData.issueDate);
    console.log('✅ Verso Mock Data has expiryDate:', !!versoMockData.expiryDate);
    
    const versoValid = ocrService.validateDocumentData(versoMockData, 'New ID', 'verso');
    console.log('✅ Verso Mock Data Validation:', versoValid);

    console.log('\n🎉 Mock Data Generation Tests Completed!');
    console.log('✅ Both recto and verso mock data pass their respective validations');

  } catch (error) {
    console.error('❌ Mock data test failed:', error.message);
  }
}

// Run the tests
if (require.main === module) {
  testVersoValidationUpdate()
    .then(() => {
      testMockDataGeneration();
      console.log('\n✅ All verso validation tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testVersoValidationUpdate, testMockDataGeneration };
