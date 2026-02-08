"use client";

import React, { useState, useEffect } from "react";
import {
    Cpu, MapPin, Users, Terminal, Plus, Loader2, Sparkles, X,
    PlayCircle, Activity, Save, FileText
} from "lucide-react";
import { WorkstationScene, Character } from "./ScriptWorkstation";
import { ContextReference } from "./ContextSelectorModal";

interface DirectorConsoleProps {
    activeScene: WorkstationScene | null;
    availableCharacters: Character[];
    selectedContext: ContextReference[];
    isProcessing: boolean;

    // Handlers
    onUpdateCast?: (sceneId: string, newCast: string[]) => void;
    onUpdateScene?: (sceneId: string, updates: Partial<WorkstationScene>) => void; // NEW: Persistence Handler
    onExecuteAi: (instruction: string) => void;
    onOpenContextModal: () => void;
    onRemoveContextRef: (id: string) => void;
    onCancelSelection: () => void;
}

export const DirectorConsole: React.FC<DirectorConsoleProps> = ({
    activeScene, availableCharacters, selectedContext, isProcessing,
    onUpdateCast, onUpdateScene, onExecuteAi, onOpenContextModal, onRemoveContextRef, onCancelSelection
}) => {
    const [instruction, setInstruction] = useState("");

    // NEW: Local State for Manual Edits
    const [header, setHeader] = useState("");
    const [summary, setSummary] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // Sync state when activeScene changes (Reset dirty state)
    useEffect(() => {
        if (activeScene) {
            setHeader(activeScene.header || activeScene.slugline || "");
            setSummary(activeScene.summary || activeScene.synopsis || "");
            setInstruction("");
            setIsDirty(false);
        }
    }, [activeScene?.id]);

    // Update Local State Handlers
    const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHeader(e.target.value);
        setIsDirty(true);
    };

    const handleSummaryChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setSummary(e.target.value);
        setIsDirty(true);
    };

    // Commit Changes to Parent
    const handleSaveChanges = () => {
        if (!activeScene || !onUpdateScene) return;
        onUpdateScene(activeScene.id, {
            header: header,
            slugline: header, // Sync both fields just in case
            summary: summary,
            synopsis: summary
        });
        setIsDirty(false);
    };

    const activeCastList = activeScene?.cast_ids || activeScene?.characters || [];

    const handleAddCharacter = (charId: string) => {
        if (!activeScene || !onUpdateCast) return;
        if (!activeCastList.includes(charId)) {
            onUpdateCast(activeScene.id, [...activeCastList, charId]);
        }
    };

    const handleRemoveCharacter = (charId: string) => {
        if (!activeScene || !onUpdateCast) return;
        onUpdateCast(activeScene.id, activeCastList.filter((id: string) => id !== charId));
    };

    if (!activeScene) {
        return (
            <div className="w-[400px] bg-[#080808] flex flex-col shrink-0 border-l border-[#222] h-full">
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 gap-4">
                    <div className="w-16 h-16 rounded-full border border-[#333] flex items-center justify-center bg-[#0A0A0A]">
                        <PlayCircle size={24} className="text-[#666]" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-1">System Idle</div>
                        <div className="text-[10px] font-mono text-[#444]">SELECT A SCENE TO MODIFY</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-[400px] bg-[#080808] flex flex-col shrink-0 border-l border-[#222] h-full">
            {/* HEADER */}
            <div className="h-14 border-b border-[#222] bg-[#080808] flex items-center justify-between px-6 shrink-0">
                <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest flex items-center gap-2">
                    <Cpu size={12} /> Director Console
                </div>
                <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-500 animate-pulse' : 'bg-green-900'}`} />
            </div>

            <div className="flex-1 p-6 flex flex-col overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-[#222] scrollbar-track-transparent">

                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">

                    {/* 1. SCENE HEADER EDITOR */}
                    <div className="p-4 border border-[#222] bg-[#0C0C0C] rounded-sm relative group transition-colors focus-within:border-[#444]">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[9px] font-mono text-red-500 uppercase">
                                Target Locked: SCENE {String(activeScene.scene_number).padStart(2, '0')}
                            </div>

                            {/* SAVE BUTTON (Only visible when dirty) */}
                            {isDirty && (
                                <button
                                    onClick={handleSaveChanges}
                                    className="flex items-center gap-1 text-[9px] font-bold bg-green-900/20 text-green-500 px-2 py-1 rounded-sm border border-green-900/30 hover:bg-green-900/40 transition-all animate-pulse"
                                >
                                    <Save size={10} /> SAVE CHANGES
                                </button>
                            )}
                        </div>

                        {/* Editable Header Input */}
                        <div className="relative">
                            <MapPin size={12} className="absolute top-1/2 -translate-y-1/2 left-0 text-[#555]" />
                            <input
                                type="text"
                                value={header}
                                onChange={handleHeaderChange}
                                className="w-full bg-transparent text-sm font-bold text-white uppercase tracking-wider pl-5 py-1 border-b border-transparent focus:border-red-600 focus:outline-none placeholder:text-[#333] transition-colors"
                                placeholder="INT. LOCATION - TIME"
                            />
                        </div>
                    </div>

                    {/* 2. SUMMARY EDITOR (NEW) */}
                    <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#888] uppercase mb-2">
                            <div className="flex items-center gap-2">
                                <FileText size={12} /> Scene Description
                            </div>
                            {isDirty && <span className="text-[8px] text-yellow-600 font-mono">* Unsaved</span>}
                        </div>
                        <textarea
                            value={summary}
                            onChange={handleSummaryChange}
                            placeholder="Write scene description..."
                            className="w-full h-32 bg-[#111] border border-[#222] text-xs text-[#CCC] p-3 rounded-sm focus:outline-none focus:border-[#444] resize-none leading-relaxed font-serif placeholder:text-[#333]"
                        />
                    </div>

                    {/* 3. CAST MANAGER */}
                    <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#888] uppercase mb-2">
                            <span className="flex items-center gap-2"><Users size={12} /> Scene Cast</span>
                            <span className="text-[9px] text-[#444]">{activeCastList.length} Active</span>
                        </div>
                        <div className="p-3 bg-[#111] border border-[#222] rounded-sm flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                                {activeCastList.map((charId: string) => (
                                    <div key={charId} className="flex items-center gap-1.5 px-2 py-1 bg-green-900/10 border border-green-900/30 text-green-500 text-[10px] font-bold uppercase rounded-sm group">
                                        <span>{charId.replace(/_/g, " ")}</span>
                                        <button onClick={() => handleRemoveCharacter(charId)} className="hover:text-white transition-colors"><X size={10} /></button>
                                    </div>
                                ))}
                                {activeCastList.length === 0 && <span className="text-[10px] text-[#444] italic py-1">No characters assigned.</span>}
                            </div>
                            {onUpdateCast && (
                                <select
                                    className="w-full bg-[#080808] border border-[#333] text-[#888] text-[10px] p-2 rounded-sm outline-none focus:border-[#555] cursor-pointer uppercase"
                                    onChange={(e) => { if (e.target.value) { handleAddCharacter(e.target.value); e.target.value = ""; } }}
                                    value=""
                                >
                                    <option value="" disabled>+ Add Character...</option>
                                    {availableCharacters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                                </select>
                            )}
                        </div>
                    </div>

                    {/* 4. AI PROMPT (Moved to bottom) */}
                    <div className="flex-1 flex flex-col border-t border-[#222] pt-6">
                        <div className="flex items-center justify-between text-[10px] font-bold text-[#888] uppercase mb-2">
                            <span className="flex items-center gap-2"><Terminal size={12} /> Context Aware Rewrite</span>
                            <button onClick={onOpenContextModal} className="text-red-500 hover:text-white flex items-center gap-1 transition-colors"><Plus size={10} /> Add Reference</button>
                        </div>

                        {/* Context Pills */}
                        {selectedContext.length > 0 && (
                            <div className="p-2 bg-[#111] border border-[#222] rounded-sm mb-2 max-h-[80px] overflow-y-auto flex flex-wrap gap-2">
                                {selectedContext.map(ref => (
                                    <div key={ref.id} className="flex items-center gap-1 px-2 py-1 bg-[#1A1A1A] border border-[#333] text-[#AAA] text-[9px] rounded-sm group hover:border-[#555]">
                                        <span>{ref.sourceLabel}</span>
                                        <button onClick={() => onRemoveContextRef(ref.id)} className="hover:text-red-500"><X size={8} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <textarea
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="// Enter AI commands to rewrite..."
                            className="w-full flex-1 p-4 text-xs resize-none rounded-sm placeholder:text-[#444] min-h-[100px] bg-[rgba(10,10,10,0.5)] border border-[#333] text-[#EEE] font-mono focus:outline-none focus:border-red-600 focus:bg-[rgba(20,20,20,0.8)]"
                        />
                        <div className="flex gap-2 pt-4">
                            <button onClick={() => onExecuteAi(instruction)} disabled={isProcessing || !instruction.trim()} className="flex-1 py-3 bg-red-600 text-white uppercase font-bold text-[10px] tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed border border-red-500">
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                EXECUTE REWRITE
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className="p-4 border-t border-[#222] bg-[#050505] shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[9px] font-mono text-[#444]"><Activity size={10} /> AI_ENGINE_V2: READY</div>
                    {isDirty && <span className="text-[9px] font-bold text-yellow-600 animate-pulse">UNSAVED CHANGES</span>}
                </div>
            </div>
        </div>
    );
};