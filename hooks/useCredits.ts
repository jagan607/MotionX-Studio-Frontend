// hooks/useCredits.ts
import { useState, useEffect } from "react";
import { doc, collection, query, where, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useCredits() {
    const [credits, setCredits] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEnterprise, setIsEnterprise] = useState(false);

    useEffect(() => {
        let unsubscribeSnapshot: Unsubscribe | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            // Clean up any previous snapshot listener when auth state changes
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            if (user) {
                if (user.tenantId) {
                    // Enterprise Wallet — listen to the org document matching this tenant
                    const orgQuery = query(
                        collection(db, "organizations"),
                        where("tenant_id", "==", user.tenantId),
                        limit(1)
                    );
                    unsubscribeSnapshot = onSnapshot(orgQuery, (snapshot) => {
                        if (!snapshot.empty) {
                            setCredits(snapshot.docs[0].data().credits_balance ?? 0);
                            setIsEnterprise(true);
                        } else {
                            setCredits(0);
                            setIsEnterprise(true);
                        }
                        setLoading(false);
                    }, (error) => {
                        console.error("[useCredits] Org Firestore listener error:", error);
                        setLoading(false);
                    });
                } else {
                    // Personal Wallet — listen to the user document
                    setIsEnterprise(false);
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
                }
            } else {
                setCredits(null);
                setIsEnterprise(false);
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

    return { credits, loading, isEnterprise };
}