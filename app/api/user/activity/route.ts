import { adminDb, adminAuth } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin'; // <--- IMPORT THIS
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    // Await the cookies() call
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) return NextResponse.json({ status: 'no_session' });

    try {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

        // Simple, type-safe update
        await adminDb.collection('users').doc(decoded.uid).set({
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return NextResponse.json({ status: 'ok' });
    } catch (e) {
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}