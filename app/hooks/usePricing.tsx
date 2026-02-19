"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

// --- Types ---
interface ModePricing {
    [duration: string]: number; // e.g. "3s": 5, "5s": 8
}

interface ProviderPricing {
    [mode: string]: ModePricing; // e.g. "standard": {...}, "pro": {...}
}

interface LipsyncPricing {
    per_second: number;
    minimum: number;
}

export interface Pricing {
    video: { [provider: string]: ProviderPricing };
    image: number;
    edit: number;
    finalize: number;
    voiceover: number;
    sfx: number;
    lipsync: LipsyncPricing;
}

interface PricingContextValue {
    pricing: Pricing | null;
    isLoaded: boolean;
    getVideoCost: (provider: string, mode: string, duration: string) => number;
    getLipSyncCost: (durationSeconds: number) => number;
    getImageCost: () => number;
    getVoiceoverCost: () => number;
    getFinalizeCost: () => number;
    getSfxCost: () => number;
    getEditCost: () => number;
}

// --- Default fallback pricing (used before API responds) ---
const DEFAULT_PRICING: Pricing = {
    video: {
        "kling-v3": {
            "standard": { "3s": 3, "5s": 5, "10s": 10, "15s": 15 },
            "pro": { "3s": 5, "5s": 8, "10s": 15, "15s": 22 }
        },
        "kling": {
            "standard": { "5s": 3, "10s": 6 },
            "pro": { "5s": 5, "10s": 10 }
        },
        "seedance": {
            "standard": { "3s": 3, "5s": 5, "10s": 10, "15s": 15 },
            "pro": { "3s": 5, "5s": 8, "10s": 15, "15s": 22 }
        }
    },
    image: 1,
    edit: 1,
    finalize: 1,
    voiceover: 1,
    sfx: 2,
    lipsync: { per_second: 1, minimum: 3 }
};

// --- Context ---
const PricingContext = createContext<PricingContextValue>({
    pricing: null,
    isLoaded: false,
    getVideoCost: () => 0,
    getLipSyncCost: () => 0,
    getImageCost: () => 0,
    getVoiceoverCost: () => 0,
    getFinalizeCost: () => 0,
    getSfxCost: () => 0,
    getEditCost: () => 0,
});

// --- Provider ---
export const PricingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const res = await api.get("/api/v1/shot/pricing");
                if (res.data?.pricing) {
                    setPricing(res.data.pricing);
                }
            } catch (e) {
                console.warn("[usePricing] Failed to fetch pricing, using defaults", e);
            } finally {
                setIsLoaded(true);
            }
        };
        fetchPricing();
    }, []);

    // mode = "standard" | "pro", maps from UI "std" → "standard"
    const getVideoCost = (provider: string, mode: string, duration: string): number => {
        const modeKey = mode === "std" ? "standard" : mode;
        const durationKey = duration.endsWith("s") ? duration : `${duration}s`;
        return pricing.video[provider]?.[modeKey]?.[durationKey] ?? 0;
    };

    const getLipSyncCost = (durationSeconds: number): number => {
        return Math.max(pricing.lipsync.minimum, durationSeconds * pricing.lipsync.per_second);
    };

    const getImageCost = () => pricing.image;
    const getVoiceoverCost = () => pricing.voiceover;
    const getFinalizeCost = () => pricing.finalize;
    const getSfxCost = () => pricing.sfx;
    const getEditCost = () => pricing.edit;

    return (
        <PricingContext.Provider value={{
            pricing,
            isLoaded,
            getVideoCost,
            getLipSyncCost,
            getImageCost,
            getVoiceoverCost,
            getFinalizeCost,
            getSfxCost,
            getEditCost
        }}>
            {children}
        </PricingContext.Provider>
    );
};

// --- Hook ---
export const usePricing = () => useContext(PricingContext);
