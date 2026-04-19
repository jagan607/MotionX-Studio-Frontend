import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    try {
        // ── Read the pre-computed cache document (populated hourly by backend cron) ──
        const snap = await adminDb.doc('system_metadata/global_feed').get();

        // Guard: cache document missing or feed array empty
        if (!snap.exists || !snap.data()?.feed?.length) {
            return NextResponse.json([], {
                status: 200,
                headers: {
                    // Short TTL so the edge retries quickly once the cron populates
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
                },
            });
        }

        const items = snap.data()!.feed;

        return NextResponse.json(items, {
            status: 200,
            headers: {
                // 30 min fresh at the edge, 60 min stale-while-revalidate window
                'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
            },
        });
    } catch (error) {
        console.error("Global Feed API Error:", error);
        return NextResponse.json({ error: "Failed to fetch global feed" }, { status: 500 });
    }
}
