import { api, preflightSeedance2 } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { getApiErrorMessage } from "@/lib/apiErrors";

export type VideoProvider = 'kling' | 'kling-v3' | 'kling-v3-omni' | 'seedance' | 'seedance-2' | 'seedance-1.5';

export interface PromptSegment {
    index: number;
    prompt: string;
    duration: string;
}

export interface AnimateOptions {
    prompt?: string;
    duration?: string;
    mode?: 'std' | 'pro';
    aspect_ratio?: '16:9' | '9:16' | '4:3' | '3:4' | '1:1';

    // Advanced
    negative_prompt?: string;
    cfg_scale?: number;        // 0.0–1.0
    sound?: 'on' | 'off';
    watermark?: boolean;

    // Multi-shot
    multi_shot?: boolean;
    shot_type?: 'intelligence' | 'customize';
    multi_prompt?: PromptSegment[];

    // Elements & Voices
    element_list?: Array<{ element_id: string }>;
    voice_list?: Array<{ voice_id: string }>;

    // Seedance 2.0 — Omni-Reference
    quality?: 'fast' | 'pro';                // Draft vs Final
    reference_image_urls?: string[];         // Omni-ref: image URLs
    reference_video_urls?: string[];         // Omni-ref: video URLs
    reference_audio_urls?: string[];         // Omni-ref: audio URLs
    reference_video_durations?: number[];    // Durations in seconds for uploaded videos
    parent_task_id?: string;                 // Video extension

    // Seedance 2.0 — Video Edit
    video_url?: string;                      // Source video for edit mode
    source_video_duration?: number;          // Duration in seconds of source video
    trim_start?: number;                     // Trim start time (seconds)
    trim_end?: number;                       // Trim end time (seconds)

    // Kling v3 Omni
    keep_original_audio?: boolean;            // Preserve ref video's original audio

    // Preflight bypass
    skipPreflight?: boolean;                 // Skip preflight warnings check

    // Seedance 2.0 engine variant
    model_version?: 'official' | 'preview';  // Official (default) or Preview (faster/cheaper)
}

export interface PreflightResult {
    preflight: true;
    warnings: string[];
    estimated_cost: number;
}

export const useShotVideoGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null,
    addLoadingShot?: (id: string) => void,
    removeLoadingShot?: (id: string) => void
) => {

    const handleAnimateShot = async (
        shot: any,
        provider: VideoProvider = 'seedance-2',
        endFrameUrl?: string | null,
        options?: AnimateOptions
    ): Promise<PreflightResult | void> => {
        if (!shot.image_url) { toastError("No image to animate"); return; }

        const shotId = shot.id;
        addLoadingShot?.(shotId);
        try {
            // Seedance 2.0 @tag prompt mutation when end frame is present
            const isSeedance = provider === 'seedance-2' || provider === 'seedance' || provider === 'seedance-1.5';
            const explicitOverride = options?.prompt;
            const originalPrompt = (explicitOverride !== undefined && explicitOverride !== "")
                ? explicitOverride
                : (shot.video_prompt || "Cinematic motion");
            const finalPrompt = (isSeedance && endFrameUrl)
                ? `@image1 as the first frame. ${originalPrompt}. smoothly transitioning to @image2 as the last frame.`
                : originalPrompt;

            const payload: any = {
                project_id: projectId,
                episode_id: episodeId,
                scene_id: sceneId!,
                shot_id: shot.id,
                image_url: shot.image_url,
                prompt: finalPrompt,
                provider: provider,
                end_frame_url: endFrameUrl || null
            };

            // Kling 3.0 / advanced params
            if (options) {
                if (options.duration) payload.duration = options.duration;
                if (options.mode) payload.mode = options.mode;
                if (options.aspect_ratio) payload.aspect_ratio = options.aspect_ratio;
                if (options.negative_prompt) payload.negative_prompt = options.negative_prompt;
                if (options.cfg_scale !== undefined) payload.cfg_scale = options.cfg_scale;
                if (options.sound) payload.sound = options.sound;
                if (options.watermark !== undefined) payload.watermark = options.watermark;

                // Seedance 2.0 — Omni-Reference
                if (options.quality) payload.quality = options.quality;
                if (options.reference_image_urls && options.reference_image_urls.length > 0) {
                    payload.reference_image_urls = options.reference_image_urls;
                }
                if (options.reference_video_urls && options.reference_video_urls.length > 0) {
                    payload.reference_video_urls = options.reference_video_urls;
                }
                if (options.reference_audio_urls && options.reference_audio_urls.length > 0) {
                    payload.reference_audio_urls = options.reference_audio_urls;
                }
                if (options.parent_task_id) payload.parent_task_id = options.parent_task_id;

                // Seedance 2.0 — Video Edit
                if (options.video_url) payload.video_url = options.video_url;
                if (options.source_video_duration) payload.source_video_duration = options.source_video_duration;
                if (options.trim_start !== undefined) payload.trim_start = options.trim_start;
                if (options.trim_end !== undefined) payload.trim_end = options.trim_end;

                // Kling v3 Omni
                if (options.keep_original_audio) payload.keep_original_audio = options.keep_original_audio;

                // Seedance 2.0 engine variant
                if (options.model_version) payload.model_version = options.model_version;

                // Multi-shot
                if (options.multi_shot) {
                    payload.multi_shot = true;
                    if (options.shot_type) payload.shot_type = options.shot_type;
                    if (options.multi_prompt && options.multi_prompt.length > 0) {
                        payload.multi_prompt = options.multi_prompt;
                    }
                }

                // Elements/Voices (mutually exclusive)
                if (options.element_list && options.element_list.length > 0) {
                    payload.element_list = options.element_list;
                } else if (options.voice_list && options.voice_list.length > 0) {
                    payload.voice_list = options.voice_list;
                }
            }

            // ── Preflight Interceptor (Seedance 2.0 only) ──
            const isSeedanceProvider = provider === 'seedance-2' || provider === 'seedance';
            if (isSeedanceProvider && !options?.skipPreflight) {
                try {
                    const preflight = await preflightSeedance2(payload);
                    if (preflight.warnings && preflight.warnings.length > 0) {
                        return {
                            preflight: true,
                            warnings: preflight.warnings,
                            estimated_cost: preflight.estimated_cost ?? 0,
                        };
                    }
                    // If preflight passes with no warnings, update cost and proceed
                } catch (e: any) {
                    // If preflight fails, warn but allow fallthrough to animate
                    console.warn('[Preflight] Failed, proceeding to animate:', e);
                }
            }

            await api.post("/api/v1/shot/animate_shot", payload);
            toastSuccess("Animation Queued");
        } catch (e: any) {
            toastError(getApiErrorMessage(e, "Animation request failed"));
        } finally {
            removeLoadingShot?.(shotId);
        }
    };

    const handleText2Video = async (
        shot: any,
        options?: AnimateOptions
    ) => {
        try {
            const payload: any = {
                project_id: projectId,
                episode_id: episodeId,
                scene_id: sceneId!,
                shot_id: shot.id,
                prompt: shot.video_prompt || shot.visual_action || "Cinematic scene",
                provider: 'kling-v3'
            };

            if (options) {
                if (options.negative_prompt) payload.negative_prompt = options.negative_prompt;
                if (options.duration) payload.duration = options.duration;
                if (options.mode) payload.mode = options.mode;
                if (options.aspect_ratio) payload.aspect_ratio = options.aspect_ratio;
                if (options.cfg_scale !== undefined) payload.cfg_scale = options.cfg_scale;
                if (options.sound) payload.sound = options.sound;
                if (options.watermark !== undefined) payload.watermark = options.watermark;

                // Multi-shot
                if (options.multi_shot) {
                    payload.multi_shot = true;
                    if (options.shot_type) payload.shot_type = options.shot_type;
                    if (options.multi_prompt && options.multi_prompt.length > 0) {
                        payload.multi_prompt = options.multi_prompt;
                    }
                }

                // Elements/Voices
                if (options.element_list && options.element_list.length > 0) {
                    payload.element_list = options.element_list;
                } else if (options.voice_list && options.voice_list.length > 0) {
                    payload.voice_list = options.voice_list;
                }
            }

            await api.post("/api/v1/shot/text2video_shot", payload);
            toastSuccess("Text-to-Video Queued");
        } catch (e: any) {
            toastError(getApiErrorMessage(e, "Text-to-video request failed"));
        }
    };

    return { handleAnimateShot, handleText2Video };
};