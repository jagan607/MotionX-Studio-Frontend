"use client";

import React, { useState } from "react";
import { LocationProfile, Project } from "@/lib/types";
import { CreativeBlock } from "./CreativeBlock";
import { api, updateAsset, deleteAsset, triggerAssetGeneration } from "@/lib/api";
import { AssetModal } from "@/components/AssetModal";
import { Lightbox } from "./Lightbox";
import { toast } from "react-hot-toast";
import { Plus } from "lucide-react";

interface LocationSectionProps {
    project: Project;
    locations: LocationProfile[];
    onRefresh: () => void;
}

export function LocationSection({ project, locations, onRefresh }: LocationSectionProps) {
    const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});

    // Modal & Lightbox State
    const [selectedAsset, setSelectedAsset] = useState<LocationProfile | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [genPrompt, setGenPrompt] = useState("");

    // --- ACTIONS ---
    const handleSaveAsset = async (asset: LocationProfile, data: any) => {
        try {
            await updateAsset(project.id, 'location', asset.id, data);
            toast.success("Location Updated");
            onRefresh();
            setSelectedAsset(prev => prev ? { ...prev, ...data } : null);
            return { ...asset, ...data };
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Save Failed");
            throw e;
        }
    };

    const handleDelete = async (asset: LocationProfile) => {
        if (!confirm(`Delete location "${asset.name}"?`)) return;
        try {
            await deleteAsset(project.id, 'location', asset.id);
            toast.success("Location Deleted");
            onRefresh();
        } catch (e: any) {
            toast.error("Deletion failed");
        }
    };

    const handleGenerateCustom = async (asset: LocationProfile, prompt: string, useRef: boolean = true) => {
        setGeneratingMap(prev => ({ ...prev, [asset.id]: true }));
        try {
            const res = await triggerAssetGeneration(
                project.id,
                asset.id,
                'locations',
                prompt,
                project.moodboard || {},
                project.aspect_ratio || "16:9",
                useRef
            );
            toast.success("Visual Generated");
            setTimeout(onRefresh, 1000);
            return res.image_url;
        } catch (e) {
            console.error(e);
            toast.error("Generation Failed");
        } finally {
            setGeneratingMap(prev => ({ ...prev, [asset.id]: false }));
        }
    };

    const handleCreateNew = () => {
        setSelectedAsset({
            id: 'new',
            project_id: project.id,
            name: '',
            status: 'draft',
            type: 'location',
            visual_traits: {},
            created_at: new Date()
        } as unknown as LocationProfile);
    };

    const handleGenerate = async (loc: LocationProfile) => {
        setGeneratingMap(prev => ({ ...prev, [loc.id]: true }));
        try {
            const terrain = loc.visual_traits?.terrain || '';
            const atmosphere = loc.visual_traits?.atmosphere || '';
            const lighting = loc.visual_traits?.lighting || '';
            const keywords = loc.visual_traits?.keywords || '';
            const promptStr = `(landscape, architecture, scenery, photography) RAW photo, cinematic establishing shot of ${loc.name}, ${terrain}, ${atmosphere}, ${lighting}, ${keywords}. High quality, 8k resolution, highly detailed, photorealistic, dramatic lighting, sharp focus.`;

            await api.post("/api/v1/asset/generate", {
                project_id: project.id,
                entity_id: loc.id,
                entity_type: "location",
                custom_prompt: promptStr,
                use_image_ref: false,
            });
            toast.success(`Generating establishing shot for ${loc.name}...`);
            onRefresh();
        } catch (error: any) {
            console.error("Generate error", error);
            toast.error(error.response?.data?.detail || "Generation failed");
        } finally {
            setGeneratingMap(prev => ({ ...prev, [loc.id]: false }));
        }
    };

    return (
        <div className="w-full h-full p-8 flex flex-col gap-8">
            <style jsx>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-['Anton'] uppercase tracking-wide text-white mb-1">Locations & Sets</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-[2px] font-mono">
                        {locations.length} Extracted from Script
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-6" style={{ animation: 'fadeUp 0.6s ease both' }}>
                {locations.length === 0 ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                        <span className="text-white/20 text-xs font-mono uppercase tracking-widest">No Locations Extracted Yet</span>
                    </div>
                ) : (
                    <>
                        <div
                            onClick={handleCreateNew}
                            className="group relative w-[240px] h-full min-h-[280px] flex flex-col items-center justify-center bg-[#080808]/50 border border-dashed border-white/[0.08] rounded-xl cursor-pointer hover:bg-white/[0.02] hover:border-white/[0.2] transition-colors"
                        >
                            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center mb-3 transition-colors">
                                <Plus size={20} className="text-white/50 group-hover:text-white" />
                            </div>
                            <span className="text-[10px] font-bold tracking-widest text-white/50 group-hover:text-white uppercase">Add Location</span>
                        </div>
                        {locations.map(loc => (
                            <CreativeBlock
                                key={loc.id}
                                type="LOCATION"
                                title={loc.name}
                                subtitle={loc.visual_traits?.atmosphere || ''}
                                imageUrl={loc.image_url}
                                imagePlaceholderIcon="location"
                                isGenerating={generatingMap[loc.id] || loc.status === 'processing' || loc.status === 'generating'}
                                onGenerate={() => handleGenerate(loc)}
                                onEdit={() => setSelectedAsset(loc)}
                                onDelete={() => handleDelete(loc)}
                                onUploadReference={() => setSelectedAsset(loc)}
                                onImageClick={() => loc.image_url && setLightboxUrl(loc.image_url)}
                            >
                                <div className="mt-1 flex flex-col gap-1.5">
                                    <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2 line-clamp-2">
                                        {loc.visual_traits?.terrain || ''}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {(loc.visual_traits?.lighting || '').split(',').filter(Boolean).slice(0, 2).map((item, idx) => (
                                            <span key={idx} className="px-1.5 py-0.5 bg-[#4A90E2]/10 text-[#4A90E2] rounded text-[8px] font-mono uppercase tracking-widest truncate max-w-[100px] border border-[#4A90E2]/20">
                                                {item.trim()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </CreativeBlock>
                        ))}
                    </>
                )}
            </div>

            {/* MODALS */}
            {selectedAsset && (
                <AssetModal
                    isOpen={!!selectedAsset}
                    onClose={() => setSelectedAsset(null)}
                    projectId={project.id}
                    assetId={selectedAsset.id}
                    assetName={selectedAsset.name}
                    assetType="location"
                    currentData={selectedAsset}
                    mode="upload"
                    setMode={() => { }}
                    genPrompt={genPrompt}
                    setGenPrompt={setGenPrompt}
                    isProcessing={generatingMap[selectedAsset.id] || false}
                    genre={project.genre || ""}
                    style={project.moodboard?.lighting || ""}
                    onUpload={() => { }} // Main upload handled inside
                    onUpdateTraits={(data) => handleSaveAsset(selectedAsset, data)}
                    onGenerate={(prompt, useRef) => handleGenerateCustom(selectedAsset, prompt, useRef)}
                    onLinkVoice={async () => { }}
                />
            )}

            <Lightbox
                imageUrl={lightboxUrl}
                title={locations.find(c => c.image_url === lightboxUrl)?.name || "Location"}
                onClose={() => setLightboxUrl(null)}
            />
        </div>
    );
}
