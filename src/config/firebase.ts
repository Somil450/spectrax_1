// Firebase Configuration
// Replace these values with your Firebase project credentials
// Get these from Firebase Console: https://console.firebase.google.com/

import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase (only when config values are present)
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let app: ReturnType<typeof initializeApp>;

try {
  if (!firebaseConfig.apiKey) throw new Error("Missing Firebase config");
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Set persistence to LOCAL so users stay logged in across sessions
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn("Failed to set Firebase persistence:", error);
  });

  console.log("✅ Firebase initialized");
} catch (e) {
  console.warn("⚠️ Firebase not configured — running in offline/demo mode", e);
  // Create a minimal app stub so imports don't crash
  app = initializeApp({ apiKey: "demo", projectId: "demo", appId: "demo" }, "demo");
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db, app };
