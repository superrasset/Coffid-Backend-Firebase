const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (will use default project config in Firebase environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Test video upload and verifiedDocument update
 */
async function testVideoUploadUpdate() {
  try {
    const userId = 'test-user-video-update-' + Date.now();
    const documentType = 'New ID';
    
    console.log('🧪 Testing video upload and verifiedDocument update...');
    console.log(`Test User ID: ${userId}`);
    
    // Step 1: Create a verifiedDocument with status "partial 2/3" (both sides completed)
    console.log('\n📝 Step 1: Creating verifiedDocument with status "partial 2/3"...');
    
    const verifiedDocRef = db.collection('verifiedDocument').doc();
    const mockVerifiedDoc = {
      userId: userId,
      documentType: documentType,
      status: 'partial 2/3',
      firstName: 'Test',
      lastName: 'User',
      dateOfBirth: '1990-01-01',
      uploadedDocuments: {
        recto: {
          isValid: true,
          processedAt: new Date().toISOString(),
          side: 'recto',
          uploadedDocumentId: 'mock-recto-id',
          filename: 'recto.jpg',
          imageUrl: 'https://example.com/recto.jpg',
          extractedData: {
            firstName: 'Test',
            lastName: 'User',
            dateOfBirth: '1990-01-01'
          }
        },
        verso: {
          isValid: true,
          processedAt: new Date().toISOString(),
          side: 'verso',
          uploadedDocumentId: 'mock-verso-id',
          filename: 'verso.jpg',
          imageUrl: 'https://example.com/verso.jpg',
          extractedData: {
            address: '123 Test Street'
          }
        },
        rectoProcessedAt: new Date(),
        versoProcessedAt: new Date(),
        overallValid: true,
        bothSidesCompletedAt: new Date()
      },
      createdAt: new Date()
    };
    
    await verifiedDocRef.set(mockVerifiedDoc);
    console.log(`✅ Created verifiedDocument: ${verifiedDocRef.id}`);
    
    // Step 2: Simulate video upload by creating a uploadedDocument with video data
    console.log('\n📹 Step 2: Simulating video upload...');
    
    const videoDocRef = db.collection('uploadedDocument').doc();
    const videoUploadData = {
      userId: userId,
      documentType: documentType,
      faceRecordingUrl: 'https://example.com/face-recording.mp4',
      videoUrl: 'https://example.com/video.mp4',
      filename: 'face-recording.mp4',
      uploadedAt: new Date(),
      // Note: No 'side' field - this triggers video processing
    };
    
    await videoDocRef.set(videoUploadData);
    console.log(`✅ Created video uploadedDocument: ${videoDocRef.id}`);
    console.log('Video data:', videoUploadData);
    
    // Wait for the trigger to process the video
    console.log('\n⏳ Waiting 5 seconds for trigger to process...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Check if verifiedDocument was updated with video data
    console.log('\n🔍 Step 3: Checking verifiedDocument update...');
    
    const updatedDoc = await verifiedDocRef.get();
    if (!updatedDoc.exists) {
      throw new Error('VerifiedDocument was deleted or not found');
    }
    
    const updatedData = updatedDoc.data();
    console.log('Updated verifiedDocument status:', updatedData.status);
    console.log('Video validation data:', updatedData.uploadedDocuments?.videoValidation);
    
    // Verify the updates
    const expectedUpdates = {
      statusShouldBe: 'completed',
      shouldHaveVideoValidation: true,
      shouldHaveFaceRecordingUrl: true,
      shouldHaveVideoUrl: true,
      shouldHaveFilename: true
    };
    
    const actualUpdates = {
      status: updatedData.status,
      hasVideoValidation: !!updatedData.uploadedDocuments?.videoValidation,
      hasFaceRecordingUrl: !!updatedData.uploadedDocuments?.videoValidation?.faceRecordingUrl,
      hasVideoUrl: !!updatedData.uploadedDocuments?.videoValidation?.videoUrl,
      hasFilename: !!updatedData.uploadedDocuments?.videoValidation?.filename
    };
    
    console.log('\n📊 Verification Results:');
    console.log('Expected:', expectedUpdates);
    console.log('Actual:', actualUpdates);
    
    // Check if all expected updates occurred
    const success = {
      statusCorrect: actualUpdates.status === expectedUpdates.statusShouldBe,
      videoValidationExists: actualUpdates.hasVideoValidation === expectedUpdates.shouldHaveVideoValidation,
      faceRecordingUrlExists: actualUpdates.hasFaceRecordingUrl === expectedUpdates.shouldHaveFaceRecordingUrl,
      videoUrlExists: actualUpdates.hasVideoUrl === expectedUpdates.shouldHaveVideoUrl,
      filenameExists: actualUpdates.hasFilename === expectedUpdates.shouldHaveFilename
    };
    
    const allSuccess = Object.values(success).every(v => v === true);
    
    console.log('\n✅ Success Check:');
    Object.entries(success).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}: ${value}`);
    });
    
    console.log(`\n${allSuccess ? '🎉' : '❌'} Overall Test Result: ${allSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    if (!allSuccess) {
      console.log('\n🔍 Full updated document data:');
      console.log(JSON.stringify(updatedData, null, 2));
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await verifiedDocRef.delete();
    await videoDocRef.delete();
    console.log('✅ Test data cleaned up');
    
    return allSuccess;
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run the test
testVideoUploadUpdate()
  .then((success) => {
    console.log(`\n🏁 Test completed: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
