import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
        // No session cookie — client-side auth handles lastActiveAt via AuthProvider
        return NextResponse.json({ status: 'no_session' });
    }

    try {
        // Dynamic imports to prevent module-level crash if firebase-admin fails to init
        const { adminDb, adminAuth } = await import('@/lib/firebase-admin');
        const admin = await import('firebase-admin');

        const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);

        await adminDb.collection('users').doc(decoded.uid).set({
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return NextResponse.json({ status: 'ok' });
    } catch (e) {
        console.error('[api/user/activity] Failed:', e);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}