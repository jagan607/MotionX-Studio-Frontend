"use client";

import React, { useState, useEffect } from "react";
import {
    MapPin, Users, Loader2, Sparkles, X,
    Save, Clock, AlertTriangle, Plus, Check, ChevronDown, MessageSquareQuote,
    Palette, Sun, Layers, CloudFog
} from "lucide-react";
import { SceneData } from "@/components/studio/SceneCard"; // Use unified type
import { ContextReference } from "./ContextSelectorModal";

// Shared Location Interface
export interface LocationAsset {
    id: string;
    name: string;
}

interface DirectorConsoleProps {
    activeScene: Partial<SceneData> & { id: string; scene_number: number; header: string; summary: string;[key: string]: any } | null;
    availableCharacters: { id: string; name: string }[];
    availableLocations?: LocationAsset[];
    availableProducts?: { id: string; name: string }[];
    projectType?: 'movie' | 'ad' | 'music_video';
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
    availableProducts = [],
    projectType = 'movie',
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

    // Mood State
    const [moodExpanded, setMoodExpanded] = useState(false);
    const [moodColorPalette, setMoodColorPalette] = useState("");
    const [moodLighting, setMoodLighting] = useState("");
    const [moodTexture, setMoodTexture] = useState("");
    const [moodAtmosphere, setMoodAtmosphere] = useState("");

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
                else if (rawLocName) foundId = `__raw__${rawLocName.trim()}`; // Keep raw text as fallback
            }

            setLocationId(foundId); // If "" (empty), dropdown shows placeholder
            setTimeOfDay(parsedTime);
            setSummary(activeScene.summary || activeScene.synopsis || "");
            setInstruction("");
            setIsDirty(false);

            // Sync mood fields
            const mood = activeScene.mood || {};
            setMoodColorPalette(mood.color_palette || "");
            setMoodLighting(mood.lighting || "");
            setMoodTexture(mood.texture || "");
            setMoodAtmosphere(mood.atmosphere || "");
            // Auto-expand if mood has data
            setMoodExpanded(!!(mood.color_palette || mood.lighting || mood.texture || mood.atmosphere));
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
    const locationDisplayName = selectedAsset
        ? selectedAsset.name
        : locationId.startsWith('__raw__')
            ? locationId.replace('__raw__', '')
            : "UNKNOWN LOCATION";

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
            location: locationDisplayName,
            location_id: locationId,
            mood: {
                color_palette: moodColorPalette,
                lighting: moodLighting,
                texture: moodTexture,
                atmosphere: moodAtmosphere,
            }
        });
        setIsDirty(false);
        onCancelSelection(); // Close panel on save
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

    // --- Products Handlers (Ad only) ---
    const activeProductList = activeScene?.products || [];
    const handleAddProduct = (prodId: string) => {
        if (!activeScene || !onUpdateScene) return;
        if (!activeProductList.includes(prodId)) {
            onUpdateScene(activeScene.id, { products: [...activeProductList, prodId] });
        }
    };
    const handleRemoveProduct = (prodId: string) => {
        if (!activeScene || !onUpdateScene) return;
        onUpdateScene(activeScene.id, { products: activeProductList.filter((id: string) => id !== prodId) });
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

    const hasMoodData = moodColorPalette || moodLighting || moodTexture || moodAtmosphere;

    return (
        <div className="flex flex-col h-full bg-[#050505] text-[#EEE] font-sans">



            <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* 1. SCENE DETAILS (Slugline) */}
                <div className="space-y-3">
                    <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] block">Location</label>

                    <div className="grid grid-cols-[2fr_1fr] gap-3">
                        {/* Location Select */}
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-focus-within:text-white transition-colors">
                                <MapPin size={14} />
                            </div>
                            <select
                                value={locationId}
                                onChange={handleLocationSelect}
                                className={`w-full bg-[#111] border border-[#222] text-xs font-bold uppercase rounded-md py-2.5 pl-9 pr-3 outline-none focus:border-[#444] focus:bg-[#161616] transition-colors appearance-none cursor-pointer
                                    ${!locationId || locationId.startsWith('__raw__') ? 'text-yellow-600 border-yellow-900/30' : 'text-white'}
                                `}
                            >
                                <option value="" disabled>Select Location...</option>
                                {availableLocations.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name.replace(/_/g, " ")}
                                    </option>
                                ))}
                                {locationId.startsWith('__raw__') && (
                                    <option value={locationId}>⚠ {locationId.replace('__raw__', '')}</option>
                                )}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-focus-within:text-white transition-colors">
                                <ChevronDown size={14} />
                            </div>
                        </div>

                        {/* Time Select */}
                        <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-focus-within:text-white transition-colors">
                                <Clock size={14} />
                            </div>
                            <select
                                value={timeOfDay}
                                onChange={(e) => { setTimeOfDay(e.target.value); setIsDirty(true); }}
                                className="w-full bg-[#111] border border-[#222] text-xs font-mono text-[#CCC] rounded-md py-2.5 pl-9 pr-3 outline-none focus:border-[#444] focus:bg-[#161616] transition-colors appearance-none cursor-pointer"
                            >
                                <option value="DAY">DAY</option>
                                <option value="NIGHT">NIGHT</option>
                                <option value="CONTINUOUS">CONTINUOUS</option>
                                <option value="MOMENTS LATER">MOMENTS LATER</option>
                                <option value="DAWN">DAWN</option>
                                <option value="DUSK">DUSK</option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none group-focus-within:text-white transition-colors">
                                <ChevronDown size={14} />
                            </div>
                        </div>
                    </div>


                </div>

                {/* 2. DESCRIPTION */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] block">Action</label>
                        {isProcessing && (
                            <div className="flex items-center gap-1.5">
                                <Loader2 size={10} className="animate-spin text-red-400" />
                                <span className="text-[9px] font-medium text-red-400/70 uppercase tracking-wider">Rewriting...</span>
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <textarea
                            value={summary}
                            onChange={(e) => { setSummary(e.target.value); setIsDirty(true); }}
                            placeholder="Describe the visual action..."
                            disabled={isProcessing}
                            className={`w-full h-28 bg-[#0C0C0C] border border-[#1A1A1A] hover:border-[#333] text-sm text-white p-3 rounded-lg focus:outline-none focus:border-red-500/30 focus:bg-[#111] focus:shadow-[inset_0_1px_4px_rgba(0,0,0,0.4)] resize-none leading-relaxed placeholder:text-[#333] transition-all shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)] ${isProcessing ? 'opacity-40' : ''}`}
                        />
                        {isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-[2px]">
                                <Loader2 size={20} className="animate-spin text-white/50" />
                            </div>
                        )}
                    </div>
                </div>

                {/* 2.5 DIALOGUES (Read-only) */}
                {activeScene.dialogues && activeScene.dialogues.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] flex items-center gap-1.5">
                                <MessageSquareQuote size={12} className="text-white/30" /> Dialogue
                            </label>
                            <span className="text-[9px] font-mono text-white/30">{activeScene.dialogues.length} Lines</span>
                        </div>
                        <div className="space-y-1.5 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg p-3 max-h-40 overflow-y-auto shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
                            {activeScene.dialogues.map((d: any, idx: number) => (
                                <div key={idx} className="text-[11px] leading-relaxed">
                                    <span className="font-bold text-white/80 uppercase text-[10px] tracking-wide">{d.speaker}:</span>
                                    <span className="text-[#999] ml-1.5 italic">"{d.line}"</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. CAST */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] block">Characters</label>
                        <span className="text-[9px] font-mono text-white/30">{activeCastList.length} Active</span>
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

                {/* 4. PRODUCTS (All project types) */}
                {availableProducts.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] block">Products</label>
                            <span className="text-[9px] font-mono text-white/30">{activeProductList.length} Active</span>
                        </div>

                        <div className="flex flex-wrap gap-2 min-h-[40px] items-start">
                            {activeProductList.map((prodId: string) => (
                                <div key={prodId} className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-[#1A1A1A] border border-[#333] text-white text-[10px] font-bold uppercase rounded-full group hover:border-[#555] transition-colors">
                                    <span>{prodId.replace(/_/g, " ")}</span>
                                    <button
                                        onClick={() => handleRemoveProduct(prodId)}
                                        className="p-0.5 rounded-full hover:bg-white/20 text-[#666] hover:text-white transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}

                            {onUpdateScene && (
                                <div className="relative">
                                    <select
                                        className="appearance-none pl-3 pr-8 py-1.5 bg-[#111] border border-[#222] text-[#666] hover:text-[#888] hover:border-[#333] text-[10px] font-bold uppercase rounded-full outline-none cursor-pointer transition-colors focus:border-[#444] focus:text-white"
                                        onChange={(e) => { if (e.target.value) { handleAddProduct(e.target.value); e.target.value = ""; } }}
                                        value=""
                                    >
                                        <option value="" disabled>+ Add Product</option>
                                        {availableProducts.map(prod => <option key={prod.id} value={prod.id}>{prod.name}</option>)}
                                    </select>
                                    <Plus size={10} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] pointer-events-none" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. SCENE MOOD (Collapsible) */}
                <div className="space-y-3">
                    <button
                        onClick={() => setMoodExpanded(!moodExpanded)}
                        className="flex items-center justify-between w-full group"
                    >
                        <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] flex items-center gap-2 cursor-pointer group-hover:text-white/70 transition-colors">
                            <Palette size={12} className="text-violet-400/60" /> Scene Mood
                        </label>
                        <div className="flex items-center gap-2">
                            {hasMoodData && !moodExpanded && (
                                <span className="text-[8px] font-mono text-amber-400/50 bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                                    Set
                                </span>
                            )}
                            <ChevronDown
                                size={12}
                                className={`text-white/30 transition-transform duration-200 ${moodExpanded ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>

                    {moodExpanded && (
                        <div className="space-y-3 bg-[#0A0A0A] border border-[#1E1E1E] rounded-lg p-3 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
                            {/* Color Palette */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-medium text-white/40 uppercase tracking-[0.12em] flex items-center gap-1.5">
                                    <Palette size={10} className="text-white/25" /> Color Palette
                                </label>
                                <input
                                    type="text"
                                    value={moodColorPalette}
                                    onChange={(e) => { setMoodColorPalette(e.target.value); setIsDirty(true); }}
                                    placeholder="e.g. Warm amber and deep gold..."
                                    className="w-full bg-[#0C0C0C] border border-[#1A1A1A] hover:border-[#333] text-[11px] text-white/80 px-3 py-2 rounded-md focus:outline-none focus:border-red-500/30 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-all placeholder:text-[#333]"
                                />
                            </div>

                            {/* Lighting */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-medium text-white/40 uppercase tracking-[0.12em] flex items-center gap-1.5">
                                    <Sun size={10} className="text-white/25" /> Lighting
                                </label>
                                <input
                                    type="text"
                                    value={moodLighting}
                                    onChange={(e) => { setMoodLighting(e.target.value); setIsDirty(true); }}
                                    placeholder="e.g. Chiaroscuro, single source golden..."
                                    className="w-full bg-[#0C0C0C] border border-[#1A1A1A] hover:border-[#333] text-[11px] text-white/80 px-3 py-2 rounded-md focus:outline-none focus:border-red-500/30 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-all placeholder:text-[#333]"
                                />
                            </div>

                            {/* Texture */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-medium text-white/40 uppercase tracking-[0.12em] flex items-center gap-1.5">
                                    <Layers size={10} className="text-white/25" /> Texture
                                </label>
                                <input
                                    type="text"
                                    value={moodTexture}
                                    onChange={(e) => { setMoodTexture(e.target.value); setIsDirty(true); }}
                                    placeholder="e.g. Clean digital with lens flare..."
                                    className="w-full bg-[#0C0C0C] border border-[#1A1A1A] hover:border-[#333] text-[11px] text-white/80 px-3 py-2 rounded-md focus:outline-none focus:border-red-500/30 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-all placeholder:text-[#333]"
                                />
                            </div>

                            {/* Atmosphere */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-medium text-white/40 uppercase tracking-[0.12em] flex items-center gap-1.5">
                                    <CloudFog size={10} className="text-white/25" /> Atmosphere
                                </label>
                                <input
                                    type="text"
                                    value={moodAtmosphere}
                                    onChange={(e) => { setMoodAtmosphere(e.target.value); setIsDirty(true); }}
                                    placeholder="e.g. Reverent, intimate, sacred..."
                                    className="w-full bg-[#0C0C0C] border border-[#1A1A1A] hover:border-[#333] text-[11px] text-white/80 px-3 py-2 rounded-md focus:outline-none focus:border-red-500/30 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-all placeholder:text-[#333]"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* 6. AI ASSISTANT */}
                <div className="pt-6 border-t border-[#111] space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.15em] flex items-center gap-2">
                            <Sparkles size={12} className="text-red-400/60" /> Assistant
                        </label>
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
                            className="w-full p-3 pr-12 text-xs rounded-lg bg-[#0A0A0A] border border-[#1E1E1E] hover:border-[#333] text-white font-mono focus:outline-none focus:border-red-500/30 focus:bg-[#111] focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] transition-all resize-none h-20 placeholder:text-[#333]"
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