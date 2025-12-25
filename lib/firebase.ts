import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Extract project ID from service account key if available
let projectIdFromServiceAccount: string | undefined;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    projectIdFromServiceAccount = serviceAccount.project_id;
  }
} catch (error) {
  console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', error);
}

// Firebase configuration - use service account project_id as fallback
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || projectIdFromServiceAccount;

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

if (typeof window !== 'undefined') {
  // Only initialize on client side
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  // Server-side: create dummy objects to prevent errors
  // These won't be used on server-side
  auth = {} as Auth;
  db = {} as Firestore;
}

export { app, auth, db };
export default app;

