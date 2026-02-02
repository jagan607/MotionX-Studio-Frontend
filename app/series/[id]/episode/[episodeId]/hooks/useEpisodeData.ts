import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, doc, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LocationProfile, CharacterProfile } from "@/lib/types";

export const useEpisodeData = (seriesId: string, episodeId: string) => {
    const [episodeData, setEpisodeData] = useState<any>(null);
    const [scenes, setScenes] = useState<any[]>([]);

    // State holds full CharacterProfile objects
    const [castMembers, setCastMembers] = useState<CharacterProfile[]>([]);

    // --- LOCATION STATES ---
    const [uniqueLocs, setUniqueLocs] = useState<string[]>([]);
    const [locations, setLocations] = useState<LocationProfile[]>([]);
    const [locationImages, setLocationImages] = useState<Record<string, string>>({});

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!seriesId || !episodeId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // NOTE: Check if your DB uses 'projects' or 'series' collection. 
                // Using 'projects' based on your recent backend refactor.
                const collectionName = "projects";

                // A. FETCH EPISODE METADATA
                const epRef = doc(db, collectionName, seriesId, "episodes", episodeId);
                const epDoc = await getDoc(epRef);

                const seriesRef = doc(db, collectionName, seriesId);
                const seriesDoc = await getDoc(seriesRef);

                if (!epDoc.exists()) return;
                const epData = epDoc.data();

                // Merge Series Metadata (Title, etc) into Episode Data
                if (seriesDoc.exists()) {
                    const seriesData = seriesDoc.data();
                    setEpisodeData({ ...seriesData, ...epData });
                } else {
                    setEpisodeData(epData);
                }

                // B. FETCH SCENES
                const querySnapshot = await getDocs(collection(epRef, "scenes"));
                const scenesData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                // @ts-ignore
                scenesData.sort((a, b) => a.scene_number - b.scene_number);
                setScenes(scenesData);

                // C. FETCH GLOBAL CHARACTERS
                const castIds: string[] = epData.cast_ids || [];

                if (castIds.length > 0) {
                    const charRef = collection(db, collectionName, seriesId, "characters");

                    // Batch request in chunks of 10
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

                            // --- FIX: Explicitly map required fields ---
                            fetchedChars.push({
                                id: doc.id,
                                name: data.name || "Unknown Character",
                                type: 'character',          // Explicitly set type
                                project_id: seriesId,       // Explicitly map seriesId
                                image_url: data.image_url || "",
                                status: data.status || 'active',
                                visual_traits: data.visual_traits || {},
                                voice_config: data.voice_config || {},
                                // Spread rest of data to catch any custom fields
                                ...data,
                            } as CharacterProfile);
                        });
                    }
                    setCastMembers(fetchedChars);
                } else {
                    setCastMembers([]);
                }

                // D. LOCATIONS
                const locs = new Set<string>();
                scenesData.forEach((s: any) => { if (s.location) locs.add(s.location); });
                setUniqueLocs(Array.from(locs));

                const locSnapshot = await getDocs(collection(db, collectionName, seriesId, "locations"));

                const fetchedLocations: LocationProfile[] = [];
                const locMap: Record<string, string> = {};

                locSnapshot.forEach(doc => {
                    const data = doc.data();

                    const locObj: LocationProfile = {
                        id: doc.id,
                        name: data.name || doc.id,
                        type: 'location',           // Explicitly set type
                        project_id: seriesId,       // Explicitly set ID
                        image_url: data.image_url || "",
                        visual_traits: data.visual_traits || {},
                        status: data.status || 'active',
                        ...data
                    } as LocationProfile;

                    fetchedLocations.push(locObj);

                    if (data.image_url) locMap[doc.id] = data.image_url;
                });

                setLocations(fetchedLocations);
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
        setCastMembers,
        uniqueLocs,
        locations,
        setLocations,
        locationImages,
        setLocationImages,
        loading
    };
};