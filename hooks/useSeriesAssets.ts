import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

export const useSeriesAssets = (seriesId: string) => {
    const [masterCast, setMasterCast] = useState<any[]>([]);
    const [masterLocations, setMasterLocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!seriesId) return;

        // 1. Fetch All Characters in Series
        const charQuery = query(collection(db, "series", seriesId, "characters"), orderBy("name"));
        const unsubChar = onSnapshot(charQuery, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setMasterCast(data);
        });

        // 2. Fetch All Locations in Series
        const locQuery = query(collection(db, "series", seriesId, "locations"), orderBy("name"));
        const unsubLoc = onSnapshot(locQuery, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setMasterLocations(data);
        });

        setLoading(false);

        return () => {
            unsubChar();
            unsubLoc();
        };
    }, [seriesId]);

    return { masterCast, masterLocations, loading };
};