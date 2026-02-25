"use client";
import { useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";

export function ActivityTracker() {
    useEffect(() => {
        const ping = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, {
                    lastActiveAt: serverTimestamp(),
                }, { merge: true });
                console.log("✅ [ActivityTracker] lastActiveAt synced | UID:", user.uid);
            } catch (e: any) {
                console.error("❌ [ActivityTracker] Firestore write FAILED:", e);
                toast.error(`Activity Sync Error: ${e?.message || e}`, { duration: 10000 });
            }
        };

        ping();

        // Ping every 15 minutes if they stay open
        const interval = setInterval(ping, 15 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return null;
}