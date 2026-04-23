"use client";
import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/**
 * Generic onboarding tour hook.
 * Persistence: localStorage (instant) + Firestore (durable).
 * tourId must match the key in Firestore: users/{uid}/onboarding.{tourId}
 * e.g. "dashboard_tour", "series_tour", "episode_tour", "storyboard_tour"
 */
export const useTour = (tourId: string) => {
    const [step, setStep] = useState(0); // 0 = inactive
    const hasChecked = useRef(false);

    const localKey = `tour_done_${tourId}`;

    useEffect(() => {
        hasChecked.current = false; // Reset when tourId changes
        // Wait for auth to resolve, then check
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user || hasChecked.current) return;
            hasChecked.current = true;

            // 1. Instant check: localStorage (prevents flash on every refresh)
            if (localStorage.getItem(localKey) === "true") {
                return; // Tour already completed — step stays 0
            }

            // 2. Async check: Firestore
            const timer = setTimeout(() => checkStatus(user.uid), 1200);
            return () => clearTimeout(timer);
        });
        return () => unsubscribe();
    }, [tourId]);

    const checkStatus = async (uid: string) => {
        try {
            const userRef = doc(db, "users", uid);
            const snap = await getDoc(userRef);
            const tourDone = snap.data()?.onboarding?.[tourId] === true;
            if (tourDone) {
                // Sync to localStorage so future refreshes are instant
                localStorage.setItem(localKey, "true");
            } else {
                // key absent OR false → start tour
                setStep(1);
            }
        } catch (e) {
            console.error(`[useTour] Failed to check status for "${tourId}"`, e);
            // On Firestore failure, don't show tour (avoid annoying the user)
        }
    };

    const nextStep = () => setStep((prev) => prev + 1);

    const completeTour = async () => {
        setStep(0); // Close UI immediately
        // Persist to localStorage first (instant)
        localStorage.setItem(localKey, "true");
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;
            const userRef = doc(db, "users", uid);
            // merge: true → creates key if absent, updates if present
            await setDoc(userRef, { onboarding: { [tourId]: true } }, { merge: true });
        } catch (e) {
            console.error(`[useTour] Failed to save completion for "${tourId}"`, e);
        }
    };

    return { step, nextStep, completeTour };
};

