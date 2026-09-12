// ============================================================
// FF HUB — Firebase configuration
//
// 1. Go to https://console.firebase.google.com → create a project
// 2. Project settings → General → "Your apps" → add a Web app
// 3. Copy the config object it gives you and paste the values below
// 4. Enable in the Firebase console:
//      - Authentication → Sign-in method → Email/Password
//      - Firestore Database → Create database (start in production mode)
//      - Storage → Get started
// 5. Deploy the rules in firestore.rules and storage.rules
//    (Firebase console → Firestore/Storage → Rules tab → paste + publish)
//
// See README.md for the full step-by-step setup.
// ============================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
