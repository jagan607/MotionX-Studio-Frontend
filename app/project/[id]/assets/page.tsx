"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    Users, MapPin, Sparkles, Loader2, Plus,
    LayoutGrid, Search, ArrowRight, CheckCircle2, Clapperboard,
    ShoppingBag // [NEW] Icon for products
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

export default function AssetManagerPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();

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

    return (
        <StudioLayout>
            <style jsx global>{`
                div[class*="rounded-xl"], div[class*="bg-white"], div[class*="bg-zinc-900"] {
                    border-radius: 0px !important;
                    background-color: #0A0A0A !important;
                    border: 1px solid #222 !important;
                    box-shadow: none !important;
                    transition: all 0.2s ease !important;
                }
                div[class*="rounded-xl"]:hover {
                    border-color: #555 !important;
                    background-color: #0F0F0F !important;
                }
                h3, p, span { color: #EEE !important; }
                .text-muted-foreground { color: #666 !important; }
            `}</style>

            {/* --- HEADER --- */}
            {isOnboarding ? (
                <div className="h-20 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-red-600/10 border border-red-600/30 flex items-center justify-center rounded-sm">
                            <Clapperboard className="text-red-500" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white uppercase tracking-wider leading-none">
                                Asset Registration
                            </h1>
                            <div className="flex items-center gap-2 text-[10px] font-mono text-[#666] mt-1 uppercase tracking-widest">
                                Phase 2: Visualization <span className="text-red-600">//</span> {project?.title || "Untitled"}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-[10px] font-mono text-[#444] text-right hidden md:block">
                            <div>PENDING: {assets.characters.filter(c => !c.image_url).length + assets.locations.filter(l => !l.image_url).length + assets.products.filter(p => !p.image_url).length}</div>
                            <div>READY: {assets.characters.filter(c => c.image_url).length + assets.locations.filter(l => l.image_url).length + assets.products.filter(p => p.image_url).length}</div>
                        </div>
                        <MotionButton
                            onClick={handleEnterStudio}
                            className="w-48 bg-green-600 hover:bg-green-500 border-green-500/30 text-white"
                        >
                            ENTER STUDIO <ArrowRight size={14} className="ml-2" />
                        </MotionButton>
                    </div>
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

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex overflow-hidden relative z-40">

                {/* SIDEBAR */}
                <div className="w-[280px] bg-[#050505] border-r border-[#222] flex flex-col shrink-0">
                    <div className="p-6 border-b border-[#222]">
                        <div className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-4">
                            Asset Categories
                        </div>
                        <div className="space-y-1">
                            <TabButton
                                active={activeTab === 'cast'}
                                onClick={() => setActiveTab('cast')}
                                icon={<Users size={14} />}
                                label="CAST LIST"
                                count={assets.characters.length}
                            />
                            <TabButton
                                active={activeTab === 'locations'}
                                onClick={() => setActiveTab('locations')}
                                icon={<MapPin size={14} />}
                                label="LOCATIONS"
                                count={assets.locations.length}
                            />

                            {/* [NEW] Conditionally Render Products Tab */}
                            {project?.type === 'ad' && (
                                <TabButton
                                    active={activeTab === 'products'}
                                    onClick={() => setActiveTab('products')}
                                    icon={<ShoppingBag size={14} />}
                                    label="PRODUCTS"
                                    count={assets.products.length}
                                />
                            )}
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-4">
                            Operations
                        </div>
                        <div className="space-y-3">
                            <button
                                onClick={handleGenerateAll}
                                className="w-full py-3 bg-[#0A0A0A] border border-[#222] hover:border-red-600/50 text-[10px] font-bold text-[#888] hover:text-white uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                <Sparkles size={12} className="text-red-600" /> Batch Generate
                            </button>
                            <div className="text-[9px] font-mono text-[#333] text-center">
                                *Auto-generates missing visuals
                            </div>
                        </div>
                    </div>
                </div>

                {/* GRID VIEW */}
                <div className="flex-1 bg-[#020202] flex flex-col relative">
                    <div className="h-12 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#555] uppercase tracking-widest">
                            <LayoutGrid size={14} />
                            {getHeaderTitle()}
                        </div>

                        <div className="flex gap-2">
                            <div className="flex items-center gap-2 px-3 py-1 bg-[#111] border border-[#222] text-[10px] font-mono text-[#666]">
                                <Search size={10} /> SEARCH_DB
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
                                    />
                                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-red-600/0 group-hover:border-red-600 transition-colors pointer-events-none" />
                                </div>
                            ))}
                        </div>
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
                            borderRadius: '0px',
                            boxShadow: '0 0 100px rgba(0,0,0,0.9)'
                        }
                    }}
                />
            )}
        </StudioLayout>
    );
}

const TabButton = ({ active, onClick, icon, label, count }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold tracking-widest uppercase transition-all border border-transparent
        ${active
                ? "bg-[#111] text-white border-[#222] border-l-2 border-l-red-600"
                : "text-[#555] hover:text-[#AAA] hover:bg-[#0A0A0A]"}`}
    >
        <div className="flex items-center gap-3">
            {icon} {label}
        </div>
        <span className={`font-mono ${active ? "text-red-500" : "text-[#333]"}`}>
            {String(count).padStart(2, '0')}
        </span>
    </button>
);