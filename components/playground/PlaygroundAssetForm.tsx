"use client";

/**
 * PlaygroundAssetForm — Create/edit form for Playground assets.
 *
 * Adapts fields by asset type:
 *   - Characters: age, ethnicity, build, hair, clothing, vibe
 *   - Locations:  atmosphere, lighting, terrain
 *   - Products:   brand, category, material, color
 *
 * Supports reference image upload via the backend proxy
 * (uploadPlaygroundAssetImage after asset creation).
 */

import { useState, useRef, useCallback } from "react";
import {
    X,
    Upload,
    Loader2,
    User,
    MapPin,
    Package,
    Sparkles,
} from "lucide-react";
import { usePlayground } from "@/app/context/PlaygroundContext";
import { uploadPlaygroundAssetImage } from "@/lib/playgroundApi";
import toast from "react-hot-toast";

interface PlaygroundAssetFormProps {
    assetType: "characters" | "locations" | "products";
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
    onClose,
    onCreated,
}: PlaygroundAssetFormProps) {
    const { addAsset, refreshAssets } = usePlayground();
    const config = TYPE_LABELS[assetType];

    // --- Form state ---
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [traits, setTraits] = useState<Record<string, string>>({});
    const [productMeta, setProductMeta] = useState<Record<string, string>>({});
    const [referenceFile, setReferenceFile] = useState<File | null>(null);
    const [referencePreview, setReferencePreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    const updateProductMeta = (key: string, value: string) => {
        setProductMeta(prev => ({ ...prev, [key]: value }));
    };

    // ═══ SUBMIT HANDLER ═══
    const handleSubmit = useCallback(async () => {
        if (!name.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // 1. Create the asset document
            const assetId = await addAsset({
                asset_type: assetType,
                name: name.trim(),
                description: description.trim() || undefined,
                visual_traits: Object.keys(traits).length > 0
                    ? Object.fromEntries(Object.entries(traits).filter(([_, v]) => v.trim()))
                    : undefined,
                product_metadata: assetType === "products" && Object.keys(productMeta).length > 0
                    ? Object.fromEntries(Object.entries(productMeta).filter(([_, v]) => v.trim()))
                    : undefined,
                atmosphere: traits["atmosphere"] || undefined,
                lighting: traits["lighting"] || undefined,
            });

            // 2. Upload reference image if provided (backend proxy)
            if (referenceFile && assetId) {
                try {
                    await uploadPlaygroundAssetImage(assetType, assetId, referenceFile);
                } catch (uploadErr) {
                    console.warn("[AssetForm] Image upload failed, asset still created:", uploadErr);
                    toast.error("Asset created, but image upload failed. You can re-upload later.");
                }
            }

            // 3. Refresh assets to update context + mention items
            await refreshAssets();

            toast.success(`${config.singular} "${name.trim()}" created`);
            onCreated?.();
            onClose();

        } catch (err: any) {
            console.error("[AssetForm] Create failed:", err);
            const msg = err?.response?.data?.detail || "Failed to create asset";
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    }, [name, description, traits, productMeta, referenceFile, assetType, isSubmitting, addAsset, refreshAssets, onClose, onCreated, config.singular]);

    const TypeIcon = config.icon;

    return (
        <div className="flex flex-col h-full">
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2">
                    <TypeIcon size={14} style={{ color: config.color }} />
                    <span className="text-[10px] font-mono uppercase tracking-[2px] font-bold" style={{ color: config.color }}>
                        New {config.singular}
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
                        autoFocus
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

                {/* Reference Image Upload */}
                <div>
                    <label className="text-[8px] font-mono text-[#555] uppercase tracking-[2px] block mb-1.5">
                        Reference Image
                    </label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    {referencePreview ? (
                        <div className="relative rounded-lg overflow-hidden border border-[#222]">
                            <img src={referencePreview} alt="Reference" className="w-full aspect-video object-cover" />
                            <button
                                onClick={clearFile}
                                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-red-500 transition-colors cursor-pointer"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full flex flex-col items-center justify-center py-5 border border-dashed border-[#222] rounded-lg hover:border-[#444] hover:bg-white/[0.02] transition-all cursor-pointer group"
                        >
                            <Upload size={18} className="text-[#333] group-hover:text-[#555] transition-colors mb-2" />
                            <span className="text-[9px] font-mono text-[#444] uppercase tracking-[1px]">
                                Drop or click to upload
                            </span>
                        </button>
                    )}
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
                                        onChange={(e) => updateProductMeta(key, e.target.value)}
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
                    disabled={!name.trim() || isSubmitting}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-[2px] transition-all border ${
                        !name.trim() || isSubmitting
                            ? "border-white/[0.06] bg-white/[0.02] text-[#444] cursor-not-allowed"
                            : "border-[#E50914]/40 bg-[#E50914]/15 text-white hover:bg-[#E50914]/25 hover:border-[#E50914] hover:shadow-[0_0_20px_rgba(229,9,20,0.15)] cursor-pointer"
                    }`}
                >
                    {isSubmitting ? (
                        <Loader2 className="animate-spin" size={12} />
                    ) : (
                        <Sparkles size={12} />
                    )}
                    {isSubmitting ? "Creating…" : `Create ${config.singular}`}
                </button>
            </div>
        </div>
    );
}
