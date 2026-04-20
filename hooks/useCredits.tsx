// hooks/useCredits.ts
// ──────────────────────────────────────────────────────────────────────
// Context-based credits provider.  A SINGLE onAuthStateChanged +
// onSnapshot listener lives here and is shared by every consumer via
// React Context.  This eliminates per-component listener duplication
// and the Suspense-boundary teardown race that kept GlobalHeader stuck
// on credits === null.
// ──────────────────────────────────────────────────────────────────────
"use client";

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { doc, collection, query, where, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useWorkspace } from "@/app/context/WorkspaceContext";

// ── Types ────────────────────────────────────────────────────────────
interface CreditsState {
    credits: number | null;
    plan: string;
    loading: boolean;
    isEnterprise: boolean;
    creditsExpireAt: Date | null;
    freeCreditsExpired: boolean;
}

const DEFAULT_STATE: CreditsState = {
    credits: null,
    plan: "free",
    loading: true,
    isEnterprise: false,
    creditsExpireAt: null,
    freeCreditsExpired: false,
};

// ── Context ──────────────────────────────────────────────────────────
const CreditsContext = createContext<CreditsState>(DEFAULT_STATE);

/**
 * Consume credits state from the nearest <CreditsProvider>.
 * Drop-in replacement for the old standalone useCredits() hook.
 */
export function useCredits(): CreditsState {
    return useContext(CreditsContext);
}

// ── Provider ─────────────────────────────────────────────────────────
export function CreditsProvider({ children }: { children: ReactNode }) {
    const [credits, setCredits] = useState<number | null>(null);
    const [plan, setPlan] = useState<string>("free");
    const [loading, setLoading] = useState(true);
    const [isEnterprise, setIsEnterprise] = useState(false);
    const [creditsExpireAt, setCreditsExpireAt] = useState<Date | null>(null);
    const [freeCreditsExpired, setFreeCreditsExpired] = useState(false);

    const { activeWorkspaceSlug } = useWorkspace();
    const unsubRef = useRef<Unsubscribe | null>(null);

    useEffect(() => {
        const teardownFirestore = () => {
            unsubRef.current?.();
            unsubRef.current = null;
        };

        const unsubAuth = onAuthStateChanged(auth, (user) => {
            teardownFirestore();

            if (!user) {
                setCredits(null);
                setPlan("free");
                setIsEnterprise(false);
                setCreditsExpireAt(null);
                setFreeCreditsExpired(false);
                setLoading(false);
                return;
            }

            setLoading(true);

            if (activeWorkspaceSlug) {
                // Enterprise Wallet
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
                    setCredits(0);
                    setLoading(false);
                });
            } else {
                // Personal Wallet
                setIsEnterprise(false);
                const userRef = doc(db, "users", user.uid);
                unsubRef.current = onSnapshot(userRef, (snap) => {
                    if (snap.exists()) {
                        const data = snap.data();
                        setCredits(data.credits ?? 0);
                        setPlan(data.plan ?? "free");
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
                    setCredits(0);
                    setLoading(false);
                });
            }
        });

        return () => {
            unsubAuth();
            teardownFirestore();
        };
    }, [activeWorkspaceSlug]);

    return (
        <CreditsContext.Provider value={{ credits, plan, loading, isEnterprise, creditsExpireAt, freeCreditsExpired }}>
            {children}
        </CreditsContext.Provider>
    );
}