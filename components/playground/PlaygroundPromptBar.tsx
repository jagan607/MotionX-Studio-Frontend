"use client";

/**
 * PlaygroundPromptBar — The core UX component for the Playground.
 *
 * Features:
 *  1. Textarea with usePromptMention integration (@ tagging for assets)
 *  2. Mention dropdown overlay with keyboard navigation
 *  3. Quick-settings selectors (provider, aspect ratio, shot type, model tier)
 *  4. Reference image upload
 *  5. Generate button with credit cost preview
 *  6. extractAssetIds() for payload construction
 *
 * Uses the existing usePromptMention hook from app/hooks/usePromptMention.ts,
 * wired to PlaygroundContext's mentionItems (characters, locations, products).
 */

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
    Send,
    ChevronDown,
    Image as ImageIcon,
    ImagePlus,
    User,
    MapPin,
    Package,
    X,
    Loader2,
    Upload,
    Link2,
    Search,
    Wand2,
    PlusCircle,
} from "lucide-react";
import { usePromptMention } from "@/app/hooks/usePromptMention";
import { usePlayground, type PlaygroundMentionItem } from "@/app/context/PlaygroundContext";
import { usePricing, formatCredits } from "@/app/hooks/usePricing";
import { useCredits } from "@/hooks/useCredits";
import { playgroundGenerate, playgroundEnhancePrompt } from "@/lib/playgroundApi";
import toast from "react-hot-toast";

// ═══════════════════════════════════════════════════════════════
//  ASSET ID EXTRACTION
// ═══════════════════════════════════════════════════════════════

/**
 * Parse the prompt string for @tags, cross-reference against the tag→assetId map,
 * and extract grouped Firestore IDs by type for the API payload.
 */
function extractAssetIds(
    prompt: string,
    mentionItems: PlaygroundMentionItem[]
): { characters: string; location: string; products: string } {
    // Build a tag → asset lookup
    const tagMap = new Map<string, { id: string; type: string }>();
    for (const item of mentionItems) {
        tagMap.set(item.tag.toLowerCase(), { id: item.assetId, type: item.assetType });
    }

    // Find all @tags in the prompt
    const mentioned = prompt.match(/@\w+/g) || [];
    const chars: string[] = [];
    const prods: string[] = [];
    let loc = "";

    for (const rawTag of mentioned) {
        const asset = tagMap.get(rawTag.toLowerCase());
        if (!asset) continue;
        if (asset.type === "character" && !chars.includes(asset.id)) chars.push(asset.id);
        if (asset.type === "location") loc = asset.id;   // last one wins
        if (asset.type === "product" && !prods.includes(asset.id)) prods.push(asset.id);
    }

    return {
        characters: chars.join(","),
        location: loc,
        products: prods.join(","),
    };
}

// ═══════════════════════════════════════════════════════════════
//  QUICK SETTINGS OPTIONS
// ═══════════════════════════════════════════════════════════════

const PROVIDERS = [
    { value: "gemini", label: "Gemini" },
    { value: "seedream", label: "SeedReam" },
];

const ASPECT_RATIOS = [
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
    { value: "1:1", label: "1:1" },
    { value: "4:3", label: "4:3" },
    { value: "3:4", label: "3:4" },
];

const SHOT_TYPES = [
    { value: "Wide Shot", label: "Wide" },
    { value: "Medium Shot", label: "Medium" },
    { value: "Close-Up", label: "Close-Up" },
    { value: "Extreme Close-Up", label: "Extreme CU" },
    { value: "Over-the-Shoulder", label: "OTS" },
    { value: "Bird's Eye", label: "Bird's Eye" },
    { value: "Low Angle", label: "Low Angle" },
    { value: "Dutch Angle", label: "Dutch" },
];

const MODEL_TIERS = [
    { value: "flash", label: "Flash ⚡" },
    { value: "pro", label: "Pro ✦" },
];

const RESOLUTIONS = [
    { value: "1k", label: "1K" },
    { value: "2k", label: "2K" },
    { value: "4k", label: "4K" },
];

const BATCH_SIZES = [1, 2, 4] as const;
type BatchSize = (typeof BATCH_SIZES)[number];

const RESOLUTION_MULTIPLIER: Record<string, number> = {
    '1k': 1.0,
    '2k': 1.5,
    '4k': 2.0,
};

const VISUAL_STYLES = [
    { value: "realistic", label: "Realistic" },
    { value: "cinematic", label: "Cinematic" },
    { value: "anime", label: "Anime" },
    { value: "3d-render", label: "3D Render" },
    { value: "oil-painting", label: "Oil Painting" },
    { value: "watercolor", label: "Watercolor" },
    { value: "comic", label: "Comic" },
    { value: "noir", label: "Noir" },
];

// ═══════════════════════════════════════════════════════════════
//  ASSET TYPE ICONS
// ═══════════════════════════════════════════════════════════════

const ASSET_TYPE_ICON: Record<string, typeof User> = {
    character: User,
    location: MapPin,
    product: Package,
};

const ASSET_TYPE_COLOR: Record<string, string> = {
    character: "#3B82F6",  // blue
    location: "#22C55E",   // green
    product: "#F59E0B",    // amber
};

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function PlaygroundPromptBar() {
    const {
        mentionItems,
        stylePrefs,
        setStylePref,
        pendingPrompt,
        setPendingPrompt,
        assetDrawerOpen,
        setAssetDrawerOpen,
        setAssetDrawerIntent,
    } = usePlayground();

    // --- Local state ---
    // `prompt` is the React-side mirror used for derived UI (highlight backdrop,
    // generate button enabled state, credit cost, etc.).  The actual textarea is
    // **uncontrolled** — we never pass `value={prompt}` back to it — so React
    // can't fight the browser over cursor position during rapid edits / paste.
    const [prompt, setPrompt] = useState("");
    const promptRef = useRef("");           // always-current, no re-render
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [referenceImages, setReferenceImages] = useState<File[]>([]);
    const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
    const [referenceUrls, setReferenceUrls] = useState<string[]>([]); // URLs from drag-and-drop
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = useRef(0); // Counter to prevent child-element flickering
    const [showSettings, setShowSettings] = useState(false);
    const [batchSize, setBatchSize] = useState<BatchSize>(1);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    // mentionRef is initialised after `mention` is created (below)

    // --- Dynamic pricing ---
    const { getImageCost } = usePricing();
    const { credits } = useCredits();
    const imageCost = getImageCost(stylePrefs.image_provider, stylePrefs.model_tier as 'flash' | 'pro', 'playground');
    const resolution = stylePrefs.image_resolution || '1k';
    const finalCost = Math.round(imageCost * (RESOLUTION_MULTIPLIER[resolution] || 1) * batchSize * 100) / 100;
    const hasInsufficientBalance = credits !== null && credits < finalCost;

    // --- Stable callback for mention tag insertion (must be defined before usePromptMention) ---
    const handleMentionInsert = useCallback((newValue: string) => {
        promptRef.current = newValue;
        setPrompt(newValue);
    }, []);

    // --- usePromptMention wiring ---
    const mention = usePromptMention({
        textareaRef,
        items: mentionItems, // PlaygroundMentionItem extends MentionItem
        enabled: mentionItems.length > 0,
        onInsert: handleMentionInsert,
    });

    // Now that `mention` is defined, keep a stable ref for callbacks
    const mentionRef = useRef(mention);
    mentionRef.current = mention;

    // --- Magic Enhance handler ---
    const handleEnhance = useCallback(async () => {
        const cur = promptRef.current;
        if (!cur.trim() || isEnhancing || isGenerating) return;

        // 1. Extract all @tags before sending
        const originalTags = (cur.match(/@\w+/g) || []).map(t => t.toLowerCase());

        setIsEnhancing(true);
        try {
            const enhanced = await playgroundEnhancePrompt({
                prompt: cur,
                provider: stylePrefs.image_provider || 'gemini',
                aspect_ratio: stylePrefs.aspect_ratio || '16:9',
            });

            // 2. @Tag safety net: verify all original tags are still present
            let safePrompt = enhanced;
            const enhancedLower = enhanced.toLowerCase();
            const missingTags = originalTags.filter(tag => !enhancedLower.includes(tag));
            if (missingTags.length > 0) {
                const origCasing = (cur.match(/@\w+/g) || []);
                const toAppend = origCasing.filter(t => missingTags.includes(t.toLowerCase()));
                safePrompt = `${enhanced} ${toAppend.join(' ')}`;
            }

            // Push into the uncontrolled textarea + mirror to React
            writeToTextarea(safePrompt);
            autoResize();
            requestAnimationFrame(() => textareaRef.current?.focus());

        } catch (e: any) {
            console.error('[Enhance] Failed:', e);
            toast.error('Enhancement failed — try again');
        } finally {
            setIsEnhancing(false);
        }
    }, [isEnhancing, isGenerating, stylePrefs]);

    // --- Helper: imperatively set textarea value (uncontrolled) ---
    const writeToTextarea = useCallback((text: string) => {
        const el = textareaRef.current;
        if (el) el.value = text;
        promptRef.current = text;
        setPrompt(text);
    }, []);

    // --- Handle prompt input (uncontrolled — textarea owns cursor) ---
    const handlePromptChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const value = e.target.value;
            // Mirror to React state (for button enable/disable, credit calc, backdrop)
            promptRef.current = value;
            setPrompt(value);
            // Let mention system check for @ triggers
            mentionRef.current.handleChange(value, e.target.selectionStart ?? undefined);
        },
        []
    );

    // --- Handle reference image(s) ---
    const MAX_REFS = 10;
    const totalRefs = referenceImages.length + referenceUrls.length;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const remaining = MAX_REFS - totalRefs;
        const toAdd = files.slice(0, Math.max(0, remaining));
        if (toAdd.length < files.length) {
            toast.error(`Max ${MAX_REFS} reference images`);
        }
        setReferenceImages(prev => [...prev, ...toAdd]);
        setReferencePreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    };

    const removeReferenceFile = (idx: number) => {
        setReferencePreviews(prev => {
            URL.revokeObjectURL(prev[idx]);
            return prev.filter((_, i) => i !== idx);
        });
        setReferenceImages(prev => prev.filter((_, i) => i !== idx));
    };

    const clearReference = () => {
        referencePreviews.forEach(u => URL.revokeObjectURL(u));
        setReferenceImages([]);
        setReferencePreviews([]);
        setReferenceUrls([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeReferenceUrl = (idx: number) => {
        setReferenceUrls(prev => prev.filter((_, i) => i !== idx));
    };



    // --- Drag-and-drop handlers (using counter for flicker-free child traversal) ---
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current += 1;
        if (dragCounterRef.current === 1) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragOver(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragOver(false);

        // Check for playground image URL
        const pgUrl = e.dataTransfer.getData("application/x-playground-image")
            || e.dataTransfer.getData("text/plain");

        if (pgUrl && pgUrl.startsWith("http")) {
            // Append to list (dedup)
            setReferenceUrls(prev => {
                if (prev.includes(pgUrl)) return prev;
                return [...prev, pgUrl];
            });

        }
    }, []);

    // --- Auto-resize textarea + sync backdrop ---
    const backdropRef = useRef<HTMLDivElement | null>(null);

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;

        // Save and restore scroll / selection so the resize can't
        // displace the caret or cause visible content jumps.
        const savedScrollTop = el.scrollTop;

        // Reset to auto so scrollHeight reports the true content height
        // (setting to '0' mid-edit can reflow the caret to a wrong line).
        el.style.height = 'auto';
        const next = Math.min(el.scrollHeight, 120);
        el.style.height = next + 'px';

        el.scrollTop = savedScrollTop;

        // Pin backdrop height to match
        const bd = backdropRef.current;
        if (bd) bd.style.height = next + 'px';
    }, []);

    // --- Watch pendingPrompt from context (one-shot reuse) ---
    useEffect(() => {
        if (pendingPrompt) {
            writeToTextarea(pendingPrompt);
            setPendingPrompt(null);
            // autoResize in rAF so the DOM value is committed
            requestAnimationFrame(() => {
                autoResize();
                textareaRef.current?.focus();
            });
        }
    }, [pendingPrompt, setPendingPrompt, autoResize, writeToTextarea]);

    // Sync scroll between textarea and backdrop
    const handleScroll = useCallback(() => {
        if (textareaRef.current && backdropRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    }, []);

    // Build known-tags lookup from mentionItems
    const knownTagMap = useMemo(() => {
        const map = new Map<string, string>(); // lowercase tag -> assetType
        for (const item of mentionItems) {
            map.set(item.tag.toLowerCase(), item.assetType);
        }
        return map;
    }, [mentionItems]);

    // Render highlighted text for the backdrop div
    const renderHighlightedText = useCallback((text: string) => {
        if (!text) return <>&nbsp;</>;

        // Split on @word boundaries, keeping the delimiters
        const parts = text.split(/(@\w+)/g);

        return parts.map((part, idx) => {
            if (part.startsWith("@")) {
                const assetType = knownTagMap.get(part.toLowerCase());
                if (assetType) {
                    return (
                        <span key={idx} style={{ color: "#60A5FA" }}>
                            {part}
                        </span>
                    );
                }
            }
            return <span key={idx} style={{ color: 'rgba(255,255,255,0.9)' }}>{part}</span>;
        });
    }, [knownTagMap]);

    // ═══ GENERATE HANDLER ═══
    const handleGenerate = useCallback(async () => {
        const trimmed = promptRef.current.trim();
        if (!trimmed || isGenerating) return;

        setIsGenerating(true);

        try {
            // Extract asset IDs from @tags
            const { characters, location, products } = extractAssetIds(trimmed, mentionItems);

            // Build a single-generation thunk
            const generateOne = () =>
                playgroundGenerate({
                    prompt: trimmed,
                    characters: characters || undefined,
                    location: location || undefined,
                    products: products || undefined,
                    aspect_ratio: stylePrefs.aspect_ratio,
                    style: stylePrefs.style,
                    shot_type: stylePrefs.shot_type,
                    image_provider: stylePrefs.image_provider,
                    model_tier: stylePrefs.model_tier,
                    style_palette: stylePrefs.style_palette || undefined,
                    style_lighting: stylePrefs.style_lighting || undefined,
                    style_mood: stylePrefs.style_mood || undefined,
                    reference_image: referenceImages[0] || null,
                    ref_image_urls: referenceUrls.length ? referenceUrls : undefined,
                    image_resolution: stylePrefs.image_resolution || '1k',
                });

            // Fire N parallel requests (batchSize = 1 | 2 | 4)
            const results = await Promise.allSettled(
                Array.from({ length: batchSize }, () => generateOne())
            );

            const failed = results.filter((r) => r.status === "rejected").length;


            if (failed > 0) {
                toast.error(
                    `${failed} generation${failed > 1 ? "s" : ""} failed to queue`
                );
            }

            writeToTextarea("");
            clearReference();
            // Reset textarea height
            if (textareaRef.current) textareaRef.current.style.height = "auto";

        } catch (err: any) {
            console.error("[PlaygroundPromptBar] Generate failed:", err);
            const msg = err?.response?.data?.detail || "Generation failed. Please try again.";
            toast.error(msg);
        } finally {
            setIsGenerating(false);
        }
    }, [isGenerating, mentionItems, stylePrefs, referenceImages, batchSize, writeToTextarea]);

    // --- Keyboard: Enter to submit (Shift+Enter for newline) ---
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            // Let the mention system handle its keys first
            mentionRef.current.handleKeyDown(e);
            if (e.defaultPrevented) return;

            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
            }
        },
        [handleGenerate]
    );

    // Count tagged assets in current prompt (used only for display, fine with state)
    const taggedCount = useMemo(() => {
        return (prompt.match(/@\w+/g) || []).filter(tag =>
            mentionItems.some(m => m.tag.toLowerCase() === tag.toLowerCase())
        ).length;
    }, [prompt, mentionItems]);

    return (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
            {/* Gradient fade */}
            <div className="h-8 bg-gradient-to-t from-[#030303] to-transparent" />

            <div className="bg-[#030303] px-4 pb-4 pt-1 pointer-events-auto">
                <div className="max-w-4xl mx-auto relative">

                    {/* ── REFERENCE IMAGE PREVIEWS (files + dropped URLs) ── */}
                    {(referencePreviews.length > 0 || referenceUrls.length > 0) && (
                        <div className="flex items-center gap-2 mb-2 px-1 overflow-x-auto">
                            {/* File-uploaded references */}
                            {referencePreviews.map((preview, idx) => (
                                <div key={`file-${idx}`} className="relative w-12 h-12 rounded-lg overflow-hidden border border-[#333] shrink-0">
                                    <img src={preview} className="w-full h-full object-cover" alt={`Reference ${idx + 1}`} />
                                    <button
                                        onClick={() => removeReferenceFile(idx)}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center text-white/80 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <X size={8} />
                                    </button>
                                </div>
                            ))}

                            {/* Dropped URL references */}
                            {referenceUrls.map((url, idx) => (
                                <div key={`url-${idx}`} className="relative w-12 h-12 rounded-lg overflow-hidden border border-[#333] shrink-0">
                                    <img src={url} className="w-full h-full object-cover" alt={`Ref ${idx + 1}`} />
                                    <button
                                        onClick={() => removeReferenceUrl(idx)}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center text-white/80 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                                    >
                                        <X size={8} />
                                    </button>
                                    <div className="absolute bottom-0.5 left-0.5 bg-black/70 p-0.5 rounded">
                                        <Link2 size={7} className="text-blue-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── MAIN PROMPT CONTAINER ── */}
                    <div
                        className={`relative border rounded-2xl transition-all duration-300 ${
                            isDragOver
                                ? "border-[#E50914]/50 shadow-[0_0_30px_rgba(229,9,20,0.15)]"
                                : "border-white/[0.08] hover:border-white/[0.14] focus-within:border-[#E50914]/30 shadow-[0_4px_30px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)] focus-within:shadow-[0_4px_40px_rgba(229,9,20,0.08),0_0_0_1px_rgba(229,9,20,0.12)]"
                        }`}
                        style={{ background: 'linear-gradient(180deg, #161616 0%, #0e0e0e 100%)' }}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {/* Drop zone overlay — prominent, full-coverage */}
                        {isDragOver && (
                            <div className="absolute inset-0 z-40 rounded-xl bg-black/80 backdrop-blur-sm border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ animation: 'fadeIn 0.15s ease-out' }}>
                                <div className="w-14 h-14 rounded-2xl bg-[#E50914]/15 border border-[#E50914]/30 flex items-center justify-center animate-pulse">
                                    <ImagePlus size={24} className="text-[#E50914]" />
                                </div>
                                <div className="text-center">
                                    <p className="text-[11px] font-bold text-white/90 uppercase tracking-[2px]">Drop image to use as reference</p>
                                    <p className="text-[9px] text-white/40 font-mono mt-1">PNG, JPG, WEBP supported</p>
                                </div>
                            </div>
                        )}

                        {/* Textarea + backdrop highlight + mention dropdown wrapper */}
                        <div className="relative px-4 pt-3 pb-2">
                            <div className="flex items-start gap-2">
                                {/* ── Magic Enhance Button ── */}
                                <button
                                    onClick={handleEnhance}
                                    disabled={!prompt.trim() || isEnhancing || isGenerating}
                                    title={isEnhancing ? 'Enhancing…' : 'Magic Enhance — expand your prompt with AI'}
                                    className={`mt-0.5 p-1.5 rounded-lg transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed ${
                                        isEnhancing
                                            ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                                            : !prompt.trim()
                                                ? 'text-[#333] border border-transparent'
                                                : 'text-[#555] hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20'
                                    }`}
                                >
                                    {isEnhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                </button>

                                {/* Grid stack: backdrop + textarea share the same cell */}
                                <div className="flex-1 grid min-w-0 max-h-[120px] overflow-y-auto no-scrollbar" style={{ gridTemplateColumns: '1fr' }}>
                                    {/* Backdrop: highlighted text layer behind the textarea */}
                                    <div
                                        ref={backdropRef}
                                        aria-hidden="true"
                                        className="pointer-events-none whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed min-h-[24px]"
                                        style={{
                                            gridArea: '1 / 1',
                                            wordWrap: 'break-word',
                                            overflowWrap: 'break-word',
                                        }}
                                    >
                                        {renderHighlightedText(prompt)}
                                    </div>

                                    <textarea
                                        ref={textareaRef}
                                        defaultValue=""
                                        onChange={(e) => {
                                            handlePromptChange(e);
                                            // Defer resize to next frame so the browser
                                            // finishes processing the keystroke first —
                                            // running it synchronously can misplace the
                                            // caret during backspace / delete.
                                            requestAnimationFrame(autoResize);
                                        }}
                                        onKeyDown={handleKeyDown}
                                        onBlur={() => mentionRef.current.handleBlur()}
                                        onScroll={handleScroll}
                                        placeholder="Describe your scene… Use @ to tag characters, locations, and products"
                                        className="w-full text-[13px] placeholder:text-[#444] outline-none font-sans resize-none leading-relaxed min-h-[24px]"
                                        style={{ gridArea: '1 / 1', background: 'transparent', color: 'transparent', caretColor: '#E50914' }}
                                        rows={1}
                                        disabled={isGenerating || isEnhancing}
                                    />
                                </div>
                            </div>

                            {/* ── MENTION DROPDOWN ── */}
                            {mention.isOpen && mention.filteredItems.length > 0 && (() => {
                                // Group items by asset type for visual separation
                                const grouped: Record<string, typeof mention.filteredItems> = {};
                                let globalIdx = 0;
                                const indexMap: number[] = []; // maps global flat index → original index
                                for (const item of mention.filteredItems) {
                                    const pgItem = item as PlaygroundMentionItem;
                                    const type = pgItem.assetType || "other";
                                    if (!grouped[type]) grouped[type] = [];
                                    grouped[type].push(item);
                                    indexMap.push(globalIdx);
                                    globalIdx++;
                                }

                                return (
                                    <div
                                        className="absolute z-50 w-[300px] rounded-xl border border-[#222] bg-[#0d0d0d]/98 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden"
                                        style={{
                                            bottom: "100%",
                                            left: Math.min(mention.menuPosition.left, 300),
                                            marginBottom: 8,
                                        }}
                                        onMouseDown={(e) => e.preventDefault()}
                                    >
                                        {/* Header with search hint */}
                                        <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
                                            <Search size={10} className="text-[#555]" />
                                            <span className="text-[8px] font-mono text-[#555] uppercase tracking-[2px]">
                                                Tag an asset — type to filter
                                            </span>
                                            <span className="ml-auto text-[7px] font-mono text-[#333]">
                                                {mention.filteredItems.length} result{mention.filteredItems.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>

                                        {/* Scrollable list */}
                                        <div className="max-h-[320px] overflow-y-auto no-scrollbar py-1">
                                            {mention.filteredItems.map((item, idx) => {
                                                const pgItem = item as PlaygroundMentionItem;
                                                const TypeIcon = ASSET_TYPE_ICON[pgItem.assetType] || Package;
                                                const typeColor = ASSET_TYPE_COLOR[pgItem.assetType] || "#888";
                                                const isActive = idx === mention.activeIndex;

                                                // Show type header before first item of each group
                                                const prevItem = idx > 0 ? (mention.filteredItems[idx - 1] as PlaygroundMentionItem) : null;
                                                const showHeader = !prevItem || prevItem.assetType !== pgItem.assetType;

                                                return (
                                                    <div key={pgItem.assetId || item.tag}>
                                                        {showHeader && (
                                                            <div className="px-3 pt-2 pb-1 flex items-center gap-1.5">
                                                                <TypeIcon size={9} style={{ color: typeColor }} />
                                                                <span className="text-[7px] font-bold uppercase tracking-[2px]" style={{ color: typeColor }}>
                                                                    {pgItem.assetType}s
                                                                </span>
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => mention.insertTag(item.tag)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer border-none ${
                                                                isActive
                                                                    ? "bg-[#E50914]/10"
                                                                    : "bg-transparent hover:bg-white/[0.04]"
                                                            }`}
                                                        >
                                                            {/* Asset thumbnail */}
                                                            <div className="w-8 h-8 rounded-md border border-[#222] overflow-hidden shrink-0 flex items-center justify-center bg-[#111]">
                                                                {pgItem.url ? (
                                                                    <img src={pgItem.url} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <TypeIcon size={12} style={{ color: typeColor }} />
                                                                )}
                                                            </div>
                                                            {/* Name + type */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[11px] font-semibold text-white/90 truncate">{item.name}</p>
                                                                <p className="text-[8px] uppercase tracking-[1px] font-mono" style={{ color: typeColor }}>
                                                                    {pgItem.assetType}
                                                                </p>
                                                            </div>
                                                            {/* Tag preview */}
                                                            <span className="text-[9px] font-mono text-[#555] shrink-0">{item.tag}</span>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── BOTTOM ROW: Settings + Actions ── */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">

                            {/* Left: Quick controls */}
                            <div className="flex items-center gap-1.5">
                                {/* + Asset shortcut */}
                                <button
                                    onClick={() => {
                                        setAssetDrawerOpen(true);
                                        setAssetDrawerIntent('create');
                                    }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:border-white/20"
                                    title="Create a new asset"
                                >
                                    <PlusCircle size={11} />
                                    <span className="hidden sm:inline">Asset</span>
                                </button>

                                {/* Reference image upload */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border ${
                                        referenceImages.length > 0
                                            ? "border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]"
                                            : "border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:border-white/20"
                                    }`}
                                    title="Attach reference image"
                                >
                                    <Upload size={11} />
                                    <span className="hidden sm:inline">Ref</span>
                                </button>

                                {/* Toggle settings */}
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border ${
                                        showSettings
                                            ? "border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]"
                                            : "border-white/[0.08] bg-transparent text-white/70 hover:text-white hover:border-white/20"
                                    }`}
                                >
                                    <ChevronDown
                                        size={11}
                                        className={`transition-transform ${showSettings ? "rotate-180" : ""}`}
                                    />
                                    <span className="hidden sm:inline">Settings</span>
                                </button>

                                {/* Inline quick-selects (always visible) */}
                                <QuickSelect
                                    value={stylePrefs.image_provider}
                                    options={PROVIDERS}
                                    onChange={(v) => setStylePref("image_provider", v)}
                                />
                                <QuickSelect
                                    value={stylePrefs.aspect_ratio}
                                    options={ASPECT_RATIOS}
                                    onChange={(v) => setStylePref("aspect_ratio", v)}
                                />
                                <QuickSelect
                                    value={stylePrefs.model_tier}
                                    options={MODEL_TIERS}
                                    onChange={(v) => setStylePref("model_tier", v)}
                                />
                                <QuickSelect
                                    value={stylePrefs.image_resolution || '1k'}
                                    options={RESOLUTIONS}
                                    onChange={(v) => setStylePref("image_resolution", v)}
                                />

                                <BatchSelector value={batchSize} onChange={setBatchSize} />
                            </div>

                            {/* Right: Generate */}
                            <button
                                onClick={handleGenerate}
                                disabled={!prompt.trim() || isGenerating || hasInsufficientBalance}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-[2px] transition-all border whitespace-nowrap ${
                                    !prompt.trim() || isGenerating || hasInsufficientBalance
                                        ? "border-white/[0.06] bg-white/[0.02] text-[#444] cursor-not-allowed"
                                        : "border-[#E50914]/40 bg-[#E50914]/15 text-white hover:bg-[#E50914]/25 hover:border-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.2)] cursor-pointer"
                                }`}
                            >
                                {isGenerating ? (
                                    <Loader2 className="animate-spin" size={12} />
                                ) : (
                                    <Send size={12} />
                                )}
                                {isGenerating ? "Generating…" : hasInsufficientBalance ? "Low Balance" : "Generate"}
                                {!isGenerating && (
                                    <span className="opacity-50 text-[8px] font-normal">• {formatCredits(finalCost)} cr</span>
                                )}
                            </button>
                        </div>

                        {/* ── EXPANDED SETTINGS PANEL ── */}
                        {showSettings && (
                            <div
                                className="border-t border-white/[0.06] px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3"
                                style={{ animation: "fadeSlideIn 0.15s ease-out" }}
                            >
                                <SettingsField
                                    label="Shot Type"
                                    value={stylePrefs.shot_type}
                                    options={SHOT_TYPES}
                                    onChange={(v) => setStylePref("shot_type", v)}
                                />
                                <SettingsField
                                    label="Provider"
                                    value={stylePrefs.image_provider}
                                    options={PROVIDERS}
                                    onChange={(v) => setStylePref("image_provider", v)}
                                />
                                <SettingsField
                                    label="Aspect Ratio"
                                    value={stylePrefs.aspect_ratio}
                                    options={ASPECT_RATIOS}
                                    onChange={(v) => setStylePref("aspect_ratio", v)}
                                />
                                <SettingsField
                                    label="Model Tier"
                                    value={stylePrefs.model_tier}
                                    options={MODEL_TIERS}
                                    onChange={(v) => setStylePref("model_tier", v)}
                                />
                                <SettingsField
                                    label="Visual Style"
                                    value={stylePrefs.style}
                                    options={VISUAL_STYLES}
                                    onChange={(v) => setStylePref("style", v)}
                                />
                                <SettingsTextInput
                                    label="Color Palette"
                                    value={stylePrefs.style_palette}
                                    placeholder="e.g. warm amber, teal"
                                    onChange={(v) => setStylePref("style_palette", v)}
                                />
                                <SettingsTextInput
                                    label="Lighting"
                                    value={stylePrefs.style_lighting}
                                    placeholder="e.g. golden hour, neon"
                                    onChange={(v) => setStylePref("style_lighting", v)}
                                />
                                <SettingsTextInput
                                    label="Mood"
                                    value={stylePrefs.style_mood}
                                    placeholder="e.g. tense, dreamy"
                                    onChange={(v) => setStylePref("style_mood", v)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Hint text — inside the card */}
                    <div className="flex items-center justify-between mt-2 px-1">
                        <span className="text-[8px] text-[#333] font-mono">
                            <span className="text-[#555]">@</span> to tag assets • <span className="text-[#555]">Enter</span> to generate • <span className="text-[#555]">Shift+Enter</span> for newline
                        </span>
                        {mentionItems.length > 0 && (
                            <span className="text-[8px] text-[#333] font-mono">
                                {mentionItems.length} asset{mentionItems.length !== 1 ? "s" : ""} available
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Inline quick-select dropdown — compact, sits in the prompt bar bottom row.
 */
function QuickSelect({
    value,
    options,
    onChange,
}: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="bg-transparent border border-white/[0.06] rounded-md px-2 py-1.5 text-[9px] font-mono text-white/80 uppercase tracking-[1px] outline-none cursor-pointer hover:border-white/20 hover:text-white transition-colors appearance-none hidden sm:block"
            style={{ minWidth: 54 }}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0a0a0a] text-white">
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

/**
 * Settings field — full label + dropdown, used in the expandable settings panel.
 */
function SettingsField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="text-[7px] font-mono text-[#555] uppercase tracking-[2px] block mb-1">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-[#111] border border-[#222] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white/80 outline-none cursor-pointer hover:border-[#444] transition-colors"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-[#0a0a0a]">
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

/**
 * Settings text input — free-text field for style preferences.
 */
function SettingsTextInput({
    label,
    value,
    placeholder,
    onChange,
}: {
    label: string;
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="text-[7px] font-mono text-[#555] uppercase tracking-[2px] block mb-1">{label}</label>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[#111] border border-[#222] rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white/80 outline-none hover:border-[#444] focus:border-[#E50914]/40 transition-colors placeholder:text-[#444]"
            />
        </div>
    );
}

/**
 * Batch size selector — segmented pill toggle (×1 / ×2 / ×4)
 */
function BatchSelector({
    value,
    onChange,
}: {
    value: BatchSize;
    onChange: (size: BatchSize) => void;
}) {
    return (
        <div className="flex items-center border border-white/[0.08] rounded-md overflow-hidden">
            {BATCH_SIZES.map((size) => (
                <button
                    key={size}
                    onClick={() => onChange(size)}
                    className={`px-2.5 py-1.5 text-[9px] font-bold font-mono uppercase tracking-[1px] transition-all cursor-pointer border-none ${
                        value === size
                            ? "bg-[#E50914]/15 text-[#E50914]"
                            : "bg-transparent text-[#555] hover:text-white"
                    }`}
                >
                    ×{size}
                </button>
            ))}
        </div>
    );
}
