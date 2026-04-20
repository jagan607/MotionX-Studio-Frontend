import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

/**
 * Robustly parse the FIREBASE_PRIVATE_KEY environment variable.
 *
 * Handles all common Vercel / CI formats:
 *   1. Literal "\\n" two-char sequences  → real newlines
 *   2. Already-real newlines             → pass-through
 *   3. JSON-encoded string (with outer quotes) → JSON.parse first
 */
function parsePrivateKey(raw: string | undefined): string | undefined {
    if (!raw) return undefined;

    let key = raw;

    // If the value was pasted as a JSON string (e.g. "\"-----BEGIN...\""),
    // unwrap it first.
    if (key.startsWith('"') && key.endsWith('"')) {
        try {
            key = JSON.parse(key);
        } catch {
            // Not valid JSON — continue with raw value
        }
    }

    // Replace all literal two-char "\\n" sequences with real newlines
    key = key.replace(/\\n/g, '\n');

    return key;
}

function getFirebaseApp() {
    if (getApps().length) return getApps()[0];

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (!projectId || !clientEmail || !privateKey) {
        console.error(
            '[firebase-admin] Missing credentials. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.',
            { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey }
        );
        throw new Error('Firebase Admin credentials are not configured.');
    }

    return initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        storageBucket: 'motionx-studio.firebasestorage.app',
    });
}

// Lazy-init: only initializes when first accessed, not at import time
let _db: ReturnType<typeof getFirestore> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _storage: ReturnType<typeof getStorage> | null = null;

export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
    get(_, prop) {
        if (!_db) { getFirebaseApp(); _db = getFirestore(); }
        return Reflect.get(_db, prop);
    },
});

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
    get(_, prop) {
        if (!_auth) { getFirebaseApp(); _auth = getAuth(); }
        return Reflect.get(_auth, prop);
    },
});

export const adminStorage = new Proxy({} as ReturnType<typeof getStorage>, {
    get(_, prop) {
        if (!_storage) { getFirebaseApp(); _storage = getStorage(); }
        return Reflect.get(_storage, prop);
    },
});