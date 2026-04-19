// hooks/useCredits.ts
import { useState, useEffect, useRef } from "react";
import { doc, collection, query, where, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useWorkspace } from "@/app/context/WorkspaceContext";

export function useCredits() {
    const [credits, setCredits] = useState<number | null>(null);
    const [plan, setPlan] = useState<string>("free");
    const [loading, setLoading] = useState(true);
    const [isEnterprise, setIsEnterprise] = useState(false);
    const [creditsExpireAt, setCreditsExpireAt] = useState<Date | null>(null);
    const [freeCreditsExpired, setFreeCreditsExpired] = useState(false);

    const { activeWorkspaceSlug } = useWorkspace();
    const unsubRef = useRef<Unsubscribe | null>(null);

    useEffect(() => {
        // Tear down previous listener
        unsubRef.current?.();
        unsubRef.current = null;

        const user = auth.currentUser;
        if (!user) {
            setCredits(null);
            setPlan("free");
            setIsEnterprise(false);
            setCreditsExpireAt(null);
            setFreeCreditsExpired(false);
            setLoading(false);
            return;
        }

        // Reset to loading state while the new listener fires
        setLoading(true);

        if (activeWorkspaceSlug) {
            // Enterprise Wallet — listen to the org document matching this workspace slug
            setIsEnterprise(true);
            setCreditsExpireAt(null);
            setFreeCreditsExpired(false);
            const orgQuery = query(
                collection(db, "organizations"),
                where("slug", "==", activeWorkspaceSlug),
                limit(1)
            );
            unsubRef.current = onSnapshot(orgQuery, (snapshot) => {
                if (!snapshot.empty) {
                    setCredits(snapshot.docs[0].data().credits_balance ?? 0);
                } else {
                    setCredits(0);
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
            unsubRef.current = onSnapshot(userRef, (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    setCredits(data.credits ?? 0);
                    setPlan(data.plan ?? "free");
                    // Credit expiry fields
                    const expireAt = data.credits_expire_at;
                    if (expireAt && expireAt.toDate) {
                        setCreditsExpireAt(expireAt.toDate());
                    } else if (expireAt) {
                        setCreditsExpireAt(new Date(expireAt));
                    } else {
                        setCreditsExpireAt(null);
                    }
                    setFreeCreditsExpired(data.free_credits_expired ?? false);
                } else {
                    setCredits(0);
                    setPlan("free");
                    setCreditsExpireAt(null);
                    setFreeCreditsExpired(false);
                }
                setLoading(false);
            }, (error) => {
                console.error("[useCredits] Firestore listener error:", error);
                setLoading(false);
            });
        }

        return () => {
            unsubRef.current?.();
            unsubRef.current = null;
        };
    }, [activeWorkspaceSlug]);

    return { credits, plan, loading, isEnterprise, creditsExpireAt, freeCreditsExpired };
}