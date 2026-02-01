"use client";

import React, { useState, useEffect } from "react";
import {
    X, Check, Layers, FileText, Loader2, ChevronRight,
    Search, Database, ArrowRight, AlertCircle
} from "lucide-react";

// --- TYPES ---
export interface ContextReference {
    id: string; // scene_id
    sourceLabel: string; // "Ep 1 • Sc 2"
    header: string;
    summary: string;
}

interface ContextSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selected: ContextReference[]) => void;

    // Data Sources
    episodes: any[];
    // The Lazy Loader: The parent page will provide the function to fetch scenes
    onFetchScenes: (episodeId: string) => Promise<any[]>;

    // Pre-selection (if re-opening the modal)
    initialSelection?: ContextReference[];
}

export const ContextSelectorModal: React.FC<ContextSelectorModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    episodes,
    onFetchScenes,
    initialSelection = []
}) => {
    // --- STATE ---
    const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
    const [sceneCache, setSceneCache] = useState<Record<string, any[]>>({});
    const [loadingEp, setLoadingEp] = useState<string | null>(null);

    // The "Shopping Cart" of context
    const [selectedRefs, setSelectedRefs] = useState<ContextReference[]>(initialSelection);

    // --- 1. INITIALIZE ---
    // Auto-select first episode if available and nothing selected
    useEffect(() => {
        if (isOpen && episodes.length > 0 && !activeEpisodeId) {
            setActiveEpisodeId(episodes[0].id);
        }
    }, [isOpen, episodes]);

    // --- 2. LAZY LOAD SCENES ---
    useEffect(() => {
        if (!activeEpisodeId) return;
        if (sceneCache[activeEpisodeId]) return; // Already cached

        const load = async () => {
            setLoadingEp(activeEpisodeId);
            try {
                const fetchedScenes = await onFetchScenes(activeEpisodeId);
                setSceneCache(prev => ({ ...prev, [activeEpisodeId]: fetchedScenes }));
            } catch (e) {
                console.error("Failed to load scenes for context", e);
            } finally {
                setLoadingEp(null);
            }
        };
        load();
    }, [activeEpisodeId]);

    // --- HANDLERS ---

    const toggleSelection = (scene: any, episode: any) => {
        const alreadySelected = selectedRefs.find(r => r.id === scene.id);

        if (alreadySelected) {
            // Remove
            setSelectedRefs(prev => prev.filter(r => r.id !== scene.id));
        } else {
            // Add
            // Sanitize header logic same as workstation
            const header = scene.slugline || scene.header || "UNKNOWN SCENE";
            const summary = scene.synopsis || scene.summary || "";

            const newRef: ContextReference = {
                id: scene.id,
                sourceLabel: `EP ${episode.episode_number || '?'} • SC ${scene.scene_number}`,
                header: header,
                summary: summary
            };
            setSelectedRefs(prev => [...prev, newRef]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">

            {/* MAIN CONTAINER */}
            <div className="w-[900px] h-[600px] bg-[#050505] border border-[#222] flex flex-col shadow-2xl shadow-black relative overflow-hidden">

                {/* HEADER */}
                <div className="h-16 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        <Database size={16} className="text-red-600" />
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest leading-none">Context Matrix</h2>
                            <span className="text-[10px] text-[#555] font-mono">SELECT REFERENCES FOR AI MEMORY</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center hover:bg-[#151515] text-[#666] hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* CONTENT ROW */}
                <div className="flex-1 flex overflow-hidden">

                    {/* LEFT: EPISODE LIST (Master) */}
                    <div className="w-[280px] border-r border-[#222] bg-[#050505] flex flex-col">
                        <div className="p-3 border-b border-[#222] bg-[#0A0A0A]">
                            <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                                <Layers size={12} /> Project Reels
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {episodes.length === 0 && (
                                <div className="p-4 text-[10px] text-[#444] font-mono text-center">
                                    No active reels found.
                                </div>
                            )}
                            {episodes.map((ep) => (
                                <button
                                    key={ep.id}
                                    onClick={() => setActiveEpisodeId(ep.id)}
                                    className={`w-full text-left px-4 py-3 border transition-all flex items-center justify-between group
                                    ${activeEpisodeId === ep.id
                                            ? "bg-[#111] border-[#333] border-l-2 border-l-red-600 text-white"
                                            : "bg-transparent border-transparent text-[#666] hover:bg-[#0E0E0E] hover:text-[#CCC]"}`}
                                >
                                    <div>
                                        <div className="text-[9px] font-mono opacity-50 mb-1">REEL {String(ep.episode_number || 0).padStart(2, '0')}</div>
                                        <div className="text-xs font-bold uppercase truncate max-w-[180px]">{ep.title || "Untitled Reel"}</div>
                                    </div>
                                    {activeEpisodeId === ep.id && <ChevronRight size={14} className="text-red-600" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: SCENE LIST (Detail) */}
                    <div className="flex-1 bg-[#020202] flex flex-col relative">

                        {/* FIX: Loader logic now strictly checks if activeEpisodeId exists to avoid null===null infinite state */}
                        {activeEpisodeId && loadingEp === activeEpisodeId && (
                            <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                                <Loader2 className="animate-spin text-red-600" />
                            </div>
                        )}

                        <div className="p-3 border-b border-[#222] bg-[#0A0A0A] flex justify-between items-center">
                            <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                                <FileText size={12} /> Scene Data
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-[#444] font-mono">
                                {sceneCache[activeEpisodeId || ""]?.length || 0} SCENES DETECTED
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {activeEpisodeId && sceneCache[activeEpisodeId] ? (
                                sceneCache[activeEpisodeId].map((scene) => {
                                    const isSelected = selectedRefs.some(r => r.id === scene.id);
                                    // Robust header fallback
                                    const header = scene.slugline || scene.header || scene.title || "UNKNOWN SCENE";
                                    const summary = scene.synopsis || scene.summary || "";

                                    return (
                                        <div
                                            key={scene.id}
                                            onClick={() => toggleSelection(scene, episodes.find(e => e.id === activeEpisodeId))}
                                            className={`p-4 border transition-all cursor-pointer flex gap-4 group
                                            ${isSelected
                                                    ? "bg-[#0A0A0A] border-green-900/50 shadow-[inset_0_0_20px_rgba(20,83,45,0.1)]"
                                                    : "bg-[#050505] border-[#151515] hover:border-[#333] hover:bg-[#080808]"}`}
                                        >
                                            {/* Checkbox Visual */}
                                            <div className={`w-5 h-5 rounded-sm border flex items-center justify-center shrink-0 mt-0.5 transition-colors
                                                ${isSelected ? "bg-green-600 border-green-600" : "border-[#333] group-hover:border-[#555]"}`}
                                            >
                                                {isSelected && <Check size={12} className="text-black stroke-[4]" />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-bold uppercase tracking-wider truncate ${isSelected ? "text-white" : "text-[#888]"}`}>
                                                        {header}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-[#444] bg-[#111] px-1.5 py-0.5 rounded-sm">
                                                        SC {String(scene.scene_number).padStart(2, '0')}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-[#555] line-clamp-2 font-mono leading-relaxed group-hover:text-[#777]">
                                                    {summary || "No description available."}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-30">
                                    <ArrowRight size={24} className="mb-2" />
                                    <span className="text-xs font-mono">SELECT A REEL TO BROWSE</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="h-16 border-t border-[#222] bg-[#050505] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="text-[10px] font-bold text-[#666] uppercase tracking-widest">
                            Selection: <span className="text-white">{selectedRefs.length} items</span>
                        </div>
                        {selectedRefs.length > 0 && (
                            <div className="flex gap-1">
                                {selectedRefs.slice(0, 3).map(r => (
                                    <span key={r.id} className="text-[9px] font-mono bg-[#151515] border border-[#333] px-2 py-1 rounded-sm text-[#888] truncate max-w-[100px]">
                                        {r.sourceLabel}
                                    </span>
                                ))}
                                {selectedRefs.length > 3 && (
                                    <span className="text-[9px] font-mono bg-[#151515] border border-[#333] px-2 py-1 rounded-sm text-[#888]">
                                        +{selectedRefs.length - 3}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 border border-[#333] text-[10px] font-bold text-[#666] hover:text-white hover:bg-[#111] uppercase tracking-widest transition-all rounded-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { onConfirm(selectedRefs); onClose(); }}
                            className="px-8 py-2.5 bg-white text-black hover:bg-gray-200 border border-transparent text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm flex items-center gap-2"
                        >
                            <Check size={14} /> Confirm Selection
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};