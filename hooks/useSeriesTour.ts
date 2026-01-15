import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

export const useSeriesTour = () => {
    // 0: Idle, 1: New Episode Button
    const [tourStep, setTourStep] = useState(0);

    useEffect(() => {
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

            // Check specific flag for series screen
            if (!data.onboarding?.series_tour) {
                setTourStep(1);
            }
        } catch (e) {
            console.error("Series tour check failed", e);
        }
    };

    const completeTour = async () => {
        setTourStep(0);
        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${API_BASE_URL}/api/v1/user/complete_onboarding?tour_id=series_tour`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Could not save series tour status");
        }
    };

    return { tourStep, completeTour };
};