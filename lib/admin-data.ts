import { adminDb } from './firebase-admin';

/**
 * Fetches the 7-day user acquisition chart data.
 * Designed to be called independently within a Suspense boundary.
 */
export async function getChartData() {
    const now = new Date();
    const usersSnap = await adminDb.collection('users').get();

    const chartDataMap = new Map();

    // Initialize chart data (Last 7 days)
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = d.toISOString().split('T')[0];
        chartDataMap.set(dateKey, {
            date: d.toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: dateKey,
            users: 0,
            projects: 0
        });
    }

    usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const joined = data.createdAt?.toDate ? data.createdAt.toDate() : null;

        if (joined) {
            const dateKey = joined.toISOString().split('T')[0];
            if (chartDataMap.has(dateKey)) {
                chartDataMap.get(dateKey).users += 1;
            }
        }
    });

    return Array.from(chartDataMap.values());
}

/**
 * Fetches the last 10 system log entries for the Audit Stream.
 * Designed to be called independently within a Suspense boundary.
 */
export async function getAuditLogs() {
    const logsSnap = await adminDb
        .collection('system_logs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    return logsSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            action: data.action || 'UNKNOWN',
            details: data.details || data.description || '', // Normalize field names
            time: data.timestamp?.toDate
                ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Now'
        };
    });
}

/**
 * Fetches the landing page CMS configuration.
 * Designed to be called independently within a Suspense boundary.
 */
export async function getCmsConfig() {
    const cmsSnap = await adminDb.collection('site_config').doc('landing_page').get();
    return cmsSnap.exists
        ? cmsSnap.data()
        : { headline: 'Direct Everything', subhead: 'AI CINEMA ENGINE' };
}

/**
 * Computes MRR (grouped by currency) and active subscriber count
 * by querying the top-level `transactions` collection for recent
 * subscription charges (last 30 days).
 *
 * This avoids the need for a collection-group index on the
 * `subscription` subcollection, which Firestore treats as a
 * single-field exemption and cannot be deployed via CLI.
 *
 * Data model (written by backend webhook):
 *   transactions/{id} → { uid, type: "subscription_charge", amount, currency, timestamp }
 *
 * We deduplicate by UID so each subscriber is counted once
 * at their most recent payment amount.
 */
export async function getMrrStats() {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const txSnap = await adminDb
            .collection('transactions')
            .where('type', '==', 'subscription_charge')
            .where('timestamp', '>=', thirtyDaysAgo)
            .get();

        // Deduplicate by UID — keep latest payment per user
        const latestByUser = new Map<string, { amount: number; currency: string }>();

        txSnap.docs.forEach(doc => {
            const data = doc.data();
            const uid = data.uid;
            const amount = data.amount || 0;
            const currency = (data.currency || 'USD').toUpperCase();

            if (uid && amount > 0) {
                latestByUser.set(uid, { amount, currency });
            }
        });

        // Aggregate
        let activeSubscribers = 0;
        const mrrByCurrency: Record<string, number> = {};

        latestByUser.forEach(({ amount, currency }) => {
            activeSubscribers++;
            mrrByCurrency[currency] = (mrrByCurrency[currency] || 0) + amount;
        });

        return { activeSubscribers, mrrByCurrency };
    } catch (error: any) {
        // Log the index creation URL from the error so admin can click it
        console.warn('[getMrrStats] Index not ready — click the link in the error above to create it.');
        console.warn(error?.message || error);
        return { activeSubscribers: 0, mrrByCurrency: {} };
    }
}

/**
 * Counts active sessions by querying the `active_sessions` collection
 * for documents with `last_seen` within the last 2 minutes.
 *
 * The heartbeat client hook writes to: active_sessions/{uid}
 * with fields: { uid, last_seen: serverTimestamp() }
 */
export async function getActiveSessionCount() {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const snap = await adminDb
        .collection('active_sessions')
        .where('last_seen', '>=', twoMinutesAgo)
        .get();

    return snap.size;
}