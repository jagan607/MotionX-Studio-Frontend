import { api } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

export type VideoProvider = 'kling' | 'kling-v3' | 'seedance';

export interface PromptSegment {
    index: number;
    prompt: string;
    duration: string;
}

export interface AnimateOptions {
    duration?: '3' | '5' | '10' | '15';
    mode?: 'std' | 'pro';
    aspect_ratio?: '16:9' | '9:16' | '1:1';

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
}

export const useShotVideoGen = (
    projectId: string,
    episodeId: string,
    sceneId: string | null
) => {

    const handleAnimateShot = async (
        shot: any,
        provider: VideoProvider = 'kling',
        endFrameUrl?: string | null,
        options?: AnimateOptions
    ) => {
        if (!shot.image_url) return toastError("No image to animate");

        try {
            const payload: any = {
                project_id: projectId,
                episode_id: episodeId,
                scene_id: sceneId!,
                shot_id: shot.id,
                image_url: shot.image_url,
                prompt: shot.video_prompt || "Cinematic motion",
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

            await api.post("/api/v1/shot/animate_shot", payload);
            toastSuccess("Animation Queued");
        } catch (e: any) {
            toastError(e.response?.data?.detail || "Animation request failed");
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
            toastError(e.response?.data?.detail || "Text-to-video request failed");
        }
    };

    return { handleAnimateShot, handleText2Video };
};