/**
 * errorDictionary.ts
 *
 * Maps backend `error_code` enums to contextual, actionable UI states
 * for shot card error overlays. Shared across video AND image generation errors.
 */

// ── Action Types ──
export type ErrorActionType = 'retry' | 'edit' | 'wait' | 'topup' | 'reupload' | 'support';

// ── UI Config Shape ──
export interface ErrorUIConfig {
    icon: string;
    title: string;
    message: string;
    actionText: string;
    actionType: ErrorActionType;
}

// ── Dictionary ──
export const ERROR_UI_DICTIONARY: Record<string, ErrorUIConfig> = {
    PROVIDER_OVERLOAD: {
        icon: "🔄",
        title: "Servers Busy",
        message: "Our partner's video servers are temporarily overloaded.",
        actionText: "Try Again",
        actionType: "retry",
    },
    CONTENT_FLAGGED: {
        icon: "🛡️",
        title: "Content Flagged",
        message: "This prompt or image triggered AI safety filters. Please adjust your inputs.",
        actionText: "Edit Prompt",
        actionType: "edit",
    },
    RATE_LIMITED: {
        icon: "⏳",
        title: "High Traffic",
        message: "AI servers are currently rate-limiting requests.",
        actionText: "Wait & Retry",
        actionType: "wait",
    },
    GENERATION_TIMEOUT: {
        icon: "⏰",
        title: "Timed Out",
        message: "The generation took too long to respond.",
        actionText: "Try Again",
        actionType: "retry",
    },
    INVALID_INPUT: {
        icon: "⚠️",
        title: "Invalid Input",
        message: "There is an issue with your media files or prompt.",
        actionText: "Check Inputs",
        actionType: "edit",
    },
    MEDIA_EXPIRED: {
        icon: "🔗",
        title: "Media Expired",
        message: "The source media link has expired.",
        actionText: "Re-upload",
        actionType: "reupload",
    },
    INSUFFICIENT_CREDITS: {
        icon: "💳",
        title: "Low Balance",
        message: "You don't have enough credits to generate this shot.",
        actionText: "Get Credits",
        actionType: "topup",
    },
    DOWNLOAD_FAILED: {
        icon: "⬇️",
        title: "Processing Failed",
        message: "We couldn't fetch the final video file.",
        actionText: "Retry",
        actionType: "retry",
    },
    QUOTA_EXHAUSTED: {
        icon: "🛑",
        title: "Capacity Full",
        message: "AI provider quota reached. Please try again later.",
        actionText: "Okay",
        actionType: "wait",
    },
    AUTH_FAILED: {
        icon: "🔐",
        title: "Auth Error",
        message: "Partner authentication failed.",
        actionText: "Contact Support",
        actionType: "support",
    },
    UNKNOWN: {
        icon: "❓",
        title: "Generation Failed",
        message: "An unexpected error occurred.",
        actionText: "Retry",
        actionType: "retry",
    },
};

/**
 * Resolves an error_code (and optional fallback error_message) to a UI config.
 * Priority: exact dictionary match → UNKNOWN fallback with custom message.
 */
export const getErrorUIConfig = (
    errorCode?: string | null,
    errorMessage?: string | null
): ErrorUIConfig => {
    if (errorCode && ERROR_UI_DICTIONARY[errorCode]) {
        return ERROR_UI_DICTIONARY[errorCode];
    }

    // Use UNKNOWN template, but override the message if the backend provided one
    const fallback = { ...ERROR_UI_DICTIONARY.UNKNOWN };
    if (errorMessage && errorMessage.length < 200) {
        fallback.message = errorMessage;
    }
    return fallback;
};

/**
 * Execute the action associated with an error overlay.
 * Each handler is optional — callers wire only the actions they support.
 */
export const executeErrorAction = (
    actionType: ErrorActionType,
    handlers: {
        onRetry?: () => void;
        onEdit?: () => void;
        onTopUp?: () => void;
        onReupload?: () => void;
        onSupport?: () => void;
    }
) => {
    switch (actionType) {
        case 'retry':
            handlers.onRetry?.();
            break;
        case 'edit':
            handlers.onEdit?.();
            break;
        case 'wait':
            // No action — user just dismisses
            break;
        case 'topup':
            handlers.onTopUp?.();
            break;
        case 'reupload':
            handlers.onReupload?.();
            break;
        case 'support':
            if (handlers.onSupport) {
                handlers.onSupport();
            } else {
                // Default: Intercom with mailto fallback
                const w = window as any;
                if (w.Intercom) {
                    w.Intercom('show');
                } else {
                    window.location.href = 'mailto:support@motionx.studio';
                }
            }
            break;
    }
};
