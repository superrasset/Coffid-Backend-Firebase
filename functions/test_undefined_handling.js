// Test Undefined Values Handling in Mindee OCR Service
const {MindeeOCRService} = require('./src/documentCheck/ocrService');

// Mock Mindee response with missing/undefined fields
const mockMindeeResponseWithMissingFields = {
  "document": {
    "inference": {
      "prediction": {
        // Some fields present
        "surname": {
          "confidence": 0.95,
          "value": "MARTIN"
        },
        "birth_date": {
          "confidence": 0.90,
          "value": "1990-07-13"
        },
        // Missing given_names (should not break)
        // Missing document_type (should be handled)
        // Missing document_side (should be handled)
        "nationality": {
          "confidence": 0.88,
          "value": "FRA"
        }
        // Other fields missing
      }
    }
  }
};

async function testUndefinedHandling() {
  console.log('Testing Undefined Values Handling...\n');

  try {
    const mindeeService = new MindeeOCRService();

    console.log('=== Testing with missing fields ===');
    const extractedData = mindeeService.parseMindeeResponse(mockMindeeResponseWithMissingFields, 'recto');
    
    console.log('Extracted data (with missing fields):');
    console.log(JSON.stringify(extractedData, null, 2));

    // Check for undefined values
    const hasUndefinedValues = checkForUndefined(extractedData);
    console.log('\nHas undefined values:', hasUndefinedValues);

    if (!hasUndefinedValues) {
      console.log('✅ No undefined values found - safe for Firestore!');
    } else {
      console.log('❌ Found undefined values - would cause Firestore error');
    }

    // Test validation with missing data
    const isValid = mindeeService.validateDocumentData(extractedData, 'Traditional ID', 'recto');
    console.log('Validation result:', isValid);

    const errors = mindeeService.getValidationErrors(extractedData, 'recto');
    console.log('Validation errors:', errors);

    console.log('\n✅ Undefined handling test completed successfully');

  } catch (error) {
    console.error('❌ Undefined handling test failed:', error.message);
    console.error(error.stack);
  }
}

function checkForUndefined(obj, path = '') {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    
    if (value === undefined) {
      console.log(`Found undefined at: ${currentPath}`);
      return true;
    }
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      if (checkForUndefined(value, currentPath)) {
        return true;
      }
    }
    
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (value[i] === undefined) {
          console.log(`Found undefined in array at: ${currentPath}[${i}]`);
          return true;
        }
        if (value[i] !== null && typeof value[i] === 'object') {
          if (checkForUndefined(value[i], `${currentPath}[${i}]`)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Run test if called directly
if (require.main === module) {
  testUndefinedHandling();
}

module.exports = { testUndefinedHandling };
