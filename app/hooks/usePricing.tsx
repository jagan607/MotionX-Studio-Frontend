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

interface VideoEditRates {
    standard: number; // credits per second for Draft / Standard
    pro: number;      // credits per second for Final / Pro
}

export interface Pricing {
    video: { [provider: string]: ProviderPricing };
    video_edit: { [provider: string]: VideoEditRates };
    image: Record<string, any>;
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
    referenceVideoDurations?: number[]; // Durations of uploaded reference videos (seconds)
}

interface PricingContextValue {
    pricing: Pricing | null;
    isLoaded: boolean;
    getVideoCost: (provider: string, mode: string, duration: string, options?: VideoCostOptions) => number;
    getVideoEditRate: (provider: string, mode: 'std' | 'pro') => number;
    getLipSyncCost: (durationSeconds: number) => number;
    getImageCost: (provider?: string, tier?: 'flash' | 'pro', context?: 'playground' | 'shot') => number;
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
        "kling-v3-omni": {
            "standard": { "3s": 2.0, "5s": 3.0, "10s": 5.0, "15s": 8.0 },
            "pro": { "3s": 3.0, "5s": 5.0, "10s": 8.0, "15s": 12.0 },
            "audio_surcharge": { "standard": 1.0, "pro": 1.0 },
            "multi_shot_surcharge": { "standard": 0.2, "pro": 0.2 },
            "end_frame_surcharge": { "standard": 0.2, "pro": 0.2 }
        },
        "kling": {
            "standard": { "5s": 1.0, "10s": 2.0 },
            "pro": { "5s": 2.0, "10s": 4.0 },
            "audio_surcharge": { "standard": 0.5, "pro": 1.0 }
        },
        "seedance-2": {
            "standard": { "5s": 3.0, "10s": 6.0, "15s": 9.0 },
            "pro": { "5s": 4.0, "10s": 8.0, "15s": 12.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 },
            "end_frame_surcharge": { "standard": 0.3, "pro": 0.3 }
        },
        "seedance-2-preview": {
            "standard": { "5s": 2.0, "10s": 3.5, "15s": 5.5 },
            "pro": { "5s": 3.0, "10s": 5.5, "15s": 8.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 },
            "end_frame_surcharge": { "standard": 0.2, "pro": 0.2 }
        },
        "seedance": {
            "standard": { "5s": 3.0, "10s": 6.0, "15s": 9.0 },
            "pro": { "5s": 4.0, "10s": 8.0, "15s": 12.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 },
            "end_frame_surcharge": { "standard": 0.3, "pro": 0.3 }
        },
        "seedance-1.5": {
            "standard": { "5s": 1.0, "10s": 2.0 },
            "pro": { "5s": 2.0, "10s": 4.0 },
            "audio_surcharge": { "standard": 0.0, "pro": 0.0 }
        }
    },
    video_edit: {
        "seedance-2": { standard: 0.8, pro: 1.2 },
        "seedance-2-preview": { standard: 0.7, pro: 1.0 },
        "seedance":   { standard: 0.8, pro: 1.2 },
    },
    image: {
        playground: {
            gemini: { flash: 0.3, pro: 0.6 },
            seedream: { flash: 0.3, pro: 0.6 },
        },
        shot: {
            gemini: { flash: 0.5, pro: 1.0 },
            seedream: { flash: 0.5, pro: 1.0 },
        },
    },
    upscale: { flash: 3, pro: 3 },
    edit: 1,
    finalize: 1,
    voiceover: 1,
    sfx: 2,
    lipsync: { per_second: 2, minimum: 5 }
};

// --- Context ---
const PricingContext = createContext<PricingContextValue>({
    pricing: null,
    isLoaded: false,
    getVideoCost: () => 0,
    getVideoEditRate: () => 0,
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
                    setPricing(prev => ({ ...prev, ...res.data.pricing }));
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
            // Apply flat surcharges directly to the base cost
            let surcharges = 0;
            if (options?.sound === true) surcharges += (providerData.audio_surcharge as SurchargePricing)?.[modeKey] ?? 0;
            if (options?.multiShot === true) surcharges += (providerData.multi_shot_surcharge as SurchargePricing)?.[modeKey] ?? 0;
            if (options?.hasEndFrame === true) surcharges += (providerData.end_frame_surcharge as SurchargePricing)?.[modeKey] ?? 0;

            const rawCost = baseCost + surcharges;

            // Reference video surcharge
            let refVideoSurcharge = 0;
            if (options?.referenceVideoDurations && options.referenceVideoDurations.length > 0) {
                const perSecondRate = rawCost / dur;
                const totalRefSeconds = options.referenceVideoDurations.reduce((a, b) => a + b, 0);
                refVideoSurcharge = perSecondRate * totalRefSeconds;
            }

            return Math.round((rawCost + refVideoSurcharge) * 10) / 10;
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

        // Reference video surcharge: each ref video second is billed at the same per-second rate
        let refVideoSurcharge = 0;
        if (options?.referenceVideoDurations && options.referenceVideoDurations.length > 0) {
            const perSecondRate = total5sBase / 5;
            const totalRefSeconds = options.referenceVideoDurations.reduce((a, b) => a + b, 0);
            refVideoSurcharge = perSecondRate * totalRefSeconds;
        }

        // 4. Round to 1 decimal
        return Math.round((rawCost + refVideoSurcharge) * 10) / 10;
    };

    const getLipSyncCost = (durationSeconds: number): number => {
        return Math.max(pricing.lipsync.minimum, durationSeconds * pricing.lipsync.per_second);
    };

    const getImageCost = (provider: string = 'gemini', tier: 'flash' | 'pro' = 'flash', context: 'playground' | 'shot' = 'playground') => {
        const img = pricing.image as any;
        // Context-aware format: { playground: { gemini: { flash: 0.3 } }, shot: { gemini: { flash: 0.5 } } }
        if (img?.playground || img?.shot) {
            const contextData = img[context] ?? img.playground;
            const providerData = contextData?.[provider];
            if (providerData) return providerData[tier] ?? (tier === 'pro' ? 0.6 : 0.3);
            // Fallback to first provider in context
            const firstProvider = Object.values(contextData || {})[0] as any;
            return firstProvider?.[tier] ?? (tier === 'pro' ? 0.6 : 0.3);
        }
        // Legacy flat format: { gemini: { flash: 0.3 } } or { flash: 1, pro: 2 }
        if (img && typeof img === 'object' && !('flash' in img)) {
            const providerData = img[provider];
            if (providerData) return providerData[tier] ?? (tier === 'pro' ? 0.6 : 0.3);
            const firstProvider = Object.values(img)[0] as any;
            return firstProvider?.[tier] ?? (tier === 'pro' ? 0.6 : 0.3);
        }
        if (typeof img === 'number') return tier === 'pro' ? img * 2 : img;
        return img?.[tier] ?? (tier === 'pro' ? 0.6 : 0.3);
    };
    const getUpscaleCost = (tier: 'flash' | 'pro' = 'pro') => {
        const up = pricing.upscale;
        if (!up || typeof up === 'number') return 3;
        // Upscaling always costs the pro amount (default 3) regardless of the selected tier
        return up?.['pro'] ?? 3;
    };
    /** Returns the per-second credit rate for video editing on a given provider + tier. */
    const getVideoEditRate = (provider: string, mode: 'std' | 'pro'): number => {
        const modeKey = mode === 'std' ? 'standard' : 'pro';
        const rates = pricing.video_edit?.[provider] ?? DEFAULT_PRICING.video_edit?.[provider];
        if (!rates) return modeKey === 'pro' ? 1.2 : 0.8; // ultimate fallback
        return rates[modeKey as keyof VideoEditRates] ?? (modeKey === 'pro' ? 1.2 : 0.8);
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
            getVideoEditRate,
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
