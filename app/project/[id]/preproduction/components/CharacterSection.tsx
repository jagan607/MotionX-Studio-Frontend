"use client";

import React, { useState } from "react";
import { CharacterProfile, Project, Scene } from "@/lib/types";
import { CreativeBlock } from "./CreativeBlock";
import { api, updateAsset, deleteAsset, triggerAssetGeneration } from "@/lib/api";
import { AssetModal } from "@/components/AssetModal";
import { useMediaViewer, MediaItem } from "@/app/context/MediaViewerContext";
import { toast } from "react-hot-toast";
import { Loader2, Plus } from "lucide-react";

interface CharacterSectionProps {
    project: Project;
    characters: CharacterProfile[];
    onRefresh: () => void;
}

export function CharacterSection({ project, characters, onRefresh }: CharacterSectionProps) {
    const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});

    // Modal & Lightbox State
    const [selectedAsset, setSelectedAsset] = useState<CharacterProfile | null>(null);
    const { openViewer } = useMediaViewer();
    const [genPrompt, setGenPrompt] = useState("");

    // --- ACTIONS ---
    const handleSaveAsset = async (asset: CharacterProfile, data: any) => {
        try {
            await updateAsset(project.id, 'character', asset.id, data);
            toast.success("Character Updated");
            onRefresh();
            setSelectedAsset(prev => prev ? { ...prev, ...data } : null);
            return { ...asset, ...data };
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Save Failed");
            throw e;
        }
    };

    const handleDelete = async (asset: CharacterProfile) => {
        if (!confirm(`Delete character "${asset.name}"?`)) return;
        try {
            await deleteAsset(project.id, 'character', asset.id);
            toast.success("Character Deleted");
            onRefresh();
        } catch (e: any) {
            toast.error("Deletion failed");
        }
    };

    const handleGenerateCustom = async (asset: CharacterProfile, prompt: string, useRef: boolean = true) => {
        setGeneratingMap(prev => ({ ...prev, [asset.id]: true }));
        try {
            const res = await triggerAssetGeneration(
                project.id,
                asset.id,
                'characters',
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
            type: 'character',
            visual_traits: {},
            created_at: new Date()
        } as unknown as CharacterProfile);
    };

    const handleGenerate = async (char: CharacterProfile) => {
        setGeneratingMap(prev => ({ ...prev, [char.id]: true }));
        try {
            const traits = char.visual_traits || {};
            const charType = (char as any).type || 'human';
            
            // Build trait parts, filtering out empty values
            const parts: string[] = [];
            if (charType !== 'human') parts.push(`${charType} character`);
            if (traits.age) parts.push(traits.age);
            if (traits.ethnicity) parts.push(traits.ethnicity);
            if (traits.build) parts.push(`${traits.build} build`);
            if (traits.hair) parts.push(traits.hair);
            if (traits.clothing) parts.push(`wearing ${traits.clothing}`);
            if (traits.distinguishing_features) parts.push(traits.distinguishing_features);
            if (traits.vibe) parts.push(traits.vibe);
            
            const traitStr = parts.filter(Boolean).join(', ');
            const promptStr = `Cinematic portrait of ${char.name}${traitStr ? `, ${traitStr}` : ''}. Dramatic lighting, sharp focus, photorealistic, 8k resolution, highly detailed.`;

            await api.post("/api/v1/asset/generate", {
                project_id: project.id,
                entity_id: char.id,
                entity_type: "character",
                custom_prompt: promptStr,
                use_image_ref: false,
            });
            toast.success(`Generating portrait for ${char.name}...`);
            onRefresh();
        } catch (error: any) {
            console.error("Generate error", error);
            toast.error(error.response?.data?.detail || "Generation failed");
        } finally {
            setGeneratingMap(prev => ({ ...prev, [char.id]: false }));
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
                    <h2 className="text-xl font-['Anton'] uppercase tracking-wide text-white mb-1">Cast & Characters</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-[2px] font-mono">
                        {characters.length} Extracted from Script
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-6" style={{ animation: 'fadeUp 0.6s ease both' }}>
                {characters.length === 0 ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                        <span className="text-white/20 text-xs font-mono uppercase tracking-widest">No Cast Extracted Yet</span>
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
                            <span className="text-[10px] font-bold tracking-widest text-white/50 group-hover:text-white uppercase">Add Character</span>
                        </div>
                        {characters.map(char => (
                            <CreativeBlock
                                key={char.id}
                                type="CHARACTER"
                                title={char.name}
                                subtitle={`${char.visual_traits?.age || ''} • ${char.visual_traits?.ethnicity || ''}`}
                                imageUrl={char.image_url}
                                imagePlaceholderIcon="user"
                                isGenerating={generatingMap[char.id] || char.status === 'processing' || char.status === 'generating'}
                                onGenerate={() => handleGenerate(char)}
                                onEdit={() => setSelectedAsset(char)}
                                onDelete={() => handleDelete(char)}
                                onUploadReference={() => setSelectedAsset(char)}
                                onImageClick={() => {
                                    if (char.image_url) {
                                        const mediaItems: MediaItem[] = characters.filter(c => c.image_url).map(c => ({
                                            id: c.id,
                                            type: 'image' as const,
                                            imageUrl: c.image_url!,
                                            title: c.name,
                                        }));
                                        const idx = mediaItems.findIndex(m => m.id === char.id);
                                        openViewer(mediaItems, idx >= 0 ? idx : 0);
                                    }
                                }}
                            >
                                <div className="mt-1 flex flex-col gap-1.5">
                                    <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2 line-clamp-2">
                                        {char.visual_traits?.vibe || ''}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {(char.visual_traits?.clothing || '').split(',').filter(Boolean).slice(0, 2).map((item, idx) => (
                                            <span key={idx} className="px-1.5 py-0.5 bg-[#D4A843]/10 text-[#D4A843] rounded text-[8px] font-mono uppercase tracking-widest truncate max-w-[100px] border border-[#D4A843]/20">
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
                    assetType="character"
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
                    onLinkVoice={async (v) => { await handleSaveAsset(selectedAsset, { voice_config: v }); }}
                />
            )}


        </div>
    );
}
