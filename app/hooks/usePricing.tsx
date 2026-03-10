"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

// --- Types ---
interface ModePricing {
    [duration: string]: number; // e.g. "3s": 5, "5s": 8
}

interface SurchargePricing {
    [mode: string]: number; // e.g. "standard": 1.0, "pro": 1.0
}

interface ProviderPricing {
    [key: string]: ModePricing | SurchargePricing; // modes + surcharge keys
}

interface LipsyncPricing {
    per_second: number;
    minimum: number;
}

export interface Pricing {
    video: { [provider: string]: ProviderPricing };
    image: { flash: number; pro: number };
    upscale: { flash: number; pro: number };
    edit: number;
    finalize: number;
    voiceover: number;
    sfx: number;
    lipsync: LipsyncPricing;
}

export interface VideoCostOptions {
    sound?: boolean;
    multiShot?: boolean;
    hasEndFrame?: boolean;
    resolution?: 'std' | 'pro'; // For providers where resolution affects pricing independently (e.g., Seedance 1.5)
}

interface PricingContextValue {
    pricing: Pricing | null;
    isLoaded: boolean;
    getVideoCost: (provider: string, mode: string, duration: string, options?: VideoCostOptions) => number;
    getLipSyncCost: (durationSeconds: number) => number;
    getImageCost: (tier?: 'flash' | 'pro') => number;
    getUpscaleCost: (tier?: 'flash' | 'pro') => number;
    getVoiceoverCost: () => number;
    getFinalizeCost: () => number;
    getSfxCost: () => number;
    getEditCost: () => number;
}

// --- Formatting Helper ---
export const formatCredits = (n: number | null | undefined): string => {
    if (n === null || n === undefined) return '---';
    if (n % 1 === 0) return n.toLocaleString();
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

// --- Default fallback pricing (used before API responds) ---
const DEFAULT_PRICING: Pricing = {
    video: {
        "kling-v3": {
            "standard": { "5s": 2.0, "10s": 4.0, "15s": 6.0 },
            "pro": { "5s": 3.0, "10s": 6.0, "15s": 9.0 },
            "audio_surcharge": { "standard": 1.0, "pro": 1.0 },
            "multi_shot_surcharge": { "standard": 1.0, "pro": 1.0 },
            "end_frame_surcharge": { "standard": 1.0, "pro": 1.0 }
        },
        "kling": {
            "standard": { "5s": 1.0, "10s": 2.0 },
            "pro": { "5s": 2.0, "10s": 4.0 },
            "audio_surcharge": { "standard": 0.5, "pro": 1.0 }
        },
        "seedance-2": {
            "standard": { "5s": 2.0, "10s": 4.0, "15s": 6.0 },
            "pro": { "5s": 3.0, "10s": 6.0, "15s": 9.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 },
            "end_frame_surcharge": { "standard": 0.3, "pro": 0.3 }
        },
        "seedance": {
            "standard": { "5s": 2.0, "10s": 4.0, "15s": 6.0 },
            "pro": { "5s": 3.0, "10s": 6.0, "15s": 9.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 },
            "end_frame_surcharge": { "standard": 0.3, "pro": 0.3 }
        },
        "seedance-1.5": {
            "standard": { "5s": 1.0, "10s": 2.0 },
            "pro": { "5s": 2.0, "10s": 4.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 }
        }
    },
    image: { flash: 1, pro: 2 },
    upscale: { flash: 3, pro: 3 },
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
    getUpscaleCost: () => 0,
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
    const getVideoCost = (provider: string, mode: string, duration: string, options?: VideoCostOptions): number => {
        const modeKey = mode === "std" ? "standard" : mode;
        const providerData = pricing.video[provider] ?? DEFAULT_PRICING.video[provider];
        if (!providerData) return 0;

        // Duration key: append _1080p suffix when resolution is 'pro' (for providers like Seedance 1.5)
        const dur = parseInt(duration) || 5;
        const baseDurKey = `${dur}s`;
        const durKey = options?.resolution === 'pro' ? `${dur}s_1080p` : baseDurKey;

        // 1. Get base cost — try resolution-specific key first, fallback to standard key
        const tierData = providerData[modeKey] as ModePricing;
        const baseCost = tierData?.[durKey] ?? tierData?.[baseDurKey] ?? 0;

        // If we found an exact match for the duration, use it directly (no interpolation needed)
        if (baseCost > 0) {
            // Still apply surcharges on top
            let surcharges = 0;
            if (options?.sound === true) {
                surcharges += (providerData.audio_surcharge as SurchargePricing)?.[modeKey] ?? 0;
            }
            if (options?.multiShot === true) {
                surcharges += (providerData.multi_shot_surcharge as SurchargePricing)?.[modeKey] ?? 0;
            }
            if (options?.hasEndFrame === true) {
                surcharges += (providerData.end_frame_surcharge as SurchargePricing)?.[modeKey] ?? 0;
            }
            // Interpolate from 5s base
            const base5s = tierData?.[options?.resolution === 'pro' ? '5s_1080p' : '5s'] ?? tierData?.['5s'] ?? 0;
            const total5sBase = base5s + surcharges;
            const rawCost = (total5sBase / 5) * dur;
            return Math.round(rawCost * 10) / 10;
        }

        // Fallback: proportional from 5s base
        const base5s = tierData?.[options?.resolution === 'pro' ? '5s_1080p' : '5s'] ?? tierData?.['5s'] ?? 0;

        // 2. Collect surcharges
        let surcharges = 0;
        if (options?.sound === true) {
            surcharges += (providerData.audio_surcharge as SurchargePricing)?.[modeKey] ?? 0;
        }
        if (options?.multiShot === true) {
            surcharges += (providerData.multi_shot_surcharge as SurchargePricing)?.[modeKey] ?? 0;
        }
        if (options?.hasEndFrame === true) {
            surcharges += (providerData.end_frame_surcharge as SurchargePricing)?.[modeKey] ?? 0;
        }

        // 3. Combine & interpolate
        const total5sBase = base5s + surcharges;
        const rawCost = (total5sBase / 5) * dur;

        // 4. Round to 1 decimal
        return Math.round(rawCost * 10) / 10;
    };

    const getLipSyncCost = (durationSeconds: number): number => {
        return Math.max(pricing.lipsync.minimum, durationSeconds * pricing.lipsync.per_second);
    };

    const getImageCost = (tier: 'flash' | 'pro' = 'flash') => {
        const img = pricing.image;
        // Handle both old API format (flat number) and new format ({ flash, pro })
        if (typeof img === 'number') return tier === 'pro' ? img * 2 : img;
        return img?.[tier] ?? (tier === 'pro' ? 2 : 1);
    };
    const getUpscaleCost = (tier: 'flash' | 'pro' = 'pro') => {
        const up = pricing.upscale;
        if (!up || typeof up === 'number') return 3;
        // Upscaling always costs the pro amount (default 3) regardless of the selected tier
        return up?.['pro'] ?? 3;
    };
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
            getUpscaleCost,
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
