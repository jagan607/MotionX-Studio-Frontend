"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowRight, Users, MapPin, RefreshCw, Wand2, Settings,
    Plus, Trash2, Loader2, Sparkles, Play
} from "lucide-react";
import { toast } from "react-hot-toast";

// --- API & TYPES ---
import { fetchProjectAssets, deleteAsset, createAsset, triggerAssetGeneration } from "@/lib/api";
// FIX 1: Import specific profile types to strictly type the state
import { Asset, CharacterProfile, LocationProfile } from "@/lib/types";

// --- COMPONENTS ---
import { AssetModal } from "@/components/AssetModal";
import { StudioLayout } from "@/components/ui/StudioLayout";
import { MotionButton } from "@/components/ui/MotionButton";

export default function AssetManagerPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    // --- STATE ---
    const [activeTab, setActiveTab] = useState<'cast' | 'locations'>('cast');

    // FIX 2: Strictly type the state so TS knows 'characters' has voice_config
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
    const [isCreating, setIsCreating] = useState(false);
    const [newAssetName, setNewAssetName] = useState("");

    // --- 1. LOAD DATA ---
    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        try {
            // fetchProjectAssets returns { characters: CharacterProfile[], locations: LocationProfile[] }
            const data = await fetchProjectAssets(projectId);
            setAssets(data);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load assets");
        } finally {
            setLoading(false);
        }
    };

    // --- 2. CALCULATE PROGRESS ---
    const calculateProgress = () => {
        const all = [...assets.characters, ...assets.locations];
        if (all.length === 0) return 0;

        let score = 0;
        // Visuals count for 70% of the score
        const visualsDone = all.filter(a => a.image_url).length;
        score += (visualsDone / all.length) * 70;

        // Audio counts for 30% (Characters only)
        if (assets.characters.length > 0) {
            // FIX 3: TS is now happy because we know 'assets.characters' contains CharacterProfiles
            const audioDone = assets.characters.filter(c => c.voice_config?.voice_id).length;
            score += (audioDone / assets.characters.length) * 30;
        } else {
            score += 30; // If no characters, audio is "done"
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
            await loadData(); // Reload grid
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
            // Optimistic update
            setAssets(prev => ({
                ...prev,
                [type === 'character' ? 'characters' : 'locations']: prev[type === 'character' ? 'characters' : 'locations'].filter(a => a.id !== id)
            }));
            toast.success("Asset Deleted");
        } catch (e) {
            toast.error("Deletion failed");
        }
    };

    const handleGenerate = async (asset: Asset) => {
        // Optimistic UI update
        setGeneratingIds(prev => new Set(prev).add(asset.id));
        toast("Queued for Generation...", { icon: '⏳' });

        try {
            // Trigger Backend Job
            await triggerAssetGeneration(projectId, asset.id, asset.type);

            // Simple polling simulation for MVP
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

        // Fire all requests concurrently
        await Promise.all(pending.map(asset => handleGenerate(asset)));
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

                    {/* ADD NEW CARD */}
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
                        <div key={asset.id} className="group relative aspect-[3/4] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-600 transition-all">

                            {/* IMAGE / STATUS */}
                            <div className="w-full h-full relative">
                                {asset.image_url ? (
                                    <img src={asset.image_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        {generatingIds.has(asset.id) ? (
                                            <>
                                                <Loader2 className="animate-spin text-motion-red mb-2" size={24} />
                                                <span className="text-[9px] font-mono text-motion-red animate-pulse">GENERATING...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="text-neutral-700 mb-2" size={24} />
                                                <span className="text-[9px] font-mono text-neutral-600">NO VISUAL</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* DELETE BUTTON (Hover Only) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(asset.id, asset.type); }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-900/80 text-white/50 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>

                                {/* AUDIO BADGE (Characters Only) */}
                                {/* FIX: TS knows this is safe now because of the union type check, but let's be explicit */}
                                {asset.type === 'character' && (asset as CharacterProfile).voice_config?.voice_id && (
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur rounded text-[8px] font-bold text-green-400 flex items-center gap-1">
                                        <Play size={8} fill="currentColor" /> VOICE LINKED
                                    </div>
                                )}
                            </div>

                            {/* CARD FOOTER (Name & CTAs) */}
                            <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black via-black/90 to-transparent">
                                <h3 className="text-sm font-display uppercase text-white truncate mb-3">{asset.name}</h3>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleGenerate(asset)}
                                        disabled={generatingIds.has(asset.id)}
                                        className="flex items-center justify-center gap-1.5 py-2 bg-white/10 hover:bg-motion-red text-white rounded text-[9px] font-bold tracking-widest transition-colors disabled:opacity-50"
                                    >
                                        <Sparkles size={10} /> {asset.image_url ? "REGEN" : "GENERATE"}
                                    </button>

                                    <button
                                        onClick={() => setSelectedAsset(asset)}
                                        className="flex items-center justify-center gap-1.5 py-2 bg-transparent border border-white/20 hover:border-white hover:bg-white/5 text-white rounded text-[9px] font-bold tracking-widest transition-colors"
                                    >
                                        <Settings size={10} /> CONFIG
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* MODAL INTEGRATION */}
                {selectedAsset && (
                    <AssetModal
                        isOpen={!!selectedAsset}
                        onClose={() => { setSelectedAsset(null); loadData(); }} // Refresh on close
                        assetId={selectedAsset.id}
                        projectId={projectId}
                        assetType={selectedAsset.type}
                        assetName={selectedAsset.name}
                        currentData={selectedAsset}
                        // These props are needed by your modal implementation
                        mode="generate"
                        setMode={() => { }}
                        genPrompt={selectedAsset.prompt || ""}
                        setGenPrompt={() => { }}
                        isProcessing={false} // Managed inside modal for generation
                        genre="cinematic" // You can fetch this from project details if needed
                        style="realistic"
                        onUpload={() => { }} // Implement if needed
                        onGenerate={() => { }} // Implement inside modal or pass handler
                        onUpdateTraits={async (traits: any) => {
                            // Basic implementation to satisfy prop requirement
                            // Real update logic should be in api call inside modal
                        }}
                        onLinkVoice={async () => { }}
                        styles={{ modal: { background: '#090909', border: '1px solid #222', borderRadius: '12px' } }}
                    />
                )}
            </div>
        </StudioLayout>
    );
}

// --- SUB-COMPONENTS ---
const TabButton = ({ active, onClick, icon, label }: any) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded text-[10px] font-bold tracking-widest transition-all ${active ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-500 hover:text-white"
            }`}
    >
        {icon} {label}
    </button>
);