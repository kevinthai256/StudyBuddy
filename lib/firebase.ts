import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

// Firebase configuration
// Note: Only NEXT_PUBLIC_* env vars are available on the client side
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ''),
  projectId: projectId || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.appspot.com` : ''),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Initialize Firebase (client-side only)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | undefined;

if (typeof window !== 'undefined') {
  // Only initialize on client side
  // Validate required config
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('Firebase client config is missing. Please add NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID to your .env file.');
    // Create dummy objects to prevent crashes
    app = {} as FirebaseApp;
    auth = {} as Auth;
    db = {} as Firestore;
    analytics = undefined;
  } else {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
    analytics = getAnalytics(app);
  }
} else {
  // Server-side: create dummy objects to prevent errors
  // These won't be used on server-side
  app = {} as FirebaseApp;
  auth = {} as Auth;
  db = {} as Firestore;
  analytics = undefined;
}

export { app, auth, db, analytics };
export default app;

