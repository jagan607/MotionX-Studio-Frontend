"use client";

/**
 * PlaygroundAnimateModal — Adapter component that bridges
 * PlaygroundGeneration → ShotEditorPanel (Studio animation modal).
 *
 * Maps a PlaygroundGeneration into a pseudo-Shot object and intercepts
 * the onAnimate callback to route to the Playground animation API
 * instead of the Studio API.
 *
 * Zero modifications to ShotEditorPanel or VideoSettingsPanel required.
 */

import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ShotEditorPanel } from "@/app/components/storyboard/ShotEditorPanel";
import { usePlayground } from "@/app/context/PlaygroundContext";
import { playgroundAnimate, type PlaygroundGeneration, type PlaygroundAnimateParams } from "@/lib/playgroundApi";
import type { Shot } from "@/lib/types";
import type { AnimateOptions, VideoProvider } from "@/app/hooks/shot-manager/useShotVideoGen";
import toast from "react-hot-toast";


interface PlaygroundAnimateModalProps {
    generation: PlaygroundGeneration | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function PlaygroundAnimateModal({
    generation,
    isOpen,
    onClose,
}: PlaygroundAnimateModalProps) {
    const { characters, generations, uid } = usePlayground();

    // ── Map PlaygroundGeneration → pseudo-Shot ──
    const pseudoShot: Shot | null = useMemo(() => {
        if (!generation) return null;
        return {
            id: generation.id,
            shot_type: generation.shot_type || "Wide Shot",
            visual_action: generation.prompt || "",
            video_prompt: generation.prompt || "",
            image_url: generation.image_url,
            video_url: generation.video_url,
            characters: generation.characters || [],
            products: generation.products || [],
            location: generation.location,
            status: generation.status === "completed" ? "rendered" : generation.status,
            video_status: generation.video_status as any,
            video_settings: (generation as any).video_settings || {},
            video_history: (generation as any).video_history || [],
        };
    }, [generation]);

    // ── Map Playground characters → sceneCharacters shape ──
    const sceneCharacters = useMemo(
        () =>
            characters
                .filter((c) => c.image_url)
                .map((c) => ({ name: c.name, image_url: c.image_url! })),
        [characters]
    );

    // ── Map other completed generations → sceneShots shape ──
    const sceneShots = useMemo(
        () =>
            generations
                .filter((g) => g.id !== generation?.id && (g.image_url || g.video_url))
                .slice(0, 12)
                .map((g) => ({
                    id: g.id,
                    image_url: g.image_url,
                    video_url: g.video_url,
                    visual_action: g.prompt || "",
                })),
        [generations, generation?.id]
    );

    // ── onAnimate → route to playgroundAnimate() ──
    const handleAnimate = useCallback(
        async (provider: VideoProvider, endFrameUrl?: string | null, options?: AnimateOptions) => {
            if (!generation) return;

            try {
                const params: PlaygroundAnimateParams = {
                    generation_id: generation.id,
                    image_url: generation.image_url,
                    prompt: options?.prompt || generation.prompt || "",
                    provider: provider,
                    duration: options?.duration || "5",
                    mode: options?.mode || "std",
                    aspect_ratio: options?.aspect_ratio || generation.aspect_ratio || "16:9",
                    negative_prompt: options?.negative_prompt,
                    cfg_scale: options?.cfg_scale,
                    sound: options?.sound,
                    multi_shot: options?.multi_shot,
                    shot_type: options?.shot_type,
                    multi_prompt: options?.multi_prompt,
                    element_list: options?.element_list,
                    voice_list: options?.voice_list,
                    watermark: options?.watermark,
                    reference_image_urls: options?.reference_image_urls,
                    reference_video_urls: options?.reference_video_urls,
                    reference_video_durations: options?.reference_video_durations,
                    reference_audio_urls: options?.reference_audio_urls,
                    parent_task_id: options?.parent_task_id,
                    quality: options?.quality,
                    video_url: options?.video_url,
                    source_video_duration: options?.source_video_duration,
                    trim_start: options?.trim_start,
                    trim_end: options?.trim_end,
                };

                // Pass end frame URL if provided
                if (endFrameUrl) {
                    params.end_frame_url = endFrameUrl;
                }

                await playgroundAnimate(params);
                toast.success("Animation started");
                onClose();
            } catch (err: any) {
                console.error("[PlaygroundAnimate] Failed:", err);
                toast.error(err?.response?.data?.detail || "Animation failed");
            }
        },
        [generation, onClose]
    );

    // ── onUpdateShot → local no-op (Playground doesn't persist to Studio Firestore) ──
    const handleUpdateShot = useCallback(
        (_id: string, _field: string, _value: any) => {
            // Settings are ephemeral for Playground — the VideoSettingsPanel
            // manages its own local state, so no Firestore write is needed.
        },
        []
    );

    if (!isOpen || !pseudoShot) return null;

    // Portal to document.body so the modal escapes the Playground's
    // fixed stacking context and renders above the GlobalHeader (z-50).
    return createPortal(
        <ShotEditorPanel
            shot={pseudoShot}
            projectId={`pg_${uid || "anon"}`}
            isOpen={isOpen}
            onClose={onClose}
            onUpdateShot={handleUpdateShot}
            onAnimate={handleAnimate}
            onLipSync={() => {}}
            isGenerating={false}
            sceneCharacters={sceneCharacters}
            sceneShots={sceneShots}
        />,
        document.body
    );
}
