// Test script to simulate frontend video upload behavior (without 'side' field)
// This demonstrates how face/video uploads should be structured for the new system

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin (if not already initialized)
try {
  initializeApp();
} catch (error) {
  console.log('Firebase Admin already initialized');
}

const db = getFirestore();

// Test document structures for face/video uploads (NO 'side' field)
const videoUploadExamples = {
  // Example 1: Face recording upload with faceRecordingUrl
  faceRecordingUpload: {
    userId: "test-user-face-123",
    documentType: "Traditional ID", // Must match existing document type
    faceRecordingUrl: "https://storage.googleapis.com/bucket/face_recording_123.mp4",
    filename: "face_recording_user123.mp4",
    status: "pending",
    uploadedAt: new Date(),
    // NO 'side' field - this is key!
  },

  // Example 2: Video upload with videoUrl
  videoUpload: {
    userId: "test-user-video-456", 
    documentType: "New ID", // Must match existing document type
    videoUrl: "https://storage.googleapis.com/bucket/video_validation_456.mp4",
    filename: "video_validation_user456.mp4",
    status: "pending",
    uploadedAt: new Date(),
    // NO 'side' field - this is key!
  },

  // Example 3: Video upload detected by filename (fallback detection)
  filenameBasedVideoUpload: {
    userId: "test-user-filename-789",
    documentType: "Traditional ID",
    imageUrl: "https://storage.googleapis.com/bucket/face_recording_789.mp4", // Using imageUrl for compatibility
    filename: "face_recording_selfie_789.mp4", // Contains 'face' keyword
    status: "pending", 
    uploadedAt: new Date(),
    // NO 'side' field - this is key!
  },

  // Example 4: Another filename-based detection
  videoFilenameUpload: {
    userId: "test-user-video-file-999",
    documentType: "New ID", 
    imageUrl: "https://storage.googleapis.com/bucket/video_validation_999.mp4",
    filename: "video_liveness_check_999.mp4", // Contains 'video' keyword
    status: "pending",
    uploadedAt: new Date(),
    // NO 'side' field - this is key!
  }
};

async function testVideoUploadDetection() {
  console.log('=== Testing Video Upload Detection (No Side Field) ===\n');

  for (const [exampleName, uploadData] of Object.entries(videoUploadExamples)) {
    console.log(`\n📋 Testing ${exampleName}:`);
    console.log('Upload Data Structure:', JSON.stringify(uploadData, null, 2));
    
    try {
      // Add document to Firestore to trigger the function
      const docRef = await db.collection('uploadedDocument').add(uploadData);
      console.log(`✅ Document created with ID: ${docRef.id}`);
      
      // Wait a moment for the trigger to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if verifiedDocument was created/updated
      const verifiedDocs = await db.collection('verifiedDocument')
        .where('userId', '==', uploadData.userId)
        .where('documentType', '==', uploadData.documentType)
        .get();
      
      if (!verifiedDocs.empty) {
        const verifiedDoc = verifiedDocs.docs[0];
        const verifiedData = verifiedDoc.data();
        console.log(`✅ VerifiedDocument updated - Status: ${verifiedData.status}`);
        console.log(`   Document ID: ${verifiedDoc.id}`);
        
        // Check if user data was updated (should happen when status becomes 'completed')
        if (verifiedData.status === 'completed') {
          const userDoc = await db.collection('users').doc(uploadData.userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            console.log(`✅ User data updated:`, {
              hasFirstname: !!userData.firstname,
              hasLastname: !!userData.lastname, 
              hasBirthDate: !!userData.birthDate
            });
          }
        }
      } else {
        console.log('⚠️  No verifiedDocument found - check logs for processing errors');
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${exampleName}:`, error.message);
    }
  }
}

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  const userIds = Object.values(videoUploadExamples).map(ex => ex.userId);
  
  try {
    // Clean uploadedDocument collection
    const uploadedDocs = await db.collection('uploadedDocument').get();
    const uploadedBatch = db.batch();
    let uploadedCount = 0;
    
    uploadedDocs.forEach(doc => {
      const data = doc.data();
      if (userIds.includes(data.userId)) {
        uploadedBatch.delete(doc.ref);
        uploadedCount++;
      }
    });
    
    if (uploadedCount > 0) {
      await uploadedBatch.commit();
      console.log(`✅ Cleaned ${uploadedCount} uploadedDocument records`);
    }
    
    // Clean verifiedDocument collection  
    const verifiedDocs = await db.collection('verifiedDocument').get();
    const verifiedBatch = db.batch();
    let verifiedCount = 0;
    
    verifiedDocs.forEach(doc => {
      const data = doc.data();
      if (userIds.includes(data.userId)) {
        verifiedBatch.delete(doc.ref);
        verifiedCount++;
      }
    });
    
    if (verifiedCount > 0) {
      await verifiedBatch.commit();
      console.log(`✅ Cleaned ${verifiedCount} verifiedDocument records`);
    }
    
    // Clean users collection
    const usersBatch = db.batch();
    let usersCount = 0;
    
    for (const userId of userIds) {
      const userRef = db.collection('users').doc(userId);
      usersBatch.delete(userRef);
      usersCount++;
    }
    
    if (usersCount > 0) {
      await usersBatch.commit();
      console.log(`✅ Cleaned ${usersCount} user records`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

// Detection criteria documentation
function printDetectionCriteria() {
  console.log('\n=== Video Upload Detection Criteria ===');
  console.log('The backend detects video uploads when:');
  console.log('1. ✅ Document has faceRecordingUrl field');
  console.log('2. ✅ Document has videoUrl field'); 
  console.log('3. ✅ Document has NO side field AND filename contains "video" or "face"');
  console.log('\n⚠️  IMPORTANT: Video uploads should NEVER include a "side" field!');
  console.log('⚠️  The "side" field is only for document photos (recto/verso)');
  
  console.log('\n=== Frontend Requirements ===');
  console.log('When uploading face/video recordings, ensure:');
  console.log('• ❌ Do NOT include "side" field');
  console.log('• ✅ Include faceRecordingUrl OR videoUrl');
  console.log('• ✅ Use descriptive filename with "face" or "video"');
  console.log('• ✅ Include proper userId and documentType');
  
  console.log('\n=== Expected Flow ===');
  console.log('1. User uploads recto (side: "recto") → status: "partial 1/3"');
  console.log('2. User uploads verso (side: "verso") → status: "partial 2/3"'); 
  console.log('3. User uploads video (NO side field) → status: "completed"');
  console.log('4. User data updated in users collection');
}

// Run tests
async function runTests() {
  printDetectionCriteria();
  await testVideoUploadDetection();
  
  console.log('\n=== Test Complete ===');
  console.log('Check Firebase Functions logs for detailed processing information');
  console.log('Run cleanup if needed: await cleanupTestData()');
}

// Export for use in other scripts
module.exports = {
  videoUploadExamples,
  testVideoUploadDetection, 
  cleanupTestData,
  printDetectionCriteria
};

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}
