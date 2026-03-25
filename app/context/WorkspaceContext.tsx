"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { api } from "@/lib/api";

// --- Types ---
export interface Workspace {
    slug: string;
    name: string;
    logo_url?: string;
}

interface WorkspaceContextType {
    availableWorkspaces: Workspace[];
    activeWorkspaceSlug: string | null;  // null = personal workspace
    setActiveWorkspace: (slug: string | null) => void;
    isLoading: boolean;
    refreshWorkspaces: () => Promise<void>;
}

// --- Module-level getter for non-React code (e.g., Axios interceptor) ---
let _activeWorkspaceSlug: string | null = null;

/**
 * Returns the currently active workspace slug.
 * Used by the Axios interceptor in lib/api.ts to inject X-Org-Id header.
 */
export function getActiveWorkspaceSlug(): string | null {
    return _activeWorkspaceSlug;
}

// --- Context ---
const WorkspaceContext = createContext<WorkspaceContextType>({
    availableWorkspaces: [],
    activeWorkspaceSlug: null,
    setActiveWorkspace: () => {},
    isLoading: true,
    refreshWorkspaces: async () => {},
});

export function useWorkspace() {
    return useContext(WorkspaceContext);
}

// --- Provider ---
const STORAGE_KEY = "motionx_active_workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspaceSlug, setActiveWorkspaceSlug] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Sync module-level getter whenever React state changes
    useEffect(() => {
        _activeWorkspaceSlug = activeWorkspaceSlug;
    }, [activeWorkspaceSlug]);

    // Restore persisted workspace on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                setActiveWorkspaceSlug(stored);
                _activeWorkspaceSlug = stored;
            }
        } catch { /* localStorage unavailable (SSR) */ }
    }, []);

    // Fetch workspaces when user authenticates
    const fetchWorkspaces = useCallback(async () => {
        try {
            const res = await api.get("/api/organization/my-orgs");
            const orgs: Workspace[] = (res.data.organizations || res.data || []).map((o: any) => ({
                slug: o.slug,
                name: o.name || o.slug,
                logo_url: o.logo_url,
            }));
            setAvailableWorkspaces(orgs);

            // Validate that persisted workspace still exists in the user's org list
            const storedSlug = localStorage.getItem(STORAGE_KEY);
            if (storedSlug && !orgs.some(o => o.slug === storedSlug)) {
                // Workspace no longer valid — reset to personal
                setActiveWorkspaceSlug(null);
                _activeWorkspaceSlug = null;
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (error) {
            console.warn("[WorkspaceContext] Failed to fetch workspaces:", error);
            setAvailableWorkspaces([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                fetchWorkspaces();
            } else {
                // Logged out — reset everything
                setAvailableWorkspaces([]);
                setActiveWorkspaceSlug(null);
                _activeWorkspaceSlug = null;
                setIsLoading(false);
                try { localStorage.removeItem(STORAGE_KEY); } catch {}
            }
        });
        return () => unsubscribe();
    }, [fetchWorkspaces]);

    // Set active workspace + persist
    const setActiveWorkspace = useCallback((slug: string | null) => {
        setActiveWorkspaceSlug(slug);
        _activeWorkspaceSlug = slug;
        try {
            if (slug) {
                localStorage.setItem(STORAGE_KEY, slug);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch { /* localStorage unavailable */ }
    }, []);

    return (
        <WorkspaceContext.Provider value={{
            availableWorkspaces,
            activeWorkspaceSlug,
            setActiveWorkspace,
            isLoading,
            refreshWorkspaces: fetchWorkspaces,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}
