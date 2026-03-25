import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    try {
        const shotsRef = adminDb.collectionGroup('shots');
        
        // Use admin SDK to bypass client-side security rules for the landing page public feed
        const snapshot = await shotsRef
            .where('status', '==', 'rendered')
            .orderBy('created_at', 'desc')
            .limit(200)
            .get();

        const validShots = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((s: any) => s.image_url || s.video_url);

        // Randomize
        validShots.sort(() => 0.5 - Math.random());

        return NextResponse.json(validShots, { status: 200 });
    } catch (error) {
        console.error("Global Feed API Error:", error);
        return NextResponse.json({ error: "Failed to fetch global feed" }, { status: 500 });
    }
}
