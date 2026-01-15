import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase"; // Check if path is @/lib or ../lib depending on folder
import { API_BASE_URL } from "@/lib/config";

export const useDashboardTour = () => {
    // 0: Idle, 1: Credits, 2: New Series
    const [tourStep, setTourStep] = useState(0);

    useEffect(() => {
        // Delay check slightly to ensure UI is mounted
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

            // If dashboard_tour is NOT true, start the tour
            if (!data.onboarding?.dashboard_tour) {
                setTourStep(1);
            }
        } catch (e) {
            console.error("Dashboard tour check failed", e);
        }
    };

    const nextStep = () => setTourStep(prev => prev + 1);

    const completeTour = async () => {
        setTourStep(0);
        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${API_BASE_URL}/api/v1/user/complete_onboarding?tour_id=dashboard_tour`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Could not save tour status");
        }
    };

    return { tourStep, nextStep, completeTour };
};