"use client";
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/**
 * Generic onboarding tour hook.
 * Reads Firestore directly (no backend API call) for instant check.
 * tourId must match the key in Firestore: users/{uid}/onboarding.{tourId}
 * e.g. "dashboard_tour", "series_tour", "episode_tour", "storyboard_tour"
 */
export const useTour = (tourId: string) => {
    const [step, setStep] = useState(0); // 0 = inactive

    useEffect(() => {
        // Wait for auth to resolve, then check Firestore
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) return;
            // Small delay to ensure page DOM is mounted before we start tour
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
            // key absent OR false → start tour
            if (!tourDone) {
                setStep(1);
            }
        } catch (e) {
            console.error(`[useTour] Failed to check status for "${tourId}"`, e);
        }
    };

    const nextStep = () => setStep((prev) => prev + 1);

    const completeTour = async () => {
        setStep(0); // Close UI immediately
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
