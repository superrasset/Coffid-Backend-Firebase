// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.

const { logger } = require("firebase-functions/logger");

const {onRequest} = require("firebase-functions/v2/https");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");

// The Firebase Admin SDK to access Firestore.
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore(); // This line gets the Firestore instance and assigns it to 'db'


// -----------------------------------------------------------------------------------------------------------
// ---------------------------------------------STARTING THE JOB HERE-----------------------------------------
// -----------------------------------------------------------------------------------------------------------

// LOCAL : 
// exemple -1 : http://localhost:5001/coffid-2388b/us-central1/generateQrCode?q=majorite
// exemple -2 :https://getprocessstatus-n7h5iyb34a-uc.a.run.app/?taskId=Rk8YsmkkIOEk37U4T0IB

// PROD : 
// exemple -1 :  https://generateqrcode-n7h5iyb34a-uc.a.run.app/?q=majorite
// exemple -2 :  https://getprocessstatus-n7h5iyb34a-uc.a.run.app/?taskId=Rk8YsmkkIOEk37U4T0IB

// TODO Residuel :
//     - Créer un deeplink



  // Import the qrcode library
const qrcode = require('qrcode');

// Function to generate a QR code based on text passed as a query parameter
exports.generateQrCode = onRequest(async (req, res) => {
    // Get the info the client wants to access
    const infoRequired = req.query.q;
    

    // Optional: Get desired QR code format from 'format' query parameter (e.g., 'png', 'svg', 'utf8')
    // Defaults to 'png' data URL
    //const format = 'svg';

    if (!infoRequired) {
        // If no text is provided, return a 400 Bad Request error
        return res.status(400).send('Please provide the data you want to check in the query parameter.');
    }

    try {


        const pendingRequest = await getFirestore()
        .collection("pendingRequest")
        
        //rajouter un switch case pour s'assurer qu'on nous envoie pas de la merde (type majorité/age/genre/...)
        
        .add({
          clientRequester : 'Pornhub',  
          infoRequired: infoRequired,
          status : 'pending',
          createdAt : new Date(),
          result:null,
          userId: null,
          userResponseUpdatedAt:null
        });

        let qrOutput;
        let contentType;

        
        //qrCodeText = 'com.rasset.appv2'
        qrCodeText = 'https://coffid.com/second/' + pendingRequest.id
        
        let qrFormat = 'text' //TODO : récupérer de la request

        switch (qrFormat.toLowerCase()) {
          case 'svg':
              qrOutput = await qrcode.toString(qrCodeText, { type: 'svg' });
              contentType = 'image/svg+xml';
              break;

          case 'text':
          default:
                qrOutput = qrCodeText
                contentType = 'application/json';
      }
        //qrOutput = await qrcode.toString(qrCodeText, { type: 'svg' });
        //contentType = 'image/svg+xml';
        //contentType = 'application/json';

        //TEST
        //-----------------------------Ne générer que le texte a display"
        //DIFN
        
        // Send the QR code back in the appropriate format
        if (contentType === 'application/json') {
            res.status(200).json({ 
              dataToEncode: qrOutput,
              taskId: pendingRequest.id });
            // renvoyer le task id
        } else {
            res.setHeader('Content-Type', contentType);
            res.status(200).send(qrOutput);
            
        }

    } catch (error) {
        // Log any errors and send a 500 Internal Server Error response
        
        res.status(500).send(error);
    }
});

// Function 2 (NEW API Layer): HTTP Trigger - Allows client to poll for status
exports.getProcessStatus = onRequest(async (req, res) => {
  const taskId = req.query.taskId;
  console.log(taskId)
  if (!taskId) {
      return res.status(400).send('Missing "taskId" query parameter.');
  }

  try {
      const taskDoc = await db.collection("pendingRequest").doc(taskId).get();
     
      if (!taskDoc.exists) {
          return res.status(404).json({ status: 'not_found', message: 'Task not found.' });
      }

      const data = taskDoc.data();
      // Return only the necessary public information
      res.status(200).json({
          taskId: taskId,
          status: data.status,
          result: data.result || null, // Only return result if available
          inforequired : data.infoRequired || null, // Include infoRequired if needed
          userResponseUpdatedAt: data.userResponseUpdatedAt || null, // Include userResponseUpdatedAt if needed
      });

  } catch (error) {
    console.log(error)    
    res.status(500).send('Error retrieving task status.');
  }
});


// Function 3 : Create a User collection once a user has signed up

// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const {auth} = require("firebase-functions"); // For 1st Gen auth functions


/**
 * Creates a new document in the 'users' collection whenever a new user signs up
 * via Firebase Authentication.
 */
exports.createUserProfile = auth.user().onCreate((user) => {
  // We only care about users with a UID (which all auth users have)
  if (!user.uid) {
    console.log("User has no UID, skipping profile creation.");
    return;
  }

  // Get relevant user data from the auth record
  const uid = user.uid;
  const email = user.email || null; // Email might not be present (e.g., anonymous, phone auth)
  const displayName = user.displayName || null; // Display name might not be present
  const photoURL = user.photoURL || null; // Photo URL might not be present

  // Prepare the initial user document data for Firestore
  const userDocData = {
    email: email,
    displayName: displayName,
    photoURL: photoURL,
    createdAt: new Date(), // Firestore's server timestamp
    // Add any other default fields you want
    age: null, // Initialize age as null or 0
    sex: null, // Initialize sex as null
    // Add other fields you plan to store
    // e.g., 'isAdmin': false, 'lastLogin': db.FieldValue.serverTimestamp()
  };

  // Set the user document in the 'users' collection using the UID as the document ID
  // The 'set' method with {merge: true} is good if you might update later,
  // but for initial creation, just 'set' without merge is fine.
  return db.collection("users").doc(uid).set(userDocData)
    .then(() => {
      console.log(`User profile created for UID: ${uid}`);
      return null; // Cloud Functions should return null or a Promise
    })
    .catch((error) => {
      console.error(`Error creating user profile for UID: ${uid}`, error);
      // You might want to log this error to Firebase Crashlytics or another monitoring tool
      throw new Error(`Failed to create user profile: ${error.message}`);
    });
});

