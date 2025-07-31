// Test script to verify document-level fields are correctly populated
// Tests both recto-first and verso-first scenarios

const admin = require('firebase-admin');
const { processIDDocument, completeDocumentWithVideo } = require('./src/documentCheck/verifyIDDocument');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function testDocumentLevelFields() {
  console.log('\n=== Testing Document-Level Fields Aggregation ===\n');
  
  try {
    // Test scenario 1: Recto-first processing
    console.log('1. Testing Recto-first scenario...');
    
    const testUserId = `test-user-${Date.now()}`;
    const documentType = 'Traditional ID';
    
    // Create test recto document
    const rectoDocId = `recto-${Date.now()}`;
    await db.collection('uploadedDocument').doc(rectoDocId).set({
      userId: testUserId,
      documentType: documentType,
      side: 'recto',
      imageUrl: 'test-recto-url',
      filename: 'test-recto.jpg',
      createdAt: new Date()
    });
    
    // Process recto
    console.log('Processing recto...');
    const rectoResult = await processIDDocument(rectoDocId, {
      userId: testUserId,
      documentType: documentType,
      side: 'recto',
      imageUrl: 'test-recto-url',
      filename: 'test-recto.jpg'
    });
    
    console.log('Recto processing result:', {
      success: rectoResult.success,
      isValid: rectoResult.verificationResult.isValid,
      documentId: rectoResult.verificationStatus?.documentId
    });
    
    // Check document-level fields after recto
    if (rectoResult.verificationStatus?.documentId) {
      const verifiedDoc = await db.collection('verifiedDocument')
        .doc(rectoResult.verificationStatus.documentId).get();
      
      if (verifiedDoc.exists) {
        const data = verifiedDoc.data();
        console.log('\nDocument-level fields after recto processing:');
        console.log('- cardNumber:', data.cardNumber);
        console.log('- firstname:', data.firstname);
        console.log('- lastname:', data.lastname);
        console.log('- birthDate:', data.birthDate);
        console.log('- issueDate:', data.issueDate);
        console.log('- expiryDate:', data.expiryDate);
        console.log('- MRZ1:', data.MRZ1);
        console.log('- MRZ2:', data.MRZ2);
        console.log('- status:', data.status);
        
        // Process verso
        console.log('\nProcessing verso...');
        const versoDocId = `verso-${Date.now()}`;
        await db.collection('uploadedDocument').doc(versoDocId).set({
          userId: testUserId,
          documentType: documentType,
          side: 'verso',
          imageUrl: 'test-verso-url',
          filename: 'test-verso.jpg',
          createdAt: new Date()
        });
        
        const versoResult = await processIDDocument(versoDocId, {
          userId: testUserId,
          documentType: documentType,
          side: 'verso',
          imageUrl: 'test-verso-url',
          filename: 'test-verso.jpg'
        });
        
        console.log('Verso processing result:', {
          success: versoResult.success,
          isValid: versoResult.verificationResult.isValid,
          bothSidesComplete: versoResult.verificationStatus?.bothSidesComplete
        });
        
        // Check updated document-level fields after verso
        const updatedDoc = await db.collection('verifiedDocument')
          .doc(rectoResult.verificationStatus.documentId).get();
        
        if (updatedDoc.exists) {
          const updatedData = updatedDoc.data();
          console.log('\nDocument-level fields after verso processing:');
          console.log('- cardNumber:', updatedData.cardNumber);
          console.log('- firstname:', updatedData.firstname);
          console.log('- lastname:', updatedData.lastname);
          console.log('- birthDate:', updatedData.birthDate);
          console.log('- issueDate:', updatedData.issueDate);
          console.log('- expiryDate:', updatedData.expiryDate);
          console.log('- MRZ1:', updatedData.MRZ1);
          console.log('- MRZ2:', updatedData.MRZ2);
          console.log('- status:', updatedData.status);
          
          // Test video validation completion
          console.log('\nTesting video validation completion...');
          const videoResult = await completeDocumentWithVideo(testUserId, documentType, {
            isValid: true,
            confidence: 0.95,
            errors: []
          });
          
          console.log('Video validation result:', videoResult);
          
          // Check final document state
          const finalDoc = await db.collection('verifiedDocument')
            .doc(rectoResult.verificationStatus.documentId).get();
          
          if (finalDoc.exists) {
            const finalData = finalDoc.data();
            console.log('\nFinal document-level fields after video validation:');
            console.log('- cardNumber:', finalData.cardNumber);
            console.log('- firstname:', finalData.firstname);
            console.log('- lastname:', finalData.lastname);
            console.log('- birthDate:', finalData.birthDate);
            console.log('- issueDate:', finalData.issueDate);
            console.log('- expiryDate:', finalData.expiryDate);
            console.log('- MRZ1:', finalData.MRZ1);
            console.log('- MRZ2:', finalData.MRZ2);
            console.log('- status:', finalData.status);
            
            // Check if user data was updated in users collection
            if (finalData.status === 'completed') {
              console.log('\nChecking user data update...');
              try {
                const userDoc = await db.collection('users').doc(testUserId).get();
                if (userDoc.exists) {
                  const userData = userDoc.data();
                  console.log('\nUser data structure after document completion:');
                  console.log('- firstname:', JSON.stringify(userData.firstname, null, 2));
                  console.log('- lastname:', JSON.stringify(userData.lastname, null, 2));
                  console.log('- birthDate:', JSON.stringify(userData.birthDate, null, 2));
                  console.log('- updatedAt:', userData.updatedAt);
                } else {
                  console.log('❌ User document not found in users collection');
                }
              } catch (userError) {
                console.error('Error checking user data:', userError.message);
              }
            }
          }
        }
      }
    }
    
    console.log('\n=== Test completed successfully! ===');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  // Clean up test data
  try {
    console.log('\nCleaning up test data...');
    
    // Delete test uploadedDocuments
    const uploadedDocs = await db.collection('uploadedDocument')
      .where('userId', '>=', 'test-user-')
      .where('userId', '<=', 'test-user-\uf8ff')
      .get();
    
    for (const doc of uploadedDocs.docs) {
      await doc.ref.delete();
    }
    
    // Delete test verifiedDocuments
    const verifiedDocs = await db.collection('verifiedDocument')
      .where('userId', '>=', 'test-user-')
      .where('userId', '<=', 'test-user-\uf8ff')
      .get();
    
    for (const doc of verifiedDocs.docs) {
      await doc.ref.delete();
    }
    
    // Delete test user data
    const users = await db.collection('users')
      .where('updatedAt', '>=', new Date(Date.now() - 60000)) // Last minute
      .get();
    
    for (const doc of users.docs) {
      // Only delete test users (those with test- prefix or recent updates from our test)
      if (doc.id.startsWith('test-user-')) {
        await doc.ref.delete();
      }
    }
    
    console.log('Cleanup completed successfully');
    
  } catch (cleanupError) {
    console.error('Cleanup failed:', cleanupError.message);
  }
}

// Test scenario 2: Verso-first processing
async function testVersoFirstScenario() {
  console.log('\n=== Testing Verso-First Scenario ===\n');
  
  try {
    const testUserId = `test-user-verso-${Date.now()}`;
    const documentType = 'New ID';
    
    // Create test verso document first
    const versoDocId = `verso-first-${Date.now()}`;
    await db.collection('uploadedDocument').doc(versoDocId).set({
      userId: testUserId,
      documentType: documentType,
      side: 'verso',
      imageUrl: 'test-verso-url',
      filename: 'test-verso.jpg',
      createdAt: new Date()
    });
    
    // Process verso first
    console.log('Processing verso first...');
    const versoResult = await processIDDocument(versoDocId, {
      userId: testUserId,
      documentType: documentType,
      side: 'verso',
      imageUrl: 'test-verso-url',
      filename: 'test-verso.jpg'
    });
    
    console.log('Verso-first processing result:', {
      success: versoResult.success,
      isValid: versoResult.verificationResult.isValid,
      documentId: versoResult.verificationStatus?.documentId
    });
    
    // Check document-level fields after verso (first)
    if (versoResult.verificationStatus?.documentId) {
      const verifiedDoc = await db.collection('verifiedDocument')
        .doc(versoResult.verificationStatus.documentId).get();
      
      if (verifiedDoc.exists) {
        const data = verifiedDoc.data();
        console.log('\nDocument-level fields after verso-first processing:');
        console.log('- cardNumber:', data.cardNumber);
        console.log('- firstname:', data.firstname);
        console.log('- lastname:', data.lastname);
        console.log('- birthDate:', data.birthDate);
        console.log('- issueDate:', data.issueDate);
        console.log('- expiryDate:', data.expiryDate);
        console.log('- MRZ1:', data.MRZ1);
        console.log('- MRZ2:', data.MRZ2);
        console.log('- status:', data.status);
        
        console.log('\nNote: Some fields may be null as verso typically has limited data');
      }
      
      // Clean up verso-first test data
      await db.collection('uploadedDocument').doc(versoDocId).delete();
      await db.collection('verifiedDocument').doc(versoResult.verificationStatus.documentId).delete();
    }
    
    console.log('\n=== Verso-first test completed! ===');
    
  } catch (error) {
    console.error('Verso-first test failed:', error.message);
  }
}

// Run both tests
async function runAllTests() {
  await testDocumentLevelFields();
  await testVersoFirstScenario();
  process.exit(0);
}

runAllTests().catch(console.error);
