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

// --- TOUR ---
import { useTour } from "@/hooks/useTour";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { ASSET_MANAGER_TOUR_STEPS } from "@/lib/tourConfigs";

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

    // --- TOUR ---
    const amTour = useTour("asset_manager_tour");

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
                toast.success("Asset created");
                setSelectedAsset(newAsset);
                loadData();
                return newAsset;
            } else {
                await updateAsset(projectId, asset.type, asset.id, data);
                toast.success("Asset updated");
                loadData();
                return asset;
            }
        } catch (e) {
            console.error(e);
            toast.error("Save failed");
            throw e;
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (!confirm("Delete this asset?")) return;
        try {
            await deleteAsset(projectId, type, id);
            setAssets(prev => {
                const newState = { ...prev };
                if (type === 'character') newState.characters = prev.characters.filter(a => a.id !== id);
                else if (type === 'location') newState.locations = prev.locations.filter(a => a.id !== id);
                else if (type === 'product') newState.products = prev.products.filter(a => a.id !== id);
                return newState;
            });
            toast.success("Asset deleted");
            onAssetsUpdated?.();
        } catch (e) {
            toast.error("Delete failed");
        }
    };

    const handleGenerate = async (asset: Asset, customPrompt?: string, useRef: boolean = true) => {
        if (asset.id === "new") return;

        setGeneratingIds(prev => new Set(prev).add(asset.id));
        toast("Generating visual...", { icon: '✨' });

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
            toast.error("Generation failed");
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
            toast.error("Creation failed");
        }
    };

    const handleGenerateAll = async () => {
        let targetList: Asset[] = [];
        if (activeTab === 'cast') targetList = assets.characters;
        else if (activeTab === 'locations') targetList = assets.locations;
        else if (activeTab === 'products') targetList = assets.products;

        const pending = targetList.filter(a => !a.image_url);
        if (pending.length === 0) { toast.success("All assets are ready"); return; }
        toast.loading(`Generating ${pending.length} assets...`);
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
        if (activeTab === 'cast') return 'Cast';
        if (activeTab === 'locations') return 'Locations';
        return 'Products';
    };

    const displayedAssets = getDisplayedAssets();

    // ─────────────────────────────────────────────────────────────────────────

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            <TourOverlay
                step={amTour.step}
                steps={ASSET_MANAGER_TOUR_STEPS}
                onNext={amTour.nextStep}
                onComplete={amTour.completeTour}
            />

            {/* Modal Container — wider to accommodate the grid */}
            <div className="w-[95vw] max-w-[1200px] h-[90vh] flex flex-col bg-[#050505] border border-white/[0.06] shadow-2xl shadow-black/80 relative overflow-hidden rounded-xl">

                {/* ── HEADER ── */}
                <div className="h-14 border-b border-white/[0.06] bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Assets</h2>
                        <div className="text-[10px] text-neutral-600 flex items-center gap-3">
                            <span>Ready: {assets.characters.filter(c => c.image_url).length + assets.locations.filter(l => l.image_url).length + assets.products.filter(p => p.image_url).length}</span>
                            <span className="text-white/[0.08]">|</span>
                            <span>Pending: {assets.characters.filter(c => !c.image_url).length + assets.locations.filter(l => !l.image_url).length + assets.products.filter(p => !p.image_url).length}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Generate All */}
                        <button
                            id="tour-am-generate-all"
                            onClick={handleGenerateAll}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] hover:border-[#E50914]/50 hover:bg-[#E50914]/10 text-neutral-500 hover:text-[#ff6b6b] text-[10px] font-bold tracking-widest uppercase transition-all rounded-md"
                        >
                            <Sparkles size={11} /> Generate All
                        </button>

                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.04] text-neutral-600 hover:text-white transition-colors rounded-full"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── TAB BAR ── */}
                <div id="tour-am-cast-tab" className="h-11 border-b border-white/[0.06] bg-[#080808] flex items-center px-6 gap-1 shrink-0">
                    {/* Products tab — shown first for ad projects */}
                    {project?.type === 'ad' && (
                        <TabButton
                            active={activeTab === 'products'}
                            onClick={() => setActiveTab('products')}
                            icon={<ShoppingBag size={12} />}
                            label="Products"
                            count={assets.products.length}
                        />
                    )}
                    <TabButton
                        active={activeTab === 'cast'}
                        onClick={() => setActiveTab('cast')}
                        icon={<Users size={12} />}
                        label="Cast"
                        count={assets.characters.length}
                    />
                    <TabButton
                        active={activeTab === 'locations'}
                        onClick={() => setActiveTab('locations')}
                        icon={<MapPin size={12} />}
                        label="Locations"
                        count={assets.locations.length}
                    />
                    {/* Products tab for non-ad projects */}
                    {project?.type !== 'ad' && (
                        <TabButton
                            active={activeTab === 'products'}
                            onClick={() => setActiveTab('products')}
                            icon={<ShoppingBag size={12} />}
                            label="Products"
                            count={assets.products.length}
                        />
                    )}

                    {/* Right side — section label + search placeholder */}
                    <div className="ml-auto flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-600 uppercase tracking-widest">
                            <LayoutGrid size={12} />
                            {getHeaderTitle()}
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/[0.06] rounded-md text-[10px] text-neutral-600">
                            <Search size={10} /> Search
                        </div>
                    </div>
                </div>

                {/* ── GRID ── */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#020202]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">

                        {/* Register New Card */}
                        <button
                            id="tour-am-register-new"
                            onClick={handleOpenDraft}
                            className="group aspect-[3/4] bg-white/[0.02] border border-dashed border-white/[0.08] hover:border-[#E50914]/40 hover:bg-[#E50914]/5 rounded-xl flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden"
                        >
                            <div className="h-12 w-12 rounded-full bg-white/[0.04] flex items-center justify-center border border-white/[0.06] group-hover:bg-[#E50914] group-hover:border-[#E50914] group-hover:text-white text-neutral-600 transition-colors mb-4">
                                <Plus size={24} />
                            </div>
                            <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-600 group-hover:text-white uppercase">
                                Add New
                            </span>
                        </button>

                        {/* Loading State */}
                        {loading ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                                <Loader2 className="animate-spin text-[#E50914] mb-4" size={24} />
                                <span className="text-xs tracking-widest text-neutral-600">Loading assets...</span>
                            </div>
                        ) : displayedAssets.map((asset, index) => (
                            <div key={asset.id} className="relative group">
                                <AssetCard
                                    tourId={index === 0 ? "tour-am-asset-card" : undefined}
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
                            </div>
                        ))}

                        {/* Empty State */}
                        {!loading && displayedAssets.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-40">
                                <div className="text-[10px] tracking-widest text-neutral-600 uppercase">
                                    No assets yet — add one to get started
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
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '12px',
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
                ? "border-[#E50914] text-white bg-white/[0.02]"
                : "border-transparent text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.02]"}`}
    >
        {icon}
        {label}
        <span className={`ml-1 ${active ? "text-[#E50914]" : "text-neutral-700"}`}>
            {String(count).padStart(2, '0')}
        </span>
    </button>
);
