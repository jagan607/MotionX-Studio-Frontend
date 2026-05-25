"use client";

import {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    type ReactNode,
} from "react";

// ── Types ────────────────────────────────────────────────────────────

/** Shape of the 403 payload from the backend */
export interface FreeTierLimitPayload {
    detail: string;
    error_code: "FREE_TIER_LIMIT_REACHED";
    limit_type: string;
    current_usage: number;
    limit: number;
}

interface FreeTierLimitState {
    isOpen: boolean;
    limitType: string | null;
    detail: string | null;
    currentUsage: number;
    usageLimit: number;
}

interface FreeTierLimitContextValue extends FreeTierLimitState {
    triggerUpgradeModal: (payload: FreeTierLimitPayload) => void;
    closeUpgradeModal: () => void;
}

const DEFAULT_STATE: FreeTierLimitState = {
    isOpen: false,
    limitType: null,
    detail: null,
    currentUsage: 0,
    usageLimit: 0,
};

// ── DOM Event Bridge ─────────────────────────────────────────────────
// Uses window CustomEvent to cross webpack chunk boundaries.
// The Axios interceptor (in api.ts) dispatches the event, and the
// React provider listens for it. This is immune to module
// instantiation issues that break the old module-level variable approach.

const UPGRADE_MODAL_EVENT = "__mx_free_tier_limit__";

/** Called by the Axios interceptor to fire the modal */
export const fireGlobalLimitTrigger = (payload: FreeTierLimitPayload) => {
    if (typeof window !== "undefined") {
        console.log("[FreeTierLimit] Dispatching upgrade modal event:", payload.limit_type);
        window.dispatchEvent(
            new CustomEvent(UPGRADE_MODAL_EVENT, { detail: payload })
        );
    }
};

// ── Context ──────────────────────────────────────────────────────────

const FreeTierLimitContext = createContext<FreeTierLimitContextValue>({
    ...DEFAULT_STATE,
    triggerUpgradeModal: () => {},
    closeUpgradeModal: () => {},
});

export function useFreeTierLimit(): FreeTierLimitContextValue {
    return useContext(FreeTierLimitContext);
}

// ── Provider ─────────────────────────────────────────────────────────

export function FreeTierLimitProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<FreeTierLimitState>(DEFAULT_STATE);

    const triggerUpgradeModal = useCallback(
        (payload: FreeTierLimitPayload) => {
            console.log("[FreeTierLimit] triggerUpgradeModal called:", payload.limit_type);
            setState({
                isOpen: true,
                limitType: payload.limit_type,
                detail: payload.detail,
                currentUsage: payload.current_usage,
                usageLimit: payload.limit,
            });
        },
        []
    );

    const closeUpgradeModal = useCallback(() => {
        setState(DEFAULT_STATE);
    }, []);

    // Listen for the DOM event dispatched by the Axios interceptor
    useEffect(() => {
        const handler = (e: Event) => {
            const payload = (e as CustomEvent<FreeTierLimitPayload>).detail;
            console.log("[FreeTierLimit] Received DOM event, opening modal:", payload.limit_type);
            triggerUpgradeModal(payload);
        };
        window.addEventListener(UPGRADE_MODAL_EVENT, handler);
        return () => window.removeEventListener(UPGRADE_MODAL_EVENT, handler);
    }, [triggerUpgradeModal]);

    return (
        <FreeTierLimitContext.Provider
            value={{ ...state, triggerUpgradeModal, closeUpgradeModal }}
        >
            {children}
        </FreeTierLimitContext.Provider>
    );
}

