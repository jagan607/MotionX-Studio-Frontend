"use client";

import React, { useEffect, useState } from "react";
import { Scene, Project } from "@/lib/types";
import { InputDeck } from "@/components/script/InputDeck";
import { CreativeBlock } from "./CreativeBlock";
import { GripVertical, Save, X } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "react-hot-toast";

interface ScriptSectionProps {
    project: Project;
    scenes: Scene[];
    activeEpisodeId: string | null;
    onUpdateProject: (p: Project) => void;
    onScenesUpdated: () => void;
    episodes?: any[];
}

export function ScriptSection({ project, scenes, activeEpisodeId, onUpdateProject, onScenesUpdated, episodes = [] }: ScriptSectionProps) {
    const hasScript = (project.script_status !== "empty" && project.script_status !== "pending") || scenes.length > 0 || episodes.some((ep: any) => ep.status === "draft_ready" || ep.status === "ready");

    const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
    const [editData, setEditData] = useState({ header: "", summary: "" });
    const [isSaving, setIsSaving] = useState(false);

    const startEdit = (scene: Scene) => {
        setEditingSceneId(scene.id);
        setEditData({ header: scene.header || "", summary: scene.summary || "" });
    };

    const handleSaveScene = async (sceneId: string) => {
        if (!activeEpisodeId) {
            toast.error("No active episode found");
            return;
        }
        setIsSaving(true);
        try {
            const sceneRef = doc(db, "projects", project.id, "episodes", activeEpisodeId, "scenes", sceneId);
            await updateDoc(sceneRef, {
                header: editData.header,
                summary: editData.summary
            });
            toast.success("Scene Updated");
            setEditingSceneId(null);
            onScenesUpdated();
        } catch (e: any) {
            console.error("Failed to update scene", e);
            toast.error("Update failed");
        } finally {
            setIsSaving(false);
        }
    };

    // When the script is ingested, the parent (page.tsx) will handle the router push 
    // or state update from `onScenesUpdated` or `onUpdateProject`.

    return (
        <div className="w-full h-full p-8 flex flex-col gap-8">
            <style jsx>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0% { opacity: 0.3; }
                    50% { opacity: 1; }
                    100% { opacity: 0.3; }
                }
            `}</style>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-['Anton'] uppercase tracking-wide text-white mb-1">Script & Scenes</h2>
                    <p className="text-[10px] text-white/40 uppercase tracking-[2px] font-mono">
                        {scenes.length > 0 ? `${scenes.length} Scenes Extracted` : "Ingest your script to begin"}
                    </p>
                </div>
            </div>

            {!hasScript ? (
                /* ── Ingestion Phase ── */
                <div className="max-w-2xl mx-auto w-full mt-10">
                    <InputDeck
                        projectId={project.id}
                        projectTitle={project.title}
                        projectType={project.type as any}
                        initialTitle={project.title}
                        onSuccess={() => {
                            // After ingest triggers success, parent component will refetch scenes
                            onScenesUpdated();
                        }}
                        onCancel={() => { }}
                    />
                </div>
            ) : (
                /* ── Canvas Phase (Scenes as Blocks) ── */
                <div className="flex flex-wrap gap-6" style={{ animation: 'fadeUp 0.6s ease both' }}>
                    {scenes.sort((a, b) => a.scene_number - b.scene_number).map((scene) => (
                        <CreativeBlock
                            key={scene.id}
                            type="SCRIPT"
                            title={`Scene ${scene.scene_number}`}
                            className={`bg-[#111] border-white/[0.05] ${editingSceneId === scene.id ? '!border-motion-red shadow-[0_0_30px_rgba(229,9,20,0.15)]' : ''}`}
                            onEdit={() => startEdit(scene)}
                        >
                            <div className="mt-3 flex flex-col gap-3">
                                {editingSceneId === scene.id ? (
                                    <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                                        <input
                                            value={editData.header}
                                            onChange={e => setEditData(prev => ({ ...prev, header: e.target.value }))}
                                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-[11px] font-bold text-white uppercase tracking-wider focus:outline-none focus:border-motion-red"
                                            placeholder="SCENE HEADER"
                                        />
                                        <textarea
                                            value={editData.summary}
                                            onChange={e => setEditData(prev => ({ ...prev, summary: e.target.value }))}
                                            className="w-full h-32 bg-black/50 border border-white/10 rounded px-3 py-2 text-[10px] text-white/70 leading-relaxed resize-none focus:outline-none focus:border-motion-red custom-scrollbar"
                                            placeholder="Scene Description..."
                                        />
                                        <div className="flex justify-end gap-2 mt-1">
                                            <button
                                                onClick={() => setEditingSceneId(null)}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 text-[9px] font-bold text-white/50 hover:text-white uppercase tracking-widest disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSaveScene(scene.id)}
                                                disabled={isSaving}
                                                className="px-3 py-1.5 bg-motion-red text-white text-[9px] font-bold uppercase tracking-widest rounded flex items-center gap-1.5 hover:bg-red-700 disabled:opacity-50 transition-colors"
                                            >
                                                <Save size={10} /> {isSaving ? "Saving..." : "Save"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Scene Header */}
                                        <div className="text-[11px] font-bold text-white/80 uppercase tracking-wider mb-1 line-clamp-2" title={scene.header}>
                                            {scene.header}
                                        </div>
                                        {/* Scene Summary */}
                                        <div className="text-[10px] text-white/50 leading-relaxed line-clamp-4" title={scene.summary}>
                                            {scene.summary}
                                        </div>
                                        {/* Meta tags */}
                                        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-white/[0.04]">
                                            {scene.characters && scene.characters.length > 0 && (
                                                <span className="text-[8px] font-mono text-[#D4A843] uppercase tracking-wider">{scene.characters.length} chars</span>
                                            )}
                                            {scene.location_id && (
                                                <span className="text-[8px] font-mono text-[#4A90E2] uppercase tracking-wider">Lctn Set</span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </CreativeBlock>
                    ))}

                    {scenes.length === 0 && (
                        <div className="w-full py-12 flex flex-col items-center gap-8">
                            {/* Skeleton scene cards */}
                            <div className="flex flex-wrap gap-6 w-full justify-center">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="w-[240px] rounded-xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden"
                                        style={{ animation: `fadeUp 0.5s ease ${i * 0.1}s both` }}>
                                        {/* Shimmer header bar */}
                                        <div className="h-8 bg-gradient-to-r from-white/[0.02] via-white/[0.06] via-white/[0.02] to-white/[0.02] bg-[length:200%_100%]"
                                            style={{ animation: 'shimmer 1.8s ease-in-out infinite' }} />
                                        <div className="p-4 space-y-3">
                                            {/* Title placeholder */}
                                            <div className="h-3 w-[60%] rounded bg-white/[0.04]"
                                                style={{ animation: 'shimmer 1.8s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                                            {/* Body lines */}
                                            <div className="space-y-2">
                                                <div className="h-2 w-full rounded bg-white/[0.03]"
                                                    style={{ animation: 'shimmer 1.8s ease-in-out infinite', animationDelay: `${i * 0.15 + 0.1}s` }} />
                                                <div className="h-2 w-[85%] rounded bg-white/[0.03]"
                                                    style={{ animation: 'shimmer 1.8s ease-in-out infinite', animationDelay: `${i * 0.15 + 0.2}s` }} />
                                                <div className="h-2 w-[45%] rounded bg-white/[0.03]"
                                                    style={{ animation: 'shimmer 1.8s ease-in-out infinite', animationDelay: `${i * 0.15 + 0.3}s` }} />
                                            </div>
                                            {/* Meta tags placeholder */}
                                            <div className="flex gap-2 pt-2 border-t border-white/[0.04]">
                                                <div className="h-2 w-12 rounded bg-[#D4A843]/10" />
                                                <div className="h-2 w-10 rounded bg-[#4A90E2]/10" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Status indicator */}
                            <div className="flex items-center gap-3">
                                <div className="relative w-4 h-4">
                                    <div className="absolute inset-0 rounded-full border border-white/[0.08]" />
                                    <div className="absolute inset-0 rounded-full border border-transparent border-t-[#E50914]/50 animate-spin" />
                                </div>
                                <span className="text-[9px] font-mono text-white/20 uppercase tracking-[3px]">
                                    Loading scenes
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
