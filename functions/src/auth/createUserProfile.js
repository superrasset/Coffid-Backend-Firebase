const {auth} = require("firebase-functions");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * Creates a new document in the 'users' collection whenever a new user signs up
 * via Firebase Authentication.
 * 
 * @param {Object} user - Firebase Auth user object
 */
const createUserProfile = auth.user().onCreate((user) => {
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

  const db = getFirestore();

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

module.exports = createUserProfile;
