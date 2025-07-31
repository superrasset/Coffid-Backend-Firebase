// Test Mindee Response Parsing with Real Data Structure
const {MindeeOCRService} = require('./src/documentCheck/ocrService');

// Mock Mindee API response based on your example
const mockMindeeResponse = {
  "api_request": {
    "error": {},
    "resources": ["document"],
    "status": "success",
    "status_code": 201,
    "url": "https://api.mindee.net/v1/products/mindee/idcard_fr/v2/predict"
  },
  "document": {
    "id": "5f54ccf1-32c4-470f-8fbb-00b0bb1e151d",
    "inference": {
      "finished_at": "2025-07-31T15:18:33+00:00",
      "is_rotation_applied": true,
      "pages": [
        {
          "id": 0,
          "prediction": {
            "alternate_name": {
              "confidence": 0.99,
              "value": "vve. DUBOIS"
            },
            "authority": {
              "confidence": 0.99,
              "value": "Préfecture de Paris"
            },
            "birth_date": {
              "confidence": 0.99,
              "value": "1990-07-13"
            },
            "birth_place": {
              "confidence": 0.99,
              "value": "PARIS"
            },
            "card_access_number": {
              "confidence": 0.99,
              "value": "546497"
            },
            "document_number": {
              "confidence": 0.99,
              "value": "D2H6862M2"
            },
            "document_side": {
              "confidence": 0.99,
              "value": "RECTO & VERSO"
            },
            "document_type": {
              "confidence": 0.99,
              "value": "NEW"
            },
            "expiry_date": {
              "confidence": 0.99,
              "value": "2030-02-11"
            },
            "gender": {
              "confidence": 0.99,
              "value": "F"
            },
            "given_names": [
              {
                "confidence": 0.99,
                "value": "Marie"
              }
            ],
            "issue_date": {
              "confidence": 0.99,
              "value": "2020-02-12"
            },
            "mrz1": {
              "confidence": 0.99,
              "value": "IDFRAX4RTBPFW46<<<<<<<<<<<<<<<"
            },
            "mrz2": {
              "confidence": 0.99,
              "value": "9007138F3002119FRA<<<<<<<<<<<6"
            },
            "mrz3": {
              "confidence": 0.99,
              "value": "MARTIN<<MAELYS<GAELLE<MARIE<<<"
            },
            "nationality": {
              "confidence": 0.99,
              "value": "FRA"
            },
            "surname": {
              "confidence": 0.99,
              "value": "MARTIN"
            }
          }
        }
      ],
      "prediction": {
        "alternate_name": {
          "confidence": 0.99,
          "value": "vve. DUBOIS"
        },
        "authority": {
          "confidence": 0.99,
          "value": "Préfecture de Paris"
        },
        "birth_date": {
          "confidence": 0.99,
          "value": "1990-07-13"
        },
        "birth_place": {
          "confidence": 0.99,
          "value": "PARIS"
        },
        "card_access_number": {
          "confidence": 0.99,
          "value": "546497"
        },
        "document_number": {
          "confidence": 0.99,
          "value": "D2H6862M2"
        },
        "document_side": {
          "confidence": 0.99,
          "value": "RECTO & VERSO"
        },
        "document_type": {
          "confidence": 0.99,
          "value": "NEW"
        },
        "expiry_date": {
          "confidence": 0.99,
          "value": "2030-02-11"
        },
        "gender": {
          "confidence": 0.99,
          "value": "F"
        },
        "given_names": [
          {
            "confidence": 0.99,
            "value": "Marie"
          }
        ],
        "issue_date": {
          "confidence": 0.99,
          "value": "2020-02-12"
        },
        "mrz1": {
          "confidence": 0.99,
          "value": "IDFRAX4RTBPFW46<<<<<<<<<<<<<<<"
        },
        "mrz2": {
          "confidence": 0.99,
          "value": "9007138F3002119FRA<<<<<<<<<<<6"
        },
        "mrz3": {
          "confidence": 0.99,
          "value": "MARTIN<<MAELYS<GAELLE<MARIE<<<"
        },
        "nationality": {
          "confidence": 0.99,
          "value": "FRA"
        },
        "surname": {
          "confidence": 0.99,
          "value": "MARTIN"
        }
      },
      "processing_time": 1.082,
      "product": {
        "features": [
          "nationality",
          "card_access_number",
          "document_number",
          "given_names",
          "surname",
          "alternate_name",
          "birth_date",
          "birth_place",
          "gender",
          "expiry_date",
          "orientation",
          "mrz1",
          "mrz2",
          "mrz3",
          "issue_date",
          "authority",
          "document_type",
          "document_side"
        ],
        "name": "mindee/Carte Nationale d'Identité",
        "version": "2.0"
      },
      "started_at": "2025-07-31T15:18:32+00:00"
    },
    "n_pages": 1,
    "name": "myfile.jpg"
  }
};

async function testMindeeResponseParsing() {
  console.log('Testing Mindee Response Parsing...\n');

  try {
    const mindeeService = new MindeeOCRService();

    // Test parsing recto side
    console.log('=== Testing RECTO side parsing ===');
    const rectoData = mindeeService.parseMindeeResponse(mockMindeeResponse, 'recto');
    console.log('Extracted data (recto):', JSON.stringify(rectoData, null, 2));
    
    const rectoValid = mindeeService.validateDocumentData(rectoData, 'Traditional ID', 'recto');
    console.log('Recto validation result:', rectoValid);
    
    if (!rectoValid) {
      const rectoErrors = mindeeService.getValidationErrors(rectoData, 'recto');
      console.log('Recto validation errors:', rectoErrors);
    }

    console.log('\n=== Testing VERSO side parsing ===');
    const versoData = mindeeService.parseMindeeResponse(mockMindeeResponse, 'verso');
    console.log('Extracted data (verso):', JSON.stringify(versoData, null, 2));
    
    const versoValid = mindeeService.validateDocumentData(versoData, 'Traditional ID', 'verso');
    console.log('Verso validation result:', versoValid);
    
    if (!versoValid) {
      const versoErrors = mindeeService.getValidationErrors(versoData, 'verso');
      console.log('Verso validation errors:', versoErrors);
    }

    console.log('\n=== Confidence Calculation ===');
    const confidence = mindeeService.calculateConfidence(mockMindeeResponse);
    console.log('Overall confidence:', confidence);

    console.log('\n✅ Mindee response parsing test completed successfully');

  } catch (error) {
    console.error('❌ Mindee response parsing test failed:', error.message);
    console.error(error.stack);
  }
}

// Run test if called directly
if (require.main === module) {
  testMindeeResponseParsing();
}

module.exports = { testMindeeResponseParsing, mockMindeeResponse };
