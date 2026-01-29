"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowRight, Users, MapPin, Sparkles, Plus, Loader2
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import {
    fetchProjectAssets,
    fetchProject, // <--- NEW IMPORT
    deleteAsset,
    createAsset,
    triggerAssetGeneration,
    updateAsset
} from "@/lib/api";
import { Asset, CharacterProfile, LocationProfile, Project } from "@/lib/types"; // <--- NEW IMPORT

// --- COMPONENTS ---
import { AssetModal } from "@/components/AssetModal";
import { AssetCard } from "@/components/AssetCard";
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";

export default function AssetManagerPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'cast' | 'locations'>('cast');

    // Data State
    const [project, setProject] = useState<Project | null>(null); // <--- Store Project/Moodboard
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

    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newAssetName, setNewAssetName] = useState("");

    // --- 1. LOAD DATA ---
    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            // Fetch Assets AND Project Details (for moodboard) in parallel
            const [assetsData, projectData] = await Promise.all([
                fetchProjectAssets(projectId),
                fetchProject(projectId)
            ]);

            setAssets(assetsData);
            setProject(projectData);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load project data");
        } finally {
            setLoading(false);
        }
    };

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

    const handleCreate = async () => {
        if (!newAssetName.trim()) return;
        setIsCreating(true);
        try {
            await createAsset(projectId, {
                name: newAssetName,
                type: activeTab === 'cast' ? 'character' : 'location'
            });
            setNewAssetName("");
            await loadData();
            toast.success("Asset Created");
        } catch (e) {
            toast.error("Failed to create asset");
        } finally {
            setIsCreating(false);
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

    const handleGenerate = async (asset: Asset, customPrompt?: string) => {
        setGeneratingIds(prev => new Set(prev).add(asset.id));
        toast("Queued for Generation...", { icon: '⏳' });

        try {
            // 1. CLEAN THE MOODBOARD (Remove 'code', 'owner_id', etc.)
            // We strip out 'code' and spread the rest into cleanStyle
            const { code, owner_id, ...cleanStyle } = project?.moodboard || {};

            // 2. GET ASPECT RATIO (Default to 16:9 if missing)
            // Note: Typescript might complain if aspect_ratio isn't in your Project interface yet.
            const aspectRatio = (project as any)?.aspect_ratio || "16:9";

            // 3. Trigger Backend Job
            await triggerAssetGeneration(
                projectId,
                asset.id,
                asset.type,
                customPrompt,
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

    const handleUpdateTraits = async (asset: Asset, traits: any) => {
        try {
            await updateAsset(projectId, asset.type, asset.id, { visual_traits: traits });
            toast.success("Traits Saved");
            loadData();
        } catch (e) {
            toast.error("Failed to save traits");
        }
    };

    // --- RENDER HELPERS ---
    const displayedAssets = activeTab === 'cast' ? assets.characters : assets.locations;

    return (
        <StudioLayout>
            <div className="min-h-screen bg-black text-white p-8 pb-32 font-sans">

                {/* HEADER & CONTROLS */}
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
                        {/* TABS */}
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

                        {/* GLOBAL ACTIONS */}
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

                {/* ASSET GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">

                    {/* ADD NEW BUTTON CARD */}
                    <div className="aspect-[3/4] border border-dashed border-neutral-800 rounded-xl bg-neutral-900/20 flex flex-col items-center justify-center p-4 hover:border-neutral-600 transition-colors group">
                        {isCreating ? (
                            <div className="w-full animate-in fade-in zoom-in">
                                <input
                                    autoFocus
                                    className="w-full bg-black border border-neutral-700 rounded p-2 text-xs text-center mb-2 focus:border-motion-red outline-none"
                                    placeholder="NAME..."
                                    value={newAssetName}
                                    onChange={(e) => setNewAssetName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                />
                                <button
                                    onClick={handleCreate}
                                    className="w-full py-1 bg-white text-black text-[9px] font-bold tracking-widest rounded"
                                >
                                    CREATE
                                </button>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsCreating(true)}
                                className="flex flex-col items-center cursor-pointer opacity-50 group-hover:opacity-100 transition-opacity"
                            >
                                <Plus size={32} className="mb-2" />
                                <span className="text-[10px] font-bold tracking-widest">ADD NEW</span>
                            </div>
                        )}
                    </div>

                    {/* ASSET CARDS */}
                    {loading ? (
                        <div className="col-span-full py-20 flex justify-center text-neutral-500 font-mono text-xs">
                            <Loader2 className="animate-spin mr-2" /> LOADING ASSETS...
                        </div>
                    ) : displayedAssets.map((asset) => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            projectId={projectId}
                            isGenerating={generatingIds.has(asset.id)}
                            onGenerate={(a) => handleGenerate(a)}
                            onConfig={(a) => {
                                setSelectedAsset(a);
                                setGenPrompt(a.prompt || "");
                            }}
                            onDelete={handleDelete}
                        />
                    ))}
                </div>

                {/* MODAL INTEGRATION */}
                {selectedAsset && (
                    <AssetModal
                        isOpen={!!selectedAsset}
                        onClose={() => { setSelectedAsset(null); }}
                        assetId={selectedAsset.id}
                        projectId={projectId}
                        assetType={selectedAsset.type}
                        assetName={selectedAsset.name}
                        currentData={selectedAsset}

                        // -- GENERATION PROPS --
                        mode="generate"
                        setMode={() => { }}
                        genPrompt={genPrompt}
                        setGenPrompt={setGenPrompt}
                        isProcessing={generatingIds.has(selectedAsset.id)}
                        onGenerate={() => handleGenerate(selectedAsset, genPrompt)} // Pass the modal prompt!

                        // -- DATA PROPS (Now Dynamic) --
                        // Tries to use project moodboard data, falls back to defaults
                        genre={(project as any)?.genre || "cinematic"}
                        style={project?.moodboard?.lighting || "realistic"}

                        // -- HANDLERS --
                        onUpload={() => { }}
                        onUpdateTraits={(traits) => handleUpdateTraits(selectedAsset, traits)}
                        onLinkVoice={async () => { }}

                        styles={{ modal: { background: '#090909', border: '1px solid #222', borderRadius: '12px' } }}
                    />
                )}
            </div>
        </StudioLayout>
    );
}

// --- TAB BUTTON COMPONENT ---
const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] font-bold tracking-widest transition-all ${active ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-white"
            }`}
    >
        {icon} {label}
    </button>
);