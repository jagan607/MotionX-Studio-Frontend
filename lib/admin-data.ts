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