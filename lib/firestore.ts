import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (server-side only)
if (!getApps().length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Fallback: try using individual env vars (for easier setup)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } else {
      console.warn('Firebase not initialized - missing credentials');
    }
  }
}

export const db = getFirestore();

// User data structure type
export interface UserData {
  todos: any[];
  studySessions: Record<string, number>;
  events: Record<string, any[]>;
  loginStreak: number;
  lastLogin: string;
}

// Helper functions for Firestore operations
export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return null;
    }

    const data = userDoc.data() as UserData;
    return data;
  } catch (error) {
    console.error('Error fetching user data from Firestore:', error);
    throw error;
  }
}

export async function saveUserData(userId: string, data: UserData): Promise<void> {
  try {
    await db.collection('users').doc(userId).set(data, { merge: true });
  } catch (error) {
    console.error('Error saving user data to Firestore:', error);
    throw error;
  }
}

