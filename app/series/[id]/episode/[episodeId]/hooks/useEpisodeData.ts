import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, doc, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LocationProfile, CharacterProfile } from "@/lib/types";

export const useEpisodeData = (seriesId: string, episodeId: string) => {
    const [episodeData, setEpisodeData] = useState<any>(null);
    const [scenes, setScenes] = useState<any[]>([]);

    // State holds full CharacterProfile objects
    const [castMembers, setCastMembers] = useState<CharacterProfile[]>([]);

    // --- UPDATED LOCATION STATES ---
    const [uniqueLocs, setUniqueLocs] = useState<string[]>([]); // Just the names (from script)
    const [locations, setLocations] = useState<LocationProfile[]>([]); // The Full DB Objects
    const [locationImages, setLocationImages] = useState<Record<string, string>>({}); // Legacy Map (Name -> URL)

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
                            fetchedChars.push({
                                id: doc.id,
                                ...data,
                                face_sample_url: data.face_sample_url || data.image_url,
                                visual_traits: data.visual_traits || {} // Ensure this exists
                            } as CharacterProfile);
                        });
                    }
                    setCastMembers(fetchedChars);
                } else {
                    setCastMembers([]);
                }

                // D. LOCATIONS (UPDATED LOGIC)
                // 1. Extract unique names from the Script Scenes
                const locs = new Set<string>();
                scenesData.forEach((s: any) => { if (s.location) locs.add(s.location); });
                setUniqueLocs(Array.from(locs));

                // 2. Fetch stored Location Profiles from Firestore
                const locSnapshot = await getDocs(collection(db, "series", seriesId, "locations"));

                const fetchedLocations: LocationProfile[] = [];
                const locMap: Record<string, string> = {};

                locSnapshot.forEach(doc => {
                    const data = doc.data();

                    // Build the full object
                    const locObj: LocationProfile = {
                        id: doc.id,
                        name: data.name || doc.id,
                        image_url: data.image_url || "",
                        visual_traits: data.visual_traits || {}, // Default to empty object if missing
                        base_prompt: data.base_prompt || "",
                        status: data.status || 'active'
                    };

                    fetchedLocations.push(locObj);

                    // Build the legacy map (Name -> Image URL) for the grid view
                    if (data.name) locMap[data.name] = data.image_url;
                });

                setLocations(fetchedLocations); // NEW State
                setLocationImages(locMap);      // Legacy State

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
        uniqueLocs,      // List of strings (Scene headers)
        locations,       // List of Objects (Full DB Profile) <--- NEW EXPORT
        setLocations,    // Setter for updates <--- NEW EXPORT
        locationImages,  // Simple Map (Name -> URL)
        setLocationImages,
        loading
    };
};