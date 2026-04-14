"use client";

/**
 * PlaygroundAssetForm — Create or edit form for Playground assets.
 *
 * Adapts fields by asset type:
 *   - Characters: age, ethnicity, build, hair, clothing, vibe
 *   - Locations:  atmosphere, lighting
 *   - Products:   brand, category, material, color
 *
 * Supports:
 *   - Create mode (no editingAsset) and Edit mode (editingAsset provided)
 *   - Reference image upload via backend proxy
 *   - AI visual generation ("Generate Visual" button)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
    X,
    Upload,
    Loader2,
    User,
    MapPin,
    Package,
    Save,
    Wand2,
    ZoomIn,
} from "lucide-react";
import { usePlayground } from "@/app/context/PlaygroundContext";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import {
    uploadPlaygroundAssetImage,
    generatePlaygroundAssetVisual,
    type PlaygroundAsset,
} from "@/lib/playgroundApi";
import toast from "react-hot-toast";

interface PlaygroundAssetFormProps {
    assetType: "characters" | "locations" | "products";
    editingAsset?: PlaygroundAsset | null; // null = create mode
    onClose: () => void;
    onCreated?: () => void;
}

const TYPE_LABELS: Record<string, { singular: string; icon: typeof User; color: string }> = {
    characters: { singular: "Character", icon: User, color: "#3B82F6" },
    locations:  { singular: "Location", icon: MapPin, color: "#22C55E" },
    products:   { singular: "Product", icon: Package, color: "#F59E0B" },
};

// ═══════════════════════════════════════════════════════════════
//  VISUAL TRAIT DEFINITIONS (type-specific)
// ═══════════════════════════════════════════════════════════════

const CHARACTER_TRAITS = [
    { key: "age", label: "Age", placeholder: "e.g. 25, mid-30s, elderly" },
    { key: "ethnicity", label: "Ethnicity", placeholder: "e.g. South Asian, East African" },
    { key: "build", label: "Build", placeholder: "e.g. Athletic, Slim, Stocky" },
    { key: "hair", label: "Hair", placeholder: "e.g. Black wavy shoulder-length" },
    { key: "clothing", label: "Clothing", placeholder: "e.g. Leather jacket, white tee" },
    { key: "vibe", label: "Vibe / Presence", placeholder: "e.g. Mysterious, Warm, Intimidating" },
];

const LOCATION_FIELDS = [
    { key: "atmosphere", label: "Atmosphere", placeholder: "e.g. Eerie, Cozy, Industrial" },
    { key: "lighting", label: "Lighting", placeholder: "e.g. Warm golden hour, Neon-lit" },
];

const PRODUCT_METADATA = [
    { key: "brand_name", label: "Brand", placeholder: "e.g. Nike, Apple, Custom" },
    { key: "category", label: "Category", placeholder: "e.g. Sneakers, Laptop, Watch" },
    { key: "material", label: "Material", placeholder: "e.g. Leather, Aluminum, Glass" },
    { key: "color", label: "Color", placeholder: "e.g. Matte Black, Rose Gold" },
];


export default function PlaygroundAssetForm({
    assetType,
    editingAsset,
    onClose,
    onCreated,
}: PlaygroundAssetFormProps) {
    const { addAsset, updateAsset, refreshAssets } = usePlayground();
    const { openViewer } = useMediaViewer();
    const config = TYPE_LABELS[assetType];
    const isEditMode = !!editingAsset;

    // --- Form state ---
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [traits, setTraits] = useState<Record<string, string>>({});
    const [productMeta, setProductMeta] = useState<Record<string, string>>({});
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [referencePreview, setReferencePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const [savedAssetId, setSavedAssetId] = useState<string | null>(editingAsset?.id || null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // --- Populate form in edit mode ---
    useEffect(() => {
        if (editingAsset) {
            setName(editingAsset.name || "");
            setDescription(editingAsset.description || "");
            setTraits(editingAsset.visual_traits || {});
            setProductMeta(
                (editingAsset.product_metadata as Record<string, string>) || {}
            );
            setCurrentImageUrl(editingAsset.image_url || null);

            // Populate location-specific fields into traits
            if (editingAsset.atmosphere) {
                setTraits(prev => ({ ...prev, atmosphere: editingAsset.atmosphere || "" }));
            }
            if (editingAsset.lighting) {
                setTraits(prev => ({ ...prev, lighting: editingAsset.lighting || "" }));
            }
        }
    }, [editingAsset]);

    // --- File handling ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setReferenceFile(file);
        setReferencePreview(URL.createObjectURL(file));
    };

    const clearFile = () => {
        setReferenceFile(null);
        if (referencePreview) URL.revokeObjectURL(referencePreview);
        setReferencePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const updateTrait = (key: string, value: string) => {
        setTraits(prev => ({ ...prev, [key]: value }));
    };

    const updateProductMetaField = (key: string, value: string) => {
        setProductMeta(prev => ({ ...prev, [key]: value }));
    };

    // ═══ SUBMIT HANDLER (Create or Update) ═══
    const handleSubmit = useCallback(async () => {
        if (!name.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const cleanTraits = Object.keys(traits).length > 0
                ? Object.fromEntries(Object.entries(traits).filter(([_, v]) => v.trim()))
                : undefined;

            const cleanProductMeta = assetType === "products" && Object.keys(productMeta).length > 0
                ? Object.fromEntries(Object.entries(productMeta).filter(([_, v]) => v.trim()))
                : undefined;

            if (isEditMode && editingAsset) {
                // ── UPDATE ──
                await updateAsset(assetType, editingAsset.id, {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    visual_traits: cleanTraits,
                    product_metadata: cleanProductMeta,
                    atmosphere: traits["atmosphere"] || undefined,
                    lighting: traits["lighting"] || undefined,
                });

                // Upload new reference image if provided
                if (referenceFile) {
                    try {
                        await uploadPlaygroundAssetImage(assetType, editingAsset.id, referenceFile);
                    } catch (uploadErr) {
                        console.warn("[AssetForm] Image upload failed:", uploadErr);
                        toast.error("Asset updated, but image upload failed.");
                    }
                }

                await refreshAssets();


            } else {
                // ── CREATE ──
                const assetId = await addAsset({
                    asset_type: assetType,
                    name: name.trim(),
                    description: description.trim() || undefined,
                    visual_traits: cleanTraits,
                    product_metadata: cleanProductMeta,
                    atmosphere: traits["atmosphere"] || undefined,
                    lighting: traits["lighting"] || undefined,
                });

                // Upload reference image if provided
                if (referenceFile && assetId) {
                    try {
                        await uploadPlaygroundAssetImage(assetType, assetId, referenceFile);
                    } catch (uploadErr) {
                        console.warn("[AssetForm] Image upload failed, asset still created:", uploadErr);
                        toast.error("Asset created, but image upload failed.");
                    }
                }

                await refreshAssets();

            }

            onCreated?.();
            onClose();

        } catch (err: any) {
            console.error("[AssetForm] Submit failed:", err);
            const msg = err?.response?.data?.detail || `Failed to ${isEditMode ? "update" : "create"} asset`;
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    }, [name, description, traits, productMeta, referenceFile, assetType, isSubmitting, isEditMode, editingAsset, addAsset, updateAsset, refreshAssets, onClose, onCreated, config.singular]);


    // ═══ GENERATE VISUAL HANDLER ═══
    const handleGenerateVisual = useCallback(async () => {
        if (isGeneratingVisual || !name.trim()) return;

        setIsGeneratingVisual(true);
        try {
            let assetId = savedAssetId;

            // If the asset hasn't been saved yet, auto-save it first
            if (!assetId) {
                const cleanTraits = Object.keys(traits).length > 0
                    ? Object.fromEntries(Object.entries(traits).filter(([_, v]) => v.trim()))
                    : undefined;
                const cleanProductMeta = assetType === "products" && Object.keys(productMeta).length > 0
                    ? Object.fromEntries(Object.entries(productMeta).filter(([_, v]) => v.trim()))
                    : undefined;

                assetId = await addAsset({
                    asset_type: assetType,
                    name: name.trim(),
                    description: description.trim() || undefined,
                    visual_traits: cleanTraits,
                    product_metadata: cleanProductMeta,
                    atmosphere: traits["atmosphere"] || undefined,
                    lighting: traits["lighting"] || undefined,
                });
                setSavedAssetId(assetId);

            }

            const result = await generatePlaygroundAssetVisual(assetType, assetId, {
                prompt: description.trim() || undefined,
                style: "realistic",
                aspect_ratio: assetType === "locations" ? "16:9" : "1:1",
            });

            setCurrentImageUrl(result.image_url);
            await refreshAssets();


        } catch (err: any) {
            console.error("[AssetForm] Generate visual failed:", err);
            const msg = err?.response?.data?.detail || "Visual generation failed";
            toast.error(msg);
        } finally {
            setIsGeneratingVisual(false);
        }
    }, [isGeneratingVisual, name, savedAssetId, assetType, description, traits, productMeta, addAsset, refreshAssets, config.singular]);


    const TypeIcon = config.icon;
    const displayImage = referencePreview || currentImageUrl;

    return (
        <div className="flex flex-col h-full">
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2">
                    <TypeIcon size={14} style={{ color: config.color }} />
                    <span className="text-[10px] font-mono uppercase tracking-[2px] font-bold" style={{ color: config.color }}>
                        {isEditMode ? `Edit ${config.singular}` : `New ${config.singular}`}
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-white/[0.06] text-[#555] hover:text-white transition-colors cursor-pointer"
                >
                    <X size={14} />
                </button>
            </div>

            {/* ── FORM BODY ── */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">

                {/* Name (required) */}
                <div>
                    <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-1.5">
                        Name <span className="text-[#E50914]">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={`e.g. ${assetType === "characters" ? "Maya" : assetType === "locations" ? "Tokyo Rooftop" : "Vintage Camera"}`}
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-[#333] outline-none focus:border-white/20 transition-colors font-sans"
                        autoFocus={!isEditMode}
                    />
                    {name.trim() && (
                        <p className="text-[8px] text-[#444] font-mono mt-1">
                            Tag: <span className="text-[#E50914]">@{name.replace(/\s+/g, "")}</span>
                        </p>
                    )}
                </div>

                {/* Description */}
                <div>
                    <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-1.5">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="A brief description for the AI to understand this asset..."
                        className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-[11px] text-white/90 placeholder:text-[#333] outline-none focus:border-white/20 transition-colors font-sans resize-none min-h-[56px]"
                        rows={2}
                    />
                </div>

                {/* Reference Image / Generated Visual */}
                <div>
                    <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-1.5">
                        Visual Reference
                    </label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Current / uploaded image display */}
                    {displayImage ? (
                        <div className="relative rounded-lg overflow-hidden border border-[#222] group/img">
                            {/* Clickable image → opens MediaViewer */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (isGeneratingVisual) return;
                                    openViewer([{
                                        id: editingAsset?.id || "preview",
                                        type: "image",
                                        imageUrl: displayImage,
                                        title: name || "Asset Preview",
                                    }]);
                                }}
                                className={`w-full block ${isGeneratingVisual ? "cursor-wait" : "cursor-zoom-in"}`}
                            >
                                <img
                                    src={displayImage}
                                    alt="Reference"
                                    className={`w-full aspect-video object-cover ${isGeneratingVisual ? "opacity-30" : ""}`}
                                />

                                {/* Zoom overlay (visible on hover, hidden during generation) */}
                                {!isGeneratingVisual && (
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn size={18} className="text-white" />
                                    </div>
                                )}
                            </button>
                            {/* Generating overlay */}
                            {isGeneratingVisual && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Loader2 className="animate-spin text-[#E50914] mb-2" size={24} />
                                    <span className="text-[9px] font-mono text-white uppercase tracking-[2px]">Generating…</span>
                                </div>
                            )}

                            {/* Clear image button */}
                            {!isGeneratingVisual && (
                                <button
                                    onClick={() => {
                                        clearFile();
                                        setCurrentImageUrl(null);
                                    }}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors cursor-pointer"
                                >
                                    <X size={10} />
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full flex flex-col items-center justify-center py-5 border border-dashed border-[#222] rounded-lg hover:border-[#444] hover:bg-white/[0.02] transition-all cursor-pointer group ${
                                isGeneratingVisual ? "pointer-events-none opacity-50" : ""
                            }`}
                        >
                            {isGeneratingVisual ? (
                                <>
                                    <Loader2 size={18} className="text-[#E50914] animate-spin mb-2" />
                                    <span className="text-[9px] font-mono text-[#E50914] uppercase tracking-[1px]">
                                        Generating visual…
                                    </span>
                                </>
                            ) : (
                                <>
                                    <Upload size={18} className="text-[#333] group-hover:text-[#555] transition-colors mb-2" />
                                    <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1px]">
                                        Drop or click to upload
                                    </span>
                                </>
                            )}
                        </button>
                    )}

                    {/* ── GENERATE VISUAL BUTTON (always visible for all types) ── */}
                    <button
                        onClick={handleGenerateVisual}
                        disabled={!name.trim() || isGeneratingVisual || isSubmitting}
                        className={`w-full flex items-center justify-center gap-2 mt-2 py-2 rounded-lg text-[8px] font-bold uppercase tracking-[2px] transition-all border ${
                            !name.trim() || isGeneratingVisual || isSubmitting
                                ? "border-white/[0.06] bg-white/[0.02] text-[#444] cursor-not-allowed"
                                : "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 cursor-pointer"
                        }`}
                    >
                        {isGeneratingVisual ? (
                            <Loader2 className="animate-spin" size={11} />
                        ) : (
                            <Wand2 size={11} />
                        )}
                        {isGeneratingVisual ? "Generating…" : "Generate Visual with AI"}
                    </button>
                </div>

                {/* ── TYPE-SPECIFIC FIELDS ── */}

                {/* CHARACTER TRAITS */}
                {assetType === "characters" && (
                    <div>
                        <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-2">
                            Visual Traits
                        </label>
                        <div className="space-y-2.5">
                            {CHARACTER_TRAITS.map(({ key, label, placeholder }) => (
                                <div key={key}>
                                    <label className="text-[7px] font-mono text-[#444] uppercase tracking-[1px] block mb-1">
                                        {label}
                                    </label>
                                    <input
                                        type="text"
                                        value={traits[key] || ""}
                                        onChange={(e) => updateTrait(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-2.5 py-1.5 text-[10px] text-white/80 placeholder:text-[#2a2a2a] outline-none focus:border-white/15 transition-colors font-sans"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* LOCATION FIELDS */}
                {assetType === "locations" && (
                    <div>
                        <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-2">
                            Environment
                        </label>
                        <div className="space-y-2.5">
                            {LOCATION_FIELDS.map(({ key, label, placeholder }) => (
                                <div key={key}>
                                    <label className="text-[7px] font-mono text-[#444] uppercase tracking-[1px] block mb-1">
                                        {label}
                                    </label>
                                    <input
                                        type="text"
                                        value={traits[key] || ""}
                                        onChange={(e) => updateTrait(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-2.5 py-1.5 text-[10px] text-white/80 placeholder:text-[#2a2a2a] outline-none focus:border-white/15 transition-colors font-sans"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* PRODUCT METADATA */}
                {assetType === "products" && (
                    <div>
                        <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-2">
                            Product Details
                        </label>
                        <div className="space-y-2.5">
                            {PRODUCT_METADATA.map(({ key, label, placeholder }) => (
                                <div key={key}>
                                    <label className="text-[7px] font-mono text-[#444] uppercase tracking-[1px] block mb-1">
                                        {label}
                                    </label>
                                    <input
                                        type="text"
                                        value={productMeta[key] || ""}
                                        onChange={(e) => updateProductMetaField(key, e.target.value)}
                                        placeholder={placeholder}
                                        className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-md px-2.5 py-1.5 text-[10px] text-white/80 placeholder:text-[#2a2a2a] outline-none focus:border-white/15 transition-colors font-sans"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── SUBMIT BUTTON ── */}
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
                <button
                    onClick={handleSubmit}
                    disabled={!name.trim() || isSubmitting || isGeneratingVisual}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-[2px] transition-all border ${
                        !name.trim() || isSubmitting || isGeneratingVisual
                            ? "border-white/[0.06] bg-white/[0.02] text-[#444] cursor-not-allowed"
                            : "border-[#E50914]/40 bg-[#E50914]/15 text-white hover:bg-[#E50914]/25 hover:border-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.15)] cursor-pointer"
                    }`}
                >
                    {isSubmitting ? (
                        <Loader2 className="animate-spin" size={12} />
                    ) : (
                        <Save size={12} />
                    )}
                    {isSubmitting
                        ? (isEditMode ? "Saving…" : "Creating…")
                        : (isEditMode ? `Save ${config.singular}` : `Create ${config.singular}`)
                    }
                </button>
            </div>
        </div>
    );
}
