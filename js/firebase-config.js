// ===========================================================================
//  FIREBASE CONFIGURATION
// ===========================================================================
//
//  Replace the placeholder values below with your own Firebase project's
//  config. You get this from the Firebase console:
//
//    1. Go to https://console.firebase.google.com and create a project.
//    2. Click the </> ("Web app") icon to register a web app.
//    3. Copy the `firebaseConfig` object it shows you and paste the values here.
//
//  Then enable, in the console:
//    - Authentication  ->  Sign-in method  ->  Google  (Enable)
//    - Firestore Database -> Create database (Production mode is fine)
//
//  Full step-by-step instructions are in README.md.
// ===========================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyC_dAbQ_FFadbOw-_Om3UbBlk6uxhcs-io",
  authDomain: "dcsa-cpp-game.firebaseapp.com",
  projectId: "dcsa-cpp-game",
  storageBucket: "dcsa-cpp-game.firebasestorage.app",
  messagingSenderId: "920388295819",
  appId: "1:920388295819:web:f3fe49fd7503644ebb488e",
};

// Leave this line as-is. It lets the app detect whether you've filled in the
// config yet, and show a friendly setup message instead of crashing.
export const isConfigured = !firebaseConfig.apiKey.startsWith("YOUR_");
