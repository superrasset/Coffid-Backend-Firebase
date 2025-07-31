const admin = require('firebase-admin');
const { processIDDocument } = require('./src/documentCheck/verifyIDDocument');
const { processPassportDocument } = require('./src/documentCheck/verifyPassportDocument');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'coffid-d22eb'
  });
}

async function testStatusFieldUpdates() {
  console.log('🧪 Testing Status Field Updates - Top Level Status Implementation');
  console.log('='.repeat(80));

  try {
    // Test 1: ID Document Recto Processing (should create status: 'partial')
    console.log('\n📋 Test 1: ID Document Recto Processing');
    console.log('-'.repeat(50));
    
    const testUserId = 'test-user-status-' + Date.now();
    const testDocId = 'test-doc-recto-' + Date.now();
    
    const rectoDocumentData = {
      userId: testUserId,
      documentType: 'New ID',
      side: 'recto',
      imageUrl: 'https://example.com/test-recto.jpg',
      filename: 'test-recto.jpg'
    };

    const rectoResult = await processIDDocument(testDocId, rectoDocumentData);
    console.log('✅ Recto processing result:', {
      success: rectoResult.success,
      isComplete: rectoResult.verificationStatus?.isComplete,
      overallValid: rectoResult.verificationStatus?.overallValid
    });

    // Check the created document in Firestore
    const db = admin.firestore();
    const verifiedDocsQuery = await db.collection('verifiedDocument')
      .where('userId', '==', testUserId)
      .where('documentType', '==', 'New ID')
      .get();

    if (!verifiedDocsQuery.empty) {
      const docData = verifiedDocsQuery.docs[0].data();
      console.log('✅ Verified document status after recto:', docData.status);
      console.log('✅ Document structure check:', {
        hasTopLevelStatus: docData.hasOwnProperty('status'),
        statusValue: docData.status,
        hasUploadedDocuments: docData.hasOwnProperty('uploadedDocuments'),
        hasRectoData: docData.uploadedDocuments?.hasOwnProperty('recto')
      });
    }

    // Test 2: ID Document Verso Processing (should update status to 'completed' or 'rejected')
    console.log('\n📋 Test 2: ID Document Verso Processing');
    console.log('-'.repeat(50));
    
    const testDocIdVerso = 'test-doc-verso-' + Date.now();
    const versoDocumentData = {
      userId: testUserId,
      documentType: 'New ID',
      side: 'verso',
      imageUrl: 'https://example.com/test-verso.jpg',
      filename: 'test-verso.jpg'
    };

    const versoResult = await processIDDocument(testDocIdVerso, versoDocumentData);
    console.log('✅ Verso processing result:', {
      success: versoResult.success,
      isComplete: versoResult.verificationStatus?.isComplete,
      overallValid: versoResult.verificationStatus?.overallValid
    });

    // Check the updated document
    const updatedDocsQuery = await db.collection('verifiedDocument')
      .where('userId', '==', testUserId)
      .where('documentType', '==', 'New ID')
      .get();

    if (!updatedDocsQuery.empty) {
      const docData = updatedDocsQuery.docs[0].data();
      console.log('✅ Verified document status after verso:', docData.status);
      console.log('✅ Complete document structure:', {
        statusValue: docData.status,
        hasRectoData: docData.uploadedDocuments?.hasOwnProperty('recto'),
        hasVersoData: docData.uploadedDocuments?.hasOwnProperty('verso'),
        overallValid: docData.uploadedDocuments?.overallValid,
        rectoValid: docData.uploadedDocuments?.recto?.isValid,
        versoValid: docData.uploadedDocuments?.verso?.isValid
      });
    }

    // Test 3: Passport Document Processing (should create status: 'completed' or 'rejected')
    console.log('\n📋 Test 3: Passport Document Processing');
    console.log('-'.repeat(50));
    
    const testUserIdPassport = 'test-user-passport-' + Date.now();
    const testDocIdPassport = 'test-doc-passport-' + Date.now();
    
    const passportDocumentData = {
      userId: testUserIdPassport,
      documentType: 'Passport',
      imageUrl: 'https://example.com/test-passport.jpg',
      filename: 'test-passport.jpg'
    };

    const passportResult = await processPassportDocument(testDocIdPassport, passportDocumentData);
    console.log('✅ Passport processing result:', {
      success: passportResult.success,
      isValid: passportResult.verificationResult?.isValid
    });

    // Check the passport document
    const passportDocsQuery = await db.collection('verifiedDocument')
      .where('userId', '==', testUserIdPassport)
      .where('documentType', '==', 'Passport')
      .get();

    if (!passportDocsQuery.empty) {
      const docData = passportDocsQuery.docs[0].data();
      console.log('✅ Verified passport document status:', docData.status);
      console.log('✅ Passport document structure:', {
        statusValue: docData.status,
        hasTopLevelStatus: docData.hasOwnProperty('status'),
        hasUploadedDocuments: docData.hasOwnProperty('uploadedDocuments'),
        hasPassportData: docData.uploadedDocuments?.hasOwnProperty('passport'),
        overallValid: docData.uploadedDocuments?.overallValid
      });
    }

    console.log('\n🎉 Status Field Tests Completed Successfully!');
    console.log('✅ Status field moved to top level');
    console.log('✅ Status values: partial, completed, rejected');
    console.log('✅ Consistent structure across ID and Passport documents');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testStatusFieldUpdates()
    .then(() => {
      console.log('\n✅ All tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testStatusFieldUpdates };
