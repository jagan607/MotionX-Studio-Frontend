import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// Construct the credentials object from Environment Variables
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // IMPORTANT: Vercel turns newlines (\n) into string literals (\\n), so we fix them here:
    privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
};

if (!getApps().length) {
    initializeApp({
        credential: cert(serviceAccount),
        storageBucket: "motionx-studio.firebasestorage.app" // Your bucket name
    });
}

const adminDb = getFirestore();
const adminAuth = getAuth();
const adminStorage = getStorage();

export { adminDb, adminAuth, adminStorage };