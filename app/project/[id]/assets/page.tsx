"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    Users, MapPin, Sparkles, Loader2, Plus,
    Search, ArrowRight, Clapperboard,
    ShoppingBag
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import {
    fetchProjectAssets,
    fetchProject,
    deleteAsset,
    createAsset,
    triggerAssetGeneration,
    updateAsset,
    fetchEpisodes
} from "@/lib/api";
import { Asset, CharacterProfile, LocationProfile, ProductProfile, Project } from "@/lib/types";
import { constructLocationPrompt, constructCharacterPrompt } from '@/lib/promptUtils';

// --- COMPONENTS ---
import { AssetModal } from "@/components/AssetModal";
import { AssetCard } from "@/components/AssetCard";
import { MotionButton } from "@/components/ui/MotionButton";

// --- LAYOUT COMPONENTS ---
import { StudioLayout } from "@/app/components/studio/StudioLayout";
import { StudioHeader } from "@/app/components/studio/StudioHeader";
import { ProjectSettingsModal } from "@/app/components/studio/ProjectSettingsModal";

// --- CONTEXT ---
import { useMediaViewer, MediaItem } from "@/app/context/MediaViewerContext";

export default function AssetManagerPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { openViewer } = useMediaViewer();

    const projectId = params.id as string;
    const isOnboarding = searchParams.get("onboarding") === "true";

    // --- STATE ---
    // [CHANGED] Added 'products' to activeTab type
    const [activeTab, setActiveTab] = useState<'cast' | 'locations' | 'products'>('cast');

    // Data State
    const [project, setProject] = useState<Project | null>(null);

    // [CHANGED] Added products array to assets state
    const [assets, setAssets] = useState<{
        characters: CharacterProfile[],
        locations: LocationProfile[],
        products: ProductProfile[]
    }>({
        characters: [],
        locations: [],
        products: []
    });

    const [loading, setLoading] = useState(true);

    // Actions State
    const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [genPrompt, setGenPrompt] = useState("");

    // UI State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // --- LOAD DATA ---
    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            const [assetsData, projectData] = await Promise.all([
                fetchProjectAssets(projectId),
                fetchProject(projectId)
            ]);

            const typedCharacters = (assetsData.characters || []).map((c: any) => ({ ...c, type: 'character' }));
            const typedLocations = (assetsData.locations || []).map((l: any) => ({ ...l, type: 'location' }));

            // [NEW] Parse products
            const typedProducts = (assetsData.products || []).map((p: any) => ({ ...p, type: 'product' }));

            setAssets({
                characters: typedCharacters,
                locations: typedLocations,
                products: typedProducts // [NEW] Store products
            });

            setProject(projectData);

            // [NEW] Auto-switch tab if it's an ad and no cast exists yet
            if (projectData.type === 'ad' && typedCharacters.length === 0 && typedProducts.length > 0) {
                setActiveTab('products');
            }

        } catch (e) {
            console.error(e);
            toast.error("Failed to load manifest");
        } finally {
            setLoading(false);
        }
    };

    // Sync Modal
    useEffect(() => {
        if (selectedAsset && selectedAsset.id !== "new") {
            const allAssets = [...assets.characters, ...assets.locations, ...assets.products];
            const freshAsset = allAssets.find(a => a.id === selectedAsset.id);
            if (freshAsset && freshAsset.image_url !== selectedAsset.image_url) {
                setSelectedAsset(freshAsset);
            }
        }
    }, [assets]);

    // --- ACTIONS ---

    const handleEnterStudio = async () => {
        if (!project) return;
        toast.success("ENTERING PRODUCTION ENVIRONMENT");
        router.push(`/project/${projectId}/studio`);
    };

    const handleOpenDraft = () => {
        // [CHANGED] Determine type based on active tab
        let type = 'character';
        if (activeTab === 'locations') type = 'location';
        if (activeTab === 'products') type = 'product';

        const draftAsset: any = {
            id: "new",
            type: type,
            name: "",
            project_id: projectId,
            status: "pending",
            visual_traits: {},
            voice_config: {},
            product_metadata: {} // [NEW] Init metadata container
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

            // [CHANGED] Update local state based on type
            setAssets(prev => {
                const newState = { ...prev };
                if (type === 'character') newState.characters = prev.characters.filter(a => a.id !== id);
                else if (type === 'location') newState.locations = prev.locations.filter(a => a.id !== id);
                else if (type === 'product') newState.products = prev.products.filter(a => a.id !== id);
                return newState;
            });

            toast.success("ASSET PURGED");
        } catch (e) {
            toast.error("DELETION FAILED");
        }
    };

    const handleGenerate = async (asset: Asset, customPrompt?: string, useRef: boolean = true) => {
        if (asset.id === "new") return;

        setGeneratingIds(prev => new Set(prev).add(asset.id));
        toast("INITIALIZING RENDER...", { icon: '⚡' });

        try {
            const { code, owner_id, ...cleanStyle } = project?.moodboard || {};

            // [CHANGED] Determine API endpoint type
            let requestType = 'characters';
            if (asset.type === 'location') requestType = 'locations';
            if (asset.type === 'product') requestType = 'products';

            let finalPrompt = customPrompt;
            if (!finalPrompt) {
                if (asset.type === 'location') {
                    finalPrompt = constructLocationPrompt(asset.name, (asset as any).visual_traits, (asset as any).visual_traits, (project as any)?.genre || "", project?.moodboard?.lighting || "");
                } else if (asset.type === 'character') {
                    finalPrompt = constructCharacterPrompt(asset.name, (asset as any).visual_traits, (asset as any).visual_traits, (project as any)?.genre || "", project?.moodboard?.lighting || "");
                } else {
                    // [NEW] Simple fallback for product if no prompt exists
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

        // [CHANGED] Determine type from active tab
        let type = 'character';
        if (activeTab === 'locations') type = 'location';
        if (activeTab === 'products') type = 'product';

        try {
            const response = await createAsset(projectId, { ...draftData, type: type });
            const newAsset = { ...response.data.asset, type: type };
            setSelectedAsset(newAsset);
            loadData();
            await handleGenerate(newAsset, draftData.prompt, true);
        } catch (e) {
            toast.error("CREATION FAILED");
        }
    };

    const handleGenerateAll = async () => {
        // [CHANGED] Select list based on active tab
        let targetList: Asset[] = [];
        if (activeTab === 'cast') targetList = assets.characters;
        else if (activeTab === 'locations') targetList = assets.locations;
        else if (activeTab === 'products') targetList = assets.products;

        const pending = targetList.filter(a => !a.image_url);
        if (pending.length === 0) {
            toast.success("ALL SYSTEMS READY");
            return;
        }
        toast.loading(`BATCH PROCESSING ${pending.length} ITEMS...`);
        await Promise.all(pending.map(asset => handleGenerate(asset)));
    };

    // [CHANGED] Helper to get currently visible assets
    const getDisplayedAssets = () => {
        if (activeTab === 'cast') return assets.characters;
        if (activeTab === 'locations') return assets.locations;
        if (activeTab === 'products') return assets.products;
        return [];
    };

    const displayedAssets = getDisplayedAssets();

    // [NEW] Helper for Header Title
    const getHeaderTitle = () => {
        if (activeTab === 'cast') return 'Character Manifest';
        if (activeTab === 'locations') return 'Environment Database';
        return 'Product Inventory';
    };

    // Handle View Asset — for locations, show all views
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

    return (
        <StudioLayout>
            {/* --- HEADER --- */}
            {isOnboarding ? (
                <div className="h-16 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="h-9 w-9 bg-red-600/10 border border-red-600/30 flex items-center justify-center rounded">
                            <Clapperboard className="text-red-500" size={18} />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white uppercase tracking-wider leading-none">
                                Asset Registration
                            </h1>
                            <span className="text-[9px] font-mono text-[#555] uppercase tracking-widest">
                                {project?.title || "Untitled"}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleEnterStudio}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 border border-green-500/30 hover:bg-green-600/40 hover:border-green-500/50 text-green-400 text-[10px] font-bold tracking-widest uppercase rounded transition-all cursor-pointer"
                    >
                        Enter Studio <ArrowRight size={11} />
                    </button>
                </div>
            ) : (
                <StudioHeader
                    projectId={projectId}
                    projectTitle={project?.title || "Loading..."}
                    activeEpisodeId={project?.default_episode_id || ""}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                />
            )}

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                project={project}
                onUpdate={setProject}
            />

            {/* --- MAIN CONTENT (no sidebar) --- */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[#020202]">

                {/* ── TAB BAR + SEARCH + ACTIONS ── */}
                <div className="h-12 border-b border-white/[0.06] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-1">
                        <TabButton
                            active={activeTab === 'cast'}
                            onClick={() => setActiveTab('cast')}
                            icon={<Users size={13} />}
                            label="Cast"
                            count={assets.characters.length}
                        />
                        <TabButton
                            active={activeTab === 'locations'}
                            onClick={() => setActiveTab('locations')}
                            icon={<MapPin size={13} />}
                            label="Locations"
                            count={assets.locations.length}
                        />
                        {(project?.type === 'ad' || assets.products.length > 0) && (
                            <TabButton
                                active={activeTab === 'products'}
                                onClick={() => setActiveTab('products')}
                                icon={<ShoppingBag size={13} />}
                                label="Products"
                                count={assets.products.length}
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Progress */}
                        <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                    style={{ width: totalCount > 0 ? `${(readyCount / totalCount) * 100}%` : '0%' }}
                                />
                            </div>
                            <span className="text-[9px] font-mono text-neutral-600">
                                {readyCount}/{totalCount}
                            </span>
                            {generatingCount > 0 && (
                                <span className="text-[9px] font-mono text-amber-500 flex items-center gap-1">
                                    <Loader2 size={9} className="animate-spin" /> {generatingCount}
                                </span>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-36 h-7 pl-7 pr-3 bg-white/[0.03] border border-white/[0.06] rounded text-[10px] text-white placeholder-neutral-600 focus:outline-none focus:border-white/[0.15] transition-colors"
                            />
                        </div>

                        {/* Generate All */}
                        <button
                            onClick={handleGenerateAll}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] hover:border-[#E50914]/50 hover:bg-[#E50914]/10 text-neutral-500 hover:text-[#ff6b6b] text-[9px] font-bold tracking-widest uppercase transition-all rounded cursor-pointer"
                        >
                            <Sparkles size={10} /> Generate All
                        </button>
                    </div>
                </div>

                {/* ── ASSET GRID ── */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div className={`grid gap-5 ${activeTab === 'locations' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>

                        {/* Add New */}
                        <AssetCard variant="create" onCreate={handleOpenDraft} label={"ADD " + (activeTab === 'cast' ? 'CHARACTER' : activeTab === 'locations' ? 'LOCATION' : 'PRODUCT')} />

                        {/* Loading */}
                        {loading ? (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-50">
                                <Loader2 className="animate-spin text-[#E50914] mb-3" size={22} />
                                <span className="text-[10px] tracking-widest text-neutral-600 uppercase">Loading assets...</span>
                            </div>
                        ) : filteredAssets.map((asset) => (
                            <AssetCard
                                key={asset.id}
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
                        ))}

                        {/* Empty */}
                        {!loading && filteredAssets.length === 0 && displayedAssets.length > 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-16 opacity-40">
                                <span className="text-[10px] tracking-widest text-neutral-600 uppercase">No matches for "{searchQuery}"</span>
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
                    styles={{
                        modal: {
                            background: '#050505',
                            border: '1px solid #333',
                            borderRadius: '4px',
                            boxShadow: '0 0 100px rgba(0,0,0,0.9)'
                        }
                    }}
                />
            )}
        </StudioLayout>
    );
}

// ── Tab Button ──
const TabButton = ({ active, onClick, icon, label, count }: {
    active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number;
}) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold tracking-widest uppercase transition-all rounded-md cursor-pointer
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