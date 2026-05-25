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

// ── Module-Level Bridge ──────────────────────────────────────────────
// Allows the Axios interceptor (non-React code) to trigger the modal.
// The provider registers its dispatch here on mount and clears on unmount.

let _trigger: ((payload: FreeTierLimitPayload) => void) | null = null;

export const setGlobalLimitTrigger = (
    fn: ((payload: FreeTierLimitPayload) => void) | null
) => {
    _trigger = fn;
};

/** Called by the Axios interceptor to fire the modal */
export const fireGlobalLimitTrigger = (payload: FreeTierLimitPayload) => {
    _trigger?.(payload);
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

    // Register the trigger function on mount so the Axios interceptor can use it
    useEffect(() => {
        setGlobalLimitTrigger(triggerUpgradeModal);
        return () => setGlobalLimitTrigger(null);
    }, [triggerUpgradeModal]);

    return (
        <FreeTierLimitContext.Provider
            value={{ ...state, triggerUpgradeModal, closeUpgradeModal }}
        >
            {children}
        </FreeTierLimitContext.Provider>
    );
}
