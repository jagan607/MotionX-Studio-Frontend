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

/**
 * Operational KPIs from `task_tracking` collection.
 * Uses existing composite indexes: (status + scheduled_at), (task_type + scheduled_at)
 *
 * Returns:
 *  - failureRate: % of tasks that failed in last 24h
 *  - totalTasks24h: total generations attempted
 *  - failedTasks24h: failed count
 *  - latencyP50: median generation time in seconds (completed tasks)
 *  - latencyByType: { video: p50, image: p50, ... }
 */
export async function getOperationalKpis() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Parallel: fetch all tasks + failed tasks + completed tasks (for latency)
        const [allSnap, failedSnap, completedSnap] = await Promise.all([
            adminDb.collection('task_tracking')
                .where('scheduled_at', '>=', twentyFourHoursAgo)
                .get(),
            adminDb.collection('task_tracking')
                .where('status', '==', 'FAILED')
                .where('scheduled_at', '>=', twentyFourHoursAgo)
                .get(),
            adminDb.collection('task_tracking')
                .where('status', '==', 'COMPLETED')
                .where('scheduled_at', '>=', twentyFourHoursAgo)
                .get(),
        ]);

        const totalTasks24h = allSnap.size;
        const failedTasks24h = failedSnap.size;
        const failureRate = totalTasks24h > 0
            ? Math.round((failedTasks24h / totalTasks24h) * 100 * 10) / 10
            : 0;

        // Compute latencies from completed tasks
        const latencies: number[] = [];
        const latenciesByType: Record<string, number[]> = {};

        completedSnap.docs.forEach(doc => {
            const data = doc.data();
            const started = data.started_at?.toDate?.();
            const resolved = data.resolved_at?.toDate?.();
            if (started && resolved) {
                const latency = (resolved.getTime() - started.getTime()) / 1000;
                if (latency > 0 && latency < 3600) { // Sanity check: under 1h
                    latencies.push(latency);
                    const taskType = data.task_type || 'unknown';
                    if (!latenciesByType[taskType]) latenciesByType[taskType] = [];
                    latenciesByType[taskType].push(latency);
                }
            }
        });

        // P50 (median)
        const median = (arr: number[]) => {
            if (arr.length === 0) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };

        const latencyP50 = Math.round(median(latencies));
        const latencyByType: Record<string, number> = {};
        for (const [type, lats] of Object.entries(latenciesByType)) {
            latencyByType[type] = Math.round(median(lats));
        }

        // Error breakdown
        const errorBreakdown: Record<string, number> = {};
        failedSnap.docs.forEach(doc => {
            const code = doc.data().error_code || 'UNKNOWN';
            errorBreakdown[code] = (errorBreakdown[code] || 0) + 1;
        });

        return {
            totalTasks24h,
            failedTasks24h,
            failureRate,
            latencyP50,
            latencyByType,
            errorBreakdown,
        };
    } catch (error: any) {
        console.warn('[getOperationalKpis] Error:', error?.message || error);
        return {
            totalTasks24h: 0, failedTasks24h: 0, failureRate: 0,
            latencyP50: 0, latencyByType: {}, errorBreakdown: {},
        };
    }
}

/**
 * Growth KPIs computed from `users` and `transactions` collections.
 *
 * Returns:
 *  - totalUsers: lifetime signups
 *  - paidUsers: users with plan != "free"
 *  - freeUsers: users on free plan
 *  - conversionRate: paid / total %
 *  - churnCount30d: subscription cancellations in last 30 days
 *  - planBreakdown: { free: N, starter: N, pro: N, agency: N }
 */
export async function getGrowthKpis() {
    try {
        const usersSnap = await adminDb.collection('users').get();

        let totalUsers = 0;
        let paidUsers = 0;
        const planBreakdown: Record<string, number> = {};

        usersSnap.docs.forEach(doc => {
            totalUsers++;
            const plan = doc.data().plan || 'free';
            planBreakdown[plan] = (planBreakdown[plan] || 0) + 1;
            if (plan !== 'free') paidUsers++;
        });

        const conversionRate = totalUsers > 0
            ? Math.round((paidUsers / totalUsers) * 100 * 10) / 10
            : 0;

        // Churn: subscription cancellations in last 30 days
        let churnCount30d = 0;
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const churnSnap = await adminDb
                .collection('transactions')
                .where('type', '==', 'subscription_cancelled')
                .where('timestamp', '>=', thirtyDaysAgo)
                .get();
            churnCount30d = churnSnap.size;
        } catch {
            // Index may not exist yet — graceful fallback
        }

        return {
            totalUsers,
            paidUsers,
            freeUsers: totalUsers - paidUsers,
            conversionRate,
            churnCount30d,
            planBreakdown,
        };
    } catch (error: any) {
        console.warn('[getGrowthKpis] Error:', error?.message || error);
        return {
            totalUsers: 0, paidUsers: 0, freeUsers: 0,
            conversionRate: 0, churnCount30d: 0, planBreakdown: {},
        };
    }
}