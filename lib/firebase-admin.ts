import 'server-only';
import * as admin from 'firebase-admin';

// 1. Import the service account JSON
// Note: You might need to adjust the path ("../../") depending on where this file is located relative to your root
const serviceAccount = require('@/serviceAccountKey.json');
// OR if using a relative path from lib/: 
// const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        // 2. Pass the entire JSON object directly
        credential: admin.credential.cert(serviceAccount),
        storageBucket: "motionx-studio.firebasestorage.app"
    });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();