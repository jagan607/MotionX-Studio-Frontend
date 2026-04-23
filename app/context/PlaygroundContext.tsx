"use client";

/**
 * PlaygroundContext — State management for the B2C Playground workspace.
 *
 * Responsibilities:
 * 1. Assets: Fetches characters, locations, products from the Playground API
 * 2. Generations: Real-time Firestore onSnapshot on playgrounds/{uid}/generations
 * 3. Style Preferences: Persisted to localStorage, injected into every generate call
 * 4. CRUD Actions: Create assets, trigger generation (via PlaygroundApi)
 *
 * This context is mounted ONLY on the /playground route — never at the root layout.
 * It shares WorkspaceContext and MediaViewerContext from the root, but owns no Studio state.
 */

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    query,
    orderBy,
    limit as firestoreLimit,
    onSnapshot,
} from "firebase/firestore";
import {
    type PlaygroundAsset,
    type PlaygroundGeneration,
    type PlaygroundAssetCreateParams,
    listPlaygroundAssets,
    createPlaygroundAsset,
    updatePlaygroundAsset as updatePlaygroundAssetApi,
    deletePlaygroundAsset as deletePlaygroundAssetApi,
} from "@/lib/playgroundApi";


// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface PlaygroundStylePrefs {
    style_palette: string;
    style_lighting: string;
    style_mood: string;
    aspect_ratio: string;
    shot_type: string;
    image_provider: string;
    model_tier: string;
    style: string;
    image_resolution: string;
}

interface PlaygroundContextType {
    // === Assets ===
    characters: PlaygroundAsset[];
    locations: PlaygroundAsset[];
    products: PlaygroundAsset[];
    assetsLoading: boolean;
    refreshAssets: () => Promise<void>;
    addAsset: (data: PlaygroundAssetCreateParams) => Promise<string>;
    updateAsset: (assetType: "characters" | "locations" | "products", assetId: string, data: Partial<Omit<PlaygroundAssetCreateParams, "asset_type">>) => Promise<void>;
    deleteAssetById: (assetType: "characters" | "locations" | "products", assetId: string) => Promise<void>;

    // === Generations (real-time via Firestore) ===
    generations: PlaygroundGeneration[];
    generationsLoading: boolean;

    // === Style Preferences (persisted to localStorage) ===
    stylePrefs: PlaygroundStylePrefs;
    setStylePref: <K extends keyof PlaygroundStylePrefs>(
        key: K,
        value: PlaygroundStylePrefs[K]
    ) => void;

    // === Mention items (derived from assets, for usePromptMention) ===
    mentionItems: PlaygroundMentionItem[];

    // === Prompt Reuse (one-shot signal from GenerationCard → PromptBar) ===
    pendingPrompt: string | null;
    setPendingPrompt: (text: string | null) => void;

    // === Pending Video Settings (one-shot signal from TemplatePicker → PromptBar) ===
    pendingVideoSettings: PendingVideoSettings | null;
    setPendingVideoSettings: (s: PendingVideoSettings | null) => void;

    // === Animate Modal (generation to animate) ===
    animateTarget: PlaygroundGeneration | null;
    setAnimateTarget: (gen: PlaygroundGeneration | null) => void;

    // === Asset Drawer (cross-component control) ===
    assetDrawerOpen: boolean;
    setAssetDrawerOpen: (open: boolean) => void;
    assetDrawerIntent: 'list' | 'create' | null;
    setAssetDrawerIntent: (intent: 'list' | 'create' | null) => void;

    // === Auth ===
    uid: string | null;
}

export interface PlaygroundMentionItem {
    tag: string;              // e.g. "@Maya" (human-readable)
    type: "image";            // usePromptMention expects 'image' | 'video' | 'audio'
    url: string;              // thumbnail URL (for dropdown display)
    name: string;             // display name
    assetId: string;          // Firestore doc ID
    assetType: "character" | "location" | "product";
}

export interface PendingVideoSettings {
    mode: 'video';
    provider: string;
    duration: string;
    quality?: string;
}


// ═══════════════════════════════════════════════════════════════
//  DEFAULTS & CONSTANTS
// ═══════════════════════════════════════════════════════════════

const STYLE_STORAGE_KEY = "motionx_playground_style";

const DEFAULT_STYLE_PREFS: PlaygroundStylePrefs = {
    style_palette: "",
    style_lighting: "",
    style_mood: "",
    aspect_ratio: "16:9",
    shot_type: "Wide Shot",
    image_provider: "gemini",
    model_tier: "flash",
    style: "realistic",
    image_resolution: "1k",
};

const DEFAULT_CONTEXT: PlaygroundContextType = {
    characters: [],
    locations: [],
    products: [],
    assetsLoading: true,
    refreshAssets: async () => {},
    addAsset: async () => "",
    updateAsset: async () => {},
    deleteAssetById: async () => {},
    generations: [],
    generationsLoading: true,
    stylePrefs: DEFAULT_STYLE_PREFS,
    setStylePref: () => {},
    mentionItems: [],
    pendingPrompt: null,
    setPendingPrompt: () => {},
    pendingVideoSettings: null,
    setPendingVideoSettings: () => {},
    animateTarget: null,
    setAnimateTarget: () => {},
    assetDrawerOpen: true,
    setAssetDrawerOpen: () => {},
    assetDrawerIntent: null,
    setAssetDrawerIntent: () => {},
    uid: null,
};


// ═══════════════════════════════════════════════════════════════
//  CONTEXT
// ═══════════════════════════════════════════════════════════════

const PlaygroundContext = createContext<PlaygroundContextType>(DEFAULT_CONTEXT);

export function usePlayground() {
    return useContext(PlaygroundContext);
}


// ═══════════════════════════════════════════════════════════════
//  PROVIDER
// ═══════════════════════════════════════════════════════════════

export function PlaygroundProvider({ children }: { children: ReactNode }) {
    const [uid, setUid] = useState<string | null>(null);

    // --- Assets ---
    const [characters, setCharacters] = useState<PlaygroundAsset[]>([]);
    const [locations, setLocations] = useState<PlaygroundAsset[]>([]);
    const [products, setProducts] = useState<PlaygroundAsset[]>([]);
    const [assetsLoading, setAssetsLoading] = useState(true);

    // --- Generations ---
    const [generations, setGenerations] = useState<PlaygroundGeneration[]>([]);
    const [generationsLoading, setGenerationsLoading] = useState(true);

    // --- Prompt reuse (one-shot signal) ---
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
    const [pendingVideoSettings, setPendingVideoSettings] = useState<PendingVideoSettings | null>(null);

    // --- Animate modal target ---
    const [animateTarget, setAnimateTarget] = useState<PlaygroundGeneration | null>(null);

    // --- Asset Drawer state (lifted for cross-component control) ---
    const [assetDrawerOpen, setAssetDrawerOpen] = useState(true);
    const [assetDrawerIntent, setAssetDrawerIntent] = useState<'list' | 'create' | null>(null);

    // --- Style Preferences ---
    const [stylePrefs, setStylePrefs] = useState<PlaygroundStylePrefs>(() => {
        // Hydrate from localStorage on mount
        try {
            const stored = localStorage.getItem(STYLE_STORAGE_KEY);
            if (stored) {
                return { ...DEFAULT_STYLE_PREFS, ...JSON.parse(stored) };
            }
        } catch { /* SSR or parse error */ }
        return DEFAULT_STYLE_PREFS;
    });


    // ── Auth listener ──
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUid(user?.uid ?? null);
        });
        return () => unsubscribe();
    }, []);


    // ── Fetch assets from API ──
    const refreshAssets = useCallback(async () => {
        if (!uid) return;
        setAssetsLoading(true);
        try {
            const [charsRes, locsRes, prodsRes] = await Promise.all([
                listPlaygroundAssets("characters"),
                listPlaygroundAssets("locations"),
                listPlaygroundAssets("products"),
            ]);
            setCharacters(charsRes.assets || []);
            setLocations(locsRes.assets || []);
            setProducts(prodsRes.assets || []);
        } catch (err) {
            console.error("[PlaygroundContext] Failed to fetch assets:", err);
        } finally {
            setAssetsLoading(false);
        }
    }, [uid]);

    // Fetch assets when uid becomes available
    useEffect(() => {
        if (uid) refreshAssets();
    }, [uid, refreshAssets]);


    // ── Create asset (delegates to API, then refreshes local state) ──
    const addAsset = useCallback(async (data: PlaygroundAssetCreateParams): Promise<string> => {
        const result = await createPlaygroundAsset(data);
        // Refresh the specific asset type that was just created
        await refreshAssets();
        return result.asset_id;
    }, [refreshAssets]);


    // ── Update asset (delegates to API, then refreshes) ──
    const updateAsset = useCallback(async (
        assetType: "characters" | "locations" | "products",
        assetId: string,
        data: Partial<Omit<PlaygroundAssetCreateParams, "asset_type">>
    ): Promise<void> => {
        await updatePlaygroundAssetApi(assetType, assetId, data);
        await refreshAssets();
    }, [refreshAssets]);


    // ── Delete asset (delegates to API, then refreshes) ──
    const deleteAssetById = useCallback(async (
        assetType: "characters" | "locations" | "products",
        assetId: string
    ): Promise<void> => {
        await deletePlaygroundAssetApi(assetType, assetId);
        await refreshAssets();
    }, [refreshAssets]);


    // ── Firestore real-time listener for generations ──
    useEffect(() => {
        if (!uid) {
            setGenerations([]);
            setGenerationsLoading(false);
            return;
        }

        setGenerationsLoading(true);

        const generationsRef = collection(db, "playgrounds", uid, "generations");
        const q = query(
            generationsRef,
            orderBy("created_at", "desc"),
            firestoreLimit(50)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const gens: PlaygroundGeneration[] = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                } as PlaygroundGeneration));
                setGenerations(gens);
                setGenerationsLoading(false);
            },
            (error) => {
                console.error("[PlaygroundContext] Generations listener error:", error);
                setGenerationsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [uid]);


    // ── Style preference setter (updates state + persists to localStorage) ──
    const setStylePref = useCallback(<K extends keyof PlaygroundStylePrefs>(
        key: K,
        value: PlaygroundStylePrefs[K]
    ) => {
        setStylePrefs((prev) => {
            const next = { ...prev, [key]: value };
            try {
                localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(next));
            } catch { /* localStorage unavailable */ }
            return next;
        });
    }, []);


    // ── Derive mention items from assets (for usePromptMention) ──
    const mentionItems: PlaygroundMentionItem[] = useMemo(() => {
        const items: PlaygroundMentionItem[] = [];

        for (const char of characters) {
            items.push({
                tag: `@${char.name.replace(/\s+/g, "")}`,
                type: "image",
                url: char.image_url || "",
                name: char.name,
                assetId: char.id,
                assetType: "character",
            });
        }

        for (const loc of locations) {
            items.push({
                tag: `@${loc.name.replace(/\s+/g, "")}`,
                type: "image",
                url: loc.image_url || "",
                name: loc.name,
                assetId: loc.id,
                assetType: "location",
            });
        }

        for (const prod of products) {
            items.push({
                tag: `@${prod.name.replace(/\s+/g, "")}`,
                type: "image",
                url: prod.image_url || "",
                name: prod.name,
                assetId: prod.id,
                assetType: "product",
            });
        }

        return items;
    }, [characters, locations, products]);


    // ── Context value ──
    const value = useMemo<PlaygroundContextType>(
        () => ({
            characters,
            locations,
            products,
            assetsLoading,
            refreshAssets,
            addAsset,
            updateAsset,
            deleteAssetById,
            generations,
            generationsLoading,
            stylePrefs,
            setStylePref,
            mentionItems,
            pendingPrompt,
            setPendingPrompt,
            pendingVideoSettings,
            setPendingVideoSettings,
            animateTarget,
            setAnimateTarget,
            assetDrawerOpen,
            setAssetDrawerOpen,
            assetDrawerIntent,
            setAssetDrawerIntent,
            uid,
        }),
        [
            characters, locations, products, assetsLoading, refreshAssets, addAsset,
            updateAsset, deleteAssetById,
            generations, generationsLoading, stylePrefs, setStylePref, mentionItems,
            pendingPrompt, setPendingPrompt,
            pendingVideoSettings, setPendingVideoSettings,
            animateTarget, setAnimateTarget,
            assetDrawerOpen, setAssetDrawerOpen,
            assetDrawerIntent, setAssetDrawerIntent,
            uid,
        ]
    );

    return (
        <PlaygroundContext.Provider value={value}>
            {children}
        </PlaygroundContext.Provider>
    );
}
