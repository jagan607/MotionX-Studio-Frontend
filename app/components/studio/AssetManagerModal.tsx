"use client";

import React, { useState, useEffect } from "react";
import {
    X, Users, MapPin, ShoppingBag, Plus, Loader2,
    Search, Sparkles
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import {
    api,
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
    onAssetsUpdated?: () => void;
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
        if (asset.type === 'location') {
            const loc = asset as LocationProfile;
            const mediaItems: MediaItem[] = [];
            if (loc.image_url) mediaItems.push({ id: `${loc.id}-wide`, type: 'image', imageUrl: loc.image_url, title: `${loc.name} — Wide`, description: loc.prompt || (loc as any).base_prompt });
            if (loc.image_views?.front) mediaItems.push({ id: `${loc.id}-front`, type: 'image', imageUrl: loc.image_views.front, title: `${loc.name} — Front`, description: '' });
            if (loc.image_views?.left) mediaItems.push({ id: `${loc.id}-left`, type: 'image', imageUrl: loc.image_views.left, title: `${loc.name} — Left`, description: '' });
            if (loc.image_views?.right) mediaItems.push({ id: `${loc.id}-right`, type: 'image', imageUrl: loc.image_views.right, title: `${loc.name} — Right`, description: '' });
            if (mediaItems.length > 0) openViewer(mediaItems, 0);
            return;
        }

        const displayed = getDisplayedAssets();
        const index = displayed.findIndex(a => a.id === asset.id);
        if (index === -1) return;
        const mediaItems: MediaItem[] = displayed.map(a => ({
            id: a.id,
            type: 'image',
            imageUrl: a.image_url,
            title: a.name,
            description: a.prompt || (a as any).base_prompt,
        }));
        openViewer(mediaItems, index);
    };

    const handleRegisterKling = async (asset: Asset) => {
        const toastId = toast.loading(asset.kling_element_id ? "Re-registering element..." : "Enabling for video...");
        try {
            const forceParam = asset.kling_element_id ? '?force=true' : '';
            const res = await api.post(`/api/v1/assets/${projectId}/${asset.type}/${asset.id}/register_kling${forceParam}`);
            if (res.data.status === 'success') {
                toast.success("Asset enabled for video", { id: toastId });

                setAssets(prev => {
                    const newState = { ...prev };
                    if (asset.type === 'character') {
                        newState.characters = prev.characters.map(c =>
                            c.id === asset.id ? { ...c, kling_element_id: String(res.data.kling_element_id) } : c
                        );
                    } else if (asset.type === 'product') {
                        newState.products = prev.products.map(p =>
                            p.id === asset.id ? { ...p, kling_element_id: String(res.data.kling_element_id) } : p
                        );
                    } else if (asset.type === 'location') {
                        newState.locations = prev.locations.map(l =>
                            l.id === asset.id ? { ...l, kling_element_id: String(res.data.kling_element_id) } : l
                        );
                    }
                    return newState;
                });

                onAssetsUpdated?.();
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to enable asset", { id: toastId });
        }
    };

    // --- HELPERS ---

    const getDisplayedAssets = (): Asset[] => {
        if (activeTab === 'cast') return assets.characters;
        if (activeTab === 'locations') return assets.locations;
        if (activeTab === 'products') return assets.products;
        return [];
    };

    const displayedAssets = getDisplayedAssets();

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const filteredAssets = searchQuery
        ? displayedAssets.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : displayedAssets;

    // Counts
    const allAssets = [...assets.characters, ...assets.locations, ...assets.products];
    const readyCount = allAssets.filter(a => a.image_url).length;
    const totalCount = allAssets.length;
    const generatingCount = generatingIds.size;

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

            {/* Modal Container */}
            <div className="w-[95vw] max-w-[1200px] h-[90vh] flex flex-col bg-[#050505] border border-white/[0.06] shadow-2xl shadow-black/80 relative overflow-hidden rounded-xl">

                {/* ── HEADER ── */}
                <div className="h-14 border-b border-white/[0.06] bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-bold text-white uppercase tracking-tight">Assets</h2>
                        <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                    style={{ width: totalCount > 0 ? `${(readyCount / totalCount) * 100}%` : '0%' }}
                                />
                            </div>
                            <span className="text-[9px] font-mono text-neutral-600">
                                {readyCount}/{totalCount}
                            </span>
                            {generatingCount > 0 && (
                                <span className="text-[9px] font-mono text-[#E50914] flex items-center gap-1">
                                    <Loader2 size={9} className="animate-spin" /> {generatingCount}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-32 h-7 pl-7 pr-3 bg-white/[0.03] border border-white/[0.06] rounded text-[10px] text-white placeholder-neutral-600 focus:outline-none focus:border-white/[0.15] transition-colors"
                            />
                        </div>

                        <button
                            id="tour-am-generate-all"
                            onClick={handleGenerateAll}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] hover:border-[#E50914]/50 hover:bg-[#E50914]/10 text-neutral-500 hover:text-[#ff6b6b] text-[9px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer"
                        >
                            <Sparkles size={10} /> Generate All
                        </button>

                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.04] text-neutral-600 hover:text-white transition-colors rounded-full cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* ── TAB BAR ── */}
                <div id="tour-am-cast-tab" className="h-11 border-b border-white/[0.06] bg-[#080808] flex items-center px-6 gap-1 shrink-0">
                    {project?.type === 'ad' && (
                        <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<ShoppingBag size={12} />} label="Products" count={assets.products.length} />
                    )}
                    <TabButton active={activeTab === 'cast'} onClick={() => setActiveTab('cast')} icon={<Users size={12} />} label="Cast" count={assets.characters.length} />
                    <TabButton active={activeTab === 'locations'} onClick={() => setActiveTab('locations')} icon={<MapPin size={12} />} label="Locations" count={assets.locations.length} />
                    {project?.type !== 'ad' && (
                        <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<ShoppingBag size={12} />} label="Products" count={assets.products.length} />
                    )}
                </div>

                {/* ── GRID ── */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#020202]">
                    <div className={`grid gap-5 ${activeTab === 'locations' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
                        <AssetCard variant="create" tourId="tour-am-register-new" onCreate={handleOpenDraft} label={"ADD " + (activeTab === 'cast' ? 'CHARACTER' : activeTab === 'locations' ? 'LOCATION' : 'PRODUCT')} />

                        {loading ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                                <Loader2 className="animate-spin text-[#E50914] mb-3" size={22} />
                                <span className="text-[10px] tracking-widest text-neutral-600 uppercase">Loading assets...</span>
                            </div>
                        ) : filteredAssets.map((asset, index) => (
                            <AssetCard
                                key={asset.id}
                                tourId={index === 0 ? "tour-am-asset-card" : undefined}
                                variant="default"
                                asset={asset}
                                projectId={projectId}
                                isGenerating={generatingIds.has(asset.id)}
                                onGenerate={(a: Asset) => handleGenerate(a, a.prompt || (a as any).base_prompt)}
                                onConfig={(a: Asset) => { setSelectedAsset(a); setGenPrompt(a.prompt || ""); }}
                                onDelete={handleDelete}
                                onView={handleViewAsset}
                                onRegisterKling={handleRegisterKling}
                            />
                        ))}

                        {!loading && filteredAssets.length === 0 && displayedAssets.length > 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-40">
                                <span className="text-[10px] tracking-widest text-neutral-600 uppercase">No matches for &quot;{searchQuery}&quot;</span>
                            </div>
                        )}
                        {!loading && displayedAssets.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-40">
                                <span className="text-[10px] tracking-widest text-neutral-600 uppercase">No assets yet — add one to get started</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
                    styles={{ modal: { background: '#050505', border: '1px solid #333', borderRadius: '4px', boxShadow: '0 0 100px rgba(0,0,0,0.9)' } }}
                />
            )}
        </div>
    );
};

function TabButton({ active, onClick, icon, label, count }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer
                ${active
                    ? "bg-white/[0.06] text-white border border-white/[0.1]"
                    : "text-neutral-600 hover:text-neutral-400 hover:bg-white/[0.02] border border-transparent"}`}
        >
            {icon}
            {label}
            <span className={`font-mono text-[9px] ${active ? "text-[#E50914]" : "text-neutral-700"}`}>
                {String(count).padStart(2, '0')}
            </span>
        </button>
    );
}
