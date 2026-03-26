"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, X, Loader2, Save, ChevronRight, Scissors } from "lucide-react";
import { generateWardrobe, updateWardrobe } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

/* ── Backend schema ─────────────────────────────────────────────── */
interface CharacterWardrobe {
    character: string;
    outfit: string;
    accessories?: string;
    hair?: string;
    makeup?: string;
    notes?: string;
}

interface WardrobeData {
    characters: CharacterWardrobe[];
    general_notes?: string;
    image_prompt?: string;
    image_url?: string | null;
    image_status?: string;
}

interface CastMember {
    id: string;
    name: string;
    image_url?: string;
}

interface WardrobePanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    sceneId: string;
    existingData?: WardrobeData | null;
    castMembers: CastMember[];
    onUpdate?: (data: WardrobeData) => void;
    sceneAction?: string;
}

export const WardrobePanel: React.FC<WardrobePanelProps> = ({
    isOpen, onClose, projectId, episodeId, sceneId,
    existingData, castMembers, onUpdate, sceneAction,
}) => {
    const [characters, setCharacters] = useState<CharacterWardrobe[]>([]);
    const [generalNotes, setGeneralNotes] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const hasData = characters.length > 0 && characters.some(c => c.outfit);
    const generatedImage = existingData?.image_url;
    const isGeneratingImage = existingData?.image_status === "generating";

    useEffect(() => {
        if (existingData?.characters?.length) {
            setCharacters(existingData.characters);
            setGeneralNotes(existingData.general_notes || "");
            // Default to Concept Art view if an image exists
            if (existingData.image_url || existingData.image_status === "generating") {
                setActiveCharIndex(-1);
            } else {
                setActiveCharIndex(0);
            }
        } else {
            setCharacters(
                castMembers.map(c => ({ character: c.name || c.id, outfit: "", accessories: "", hair: "", makeup: "", notes: "" }))
            );
            setGeneralNotes("");
            setActiveCharIndex(0);
        }
    }, [existingData, castMembers]);

    useEffect(() => {
        if (isOpen) requestAnimationFrame(() => setIsVisible(true));
        else setIsVisible(false);
    }, [isOpen]);

    const isDirty = (() => {
        if (!existingData?.characters) return characters.some(c => c.outfit || c.accessories || c.hair || c.makeup);
        if (generalNotes !== (existingData.general_notes || "")) return true;
        return characters.some((c, i) => {
            const o = existingData.characters[i];
            return c.outfit !== (o?.outfit || "") || c.accessories !== (o?.accessories || "") || c.hair !== (o?.hair || "") || c.makeup !== (o?.makeup || "") || c.notes !== (o?.notes || "");
        });
    })();

    const updateCharField = (index: number, field: keyof CharacterWardrobe, value: string) => {
        setCharacters(prev => { const n = [...prev]; n[index] = { ...n[index], [field]: value }; return n; });
    };

    const getCharImage = (charName: string): string | undefined => {
        const match = castMembers.find(c => c.name?.toUpperCase() === charName?.toUpperCase() || c.id?.toUpperCase() === charName?.toUpperCase());
        return match?.image_url;
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const charNames = castMembers.map(c => c.name || c.id);
            const res = await generateWardrobe(projectId, episodeId, sceneId, sceneAction, charNames);
            const data = res.wardrobe || res;
            if (data.characters && typeof data.characters === "object") {
                // Handle both dict {"Name": {outfit: ""}} and array format for robustness
                const charArray = Array.isArray(data.characters) ? data.characters : Object.entries(data.characters).map(([k, v]: any) => ({ character: k, ...v }));
                
                const merged = castMembers.map(cm => {
                    const ai = charArray.find(
                        (ac: CharacterWardrobe) => ac.character?.toUpperCase() === cm.name?.toUpperCase() || ac.character?.toUpperCase() === cm.id?.toUpperCase()
                    );
                    return { character: cm.name || cm.id, outfit: ai?.outfit || "", accessories: ai?.accessories || "", hair: ai?.hair || "", makeup: ai?.makeup || "", notes: ai?.notes || "" };
                });
                charArray.forEach((ac: CharacterWardrobe) => {
                    if (!merged.find(m => m.character.toUpperCase() === ac.character?.toUpperCase())) {
                        merged.push({ character: ac.character, outfit: ac.outfit || "", accessories: ac.accessories || "", hair: ac.hair || "", makeup: ac.makeup || "", notes: ac.notes || "" });
                    }
                });
                setCharacters(merged);
            }
            if (data.general_notes) setGeneralNotes(data.general_notes);
            
            // Auto switch to concept art view
            setActiveCharIndex(-1);
            
            if (onUpdate) onUpdate(data);
            toastSuccess("Wardrobe generation queued");
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Failed to generate wardrobe");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: WardrobeData = { ...existingData, characters, general_notes: generalNotes };
            await updateWardrobe(projectId, episodeId, sceneId, payload);
            if (onUpdate) onUpdate(payload);
            toastSuccess("Wardrobe saved");
        } catch (e: any) {
            toastError("Failed to save wardrobe");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => { setIsVisible(false); setTimeout(onClose, 300); };

    if (!isOpen) return null;

    const ac = activeCharIndex >= 0 ? characters[activeCharIndex] : null;
    const activeImage = activeCharIndex === -1 ? generatedImage : (ac ? getCharImage(ac.character) : undefined);

    /* ── Costume field definitions ──────────────────────────────── */
    const costumeFields: { key: keyof CharacterWardrobe; label: string; emoji: string; sub: string; placeholder: string; rows: number }[] = [
        { key: "outfit", label: "Wardrobe", emoji: "👔", sub: "Complete outfit description", placeholder: "Charcoal grey three-piece suit with subtle pinstripes. Crimson silk tie with a gold tie pin. Polished patent leather Oxford shoes. A vintage pocket watch chain visible at the waistcoat...", rows: 3 },
        { key: "accessories", label: "Accessories", emoji: "⌚", sub: "Jewelry, watches, bags, glasses", placeholder: "Gold signet ring on left pinky. Round tortoise-shell reading glasses, usually pushed to forehead. Weathered leather briefcase with brass clasps...", rows: 2 },
        { key: "hair", label: "Hair & Grooming", emoji: "💇", sub: "Hairstyle, facial hair, grooming", placeholder: "Slicked-back salt-and-pepper hair, meticulously groomed. Clean-shaven jaw. A thin scar barely visible near the left temple...", rows: 2 },
        { key: "makeup", label: "Makeup & Skin", emoji: "💄", sub: "Cosmetics, skin condition, aging", placeholder: "Subtle bags under piercing blue eyes suggesting sleepless nights. Pale complexion. No visible cosmetics — natural appearance, intentionally unremarkable...", rows: 2 },
        { key: "notes", label: "Costume Notes", emoji: "📝", sub: "Director / designer notes", placeholder: "Outfit should show wealth but not flash — old money aesthetic. Tie loosened in Act 3 to show emotional unraveling...", rows: 2 },
    ];

    const GeneralNotesField = () => (
        <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.04]">
                <Scissors size={11} className="text-red-500/40" />
                <div>
                    <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Overall Wardrobe Notes</div>
                    <div className="text-[9px] text-white/25">Applied across all characters</div>
                </div>
            </div>
            <textarea value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="1990s corporate aesthetic. Muted earth tones across all characters. No bright colors — everything desaturated, heavy fabrics..."
                rows={3}
                className="w-full bg-transparent text-[12px] text-white/60 px-5 py-3 focus:outline-none resize-none placeholder:text-white/10 leading-relaxed" />
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex" style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
            {/* === BACKDROP & CENTER IMAGE === */}
            <div className="absolute inset-0 bg-[#050505]">
                {activeCharIndex === -1 ? (
                    generatedImage ? (
                        <img key={generatedImage} src={generatedImage} alt="Concept Art" className="absolute inset-0 w-full h-full object-cover object-top"
                             style={{ transition: "opacity 0.6s ease" }} />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            <Sparkles size={120} />
                        </div>
                    )
                ) : (
                    activeImage ? (
                        <img key={activeImage} src={activeImage} alt={ac?.character || ""} className="absolute inset-0 w-full h-full object-cover object-top"
                             style={{ transition: "opacity 0.6s ease" }} />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10 font-bold text-[20vw]">
                            {ac?.character?.[0] || "?"}
                        </div>
                    )
                )}

                {/* Gradients for text readability underneath floating panels */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
                <div className="absolute inset-y-0 right-0 w-[60%] bg-gradient-to-l from-black/90 via-black/40 to-transparent" />
                <div className="absolute inset-y-0 left-0 w-[30%] bg-gradient-to-r from-black/60 to-transparent" />
            </div>

            {/* === CONTENT FLOATING PANELS === */}
            <div className="relative z-10 flex w-full h-full p-4 md:p-8 gap-6 overflow-hidden">

                {/* LEFT: Floating Filmstrip Sidebar */}
                <div className="w-[80px] h-full shrink-0 flex flex-col rounded-2xl bg-black/50 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-y-auto"
                    style={{ transform: isVisible ? "translateX(0)" : "translateX(-100px)", transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s", scrollbarWidth: "none" }}>
                    
                    <div className="px-3 py-5 border-b border-white/[0.06] flex items-center justify-center shrink-0">
                        <Scissors size={18} className="text-red-400/80" />
                    </div>
                    
                    {/* Concept Art button */}
                    {(generatedImage || isGeneratingImage || existingData?.image_prompt || hasData) && (
                        <button onClick={() => setActiveCharIndex(-1)}
                            className="relative w-full aspect-square shrink-0 cursor-pointer transition-all group flex items-center justify-center border-b border-white/[0.03]"
                            style={{ borderLeft: activeCharIndex === -1 ? "3px solid rgb(220, 38, 38)" : "3px solid transparent", background: activeCharIndex === -1 ? "rgba(220, 38, 38, 0.15)" : "transparent" }}>
                            {generatedImage ? (
                                <img src={generatedImage} alt="Concept" className="w-full h-full object-cover"
                                    style={{ opacity: activeCharIndex === -1 ? 1 : 0.4, filter: activeCharIndex === -1 ? "none" : "grayscale(0.6)", transition: "all 0.3s ease" }} />
                            ) : (
                                <Sparkles size={24} className={isGeneratingImage ? "text-red-400 animate-pulse" : "text-white/20"} />
                            )}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-2 flex justify-center">
                                <span className={`text-[8px] font-bold uppercase tracking-wider ${activeCharIndex === -1 ? "text-white" : "text-red-300"}`}>CONCEPT</span>
                            </div>
                        </button>
                    )}

                    {characters.map((char, index) => {
                        const img = getCharImage(char.character);
                        const isActive = index === activeCharIndex;
                        const hasCostume = !!char.outfit;
                        return (
                            <button key={`${char.character}-${index}`} onClick={() => setActiveCharIndex(index)}
                                className="relative w-full aspect-square shrink-0 cursor-pointer transition-all group"
                                style={{ borderLeft: isActive ? "3px solid rgb(220, 38, 38)" : "3px solid transparent", background: isActive ? "rgba(220, 38, 38, 0.15)" : "transparent" }}>
                                {img ? (
                                    <img src={img} alt={char.character} className="w-full h-full object-cover"
                                        style={{ opacity: isActive ? 1 : 0.4, filter: isActive ? "none" : "grayscale(0.6)", transition: "all 0.3s ease" }} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[18px] font-bold text-white/10">{char.character?.[0] || "?"}</span>
                                    </div>
                                )}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-2">
                                    <div className="text-[8px] font-bold text-white/80 uppercase tracking-wider truncate text-center">{char.character?.split(" ")[0]}</div>
                                </div>
                                {hasCostume && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />}
                            </button>
                        );
                    })}
                </div>

                {/* CENTER: Text Overlays */}
                <div className="flex-1 h-full relative flex flex-col justify-end pb-8 pointer-events-none"
                    style={{ transform: isVisible ? "translateY(0)" : "translateY(30px)", opacity: isVisible ? 1 : 0, transition: "all 0.5s ease 0.2s" }}>
                    
                    {activeCharIndex === -1 ? (
                        <div className="max-w-[500px]">
                            {generatedImage && !isGeneratingImage ? (
                                <div className="inline-flex items-center gap-3 bg-red-500/20 border border-red-500/40 text-red-100 px-4 py-2 rounded-xl backdrop-blur-md text-[10px] font-mono uppercase tracking-[3px] mb-4 shadow-2xl">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    Costume Lookbook Rendered
                                </div>
                            ) : null}
                            {isGeneratingImage && (
                                <div className="bg-black/40 backdrop-blur-md border border-red-500/30 p-6 rounded-2xl mb-4 max-w-[400px]">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center relative overflow-hidden shrink-0">
                                            <div className="absolute inset-0 bg-red-500/20 animate-ping" />
                                            <Sparkles size={16} className="text-red-400 animate-pulse relative z-10" />
                                        </div>
                                        <div>
                                            <div className="text-[12px] font-mono font-bold text-red-400 uppercase tracking-[4px]">Rendering Lookbook</div>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-white/60 leading-relaxed italic">
                                        {existingData?.image_prompt || "Compositing character costumes into a cinematic frame..."}
                                    </div>
                                </div>
                            )}
                            <h2 className="text-white uppercase leading-none"
                                style={{ fontFamily: "Anton, sans-serif", fontSize: "clamp(32px, 5vw, 64px)", letterSpacing: "2px", textShadow: "0 4px 30px rgba(0,0,0,0.8)" }}>
                                CONCEPT ART
                            </h2>
                        </div>
                    ) : (
                        <div className="max-w-[500px]">
                            <div className="text-[10px] font-bold text-red-400/80 uppercase tracking-[5px] mb-2 drop-shadow-md">Character Profile</div>
                            <h2 className="text-white uppercase leading-none"
                                style={{ fontFamily: "Anton, sans-serif", fontSize: "clamp(42px, 6vw, 84px)", letterSpacing: "2px", textShadow: "0 4px 40px rgba(0,0,0,0.8)" }}>
                                {ac?.character || ""}
                            </h2>
                        </div>
                    )}
                </div>

                {/* RIGHT: Floating Costume Details Panel */}
                <div className="w-[420px] lg:w-[480px] shrink-0 h-full max-h-[95vh] flex flex-col rounded-3xl overflow-hidden bg-black/60 backdrop-blur-[30px] border border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] self-center relative z-20"
                    style={{ transform: isVisible ? "translateX(0)" : "translateX(40px)", opacity: isVisible ? 1 : 0, transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s" }}>

                    {/* Header */}
                    <div className="px-8 pt-8 pb-5 shrink-0 border-b border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-[1px] bg-red-500" />
                                <span className="text-[10px] font-mono text-red-400 uppercase tracking-[4px]">Costume Dept.</span>
                            </div>
                            <button onClick={handleClose}
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.05] border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                                <X size={16} />
                            </button>
                        </div>

                        <button onClick={handleGenerate} disabled={isGenerating}
                            className="w-full flex items-center justify-between px-6 py-4 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed group border border-white/[0.05] hover:border-red-500/40 relative overflow-hidden"
                            style={{ background: isGenerating ? "rgba(220, 38, 38, 0.05)" : "rgba(255, 255, 255, 0.02)" }}>
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            <div className="flex items-center gap-4 relative z-10">
                                {isGenerating ? (
                                    <Loader2 size={16} className="animate-spin text-red-400" />
                                ) : (
                                    <Sparkles size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
                                )}
                                <span className={`text-[12px] font-bold uppercase tracking-[2px] transition-colors ${isGenerating ? "text-red-400" : "text-white/80 group-hover:text-white"}`}>
                                    {isGenerating ? "Designing Wardrobe..." : (isGeneratingImage ? "Force Retry Setup" : (hasData ? "Redesign Entire Cast" : "AI Design Costumes"))}
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Fields */}
                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                        
                        {activeCharIndex === -1 ? (
                            <>
                                <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/[0.04]">
                                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/[0.04]">
                                        <Sparkles size={13} className="text-red-400/60" />
                                        <div>
                                            <div className="text-[11px] font-bold text-white/80 uppercase tracking-widest">AI Vision Prompt</div>
                                            <div className="text-[10px] font-mono text-white/30">Read-only generation instruction</div>
                                        </div>
                                    </div>
                                    <div className="w-full bg-transparent text-[13px] text-white/60 leading-relaxed italic">
                                        {existingData?.image_prompt || "Vision prompt will appear here once generated..."}
                                    </div>
                                </div>
                                
                                <GeneralNotesField />
                            </>
                        ) : (
                            <>
                                {costumeFields.map(({ key, label, emoji, sub, placeholder, rows }) => (
                                    <div key={key} className="bg-white/[0.015] rounded-2xl p-4 border border-white/[0.03] hover:border-white/[0.08] transition-colors">
                                        <div className="flex items-center gap-3 mb-2 pb-2 border-b border-white/[0.02]">
                                            <span className="text-[14px]">{emoji}</span>
                                            <div>
                                                <div className="text-[11px] font-bold text-white/80 uppercase tracking-widest">{label}</div>
                                                <div className="text-[10px] font-mono text-white/30">{sub}</div>
                                            </div>
                                        </div>
                                        <textarea
                                            value={(ac as any)?.[key] || ""}
                                            onChange={(e) => updateCharField(activeCharIndex, key, e.target.value)}
                                            placeholder={placeholder}
                                            rows={rows}
                                            className="w-full bg-transparent text-[13px] text-white/80 focus:outline-none resize-none placeholder:text-white/10 leading-relaxed font-sans"
                                        />
                                    </div>
                                ))}

                                <GeneralNotesField />

                                {/* Progress */}
                                <div className="flex items-center gap-4 pt-4 border-t border-white/[0.03]">
                                    <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">CHAR {activeCharIndex + 1}/{characters.length}</div>
                                    <div className="flex-1 flex items-center gap-1">
                                        {characters.map((c, i) => (
                                            <div key={i} onClick={() => setActiveCharIndex(i)}
                                                className="h-1 flex-1 rounded-full transition-all cursor-pointer"
                                                style={{ backgroundColor: i === activeCharIndex ? "rgb(220, 38, 38)" : c.outfit ? "rgba(220, 38, 38, 0.4)" : "rgba(255,255,255,0.06)" }} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 shrink-0 flex items-center justify-between border-t border-white/[0.03] bg-black/20">
                        <button onClick={handleSave} disabled={isSaving}
                            className={`flex items-center gap-3 px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer rounded-xl ${isDirty ? "" : "opacity-90"}`}
                            style={{ boxShadow: isDirty ? "0 0 30px rgba(220, 38, 38, 0.4)" : "0 0 15px rgba(220, 38, 38, 0.15)" }}>
                            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span className="text-[11px] font-bold uppercase tracking-[2px]">{isSaving ? "Saving..." : "Lock Wardrobe"}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

