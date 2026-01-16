import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, doc, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";

// 1. Export Interface for use in page.tsx
export interface CharacterProfile {
    id: string;
    name: string;
    face_sample_url?: string;
    image_url?: string; // Included for type safety with DB fields
    voice_config?: {
        voice_id?: string;
        voice_name?: string;
    };
    status?: string;
}

export const useEpisodeData = (seriesId: string, episodeId: string) => {
    const [episodeData, setEpisodeData] = useState<any>(null);
    const [scenes, setScenes] = useState<any[]>([]);

    // 2. State holds full CharacterProfile objects
    const [castMembers, setCastMembers] = useState<CharacterProfile[]>([]);

    const [uniqueLocs, setUniqueLocs] = useState<string[]>([]);
    const [locationImages, setLocationImages] = useState<Record<string, string>>({});

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!seriesId || !episodeId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // A. FETCH EPISODE METADATA
                const epRef = doc(db, "series", seriesId, "episodes", episodeId);
                const epDoc = await getDoc(epRef);

                if (!epDoc.exists()) return;
                const epData = epDoc.data();
                setEpisodeData(epData);

                // B. FETCH SCENES
                const querySnapshot = await getDocs(collection(epRef, "scenes"));
                const scenesData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // @ts-ignore
                scenesData.sort((a, b) => a.scene_number - b.scene_number);
                setScenes(scenesData);

                // C. FETCH GLOBAL CHARACTERS (Optimized Batch Fetch)
                const castIds: string[] = epData.cast_ids || [];

                if (castIds.length > 0) {
                    const charRef = collection(db, "series", seriesId, "characters");

                    // Batch request in chunks of 10 (Firestore 'IN' limit)
                    const chunks = [];
                    for (let i = 0; i < castIds.length; i += 10) {
                        chunks.push(castIds.slice(i, i + 10));
                    }

                    const fetchedChars: CharacterProfile[] = [];

                    for (const chunk of chunks) {
                        const q = query(charRef, where(documentId(), "in", chunk));
                        const snap = await getDocs(q);

                        snap.forEach(doc => {
                            const data = doc.data();
                            // CRITICAL FIX: Map image_url to face_sample_url if needed
                            fetchedChars.push({
                                id: doc.id,
                                ...data,
                                face_sample_url: data.face_sample_url || data.image_url
                            } as CharacterProfile);
                        });
                    }
                    setCastMembers(fetchedChars);
                } else {
                    setCastMembers([]);
                }

                // D. LOCATIONS (Legacy Logic)
                const locs = new Set<string>();
                scenesData.forEach((s: any) => { if (s.location) locs.add(s.location); });
                setUniqueLocs(Array.from(locs));

                const locSnapshot = await getDocs(collection(db, "series", seriesId, "locations"));
                const locMap: Record<string, string> = {};
                locSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.name) locMap[data.name] = data.image_url;
                });
                setLocationImages(locMap);

            } catch (e) {
                console.error("Data Load Error:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [seriesId, episodeId]);

    return {
        episodeData,
        scenes,
        castMembers,
        setCastMembers, // Exposed for immediate UI updates after generation
        uniqueLocs,
        locationImages,
        setLocationImages,
        loading
    };
};