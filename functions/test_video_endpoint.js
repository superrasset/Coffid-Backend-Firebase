// Test script for video validation endpoint

const axios = require('axios');

// Test data
const testData = {
  userId: 'test-user-123',
  documentType: 'Traditional ID',
  videoValidationResult: {
    isValid: true,
    confidence: 0.95,
    errors: []
  }
};

const testDataInvalid = {
  userId: 'test-user-123',
  documentType: 'Traditional ID',
  videoValidationResult: {
    isValid: false,
    confidence: 0.3,
    errors: ['Video quality too low', 'Face not clearly visible']
  }
};

async function testVideoValidationEndpoint() {
  console.log('=== Testing Video Validation Endpoint ===\n');

  // Test local endpoint (if running locally)
  const localUrl = 'http://localhost:5001/coffid-2388b/us-central1/processVideoValidation';
  
  // Test production endpoint (update with actual URL after deployment)
  const productionUrl = 'https://processvideovaliation-n7h5iyb34a-uc.a.run.app/';

  // Use local URL for testing
  const testUrl = localUrl;

  try {
    console.log('1. Testing valid video validation...');
    console.log('Request URL:', testUrl);
    console.log('Request Body:', JSON.stringify(testData, null, 2));

    const response = await axios.post(testUrl, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('HTTP Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Network Error:', error.message);
      console.log('Make sure Firebase functions are running locally with: firebase emulators:start');
    } else {
      console.error('Error:', error.message);
    }
  }

  console.log('\n2. Testing invalid video validation...');
  try {
    const response2 = await axios.post(testUrl, testDataInvalid, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Response Status:', response2.status);
    console.log('Response Body:', JSON.stringify(response2.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.error('HTTP Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else {
      console.error('Error:', error.message);
    }
  }

  console.log('\n3. Testing validation errors...');
  try {
    // Test with missing userId
    const invalidData = {
      documentType: 'Traditional ID',
      videoValidationResult: {
        isValid: true,
        confidence: 0.95
      }
    };

    const response3 = await axios.post(testUrl, invalidData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Response Status:', response3.status);
    console.log('Response Body:', JSON.stringify(response3.data, null, 2));

  } catch (error) {
    if (error.response) {
      console.log('Expected validation error:', {
        status: error.response.status,
        data: error.response.data
      });
    } else {
      console.error('Unexpected error:', error.message);
    }
  }
}

// Example curl commands for testing
console.log('=== Example curl commands for testing ===\n');

console.log('Local testing:');
console.log(`curl -X POST http://localhost:5001/coffid-2388b/us-central1/processVideoValidation \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testData)}'`);

console.log('\nProduction testing (after deployment):');
console.log(`curl -X POST https://processvideovaliation-n7h5iyb34a-uc.a.run.app/ \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testData)}'`);

console.log('\n=== Expected Request Format ===');
console.log(`
POST /processVideoValidation
Content-Type: application/json

{
  "userId": "user123",
  "documentType": "Traditional ID",
  "videoValidationResult": {
    "isValid": true,
    "confidence": 0.95,
    "errors": []
  }
}
`);

console.log('=== Expected Response Format ===');
console.log(`
Success (200):
{
  "success": true,
  "message": "Video validation processed successfully",
  "data": {
    "success": true,
    "documentId": "doc123",
    "finalStatus": "completed",
    "finalValid": true
  }
}

Error (400/500):
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
`);

// Run the test if axios is available
if (typeof require !== 'undefined') {
  try {
    testVideoValidationEndpoint();
  } catch (e) {
    console.log('To run this test, install axios: npm install axios');
    console.log('Then run: node test_video_endpoint.js');
  }
}
