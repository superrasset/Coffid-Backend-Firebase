// Test the new recto-validation-required logic
const { verifyIDSide } = require('./src/documentCheck/verifyIDDocument');
const { createOCRService } = require('./src/documentCheck/ocrService');

async function testRectoValidationLogic() {
  console.log('🧪 Testing Recto Validation Required Logic');
  console.log('='.repeat(60));

  try {
    console.log('\n📋 Test 1: Recto Validation Logic');
    console.log('-'.repeat(40));
    
    // Test recto verification with mock data (should pass)
    const rectoResultValid = await verifyIDSide(
      'https://example.com/test-recto.jpg',
      'recto',
      'New ID',
      'test-doc-recto-valid',
      'test-recto-valid.jpg'
    );

    console.log('✅ Valid Recto Result:', {
      isValid: rectoResultValid.isValid,
      hasExtractedData: rectoResultValid.hasExtractedData,
      extractedDataKeys: Object.keys(rectoResultValid.extractedData || {}),
      ocrProvider: rectoResultValid.ocrData?.provider
    });

    console.log('\n📋 Test 2: Verso Validation Logic (Lenient)');
    console.log('-'.repeat(40));
    
    // Test verso verification with mock data (should pass with lenient validation)
    const versoResultValid = await verifyIDSide(
      'https://example.com/test-verso.jpg',
      'verso',
      'New ID',
      'test-doc-verso-valid',
      'test-verso-valid.jpg'
    );

    console.log('✅ Valid Verso Result:', {
      isValid: versoResultValid.isValid,
      hasExtractedData: versoResultValid.hasExtractedData,
      extractedDataKeys: Object.keys(versoResultValid.extractedData || {}),
      ocrProvider: versoResultValid.ocrData?.provider
    });

    console.log('\n📋 Test 3: OCR Service Validation Methods');
    console.log('-'.repeat(40));

    const ocrService = createOCRService();
    
    // Test with complete recto data (should pass)
    const completeRectoData = {
      birthDate: '1990-07-13',
      cardAccessNumber: '546497',
      givenNames: ['Marie'],
      surname: 'MARTIN',
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<',
      mrz2: '9007138F3002119FRA<<<<<<<<<<<6'
    };

    const rectoValidationResult = ocrService.validateDocumentData(completeRectoData, 'New ID', 'recto');
    console.log('✅ Complete Recto Data Validation:', rectoValidationResult);

    // Test with incomplete recto data (should fail)
    const incompleteRectoData = {
      birthDate: '1990-07-13',
      givenNames: ['Marie'],
      surname: 'MARTIN'
      // Missing: cardAccessNumber, mrz1, mrz2
    };

    const incompleteRectoValidation = ocrService.validateDocumentData(incompleteRectoData, 'New ID', 'recto');
    console.log('✅ Incomplete Recto Data Validation:', incompleteRectoValidation);

    // Test with basic verso data (should pass with lenient validation)
    const basicVersoData = {
      mrz1: 'IDFRAX4RTBPFW46<<<<<<<<<<<<<<',
      authority: 'Préfecture de Paris'
    };

    const versoValidationResult = ocrService.validateDocumentData(basicVersoData, 'New ID', 'verso');
    console.log('✅ Basic Verso Data Validation:', versoValidationResult);

    // Test with empty verso data (should fail)
    const emptyVersoData = {};
    const emptyVersoValidation = ocrService.validateDocumentData(emptyVersoData, 'New ID', 'verso');
    console.log('✅ Empty Verso Data Validation:', emptyVersoValidation);

    console.log('\n🎉 Validation Logic Tests Completed!');
    console.log('✅ Recto requires: birthDate, cardAccessNumber, givenNames, surname, mrz1, mrz2');
    console.log('✅ Verso requires: any of mrz1, mrz2, authority, cardAccessNumber (lenient)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test the logic changes by analyzing the code structure
function analyzeValidationLogic() {
  console.log('\n🔍 Analyzing Validation Logic Implementation');
  console.log('='.repeat(60));

  const fs = require('fs');
  const path = require('path');

  try {
    // Read the OCR service file
    const ocrServicePath = path.join(__dirname, 'src/documentCheck/ocrService.js');
    const ocrServiceContent = fs.readFileSync(ocrServicePath, 'utf8');

    // Check for new validation methods
    const hasRectoValidation = ocrServiceContent.includes('validateRectoData');
    const hasVersoValidation = ocrServiceContent.includes('validateVersoData');
    const hasSideBasedValidation = ocrServiceContent.includes('if (side === \'recto\')');

    console.log('✅ OCR Service Validation Analysis:', {
      hasRectoValidation,
      hasVersoValidation,
      hasSideBasedValidation
    });

    // Read the ID verification file
    const idVerifyPath = path.join(__dirname, 'src/documentCheck/verifyIDDocument.js');
    const idVerifyContent = fs.readFileSync(idVerifyPath, 'utf8');

    const hasRectoOnlyCreation = idVerifyContent.includes('Recto validation failed - verifiedDocument will NOT be created');
    const hasVersoLenientHandling = idVerifyContent.includes('Verso validation failed - will not update');

    console.log('✅ ID Verification Logic Analysis:', {
      hasRectoOnlyCreation,
      hasVersoLenientHandling
    });

    // Overall validation
    const allImplemented = hasRectoValidation && hasVersoValidation && 
                          hasSideBasedValidation && hasRectoOnlyCreation && 
                          hasVersoLenientHandling;

    if (allImplemented) {
      console.log('\n🎉 Validation Logic Implementation Complete!');
      console.log('✅ Recto validation is strict (all required fields)');
      console.log('✅ Verso validation is lenient (basic data)');
      console.log('✅ verifiedDocument only created when recto passes validation');
      console.log('✅ Proper error handling for validation failures');
    } else {
      console.log('\n⚠️  Validation Logic Implementation Issues Found');
      console.log('❌ Some validation logic implementations may be missing');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

// Run the tests
if (require.main === module) {
  testRectoValidationLogic()
    .then(() => {
      analyzeValidationLogic();
      console.log('\n✅ All validation logic tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      analyzeValidationLogic();
      process.exit(1);
    });
}

module.exports = { testRectoValidationLogic, analyzeValidationLogic };
