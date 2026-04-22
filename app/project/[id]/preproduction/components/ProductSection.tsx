"use client";

import React, { useState } from "react";
import { ProductProfile, Project } from "@/lib/types";
import { CreativeBlock } from "./CreativeBlock";
import { api, updateAsset, deleteAsset, triggerAssetGeneration } from "@/lib/api";
import { AssetModal } from "@/components/AssetModal";
import { useMediaViewer, MediaItem } from "@/app/context/MediaViewerContext";
import { toast } from "react-hot-toast";
import { Plus } from "lucide-react";

interface ProductSectionProps {
    project: Project;
    products: ProductProfile[];
    onRefresh: () => void;
}

export function ProductSection({ project, products, onRefresh }: ProductSectionProps) {
    const [generatingMap, setGeneratingMap] = useState<Record<string, boolean>>({});

    const isCommercial = project.type === "ad";
    const sectionTitle = isCommercial ? "Featured Products" : "Key Props & Objects";
    const entityLabel = isCommercial ? "Products" : "Props";

    // Modal & Lightbox State
    const [selectedAsset, setSelectedAsset] = useState<ProductProfile | null>(null);
    const { openViewer } = useMediaViewer();
    const [genPrompt, setGenPrompt] = useState("");

    // --- ACTIONS ---
    const handleSaveAsset = async (asset: ProductProfile, data: any) => {
        try {
            await updateAsset(project.id, 'product', asset.id, data);
            toast.success("Product Updated");
            onRefresh();
            setSelectedAsset(prev => prev ? { ...prev, ...data } : null);
            return { ...asset, ...data };
        } catch (e: any) {
            console.error(e);
            toast.error(e.response?.data?.detail || "Save Failed");
            throw e;
        }
    };

    const handleDelete = async (asset: ProductProfile) => {
        if (!confirm(`Delete product "${asset.name}"?`)) return;
        try {
            await deleteAsset(project.id, 'product', asset.id);
            toast.success("Product Deleted");
            onRefresh();
        } catch (e: any) {
            toast.error("Deletion failed");
        }
    };

    const handleGenerateCustom = async (asset: ProductProfile, prompt: string, useRef: boolean = true) => {
        setGeneratingMap(prev => ({ ...prev, [asset.id]: true }));
        try {
            const res = await triggerAssetGeneration(
                project.id,
                asset.id,
                'products',
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
            type: 'product',
            visual_traits: {},
            created_at: new Date()
        } as unknown as ProductProfile);
    };

    const handleGenerate = async (product: ProductProfile) => {
        setGeneratingMap(prev => ({ ...prev, [product.id]: true }));
        try {
            const desc = product.description || '';
            const category = product.category || 'object';
            const brand = product.brand_guidelines || '';
            // Using a simple object/product photography prompt
            const promptStr = `(commercial product photography, 8k, detailed layout, studio lighting) ${product.name}, a ${category}. ${desc}. ${brand ? `Brand aesthetic: ${brand}` : ''} High quality, sharp focus, photorealistic.`;

            await api.post("/api/v1/asset/generate", {
                project_id: project.id,
                entity_id: product.id,
                entity_type: "product",
                custom_prompt: promptStr,
                use_image_ref: false,
            });
            toast.success(`Generating image for ${product.name}...`);
            onRefresh();
        } catch (error: any) {
            console.error("Generate error", error);
            toast.error(error.response?.data?.detail || "Generation failed");
        } finally {
            setGeneratingMap(prev => ({ ...prev, [product.id]: false }));
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
                    <h2 className="text-xl font-['Anton'] uppercase tracking-wide text-white mb-1">{sectionTitle}</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-[2px] font-mono">
                        {products.length} {entityLabel} Extracted
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-6" style={{ animation: 'fadeUp 0.6s ease both' }}>
                {products.length === 0 ? (
                    <div className="w-full py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl">
                        <span className="text-white/20 text-xs font-mono uppercase tracking-widest">No {entityLabel} Extracted Yet</span>
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
                            <span className="text-[10px] font-bold tracking-widest text-white/50 group-hover:text-white uppercase">Add {isCommercial ? "Product" : "Prop"}</span>
                        </div>
                        {products.map(prod => (
                            <CreativeBlock
                                key={prod.id}
                                type="PRODUCT"
                                title={prod.name}
                                subtitle={prod.category || "Item"}
                                imageUrl={prod.image_url}
                                imagePlaceholderIcon="product"
                                isGenerating={generatingMap[prod.id] || prod.status === 'processing' || prod.status === 'generating'}
                                onGenerate={() => handleGenerate(prod)}
                                onEdit={() => setSelectedAsset(prod)}
                                onDelete={() => handleDelete(prod)}
                                onUploadReference={() => setSelectedAsset(prod)}
                                onImageClick={() => {
                                    if (prod.image_url) {
                                        const mediaItems: MediaItem[] = products.filter(p => p.image_url).map(p => ({
                                            id: p.id,
                                            type: 'image' as const,
                                            imageUrl: p.image_url!,
                                            title: p.name,
                                        }));
                                        const idx = mediaItems.findIndex(m => m.id === prod.id);
                                        openViewer(mediaItems, idx >= 0 ? idx : 0);
                                    }
                                }}
                            >
                                <div className="mt-1 flex flex-col gap-1.5">
                                    {prod.description && (
                                        <div className="text-[9px] text-white/40 uppercase tracking-wider mb-2 line-clamp-2">
                                            {prod.description}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                        {(prod.brand_guidelines || '').split(',').filter(Boolean).slice(0, 2).map((item, idx) => (
                                            <span key={idx} className="px-1.5 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded text-[8px] font-mono uppercase tracking-widest truncate max-w-[100px] border border-[#10B981]/20">
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
                    assetType="product"
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


        </div>
    );
}
