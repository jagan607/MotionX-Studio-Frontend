"use client";

import React, { useState, useEffect } from "react";
import {
    MapPin, Users, Loader2, Sparkles, X,
    Save, Clock, AlertTriangle, Plus, Check
} from "lucide-react";
import { SceneData } from "@/components/studio/SceneCard"; // Use unified type
import { ContextReference } from "./ContextSelectorModal";

// Shared Location Interface
export interface LocationAsset {
    id: string;
    name: string;
}

interface DirectorConsoleProps {
    activeScene: SceneData | null;
    availableCharacters: { id: string; name: string }[];
    availableLocations?: LocationAsset[];
    selectedContext: ContextReference[];
    isProcessing: boolean;

    // Handlers
    onUpdateCast?: (sceneId: string, newCast: string[]) => void;
    onUpdateScene?: (sceneId: string, updates: Partial<SceneData>) => void;
    onExecuteAi: (instruction: string) => void;
    onOpenContextModal: () => void;
    onRemoveContextRef: (id: string) => void;
    onCancelSelection: () => void;
}

// --- HELPER: NORMALIZE STRING FOR MATCHING ---
const normalizeLoc = (str: string) => {
    if (!str) return "";
    return str
        .toUpperCase()
        .replace(/INT\.|EXT\.|I\/E\.|INT|EXT|I\/E/g, "") // Remove prefixes
        .replace(/[^A-Z0-9]/g, ""); // Remove non-alphanumeric (spaces, apostrophes)
};

export const DirectorConsole: React.FC<DirectorConsoleProps> = ({
    activeScene,
    availableCharacters,
    availableLocations = [],
    selectedContext,
    isProcessing,
    onUpdateCast,
    onUpdateScene,
    onExecuteAi,
    onOpenContextModal,
    onRemoveContextRef,
    onCancelSelection
}) => {
    const [instruction, setInstruction] = useState("");

    // Local State
    const [locationId, setLocationId] = useState("");
    const [timeOfDay, setTimeOfDay] = useState("DAY");
    const [summary, setSummary] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // --- 1. SMART SYNC EFFECT ---
    useEffect(() => {
        if (activeScene) {
            const rawHeader = activeScene.header || activeScene.slugline || "";

            // Extract Time (everything after the last dash)
            const parts = rawHeader.split("-");
            let parsedTime = "DAY";
            let rawLocName = rawHeader;

            if (parts.length > 1) {
                // Time is usually the last part
                parsedTime = parts[parts.length - 1].trim();
                // Location is everything before the time
                rawLocName = parts.slice(0, -1).join("-").trim();
            } else if (activeScene.time) {
                parsedTime = activeScene.time;
            }

            // --- SMART MATCHING LOGIC ---
            let foundId = "";

            // A. Direct ID Match (Best)
            if (activeScene.location_id && availableLocations.some(l => l.id === activeScene.location_id)) {
                foundId = activeScene.location_id;
            }
            // B. Fuzzy Name Match
            else {
                const normHeader = normalizeLoc(rawLocName);
                const match = availableLocations.find(l => normalizeLoc(l.name) === normHeader);
                if (match) foundId = match.id;
            }

            setLocationId(foundId); // If "" (empty), dropdown shows placeholder
            setTimeOfDay(parsedTime);
            setSummary(activeScene.summary || activeScene.synopsis || "");
            setInstruction("");
            setIsDirty(false);
        }
    }, [activeScene?.id, availableLocations]); // Re-run if locations load late

    // --- 2. HANDLE SELECTION ---
    const handleLocationSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        setLocationId(selectedId);
        setIsDirty(true);
    };

    // Construct Full Header
    // If ID selected: Use Asset Name. If not: Keep original header text (or "UNKNOWN")
    const selectedAsset = availableLocations.find(l => l.id === locationId);
    const locationDisplayName = selectedAsset ? selectedAsset.name : "UNKNOWN LOCATION";

    // Final Slugline Construction
    const fullHeader = `${locationDisplayName} - ${timeOfDay}`;

    const handleSaveChanges = () => {
        if (!activeScene || !onUpdateScene) return;
        onUpdateScene(activeScene.id, {
            header: fullHeader,
            slugline: fullHeader,
            summary: summary,
            synopsis: summary,
            time: timeOfDay,
            location_id: locationId
        });
        setIsDirty(false);
    };

    // ... (Cast Handlers - No Changes) ...
    const activeCastList = activeScene?.cast_ids || activeScene?.characters || [];
    const handleAddCharacter = (charId: string) => {
        if (!activeScene || !onUpdateCast) return;
        if (!activeCastList.includes(charId)) onUpdateCast(activeScene.id, [...activeCastList, charId]);
    };
    const handleRemoveCharacter = (charId: string) => {
        if (!activeScene || !onUpdateCast) return;
        onUpdateCast(activeScene.id, activeCastList.filter((id: string) => id !== charId));
    };

    if (!activeScene) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center opacity-40 gap-4 bg-[#080808]">
                <div className="w-16 h-16 rounded-full border border-[#333] flex items-center justify-center bg-[#0A0A0A]">
                    <Save size={24} className="text-[#666]" />
                </div>
                <div>
                    <div className="text-xs font-bold text-[#666] uppercase tracking-widest mb-1">Editor Idle</div>
                    <div className="text-[10px] font-mono text-[#444]">Select a scene to begin editing</div>
                </div>
            </div>
        );
    }

    // Determine if we should show the warning
    // Show warning only if NO ID is selected AND the header text isn't empty
    const showWarning = !locationId && activeScene.header;

    return (
        <div className="flex flex-col h-full bg-[#050505] text-[#EEE] font-sans">

            {/* HEADER */}
            <div className="h-16 px-6 border-b border-[#222] flex items-center justify-between shrink-0 bg-[#080808]">
                <div>
                    <div className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-0.5">Editing Scene</div>
                    <div className="text-xl font-bold tracking-tight text-white/90">
                        {String(activeScene.scene_number).padStart(2, '0')}
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#222] rounded text-[10px] font-bold text-[#444] uppercase tracking-wider cursor-default">
                    {isDirty ? (
                        <span className="text-yellow-600 animate-pulse">Unsaved</span>
                    ) : (
                        <>
                            <Check size={12} className="text-green-500" /> Saved
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">

                {/* 1. SCENE DETAILS (Slugline) */}
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">Location</label>

                    <div className="grid grid-cols-[2fr_1fr] gap-3">
                        {/* Location Select */}
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-focus-within:text-white transition-colors">
                                <MapPin size={14} />
                            </div>
                            <select
                                value={locationId}
                                onChange={handleLocationSelect}
                                className={`w-full bg-[#111] border border-[#222] text-xs font-bold uppercase rounded-md py-3 pl-9 pr-3 outline-none focus:border-[#444] focus:bg-[#161616] transition-colors appearance-none cursor-pointer
                                    ${!locationId ? 'text-yellow-600 border-yellow-900/30' : 'text-white'}
                                `}
                            >
                                <option value="" disabled>Select Location...</option>
                                {availableLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name.replace(/_/g, " ")}
                                    </option>
                                ))}
                                {!locationId && (
                                    <option value="" disabled>⚠ UNKNOWN: {activeScene.header?.split("-")[0] || "MISSING"}</option>
                                )}
                            </select>
                        </div>

                        {/* Time Select */}
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-focus-within:text-white transition-colors">
                                <Clock size={14} />
                            </div>
                            <select
                                value={timeOfDay}
                                onChange={(e) => { setTimeOfDay(e.target.value); setIsDirty(true); }}
                                className="w-full bg-[#111] border border-[#222] text-xs font-mono text-[#CCC] rounded-md py-3 pl-9 pr-3 outline-none focus:border-[#444] focus:bg-[#161616] transition-colors appearance-none cursor-pointer"
                            >
                                <option value="DAY">DAY</option>
                                <option value="NIGHT">NIGHT</option>
                                <option value="CONTINUOUS">CONTINUOUS</option>
                                <option value="MOMENTS LATER">MOMENTS LATER</option>
                                <option value="DAWN">DAWN</option>
                                <option value="DUSK">DUSK</option>
                            </select>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="px-3 py-2 border-l-2 border-[#222] bg-[#0A0A0A] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#666] truncate uppercase tracking-wider">
                            {locationId ? fullHeader : activeScene.header || "NO HEADER"}
                        </span>
                        {showWarning && (
                            <div title="Location asset not linked" className="cursor-help">
                                <AlertTriangle size={12} className="text-yellow-600/50" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. DESCRIPTION */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">Action</label>
                    </div>
                    <textarea
                        value={summary}
                        onChange={(e) => { setSummary(e.target.value); setIsDirty(true); }}
                        placeholder="Describe the visual action..."
                        className="w-full h-40 bg-[#111] border border-[#222] text-sm text-[#DDD] p-4 rounded-md focus:outline-none focus:border-[#444] focus:bg-[#161616] resize-none leading-relaxed font-serif placeholder:text-[#333] transition-all"
                    />
                </div>

                {/* 3. CAST */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-widest block">Characters</label>
                        <span className="text-[9px] font-mono text-[#444]">{activeCastList.length} Active</span>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[40px] items-start">
                        {activeCastList.map((charId: string) => (
                            <div key={charId} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-[#1A1A1A] border border-[#333] text-white text-[10px] font-bold uppercase rounded-full group hover:border-[#555] transition-colors">
                                <span>{charId.replace(/_/g, " ")}</span>
                                <button
                                    onClick={() => handleRemoveCharacter(charId)}
                                    className="p-0.5 rounded-full hover:bg-white/20 text-[#666] hover:text-white transition-colors"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        ))}

                        {onUpdateCast && (
                            <div className="relative">
                                <select
                                    className="appearance-none pl-3 pr-8 py-1.5 bg-[#111] border border-[#222] text-[#666] hover:text-[#888] hover:border-[#333] text-[10px] font-bold uppercase rounded-full outline-none cursor-pointer transition-colors focus:border-[#444] focus:text-white"
                                    onChange={(e) => { if (e.target.value) { handleAddCharacter(e.target.value); e.target.value = ""; } }}
                                    value=""
                                >
                                    <option value="" disabled>+ Add</option>
                                    {availableCharacters.map(char => <option key={char.id} value={char.id}>{char.name}</option>)}
                                </select>
                                <Plus size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. AI ASSISTANT */}
                <div className="pt-6 border-t border-[#111] space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[#666] uppercase tracking-widest flex items-center gap-2">
                            <Sparkles size={12} className="text-red-500" /> AI Assistant
                        </label>
                        <button
                            onClick={onOpenContextModal}
                            className="text-[9px] font-bold text-red-500 hover:text-red-400 uppercase tracking-wider transition-colors"
                        >
                            + Context
                        </button>
                    </div>

                    {selectedContext.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedContext.map(ref => (
                                <div key={ref.id} className="flex items-center gap-1 px-2 py-1 bg-red-900/10 border border-red-900/30 text-red-400 text-[9px] font-mono rounded-sm">
                                    <span className="truncate max-w-[100px]">{ref.sourceLabel}</span>
                                    <button onClick={() => onRemoveContextRef(ref.id)} className="hover:text-white"><X size={8} /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative group">
                        <textarea
                            value={instruction}
                            onChange={(e) => setInstruction(e.target.value)}
                            placeholder="Ask AI to rewrite, expand, or adjust tone..."
                            className="w-full p-4 pr-12 text-xs rounded-md bg-[#0A0A0A] border border-[#222] text-[#DDD] font-mono focus:outline-none focus:border-red-900/50 focus:bg-[#111] transition-all resize-none h-24 placeholder:text-[#333]"
                        />
                        <button
                            onClick={() => onExecuteAi(instruction)}
                            disabled={isProcessing || !instruction.trim()}
                            className="absolute bottom-3 right-3 p-2 bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-0 disabled:pointer-events-none transition-all shadow-lg shadow-red-900/20"
                            title="Execute Rewrite"
                        >
                            {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        </button>
                    </div>
                </div>

            </div>

            {/* FOOTER */}
            <div className="p-4 bg-[#050505] border-t border-[#111] shrink-0">
                <button
                    onClick={handleSaveChanges}
                    disabled={!isDirty}
                    className="w-full py-3 bg-white text-black text-xs font-bold uppercase tracking-wider rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[#222] disabled:text-[#666]"
                >
                    {isDirty ? "Save Changes" : "No Changes"}
                </button>
            </div>
        </div>
    );
};