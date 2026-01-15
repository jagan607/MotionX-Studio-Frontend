import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

export const useEpisodeTour = () => {
    const [tourStep, setTourStep] = useState(0); // 0: Idle, 1: Assets Tab, 2: Storyboard
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Wait a moment for page load before checking
        const timer = setTimeout(checkStatus, 1500);
        return () => clearTimeout(timer);
    }, []);

    const checkStatus = async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;

            const res = await fetch(`${API_BASE_URL}/api/v1/user/onboarding_status`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();

            // If tour is NOT complete, start at Step 1
            if (!data.onboarding?.episode_tour) {
                setTourStep(1);
            }
            setReady(true);
        } catch (e) {
            console.error("Tour check failed", e);
        }
    };

    const nextStep = () => setTourStep(prev => prev + 1);

    const completeTour = async () => {
        setTourStep(0); // Close UI immediately
        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${API_BASE_URL}/api/v1/user/complete_onboarding?tour_id=episode_tour`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Could not save tour status");
        }
    };

    return { tourStep, nextStep, completeTour, ready };
};