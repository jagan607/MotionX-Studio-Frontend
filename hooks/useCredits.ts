// hooks/useCredits.ts
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase"; // Adjust path if your firebase.ts is elsewhere
import { onAuthStateChanged } from "firebase/auth";

export function useCredits() {
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Listen for Auth Changes first
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                // 2. If user exists, listen to their Firestore Document
                const userRef = doc(db, "users", user.uid);

                const unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
                    if (doc.exists()) {
                        setCredits(doc.data().credits ?? 0);
                    } else {
                        setCredits(0);
                    }
                    setLoading(false);
                });

                return () => unsubscribeSnapshot();
            } else {
                setCredits(null);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    return { credits, loading };
}