"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowRight, Users, MapPin, Sparkles, Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import {
    fetchProjectAssets,
    fetchProject,
    deleteAsset,
    createAsset,
    triggerAssetGeneration,
    updateAsset
} from "@/lib/api";
import { Asset, CharacterProfile, LocationProfile, Project } from "@/lib/types";
import { constructLocationPrompt, constructCharacterPrompt } from '@/lib/promptUtils';

// --- COMPONENTS ---
import { AssetModal } from "@/components/AssetModal";
import { AssetCard } from "@/components/AssetCard"; // Check import path based on your structure
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";

export default function AssetManagerPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'cast' | 'locations'>('cast');

    // Data State
    const [project, setProject] = useState<Project | null>(null);
    const [assets, setAssets] = useState<{
        characters: CharacterProfile[],
        locations: LocationProfile[]
    }>({
        characters: [],
        locations: []
    });

    const [loading, setLoading] = useState(true);

    // Actions State
    const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set());
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [genPrompt, setGenPrompt] = useState("");

    // --- 1. LOAD DATA ---
    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            const [assetsData, projectData] = await Promise.all([
                fetchProjectAssets(projectId),
                fetchProject(projectId)
            ]);

            // --- CRITICAL FIX: INJECT ASSET TYPES ---
            // The API returns segregated arrays but objects might lack the 'type' property.
            // We manually inject it so Modal and PromptUtils know what to do.
            const typedCharacters = (assetsData.characters || []).map((c: any) => ({
                ...c,
                type: 'character'
            }));

            const typedLocations = (assetsData.locations || []).map((l: any) => ({
                ...l,
                type: 'location'
            }));

            setAssets({
                characters: typedCharacters,
                locations: typedLocations
            });

            setProject(projectData);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load project data");
        } finally {
            setLoading(false);
        }
    };

    // Sync Modal with Live Data (Ignore if it's a Draft)
    useEffect(() => {
        if (selectedAsset && selectedAsset.id !== "new") {
            const allAssets = [...assets.characters, ...assets.locations];
            const freshAsset = allAssets.find(a => a.id === selectedAsset.id);

            if (freshAsset && freshAsset.image_url !== selectedAsset.image_url) {
                setSelectedAsset(freshAsset);
            }
        }
    }, [assets]);

    // --- 2. CALCULATE PROGRESS ---
    const calculateProgress = () => {
        const all = [...assets.characters, ...assets.locations];
        if (all.length === 0) return 0;

        let score = 0;
        const visualsDone = all.filter(a => a.image_url).length;
        score += (visualsDone / all.length) * 70;

        if (assets.characters.length > 0) {
            const audioDone = assets.characters.filter(c => c.voice_config?.voice_id).length;
            score += (audioDone / assets.characters.length) * 30;
        } else {
            score += 30;
        }

        return Math.round(score);
    };

    // --- 3. ACTIONS ---

    // A. Open Draft Mode
    const handleOpenDraft = () => {
        const type = activeTab === 'cast' ? 'character' : 'location';

        // Create a temporary "Draft Asset"
        const draftAsset: any = {
            id: "new",
            type: type, // This ensures 'create new' modal shows correct UI
            name: "",
            project_id: projectId,
            status: "pending",
            visual_traits: {},
            voice_config: {}
        };

        setGenPrompt("");
        setSelectedAsset(draftAsset);
    };

    // B. Save (Create or Update)
    const handleSaveAsset = async (asset: Asset, data: any) => {
        try {
            if (asset.id === "new") {
                await createAsset(projectId, {
                    ...data,
                    type: asset.type
                });
                toast.success("Asset Created");
            } else {
                await updateAsset(projectId, asset.type, asset.id, data);
                toast.success("Configuration Saved");
            }

            setSelectedAsset(null);
            loadData();
        } catch (e) {
            console.error(e);
            toast.error("Failed to save asset");
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (!confirm("Are you sure? This cannot be undone.")) return;
        try {
            await deleteAsset(projectId, type, id);
            setAssets(prev => ({
                ...prev,
                [type === 'character' ? 'characters' : 'locations']: prev[type === 'character' ? 'characters' : 'locations'].filter(a => a.id !== id)
            }));
            toast.success("Asset Deleted");
        } catch (e) {
            toast.error("Deletion failed");
        }
    };

    // --- CORE GENERATION LOGIC ---
    const handleGenerate = async (asset: Asset, customPrompt?: string) => {
        if (asset.id === "new") return;

        setGeneratingIds(prev => new Set(prev).add(asset.id));
        toast("Queued for Generation...", { icon: '⏳' });

        try {
            const { code, owner_id, ...cleanStyle } = project?.moodboard || {};
            const aspectRatio = (project as any)?.aspect_ratio || "16:9";
            const genre = (project as any)?.genre || "cinematic";
            const style = project?.moodboard?.lighting || "realistic";

            const requestType = activeTab === 'cast' ? 'characters' : 'locations';

            let finalPrompt = customPrompt;
            if (!finalPrompt) {
                // FIX: Now asset.type is guaranteed to be set correctly by loadData
                if (asset.type === 'location') {
                    finalPrompt = constructLocationPrompt(
                        asset.name,
                        (asset as any).visual_traits,
                        (asset as any).visual_traits,
                        genre,
                        style
                    );
                } else {
                    finalPrompt = constructCharacterPrompt(
                        asset.name,
                        (asset as any).visual_traits,
                        (asset as any).visual_traits,
                        genre,
                        style
                    );
                }
            }

            await triggerAssetGeneration(
                projectId,
                asset.id,
                requestType,
                finalPrompt,
                cleanStyle,
                aspectRatio
            );

            setTimeout(() => {
                loadData();
                setGeneratingIds(prev => { const next = new Set(prev); next.delete(asset.id); return next; });
            }, 8000);

        } catch (e) {
            console.error(e);
            toast.error("Generation failed to start");
            setGeneratingIds(prev => { const next = new Set(prev); next.delete(asset.id); return next; });
        }
    };

    const handleCreateAndGenerate = async (draftData: any) => {
        if (!selectedAsset) return;
        const type = activeTab === 'cast' ? 'character' : 'location';

        try {
            toast.loading("Creating asset first...");

            const response = await createAsset(projectId, {
                ...draftData,
                type: type
            });

            // Ensure the newly created asset also has the type injected immediately for local state
            const newAsset = { ...response.data.asset, type: type };

            setSelectedAsset(newAsset);
            loadData();

            await handleGenerate(newAsset, draftData.prompt);

        } catch (e) {
            console.error("Create & Generate Failed", e);
            toast.error("Failed to create asset for generation");
        }
    };

    const handleGenerateAll = async () => {
        const targetList = activeTab === 'cast' ? assets.characters : assets.locations;
        const pending = targetList.filter(a => !a.image_url);

        if (pending.length === 0) {
            toast.success("All assets already have visuals!");
            return;
        }

        toast.loading(`Starting generation for ${pending.length} assets...`);
        await Promise.all(pending.map(asset => handleGenerate(asset)));
    };

    // --- RENDER ---
    const displayedAssets = activeTab === 'cast' ? assets.characters : assets.locations;

    return (
        <StudioLayout>
            <div className="min-h-screen bg-black text-white p-8 pb-32 font-sans">

                {/* HEADER */}
                <header className="flex flex-col xl:flex-row justify-between items-end mb-8 gap-6 border-b border-neutral-800 pb-6">
                    <div className="w-full xl:w-auto">
                        <div className="flex items-center justify-between mb-2">
                            <h1 className="text-3xl font-display uppercase tracking-wider text-white">Asset Manager</h1>
                            <div className="text-right xl:hidden">
                                <span className="text-2xl font-mono text-motion-red">{calculateProgress()}%</span>
                            </div>
                        </div>

                        {/* PROGRESS BAR */}
                        <div className="w-full xl:w-[400px] h-2 bg-neutral-900 rounded-full overflow-hidden flex">
                            <div
                                className="h-full bg-motion-red transition-all duration-1000 ease-out"
                                style={{ width: `${calculateProgress()}%` }}
                            />
                        </div>
                        <p className="text-[10px] font-mono text-neutral-500 mt-2 uppercase tracking-widest">
                            Configuration Progress // {calculateProgress()}% Complete
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto">
                        <div className="flex bg-neutral-900 border border-neutral-800 rounded p-1 mr-auto xl:mr-0">
                            <TabButton
                                active={activeTab === 'cast'}
                                onClick={() => setActiveTab('cast')}
                                icon={<Users size={14} />}
                                label={`CAST (${assets.characters.length})`}
                            />
                            <TabButton
                                active={activeTab === 'locations'}
                                onClick={() => setActiveTab('locations')}
                                icon={<MapPin size={14} />}
                                label={`LOCATIONS (${assets.locations.length})`}
                            />
                        </div>

                        <button
                            onClick={handleGenerateAll}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold tracking-widest transition-all"
                        >
                            <Sparkles size={12} className="text-motion-red" /> GENERATE ALL
                        </button>

                        <MotionButton onClick={() => router.push(`/project/${projectId}/studio`)}>
                            ENTER STUDIO <ArrowRight size={14} className="ml-2" />
                        </MotionButton>
                    </div>
                </header>

                {/* GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    <AssetCard
                        variant="create"
                        onCreate={handleOpenDraft}
                        label={`New ${activeTab === 'cast' ? 'Character' : 'Location'}`}
                    />

                    {loading ? (
                        <div className="col-span-full py-20 flex justify-center text-neutral-500 font-mono text-xs">
                            <Loader2 className="animate-spin mr-2" /> LOADING ASSETS...
                        </div>
                    ) : displayedAssets.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            variant="default"
                            asset={asset}
                            projectId={projectId}
                            isGenerating={generatingIds.has(asset.id)}
                            // FIX: Explicitly type 'a' as Asset
                            onGenerate={(a: Asset) => handleGenerate(a, a.prompt || (a as any).base_prompt)}
                            onConfig={(a: Asset) => {
                                setSelectedAsset(a);
                                setGenPrompt(a.prompt || "");
                            }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>

                {/* MODAL */}
                {selectedAsset && (
                    <AssetModal
                        isOpen={!!selectedAsset}
                        onClose={() => { setSelectedAsset(null); }}
                        assetId={selectedAsset.id}
                        projectId={projectId}
                        // FIX: Now this is guaranteed to be 'character' or 'location'
                        assetType={selectedAsset.type}
                        assetName={selectedAsset.name}
                        currentData={selectedAsset}
                        mode="generate"
                        setMode={() => { }}
                        genPrompt={genPrompt}
                        setGenPrompt={setGenPrompt}
                        isProcessing={selectedAsset.id !== "new" && generatingIds.has(selectedAsset.id)}
                        onGenerate={() => handleGenerate(selectedAsset, genPrompt)}
                        onCreateAndGenerate={handleCreateAndGenerate}
                        genre={(project as any)?.genre || "cinematic"}
                        style={project?.moodboard?.lighting || "realistic"}
                        onUpload={() => { }}
                        onUpdateTraits={(data) => handleSaveAsset(selectedAsset, data)}
                        onLinkVoice={async () => { }}
                        styles={{ modal: { background: '#090909', border: '1px solid #222', borderRadius: '12px' } }}
                    />
                )}
            </div>
        </StudioLayout>
    );
}

const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] font-bold tracking-widest transition-all ${active ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-white"
            }`}
    >
        {icon} {label}
    </button>
);