// hooks/useCredits.ts
import { useState, useEffect } from "react";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useCredits() {
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot: Unsubscribe | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            // Clean up any previous snapshot listener when auth state changes
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            if (user) {
                const userRef = doc(db, "users", user.uid);
                unsubscribeSnapshot = onSnapshot(userRef, (snap) => {
                    if (snap.exists()) {
                        setCredits(snap.data().credits ?? 0);
                    } else {
                        setCredits(0);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("[useCredits] Firestore listener error:", error);
                    setLoading(false);
                });
            } else {
                setCredits(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
            }
        };
    }, []);

    return { credits, loading };
}