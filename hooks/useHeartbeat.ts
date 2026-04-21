"use client";

import { useEffect, useRef } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

/**
 * Lightweight heartbeat hook that writes to `active_sessions/{uid}`
 * every 60 seconds while the user is authenticated.
 *
 * Used by the admin dashboard to count real-time active users
 * by querying documents with `last_seen` within the last 2 minutes.
 *
 * Mount this once at the app layout level (inside AuthProvider).
 */
export function useHeartbeat() {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const userRef = useRef<User | null>(null);

    useEffect(() => {
        const sendHeartbeat = async () => {
            const user = userRef.current;
            if (!user) return;

            try {
                await setDoc(doc(db, "active_sessions", user.uid), {
                    uid: user.uid,
                    email: user.email || null,
                    last_seen: serverTimestamp(),
                });
            } catch (err) {
                // Silently fail — heartbeat is non-critical
                console.debug("[Heartbeat] write failed:", err);
            }
        };

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            userRef.current = user;

            // Clear any existing interval
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            if (user) {
                // Send immediately on auth, then every 60s
                sendHeartbeat();
                intervalRef.current = setInterval(sendHeartbeat, 60_000);
            }
        });

        return () => {
            unsubscribe();
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);
}
