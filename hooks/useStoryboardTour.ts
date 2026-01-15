import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

export const useStoryboardTour = () => {
    // 0: Idle, 1: Aspect Ratio, 2: Auto-Direct
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

            if (!data.onboarding?.storyboard_tour) {
                setTourStep(1);
            }
        } catch (e) {
            console.error("Storyboard tour check failed", e);
        }
    };

    const nextStep = () => setTourStep(prev => prev + 1);

    const completeTour = async () => {
        setTourStep(0);
        try {
            const token = await auth.currentUser?.getIdToken();
            await fetch(`${API_BASE_URL}/api/v1/user/complete_onboarding?tour_id=storyboard_tour`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
        } catch (e) {
            console.error("Could not save storyboard tour status");
        }
    };

    return { tourStep, nextStep, completeTour };
};