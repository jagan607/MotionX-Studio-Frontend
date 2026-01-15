// app/series/[id]/episode/[episodeId]/hooks/useEpisodeData.ts

import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const useEpisodeData = (seriesId: string, episodeId: string) => {
    const [episodeData, setEpisodeData] = useState<any>(null);
    const [scenes, setScenes] = useState<any[]>([]);
    const [uniqueChars, setUniqueChars] = useState<string[]>([]);
    const [uniqueLocs, setUniqueLocs] = useState<string[]>([]);
    const [characterImages, setCharacterImages] = useState<Record<string, string>>({});
    const [locationImages, setLocationImages] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!seriesId || !episodeId) return;

        const fetchData = async () => {
            try {
                // 1. Episode
                const epDoc = await getDoc(doc(db, "series", seriesId, "episodes", episodeId));
                if (epDoc.exists()) setEpisodeData(epDoc.data());

                // 2. Scenes
                const querySnapshot = await getDocs(collection(db, "series", seriesId, "episodes", episodeId, "scenes"));
                const scenesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // @ts-ignore
                scenesData.sort((a, b) => a.scene_number - b.scene_number);
                setScenes(scenesData);

                // 3. Unique Assets
                const chars = new Set<string>();
                const locs = new Set<string>();
                scenesData.forEach((s: any) => {
                    s.characters?.forEach((c: string) => chars.add(c));
                    if (s.location) locs.add(s.location);
                });
                setUniqueChars(Array.from(chars));
                setUniqueLocs(Array.from(locs));

                // 4. Character Images
                const charSnapshot = await getDocs(collection(db, "series", seriesId, "characters"));
                const charMap: Record<string, string> = {};
                charSnapshot.forEach(doc => charMap[doc.id] = doc.data().image_url);
                setCharacterImages(charMap);

                // 5. Location Images (FIXED LOGIC)
                const locSnapshot = await getDocs(collection(db, "series", seriesId, "locations"));
                const locMap: Record<string, string> = {};
                locSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.name) locMap[data.name] = data.image_url;
                });
                setLocationImages(locMap);

            } catch (e) { console.error(e); }
        };

        fetchData();
    }, [seriesId, episodeId]);

    return {
        episodeData, scenes, uniqueChars, uniqueLocs,
        characterImages, setCharacterImages,
        locationImages, setLocationImages
    };
};