/**
 * Test script to check if video completion logic is working after Firestore index is built
 * This script simulates the final step of the video upload process
 */

const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { completeDocumentWithVideo } = require('./src/documentCheck/verifyIDDocument');

// Initialize Firebase Admin (will use project defaults in Cloud Functions environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Test the video completion logic directly
 */
async function testVideoCompletion() {
  try {
    console.log('🧪 Testing video completion after index creation...');
    
    // Test with the real user from the logs who had the index error
    const userId = 'axIzZnlaklWoRbmJoUYbrq3n3aJ3';
    const documentType = 'Traditional ID';
    
    console.log(`Testing with user: ${userId}`);
    console.log(`Document type: ${documentType}`);
    
    const db = getFirestore();
    
    // First, check if there's a document with status "partial 2/3" 
    console.log('\n🔍 Checking for document with status "partial 2/3"...');
    
    const querySnapshot = await db.collection('verifiedDocument')
      .where('userId', '==', userId)
      .where('documentType', '==', documentType)
      .where('status', '==', 'partial 2/3')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (querySnapshot.empty) {
      console.log('❌ No document found with status "partial 2/3" for this user');
      console.log('This means either:');
      console.log('1. The document has already been completed');
      console.log('2. The user hasn\'t completed both recto and verso yet');
      
      // Let's check what documents exist for this user
      const allDocsSnapshot = await db.collection('verifiedDocument')
        .where('userId', '==', userId)
        .where('documentType', '==', documentType)
        .orderBy('createdAt', 'desc')
        .get();
      
      if (!allDocsSnapshot.empty) {
        console.log('\n📋 Found these documents for the user:');
        allDocsSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`${index + 1}. Document ID: ${doc.id}`);
          console.log(`   Status: ${data.status}`);
          console.log(`   Created: ${data.createdAt?.toDate?.() || data.createdAt}`);
          console.log(`   Has video validation: ${!!data.uploadedDocuments?.videoValidation}`);
        });
      } else {
        console.log('❌ No verified documents found for this user at all');
      }
      
      return false;
    }
    
    console.log('✅ Found document with status "partial 2/3"');
    const docRef = querySnapshot.docs[0];
    const docData = docRef.data();
    
    console.log(`Document ID: ${docRef.id}`);
    console.log(`Current status: ${docData.status}`);
    console.log(`Created: ${docData.createdAt?.toDate?.() || docData.createdAt}`);
    
    // Now test the video completion
    console.log('\n🎥 Testing video completion...');
    
    const videoValidationResult = {
      isValid: true,
      confidence: 0.95,
      errors: []
    };
    
    const videoData = {
      faceRecordingUrl: 'https://example.com/face-recording-test.mp4',
      videoUrl: 'https://example.com/video-test.mp4',
      filename: 'face-recording-test.mp4'
    };
    
    const result = await completeDocumentWithVideo(userId, documentType, videoValidationResult, videoData);
    
    console.log('\n✅ Video completion result:');
    console.log(`Success: ${result.success}`);
    console.log(`Document ID: ${result.documentId}`);
    console.log(`Final status: ${result.finalStatus}`);
    console.log(`Final valid: ${result.finalValid}`);
    
    // Verify the document was updated
    console.log('\n🔍 Verifying document update...');
    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    
    console.log(`New status: ${updatedData.status}`);
    console.log(`Has video validation: ${!!updatedData.uploadedDocuments?.videoValidation}`);
    console.log(`Video data stored: ${JSON.stringify(updatedData.uploadedDocuments?.videoValidation, null, 2)}`);
    
    return result.success;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
    return false;
  }
}

// Run the test
testVideoCompletion()
  .then((success) => {
    console.log(`\n🏁 Test completed: ${success ? 'SUCCESS' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
