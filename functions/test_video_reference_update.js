/**
 * Test video reference update in verifiedDocument
 * This script tests that when a video is uploaded, the verifiedDocument is updated with:
 * 1. The video validation status
 * 2. A reference to the video (faceRecordingUrl, videoUrl, or filename)
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { completeDocumentWithVideo } = require('./src/documentCheck/verifyIDDocument');

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp({
    projectId: 'coffid-33bb1',
  });
}

const db = getFirestore();

// Test data
const testUserId = 'test_video_ref_user_001';
const documentType = 'Traditional ID';

/**
 * Setup test data - create a verifiedDocument with "partial 2/3" status
 */
async function setupTestData() {
  console.log('Setting up test data...');
  
  const verifiedDocData = {
    userId: testUserId,
    documentType: documentType,
    status: 'partial 2/3',
    createdAt: new Date(),
    updatedAt: new Date(),
    uploadedDocuments: {
      recto: {
        isValid: true,
        processedAt: new Date(),
        extractedData: {
          cardNumber: 'TEST123456',
          firstname: 'Jean',
          lastname: 'Dupont'
        }
      },
      verso: {
        isValid: true,
        processedAt: new Date(),
        extractedData: {
          birthDate: '1990-01-01'
        }
      },
      overallValid: true
    },
    // Document-level fields
    cardNumber: 'TEST123456',
    firstname: 'Jean',
    lastname: 'Dupont',
    birthDate: '1990-01-01'
  };
  
  const docRef = await db.collection('verifiedDocument').add(verifiedDocData);
  console.log('Created test verifiedDocument:', docRef.id);
  
  return docRef.id;
}

/**
 * Test video validation with faceRecordingUrl
 */
async function testVideoWithFaceRecordingUrl() {
  console.log('\n=== Testing video validation with faceRecordingUrl ===');
  
  try {
    const docId = await setupTestData();
    
    const videoValidationResult = {
      isValid: true,
      confidence: 0.95,
      errors: []
    };
    
    const videoData = {
      faceRecordingUrl: 'https://storage.googleapis.com/test-bucket/face_recording_001.mp4',
      filename: 'face_recording_001.mp4'
    };
    
    const result = await completeDocumentWithVideo(
      testUserId, 
      documentType, 
      videoValidationResult, 
      videoData
    );
    
    console.log('Video validation result:', result);
    
    // Check if the verifiedDocument was updated correctly
    const updatedDoc = await db.collection('verifiedDocument').doc(result.documentId).get();
    const updatedData = updatedDoc.data();
    
    console.log('Updated verifiedDocument status:', updatedData.status);
    console.log('Video validation data:', updatedData.uploadedDocuments?.videoValidation);
    
    // Verify the video reference was stored
    const videoValidation = updatedData.uploadedDocuments?.videoValidation;
    if (videoValidation?.faceRecordingUrl) {
      console.log('✅ Face recording URL stored correctly:', videoValidation.faceRecordingUrl);
    } else {
      console.log('❌ Face recording URL not found in verifiedDocument');
    }
    
    // Clean up
    await db.collection('verifiedDocument').doc(result.documentId).delete();
    console.log('Test document cleaned up');
    
  } catch (error) {
    console.error('Error in testVideoWithFaceRecordingUrl:', error);
  }
}

/**
 * Test video validation with videoUrl
 */
async function testVideoWithVideoUrl() {
  console.log('\n=== Testing video validation with videoUrl ===');
  
  try {
    const docId = await setupTestData();
    
    const videoValidationResult = {
      isValid: true,
      confidence: 0.88,
      errors: []
    };
    
    const videoData = {
      videoUrl: 'https://storage.googleapis.com/test-bucket/video_upload_001.mp4',
      filename: 'video_upload_001.mp4'
    };
    
    const result = await completeDocumentWithVideo(
      testUserId, 
      documentType, 
      videoValidationResult, 
      videoData
    );
    
    console.log('Video validation result:', result);
    
    // Check if the verifiedDocument was updated correctly
    const updatedDoc = await db.collection('verifiedDocument').doc(result.documentId).get();
    const updatedData = updatedDoc.data();
    
    console.log('Updated verifiedDocument status:', updatedData.status);
    console.log('Video validation data:', updatedData.uploadedDocuments?.videoValidation);
    
    // Verify the video reference was stored
    const videoValidation = updatedData.uploadedDocuments?.videoValidation;
    if (videoValidation?.videoUrl) {
      console.log('✅ Video URL stored correctly:', videoValidation.videoUrl);
    } else {
      console.log('❌ Video URL not found in verifiedDocument');
    }
    
    // Clean up
    await db.collection('verifiedDocument').doc(result.documentId).delete();
    console.log('Test document cleaned up');
    
  } catch (error) {
    console.error('Error in testVideoWithVideoUrl:', error);
  }
}

/**
 * Test video validation with both URLs
 */
async function testVideoWithBothUrls() {
  console.log('\n=== Testing video validation with both URLs ===');
  
  try {
    const docId = await setupTestData();
    
    const videoValidationResult = {
      isValid: true,
      confidence: 0.92,
      errors: []
    };
    
    const videoData = {
      faceRecordingUrl: 'https://storage.googleapis.com/test-bucket/face_recording_002.mp4',
      videoUrl: 'https://storage.googleapis.com/test-bucket/video_upload_002.mp4',
      filename: 'combined_video_002.mp4'
    };
    
    const result = await completeDocumentWithVideo(
      testUserId, 
      documentType, 
      videoValidationResult, 
      videoData
    );
    
    console.log('Video validation result:', result);
    
    // Check if the verifiedDocument was updated correctly
    const updatedDoc = await db.collection('verifiedDocument').doc(result.documentId).get();
    const updatedData = updatedDoc.data();
    
    console.log('Updated verifiedDocument status:', updatedData.status);
    console.log('Video validation data:', updatedData.uploadedDocuments?.videoValidation);
    
    // Verify both video references were stored
    const videoValidation = updatedData.uploadedDocuments?.videoValidation;
    if (videoValidation?.faceRecordingUrl && videoValidation?.videoUrl) {
      console.log('✅ Both video URLs stored correctly');
      console.log('  - Face recording URL:', videoValidation.faceRecordingUrl);
      console.log('  - Video URL:', videoValidation.videoUrl);
      console.log('  - Filename:', videoValidation.filename);
    } else {
      console.log('❌ One or both video URLs not found in verifiedDocument');
    }
    
    // Clean up
    await db.collection('verifiedDocument').doc(result.documentId).delete();
    console.log('Test document cleaned up');
    
  } catch (error) {
    console.error('Error in testVideoWithBothUrls:', error);
  }
}

/**
 * Test video validation with invalid result (should set status to rejected)
 */
async function testVideoValidationRejected() {
  console.log('\n=== Testing video validation with rejection ===');
  
  try {
    const docId = await setupTestData();
    
    const videoValidationResult = {
      isValid: false,
      confidence: 0.45,
      errors: ['Face recognition failed', 'Low video quality']
    };
    
    const videoData = {
      faceRecordingUrl: 'https://storage.googleapis.com/test-bucket/failed_face_recording.mp4',
      filename: 'failed_face_recording.mp4'
    };
    
    const result = await completeDocumentWithVideo(
      testUserId, 
      documentType, 
      videoValidationResult, 
      videoData
    );
    
    console.log('Video validation result:', result);
    
    // Check if the verifiedDocument was updated correctly
    const updatedDoc = await db.collection('verifiedDocument').doc(result.documentId).get();
    const updatedData = updatedDoc.data();
    
    console.log('Updated verifiedDocument status:', updatedData.status);
    console.log('Video validation data:', updatedData.uploadedDocuments?.videoValidation);
    
    // Verify the status is rejected and video reference is still stored
    if (updatedData.status === 'rejected') {
      console.log('✅ Status correctly set to rejected');
    } else {
      console.log('❌ Status should be rejected but is:', updatedData.status);
    }
    
    const videoValidation = updatedData.uploadedDocuments?.videoValidation;
    if (videoValidation?.faceRecordingUrl) {
      console.log('✅ Video reference stored even for rejected validation');
    } else {
      console.log('❌ Video reference should be stored even for rejected validation');
    }
    
    // Clean up
    await db.collection('verifiedDocument').doc(result.documentId).delete();
    console.log('Test document cleaned up');
    
  } catch (error) {
    console.error('Error in testVideoValidationRejected:', error);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting video reference update tests...\n');
  
  await testVideoWithFaceRecordingUrl();
  await testVideoWithVideoUrl();
  await testVideoWithBothUrls();
  await testVideoValidationRejected();
  
  console.log('\n=== All tests completed ===');
}

// Run the tests
runAllTests().catch(console.error);
