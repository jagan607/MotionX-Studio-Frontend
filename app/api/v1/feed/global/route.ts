import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
    try {
        // ── Step 1: Find all free-plan users ──
        const usersSnapshot = await adminDb.collection('users')
            .where('plan', '==', 'free')
            .get();

        const freeUserIds = new Set(usersSnapshot.docs.map(d => d.id));

        if (freeUserIds.size === 0) {
            return NextResponse.json([], { status: 200 });
        }

        // ── Step 2: Find projects owned by free users ──
        // Firestore 'in' supports up to 30 values per query
        const freeUserArray = [...freeUserIds];
        const freeProjectIds: string[] = [];

        for (let i = 0; i < freeUserArray.length; i += 30) {
            const batch = freeUserArray.slice(i, i + 30);
            const projectsSnapshot = await adminDb.collection('projects')
                .where('owner_id', 'in', batch)
                .select() // Only fetch doc IDs, no field data needed
                .get();
            for (const doc of projectsSnapshot.docs) {
                freeProjectIds.push(doc.id);
            }
        }

        if (freeProjectIds.length === 0) {
            return NextResponse.json([], { status: 200 });
        }

        // ── Step 3: Fetch rendered shots from those projects ──
        // collectionGroup('shots') can't filter by parent doc ID directly,
        // so we query all rendered shots and filter by path
        const freeProjectSet = new Set(freeProjectIds);

        const shotsSnapshot = await adminDb.collectionGroup('shots')
            .where('status', '==', 'rendered')
            .orderBy('created_at', 'desc')
            .limit(500)
            .get();

        const freeShots = shotsSnapshot.docs
            .map(d => ({ id: d.id, _projectId: d.ref.path.split('/')[1], ...d.data() }))
            .filter((s: any) => freeProjectSet.has(s._projectId))
            .filter((s: any) => s.video_url || s.image_url)
            .map(({ _projectId, ...rest }: any) => rest);

        // Randomize and cap at 8 for the hero reel
        freeShots.sort(() => 0.5 - Math.random());
        const result = freeShots.slice(0, 8);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Global Feed API Error:", error);
        return NextResponse.json({ error: "Failed to fetch global feed" }, { status: 500 });
    }
}
