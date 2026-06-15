/**
 * Emergency Lifeboat Configuration
 *
 * When NEXT_PUBLIC_EMERGENCY_MODE=true:
 *  1. API routes to AWS Lightsail instead of GCP
 *  2. Audio/LipSync features are disabled (worker offline)
 *  3. Gemini image generation is blocked (billing risk)
 *  4. Image model defaults to Luma (uni-1)
 *  5. Playground is fully blocked (maintenance screen)
 *
 * To restore normal operation, set NEXT_PUBLIC_EMERGENCY_MODE=false
 * or remove the variable entirely — all original code paths remain intact.
 */

export const EMERGENCY_MODE = process.env.NEXT_PUBLIC_EMERGENCY_MODE === 'true';

export const EMERGENCY_MESSAGES = {
  AUDIO_DISABLED: 'Audio generation is temporarily disabled for server maintenance.',
  LIPSYNC_DISABLED: 'Lip Sync is temporarily disabled for server maintenance.',
  GEMINI_DISABLED: 'Gemini is temporarily unavailable. Please use Luma or Seedream.',
  PLAYGROUND_DISABLED: 'The Playground is temporarily offline for server maintenance. Please use the Storyboard for image and video generation.',
} as const;

export const EMERGENCY_FALLBACK_IMAGE_PROVIDER = 'luma-uni-1';
