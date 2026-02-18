"use client";

import React, { useState, useEffect } from "react";
import {
    X, Users, MapPin, ShoppingBag, Plus, Loader2,
    LayoutGrid, Search, Sparkles
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import {
    fetchProjectAssets,
    deleteAsset,
    createAsset,
    triggerAssetGeneration,
    updateAsset,
} from "@/lib/api";
import { Asset, CharacterProfile, LocationProfile, ProductProfile, Project } from "@/lib/types";
import { constructLocationPrompt, constructCharacterPrompt } from "@/lib/promptUtils";

// --- COMPONENTS ---
import { AssetCard } from "@/components/AssetCard";
import { AssetModal } from "@/components/AssetModal";

// --- CONTEXT ---
import { useMediaViewer, MediaItem } from "@/app/context/MediaViewerContext";

// ─────────────────────────────────────────────────────────────────────────────

interface AssetManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    project: Project | null;
    onAssetsUpdated?: () => void; // Callback to refresh parent data (e.g. scene tags)
}

// ─────────────────────────────────────────────────────────────────────────────

export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
    isOpen,
    onClose,
    projectId,
    project,
    onAssetsUpdated,
}) => {
    const { openViewer } = useMediaViewer();

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'cast' | 'locations' | 'products'>('cast');

    const [assets, setAssets] = useState<{
        characters: CharacterProfile[];
        locations: LocationProfile[];
        products: ProductProfile[];
    }>({ characters: [], locations: [], products: [] });

    const [loading, setLoading] = useState(false);
    const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [genPrompt, setGenPrompt] = useState("");

    // --- LOAD DATA ---
    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen, projectId]);

    // Auto-switch tab for ad projects
    useEffect(() => {
        if (project?.type === 'ad') {
            setActiveTab('products');
        }
    }, [project?.type]);

    // Sync AssetModal when assets refresh
    useEffect(() => {
        if (selectedAsset && selectedAsset.id !== "new") {
            const allAssets = [...assets.characters, ...assets.locations, ...assets.products];
            const freshAsset = allAssets.find(a => a.id === selectedAsset.id);
            if (freshAsset && freshAsset.image_url !== selectedAsset.image_url) {
                setSelectedAsset(freshAsset);
            }
        }
    }, [assets]);

    const loadData = async () => {
        setLoading(true);
        try {
            const assetsData = await fetchProjectAssets(projectId);

            const typedCharacters = (assetsData.characters || []).map((c: any) => ({ ...c, type: 'character' }));
            const typedLocations = (assetsData.locations || []).map((l: any) => ({ ...l, type: 'location' }));
            const typedProducts = (assetsData.products || []).map((p: any) => ({ ...p, type: 'product' }));

            setAssets({
                characters: typedCharacters,
                locations: typedLocations,
                products: typedProducts,
            });

            onAssetsUpdated?.();
        } catch (e) {
            console.error(e);
            toast.error("Failed to load assets");
        } finally {
            setLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleOpenDraft = () => {
        let type = 'character';
        if (activeTab === 'locations') type = 'location';
        if (activeTab === 'products') type = 'product';

        const draftAsset: any = {
            id: "new",
            type,
            name: "",
            project_id: projectId,
            status: "pending",
            visual_traits: {},
            voice_config: {},
            product_metadata: {},
        };
        setGenPrompt("");
        setSelectedAsset(draftAsset);
    };

    const handleSaveAsset = async (asset: Asset, data: any) => {
        try {
            if (asset.id === "new") {
                const res = await createAsset(projectId, { ...data, type: asset.type });
                const newAsset = { ...res.data.asset, type: asset.type };
                toast.success("ENTRY CREATED");
                setSelectedAsset(newAsset);
                loadData();
                return newAsset;
            } else {
                await updateAsset(projectId, asset.type, asset.id, data);
                toast.success("DATABASE UPDATED");
                loadData();
                return asset;
            }
        } catch (e) {
            console.error(e);
            toast.error("SAVE FAILED");
            throw e;
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (!confirm("CONFIRM DELETION?")) return;
        try {
            await deleteAsset(projectId, type, id);
            setAssets(prev => {
                const newState = { ...prev };
                if (type === 'character') newState.characters = prev.characters.filter(a => a.id !== id);
                else if (type === 'location') newState.locations = prev.locations.filter(a => a.id !== id);
                else if (type === 'product') newState.products = prev.products.filter(a => a.id !== id);
                return newState;
            });
            toast.success("ASSET PURGED");
            onAssetsUpdated?.();
        } catch (e) {
            toast.error("DELETION FAILED");
        }
    };

    const handleGenerate = async (asset: Asset, customPrompt?: string, useRef: boolean = true) => {
        if (asset.id === "new") return;

        setGeneratingIds(prev => new Set(prev).add(asset.id));
        toast("INITIALIZING RENDER...", { icon: '⚡' });

        try {
            const { code, owner_id, ...cleanStyle } = (project as any)?.moodboard || {};

            let requestType = 'characters';
            if (asset.type === 'location') requestType = 'locations';
            if (asset.type === 'product') requestType = 'products';

            let finalPrompt = customPrompt;
            if (!finalPrompt) {
                if (asset.type === 'location') {
                    finalPrompt = constructLocationPrompt(
                        asset.name,
                        (asset as any).visual_traits,
                        (asset as any).visual_traits,
                        (project as any)?.genre || "",
                        project?.moodboard?.lighting || ""
                    );
                } else if (asset.type === 'character') {
                    finalPrompt = constructCharacterPrompt(
                        asset.name,
                        (asset as any).visual_traits,
                        (asset as any).visual_traits,
                        (project as any)?.genre || "",
                        project?.moodboard?.lighting || ""
                    );
                } else {
                    finalPrompt = `Cinematic commercial shot of ${asset.name}. Professional lighting, high detail.`;
                }
            }

            const res = await triggerAssetGeneration(
                projectId,
                asset.id,
                requestType,
                finalPrompt,
                cleanStyle,
                (project as any)?.aspect_ratio || "16:9",
                useRef
            );

            setTimeout(() => {
                loadData();
                setGeneratingIds(prev => { const next = new Set(prev); next.delete(asset.id); return next; });
            }, 500);

            return res.image_url;
        } catch (e) {
            toast.error("RENDER FAILED");
            setGeneratingIds(prev => { const next = new Set(prev); next.delete(asset.id); return next; });
        }
    };

    const handleCreateAndGenerate = async (draftData: any) => {
        if (!selectedAsset) return;

        let type = 'character';
        if (activeTab === 'locations') type = 'location';
        if (activeTab === 'products') type = 'product';

        try {
            const response = await createAsset(projectId, { ...draftData, type });
            const newAsset = { ...response.data.asset, type };
            setSelectedAsset(newAsset);
            loadData();
            await handleGenerate(newAsset, draftData.prompt, true);
        } catch (e) {
            toast.error("CREATION FAILED");
        }
    };

    const handleGenerateAll = async () => {
        let targetList: Asset[] = [];
        if (activeTab === 'cast') targetList = assets.characters;
        else if (activeTab === 'locations') targetList = assets.locations;
        else if (activeTab === 'products') targetList = assets.products;

        const pending = targetList.filter(a => !a.image_url);
        if (pending.length === 0) { toast.success("ALL SYSTEMS READY"); return; }
        toast.loading(`BATCH PROCESSING ${pending.length} ITEMS...`);
        await Promise.all(pending.map(asset => handleGenerate(asset)));
    };

    const handleViewAsset = (asset: Asset) => {
        const displayedAssets = getDisplayedAssets();
        const index = displayedAssets.findIndex(a => a.id === asset.id);
        if (index === -1) return;

        const mediaItems: MediaItem[] = displayedAssets.map(a => ({
            id: a.id,
            type: 'image',
            imageUrl: a.image_url,
            title: a.name,
            description: a.prompt || (a as any).base_prompt,
        }));

        openViewer(mediaItems, index);
    };

    // --- HELPERS ---

    const getDisplayedAssets = (): Asset[] => {
        if (activeTab === 'cast') return assets.characters;
        if (activeTab === 'locations') return assets.locations;
        if (activeTab === 'products') return assets.products;
        return [];
    };

    const getHeaderTitle = () => {
        if (activeTab === 'cast') return 'Character Manifest';
        if (activeTab === 'locations') return 'Environment Database';
        return 'Product Inventory';
    };

    const displayedAssets = getDisplayedAssets();

    // ─────────────────────────────────────────────────────────────────────────

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">

            {/* Modal Container — wider to accommodate the grid */}
            <div className="w-[95vw] max-w-[1200px] h-[90vh] flex flex-col bg-[#050505] border border-[#222] shadow-2xl shadow-black relative overflow-hidden rounded-lg">

                {/* ── HEADER ── */}
                <div className="h-14 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Asset Manager</h2>
                        <div className="text-[10px] font-mono text-[#444] flex items-center gap-3">
                            <span>READY: {assets.characters.filter(c => c.image_url).length + assets.locations.filter(l => l.image_url).length + assets.products.filter(p => p.image_url).length}</span>
                            <span className="text-[#222]">|</span>
                            <span>PENDING: {assets.characters.filter(c => !c.image_url).length + assets.locations.filter(l => !l.image_url).length + assets.products.filter(p => !p.image_url).length}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Generate All */}
                        <button
                            onClick={handleGenerateAll}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#333] hover:border-red-600 hover:bg-red-600/10 text-[#888] hover:text-red-400 text-[10px] font-bold tracking-widest uppercase transition-all"
                        >
                            <Sparkles size={11} /> GENERATE ALL
                        </button>

                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center hover:bg-[#151515] text-[#666] hover:text-white transition-colors rounded-full"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── TAB BAR ── */}
                <div className="h-11 border-b border-[#222] bg-[#080808] flex items-center px-6 gap-1 shrink-0">
                    {/* Products tab — shown first for ad projects */}
                    {project?.type === 'ad' && (
                        <TabButton
                            active={activeTab === 'products'}
                            onClick={() => setActiveTab('products')}
                            icon={<ShoppingBag size={12} />}
                            label="PRODUCTS"
                            count={assets.products.length}
                        />
                    )}
                    <TabButton
                        active={activeTab === 'cast'}
                        onClick={() => setActiveTab('cast')}
                        icon={<Users size={12} />}
                        label="CAST LIST"
                        count={assets.characters.length}
                    />
                    <TabButton
                        active={activeTab === 'locations'}
                        onClick={() => setActiveTab('locations')}
                        icon={<MapPin size={12} />}
                        label="LOCATIONS"
                        count={assets.locations.length}
                    />
                    {/* Products tab for non-ad projects */}
                    {project?.type !== 'ad' && (
                        <TabButton
                            active={activeTab === 'products'}
                            onClick={() => setActiveTab('products')}
                            icon={<ShoppingBag size={12} />}
                            label="PRODUCTS"
                            count={assets.products.length}
                        />
                    )}

                    {/* Right side — section label + search placeholder */}
                    <div className="ml-auto flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#444] uppercase tracking-widest">
                            <LayoutGrid size={12} />
                            {getHeaderTitle()}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-[#111] border border-[#222] text-[10px] font-mono text-[#555]">
                            <Search size={10} /> SEARCH_DB
                        </div>
                    </div>
                </div>

                {/* ── GRID ── */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#020202]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">

                        {/* Register New Card */}
                        <button
                            onClick={handleOpenDraft}
                            className="group aspect-[3/4] bg-[#050505] border border-dashed border-[#333] hover:border-red-600 hover:bg-[#080808] flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#333]" />
                            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#333]" />
                            <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[#333]" />
                            <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#333]" />

                            <div className="h-12 w-12 rounded-none bg-[#111] flex items-center justify-center border border-[#222] group-hover:bg-red-600 group-hover:border-red-600 group-hover:text-white text-[#444] transition-colors mb-4">
                                <Plus size={24} />
                            </div>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-[#555] group-hover:text-white uppercase">
                                REGISTER NEW
                            </span>
                        </button>

                        {/* Loading State */}
                        {loading ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                                <Loader2 className="animate-spin text-red-600 mb-4" size={24} />
                                <span className="text-xs font-mono tracking-widest">ACCESSING MAINFRAME...</span>
                            </div>
                        ) : displayedAssets.map((asset) => (
                            <div key={asset.id} className="relative group">
                                <AssetCard
                                    variant="default"
                                    asset={asset}
                                    projectId={projectId}
                                    isGenerating={generatingIds.has(asset.id)}
                                    onGenerate={(a: Asset) => handleGenerate(a, a.prompt || (a as any).base_prompt)}
                                    onConfig={(a: Asset) => {
                                        setSelectedAsset(a);
                                        setGenPrompt(a.prompt || "");
                                    }}
                                    onDelete={handleDelete}
                                    onView={handleViewAsset}
                                />
                                {/* Corner accent */}
                                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-red-600/0 group-hover:border-red-600 transition-colors pointer-events-none" />
                            </div>
                        ))}

                        {/* Empty State */}
                        {!loading && displayedAssets.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-40">
                                <div className="text-[10px] font-mono tracking-widest text-[#555] uppercase">
                                    NO ENTRIES — REGISTER NEW TO BEGIN
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── ASSET CONFIG MODAL ── */}
            {selectedAsset && (
                <AssetModal
                    isOpen={!!selectedAsset}
                    onClose={() => setSelectedAsset(null)}
                    assetId={selectedAsset.id}
                    projectId={projectId}
                    assetType={selectedAsset.type}
                    assetName={selectedAsset.name}
                    currentData={selectedAsset}
                    mode="generate"
                    setMode={() => { }}
                    genPrompt={genPrompt}
                    setGenPrompt={setGenPrompt}
                    isProcessing={selectedAsset.id !== "new" && generatingIds.has(selectedAsset.id)}
                    onGenerate={(prompt, useRef) => handleGenerate(selectedAsset, prompt, useRef)}
                    onCreateAndGenerate={handleCreateAndGenerate}
                    genre={(project as any)?.genre}
                    style={(project as any)?.style}
                    onUpload={() => { }}
                    onUpdateTraits={(data) => handleSaveAsset(selectedAsset, data)}
                    onLinkVoice={async () => { }}
                    styles={{
                        modal: {
                            background: '#050505',
                            border: '1px solid #333',
                            borderRadius: '0px',
                            boxShadow: '0 0 100px rgba(0,0,0,0.9)',
                            zIndex: 70,
                        }
                    }}
                />
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab Button
// ─────────────────────────────────────────────────────────────────────────────

const TabButton = ({ active, onClick, icon, label, count }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count: number;
}) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all border-b-2 h-full
        ${active
                ? "border-red-600 text-white bg-[#0A0A0A]"
                : "border-transparent text-[#555] hover:text-[#AAA] hover:bg-[#0A0A0A]"}`}
    >
        {icon}
        {label}
        <span className={`font-mono ml-1 ${active ? "text-red-500" : "text-[#333]"}`}>
            {String(count).padStart(2, '0')}
        </span>
    </button>
);
