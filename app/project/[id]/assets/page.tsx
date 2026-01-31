"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowRight, Users, MapPin, Sparkles, Loader2, Plus,
    Database, Aperture, Search, LayoutGrid, ArrowLeft, Terminal
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";

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
import { AssetCard } from "@/components/AssetCard";

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

            setAssets({
                characters: typedCharacters,
                locations: typedLocations
            });

            setProject(projectData);
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
            const allAssets = [...assets.characters, ...assets.locations];
            const freshAsset = allAssets.find(a => a.id === selectedAsset.id);
            if (freshAsset && freshAsset.image_url !== selectedAsset.image_url) {
                setSelectedAsset(freshAsset);
            }
        }
    }, [assets]);

    const calculateProgress = () => {
        const all = [...assets.characters, ...assets.locations];
        if (all.length === 0) return 0;
        const visualsDone = all.filter(a => a.image_url).length;
        return Math.round((visualsDone / all.length) * 100);
    };

    // --- ACTIONS ---

    const handleOpenDraft = () => {
        const type = activeTab === 'cast' ? 'character' : 'location';
        const draftAsset: any = {
            id: "new",
            type: type,
            name: "",
            project_id: projectId,
            status: "pending",
            visual_traits: {},
            voice_config: {}
        };
        setGenPrompt("");
        setSelectedAsset(draftAsset);
    };

    // --- UPDATED SAVE HANDLER ---
    // Returns the Asset object (Promise<Asset | void>)
    const handleSaveAsset = async (asset: Asset, data: any) => {
        try {
            if (asset.id === "new") {
                // Create Mode: Return the new asset so Modal can use the ID
                const res = await createAsset(projectId, { ...data, type: asset.type });
                const newAsset = { ...res.data.asset, type: asset.type };

                toast.success("ENTRY CREATED");

                // Update local state to switch from "new" to real ID
                setSelectedAsset(newAsset);
                loadData();
                return newAsset; // <--- RETURN THE ASSET

            } else {
                // Update Mode
                await updateAsset(projectId, asset.type, asset.id, data);
                toast.success("DATABASE UPDATED");
                loadData();
                return asset; // <--- RETURN THE ASSET
            }
        } catch (e) {
            console.error(e);
            toast.error("SAVE FAILED");
            throw e; // Throw so modal knows it failed
        }
    };

    const handleDelete = async (id: string, type: string) => {
        if (!confirm("CONFIRM DELETION?")) return;
        try {
            await deleteAsset(projectId, type, id);
            setAssets(prev => ({
                ...prev,
                [type === 'character' ? 'characters' : 'locations']: prev[type === 'character' ? 'characters' : 'locations'].filter(a => a.id !== id)
            }));
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
            const requestType = activeTab === 'cast' ? 'characters' : 'locations';

            let finalPrompt = customPrompt;
            if (!finalPrompt) {
                if (asset.type === 'location') {
                    finalPrompt = constructLocationPrompt(asset.name, (asset as any).visual_traits, (asset as any).visual_traits, (project as any)?.genre || "cinematic", project?.moodboard?.lighting || "realistic");
                } else {
                    finalPrompt = constructCharacterPrompt(asset.name, (asset as any).visual_traits, (asset as any).visual_traits, (project as any)?.genre || "cinematic", project?.moodboard?.lighting || "realistic");
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
        const type = activeTab === 'cast' ? 'character' : 'location';
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
        const targetList = activeTab === 'cast' ? assets.characters : assets.locations;
        const pending = targetList.filter(a => !a.image_url);
        if (pending.length === 0) {
            toast.success("ALL SYSTEMS READY");
            return;
        }
        toast.loading(`BATCH PROCESSING ${pending.length} ITEMS...`);
        await Promise.all(pending.map(asset => handleGenerate(asset)));
    };

    const displayedAssets = activeTab === 'cast' ? assets.characters : assets.locations;

    return (
        <div className="fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col">

            {/* --- CSS OVERRIDES FOR ASSET CARDS --- */}
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
                .action-btn {
                    background-color: #DC2626 !important;
                    border: 1px solid #DC2626 !important;
                    color: white !important;
                    text-transform: uppercase;
                    font-weight: 800;
                    letter-spacing: 1px;
                }
                .action-btn:hover { background-color: #B91C1C !important; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #333; }
            `}</style>

            {/* --- HEADER --- */}
            <header className="h-20 border-b border-[#222] bg-[#080808] flex items-center justify-between px-8 shrink-0 z-50">
                <div className="flex items-center gap-8">
                    <Link href={`/project/${projectId}/script`} className="flex items-center gap-2 text-[#666] hover:text-white transition-colors group">
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Return</span>
                    </Link>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <Database size={16} className="text-red-600" />
                            <h1 className="text-xl font-display font-bold uppercase text-white tracking-tight leading-none">
                                ASSET DEPOT
                            </h1>
                        </div>
                        <div className="text-[10px] font-mono text-[#555] uppercase tracking-widest">
                            {project?.title || "PROJECT LOADING..."}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <div className="text-[10px] font-mono text-[#666] mb-1 uppercase tracking-widest">
                            VISUALIZATION: <span className="text-white">{calculateProgress()}%</span>
                        </div>
                        <div className="w-32 h-1 bg-[#222]">
                            <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${calculateProgress()}%` }} />
                        </div>
                    </div>

                    <div className="h-8 w-[1px] bg-[#222]" />

                    <button
                        onClick={() => router.push(`/project/${projectId}/studio`)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#111] border border-[#333] hover:border-white text-[10px] font-bold tracking-widest uppercase transition-colors text-white"
                    >
                        ENTER STUDIO <ArrowRight size={14} />
                    </button>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex overflow-hidden relative z-40">

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

                <div className="flex-1 bg-[#020202] flex flex-col relative">
                    <div className="h-12 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#555] uppercase tracking-widest">
                            <LayoutGrid size={14} />
                            {activeTab === 'cast' ? 'Character Manifest' : 'Environment Database'}
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
                    genre={(project as any)?.genre || "cinematic"}
                    style={project?.moodboard?.lighting || "realistic"}
                    onUpload={() => { }}
                    onUpdateTraits={(data) => handleSaveAsset(selectedAsset, data)} // Now returns Promise<Asset>
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
        </div>
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