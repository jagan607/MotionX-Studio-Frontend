import { adminDb, adminStorage } from './firebase-admin';

export async function getDashboardStats() {
    // 1. Fetch Collections
    const [usersSnap, projectsSnap, logsSnap, transactionsSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('projects').get(),
        adminDb.collection('system_logs').orderBy('timestamp', 'desc').limit(10).get(),
        adminDb.collection('transactions').get() // Fetching all for MRR calc (optimize in prod)
    ]);

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // 2. Storage Calculation
    // (Assuming you've fixed the bucket name issue from previous steps)
    let totalGB = "0.00";
    try {
        const bucket = adminStorage.bucket("motionx-studio.firebasestorage.app");
        const [files] = await bucket.getFiles();
        const totalBytes = files.reduce((acc, file) => acc + parseInt(file.metadata.size || '0'), 0);
        totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
    } catch (e) {
        console.log("Storage calc error (check bucket name):", e);
    }

    // 3. User Metrics Calculation
    let dau = 0;
    let mau = 0;
    let liveSessions = 0;
    let chartDataMap = new Map(); // Use Map for easier date lookup

    // Initialize chart data (Last 7 days)
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = d.toISOString().split('T')[0];
        chartDataMap.set(dateKey, {
            date: d.toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: dateKey,
            users: 0,
            projects: 0 // We can now track project creation too
        });
    }

    usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const lastActive = data.lastActiveAt?.toDate ? data.lastActiveAt.toDate() : null;
        const joined = data.createdAt?.toDate ? data.createdAt.toDate() : null;

        // Active Counts
        if (lastActive) {
            if (lastActive > fifteenMinAgo) liveSessions++;
            if (lastActive > oneDayAgo) dau++;
            if (lastActive > thirtyDaysAgo) mau++;
        }

        // Chart: User Acquisition
        if (joined) {
            const dateKey = joined.toISOString().split('T')[0];
            if (chartDataMap.has(dateKey)) {
                chartDataMap.get(dateKey).users += 1;
            }
        }
    });

    const chartData = Array.from(chartDataMap.values());

    // 4. Financial Metrics (MRR)
    // Sum up 'subscription' transactions from last 30 days
    let mrr = 0;
    transactionsSnap.docs.forEach(doc => {
        const t = doc.data();
        const tDate = t.timestamp?.toDate();
        if (t.type === 'subscription' && tDate > thirtyDaysAgo) {
            mrr += (t.amount || 0);
        }
    });

    // 5. Activity Logs
    const recentActivity = logsSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            action: data.action || 'UNKNOWN',
            details: data.details || data.description || '', // Normalize field names
            time: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'
        };
    });

    return {
        stats: {
            totalUsers: usersSnap.size,
            totalProjects: projectsSnap.size,
            storageGB: totalGB,
            dau,
            mau,
            liveSessions,
            mrr
        },
        chartData,
        recentActivity
    };
}