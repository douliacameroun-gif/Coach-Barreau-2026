import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.error("Firebase init failed:", e);
}

export const db = app ? getFirestore(app, firebaseConfig.firestoreDatabaseId) : null;
export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

// Auth Helpers
export const loginWithGoogle = () => {
  if (!auth) throw new Error("Firebase Auth n'est pas initialisé.");
  return signInWithPopup(auth, googleProvider);
};
export const logout = () => {
  if (!auth) throw new Error("Firebase Auth n'est pas initialisé.");
  return signOut(auth);
};

export { onAuthStateChanged, doc, getDoc, setDoc, serverTimestamp, onSnapshot };
export type { User };
