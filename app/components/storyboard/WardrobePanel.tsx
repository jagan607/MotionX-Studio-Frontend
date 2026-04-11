"use client";

import React, { useState, useEffect } from "react";
import {
    Sparkles, X, Loader2, Save, Scissors, Lock, Unlock,
    Zap, User, ImageIcon
} from "lucide-react";
import { generateWardrobe, updateWardrobe, generateWardrobePortrait } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

/* ── Backend schema ─────────────────────────────────────────────── */
interface CharacterWardrobe {
    character: string;
    outfit: string;
    accessories?: string;
    hair?: string;
    makeup?: string;
    notes?: string;
    portrait_url?: string;
    portrait_status?: "generating" | "ready" | "failed" | null;
}

interface WardrobeData {
    characters: CharacterWardrobe[];
    general_notes?: string;
    is_enabled?: boolean;
    is_locked?: boolean;
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

/* ── Toggle Switch ──────────────────────────────────────────────── */
const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
    <button
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-[38px] h-[20px] rounded-full transition-all duration-300 cursor-pointer ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
        style={{
            backgroundColor: checked ? "rgba(220, 38, 38, 0.7)" : "rgba(255,255,255,0.08)",
            border: checked ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid rgba(255,255,255,0.1)",
        }}
    >
        <div
            className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-300 shadow-md"
            style={{
                left: checked ? "20px" : "3px",
                backgroundColor: checked ? "#fff" : "rgba(255,255,255,0.3)",
            }}
        />
    </button>
);

/* ── Main Panel ─────────────────────────────────────────────────── */
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

    // Feature 1: Enable/Disable toggle
    const [isEnabled, setIsEnabled] = useState(true);

    // Feature 3: Locked state
    const [isLocked, setIsLocked] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);

    // Feature 4: Portrait generation tracking (per-character loading state)
    const [renderingPortraits, setRenderingPortraits] = useState<Set<string>>(new Set());

    const hasData = characters.length > 0 && characters.some(c => c.outfit);

    // Hydrate from existing data
    // IMPORTANT: Backend can return characters as a dict {"Name": {outfit: "..."}}
    // OR an array [{character: "Name", outfit: "..."}]. We normalize to array.
    useEffect(() => {
        let hydrated = false;

        if (existingData?.characters) {
            let charArray: CharacterWardrobe[] = [];

            if (Array.isArray(existingData.characters)) {
                // Already an array — use directly
                charArray = existingData.characters;
            } else if (typeof existingData.characters === "object") {
                // Dict format from backend — convert to array
                charArray = Object.entries(existingData.characters).map(
                    ([name, details]: [string, any]) => ({
                        character: name,
                        outfit: details?.outfit || details?.clothing || "",
                        accessories: details?.accessories || "",
                        hair: details?.hair || "",
                        makeup: details?.makeup || "",
                        notes: details?.notes || "",
                        portrait_url: details?.portrait_url,
                        portrait_status: details?.portrait_status,
                    })
                );
            }

            if (charArray.length > 0) {
                // Merge with castMembers to preserve order + handle extras
                const merged = castMembers.map(cm => {
                    const match = charArray.find(
                        ac => ac.character?.toUpperCase() === cm.name?.toUpperCase()
                            || ac.character?.toUpperCase() === cm.id?.toUpperCase()
                    );
                    return match || { character: cm.name || cm.id, outfit: "", accessories: "", hair: "", makeup: "", notes: "" };
                });
                // Add any backend characters not in castMembers
                charArray.forEach(ac => {
                    if (!merged.find(m => m.character?.toUpperCase() === ac.character?.toUpperCase())) {
                        merged.push(ac);
                    }
                });

                setCharacters(merged);
                setGeneralNotes(existingData.general_notes || "");
                setActiveCharIndex(prev => (prev < merged.length ? prev : 0));
                hydrated = true;
            }
        }

        if (!hydrated) {
            setCharacters(
                castMembers.map(c => ({ character: c.name || c.id, outfit: "", accessories: "", hair: "", makeup: "", notes: "" }))
            );
            setGeneralNotes("");
            setActiveCharIndex(0);
        }

        // Hydrate is_enabled (default true for backward compat)
        setIsEnabled(existingData?.is_enabled !== false);

        // Hydrate is_locked
        setIsLocked(existingData?.is_locked === true);
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

    // Whether editing is blocked (disabled OR locked)
    const isReadOnly = !isEnabled || isLocked;

    const updateCharField = (index: number, field: keyof CharacterWardrobe, value: string) => {
        if (isReadOnly) return;
        setCharacters(prev => { const n = [...prev]; n[index] = { ...n[index], [field]: value }; return n; });
    };

    const getCharImage = (charName: string): string | undefined => {
        const match = castMembers.find(c => c.name?.toUpperCase() === charName?.toUpperCase() || c.id?.toUpperCase() === charName?.toUpperCase());
        return match?.image_url;
    };

    /* ── Feature 1: Toggle handler ────────────────────────────────── */
    const handleToggleEnabled = async (newValue: boolean) => {
        setIsEnabled(newValue);
        try {
            const payload = { ...existingData, characters, general_notes: generalNotes, is_enabled: newValue };
            await updateWardrobe(projectId, episodeId, sceneId, payload);
            if (onUpdate) onUpdate(payload);
            toastSuccess(newValue ? "Scene wardrobe enabled" : "Scene wardrobe disabled");
        } catch (e) {
            setIsEnabled(!newValue); // Rollback
            toastError("Failed to update wardrobe toggle");
        }
    };

    /* ── AI Generate handler ──────────────────────────────────────── */
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const charNames = castMembers.map(c => c.name || c.id);
            const res = await generateWardrobe(projectId, episodeId, sceneId, sceneAction, charNames);
            const data = res.wardrobe || res;
            if (data.characters && typeof data.characters === "object") {
                // Normalize dict or array → array, handling clothing↔outfit key mismatch
                const charArray: CharacterWardrobe[] = Array.isArray(data.characters)
                    ? data.characters
                    : Object.entries(data.characters).map(([k, v]: [string, any]) => ({
                        character: k,
                        outfit: v?.outfit || v?.clothing || "",
                        accessories: v?.accessories || "",
                        hair: v?.hair || "",
                        makeup: v?.makeup || "",
                        notes: v?.notes || "",
                    }));

                const merged: CharacterWardrobe[] = castMembers.map(cm => {
                    const ai = charArray.find(
                        (ac) => ac.character?.toUpperCase() === cm.name?.toUpperCase() || ac.character?.toUpperCase() === cm.id?.toUpperCase()
                    );
                    return {
                        character: cm.name || cm.id,
                        outfit: ai?.outfit || "",
                        accessories: ai?.accessories || "",
                        hair: ai?.hair || "",
                        makeup: ai?.makeup || "",
                        notes: ai?.notes || "",
                    };
                });
                charArray.forEach((ac) => {
                    if (!merged.find(m => m.character.toUpperCase() === ac.character?.toUpperCase())) {
                        merged.push({
                            character: ac.character,
                            outfit: ac.outfit || "",
                            accessories: ac.accessories || "",
                            hair: ac.hair || "",
                            makeup: ac.makeup || "",
                            notes: ac.notes || "",
                            portrait_url: ac.portrait_url,
                            portrait_status: ac.portrait_status,
                        });
                    }
                });
                setCharacters(merged);

                // Pass the NORMALIZED data to parent (array, not raw dict)
                const normalizedPayload: WardrobeData = {
                    characters: merged,
                    general_notes: data.general_notes || generalNotes,
                };
                if (onUpdate) onUpdate(normalizedPayload);
            } else {
                if (onUpdate) onUpdate(data);
            }
            if (data.general_notes) setGeneralNotes(data.general_notes);

            toastSuccess("Wardrobe generated");
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Failed to generate wardrobe");
        } finally {
            setIsGenerating(false);
        }
    };

    /* ── Save + Lock handler ──────────────────────────────────────── */
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: WardrobeData = {
                ...existingData,
                characters,
                general_notes: generalNotes,
                is_enabled: isEnabled,
                is_locked: true,
            };
            await updateWardrobe(projectId, episodeId, sceneId, payload);
            setIsLocked(true);
            if (onUpdate) onUpdate(payload);
            toastSuccess("Wardrobe locked");
        } catch (e: any) {
            toastError("Failed to save wardrobe");
        } finally {
            setIsSaving(false);
        }
    };

    /* ── Feature 3: Unlock handler ────────────────────────────────── */
    const handleUnlock = async () => {
        setIsUnlocking(true);
        try {
            const payload: WardrobeData = {
                ...existingData,
                characters,
                general_notes: generalNotes,
                is_enabled: isEnabled,
                is_locked: false,
            };
            await updateWardrobe(projectId, episodeId, sceneId, payload);
            setIsLocked(false);
            if (onUpdate) onUpdate(payload);
            toastSuccess("Wardrobe unlocked for editing");
        } catch (e: any) {
            toastError("Failed to unlock wardrobe");
        } finally {
            setIsUnlocking(false);
        }
    };

    /* ── Feature 4: Portrait render handler ───────────────────────── */
    const handleRenderPortrait = async (charName: string) => {
        setRenderingPortraits(prev => new Set(prev).add(charName));
        try {
            await generateWardrobePortrait(projectId, episodeId, sceneId, charName);
            toastSuccess(`Portrait render queued for ${charName}`);
            // Firestore snapshot will update portrait_status → "generating" → "ready"
        } catch (e: any) {
            toastError(e?.response?.data?.detail || `Failed to render portrait for ${charName}`);
        } finally {
            setRenderingPortraits(prev => {
                const next = new Set(prev);
                next.delete(charName);
                return next;
            });
        }
    };

    const handleClose = () => { setIsVisible(false); setTimeout(onClose, 300); };

    if (!isOpen) return null;

    const ac = characters[activeCharIndex] || null;

    // Feature 4: Portrait takes priority as backdrop, then asset image
    const charPortrait = ac?.portrait_url && ac?.portrait_status === "ready" ? ac.portrait_url : undefined;
    const assetImage = ac ? getCharImage(ac.character) : undefined;
    const activeImage = charPortrait || assetImage;

    const isPortraitGenerating =
        (ac?.portrait_status === "generating") ||
        (ac ? renderingPortraits.has(ac.character) : false);

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
            <textarea value={generalNotes} onChange={(e) => !isReadOnly && setGeneralNotes(e.target.value)}
                placeholder="1990s corporate aesthetic. Muted earth tones across all characters. No bright colors — everything desaturated, heavy fabrics..."
                rows={3}
                readOnly={isReadOnly}
                className="w-full bg-transparent text-[12px] text-white/60 px-5 py-3 focus:outline-none resize-none placeholder:text-white/10 leading-relaxed" />
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex" style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
            {/* === BACKDROP & CENTER IMAGE === */}
            <div className="absolute inset-0 bg-[#050505]">
                {activeImage ? (
                    <img key={activeImage} src={activeImage} alt={ac?.character || ""} className="absolute inset-0 w-full h-full object-cover object-top"
                         style={{ transition: "opacity 0.6s ease" }} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 font-bold text-[20vw]">
                        {ac?.character?.[0] || "?"}
                    </div>
                )}

                {/* Portrait generating overlay */}
                {isPortraitGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3 relative overflow-hidden">
                                <div className="absolute inset-0 bg-red-500/10 animate-ping" />
                                <User size={22} className="text-red-400 animate-pulse relative z-10" />
                            </div>
                            <div className="text-[11px] font-mono font-bold text-red-400 uppercase tracking-[3px] mb-1">Rendering Portrait</div>
                            <div className="text-[10px] text-white/30">Generating costume visualization...</div>
                        </div>
                    </div>
                )}

                {/* Gradients for text readability */}
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

                    {characters.map((char, index) => {
                        const portraitReady = char.portrait_url && char.portrait_status === "ready";
                        const img = portraitReady ? char.portrait_url : getCharImage(char.character);
                        const isActive = index === activeCharIndex;
                        const hasCostume = !!char.outfit;
                        const isCharPortraitGenerating = char.portrait_status === "generating" || renderingPortraits.has(char.character);
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

                                {/* Portrait generating spinner overlay on thumbnail */}
                                {isCharPortraitGenerating && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <Loader2 size={14} className="animate-spin text-red-400" />
                                    </div>
                                )}

                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 py-2">
                                    <div className="text-[8px] font-bold text-white/80 uppercase tracking-wider truncate text-center">{char.character?.split(" ")[0]}</div>
                                </div>
                                {hasCostume && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.8)]" />}
                                {/* Portrait ready indicator */}
                                {portraitReady && !isActive && (
                                    <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* CENTER: Text Overlays */}
                <div className="flex-1 h-full relative flex flex-col justify-end pb-8 pointer-events-none"
                    style={{ transform: isVisible ? "translateY(0)" : "translateY(30px)", opacity: isVisible ? 1 : 0, transition: "all 0.5s ease 0.2s" }}>

                    <div className="max-w-[500px]">
                        {/* Portrait badge */}
                        {charPortrait && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-[2px] mb-3"
                                style={{ color: "rgb(34, 197, 94)", backgroundColor: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
                                <ImageIcon size={10} /> In-Costume Portrait
                            </div>
                        )}

                        <div className="text-[10px] font-bold text-red-400/80 uppercase tracking-[5px] mb-2 drop-shadow-md">Character Profile</div>
                        <h2 className="text-white uppercase leading-none"
                            style={{ fontFamily: "Anton, sans-serif", fontSize: "clamp(42px, 6vw, 84px)", letterSpacing: "2px", textShadow: "0 4px 40px rgba(0,0,0,0.8)" }}>
                            {ac?.character || ""}
                        </h2>
                    </div>
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

                        {/* ── Feature 1: Enable/Disable Toggle ── */}
                        <div className="flex items-center justify-between px-4 py-3 rounded-xl mb-4"
                            style={{ backgroundColor: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.03)" }}>
                            <div className="flex items-center gap-3">
                                <Scissors size={13} className={isEnabled ? "text-red-400" : "text-white/20"} />
                                <div>
                                    <div className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                                        Custom Scene Wardrobe
                                    </div>
                                    <div className="text-[9px] text-white/25 font-mono">
                                        {isEnabled ? "Overrides project defaults" : "Using project defaults"}
                                    </div>
                                </div>
                            </div>
                            <ToggleSwitch checked={isEnabled} onChange={handleToggleEnabled} disabled={isLocked} />
                        </div>

                        {/* ── AI Generate Button with Credit Indicator ── */}
                        <button onClick={handleGenerate} disabled={isGenerating || isReadOnly}
                            className="w-full flex items-center justify-between px-6 py-4 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed group border border-white/[0.05] hover:border-red-500/40 relative overflow-hidden"
                            style={{
                                background: isGenerating ? "rgba(220, 38, 38, 0.05)" : "rgba(255, 255, 255, 0.02)",
                                opacity: isReadOnly ? 0.35 : 1,
                            }}>
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            <div className="flex items-center gap-4 relative z-10">
                                {isGenerating ? (
                                    <Loader2 size={16} className="animate-spin text-red-400" />
                                ) : (
                                    <Sparkles size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
                                )}
                                <span className={`text-[12px] font-bold uppercase tracking-[2px] transition-colors ${isGenerating ? "text-red-400" : "text-white/80 group-hover:text-white"}`}>
                                    {isGenerating ? "Designing Wardrobe..." : (hasData ? "Redesign Entire Cast" : "AI Design Costumes")}
                                </span>
                            </div>
                            {/* ── Feature 2: Credit cost indicator ── */}
                            <div className="flex items-center gap-1 relative z-10 px-2.5 py-1 rounded-lg"
                                style={{ backgroundColor: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
                                <Zap size={10} className="text-amber-400" />
                                <span className="text-[10px] font-mono font-bold text-amber-400/80">1</span>
                            </div>
                        </button>
                    </div>

                    {/* Body — dimmed when disabled or locked */}
                    <div
                        className="flex-1 overflow-y-auto px-8 py-6 space-y-5 transition-opacity duration-300"
                        style={{
                            scrollbarWidth: "thin",
                            scrollbarColor: "rgba(255,255,255,0.1) transparent",
                            opacity: isReadOnly ? 0.35 : 1,
                            pointerEvents: isReadOnly ? "none" : "auto",
                        }}
                    >
                        {/* ── Feature 4: Portrait preview + Render button ── */}
                        {ac && (
                            <div className="flex items-center gap-4">
                                {/* Portrait mini preview */}
                                {ac.portrait_url && ac.portrait_status === "ready" && (
                                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-white/[0.06] shrink-0 relative group">
                                        <img src={ac.portrait_url} alt={`${ac.character} portrait`} className="w-full h-full object-cover" />
                                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                                    </div>
                                )}

                                {/* Render Outfit button */}
                                <button
                                    onClick={() => handleRenderPortrait(ac.character)}
                                    disabled={isPortraitGenerating || !ac.outfit}
                                    className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed border border-white/[0.05] hover:border-violet-500/40 relative overflow-hidden group"
                                    style={{
                                        background: isPortraitGenerating ? "rgba(139, 92, 246, 0.05)" : "rgba(255,255,255,0.02)",
                                        opacity: !ac.outfit ? 0.3 : 1,
                                        pointerEvents: "auto", // Override the parent's pointer-events:none when locked
                                    }}
                                    title={!ac.outfit ? "Add an outfit description first" : "Generate a portrait with this costume"}
                                >
                                    {isPortraitGenerating ? (
                                        <Loader2 size={13} className="animate-spin text-violet-400" />
                                    ) : (
                                        <User size={13} className="text-violet-400 group-hover:scale-110 transition-transform" />
                                    )}
                                    <span className={`text-[10px] font-bold uppercase tracking-[1.5px] ${isPortraitGenerating ? "text-violet-400" : "text-white/70 group-hover:text-white"}`}>
                                        {isPortraitGenerating ? "Rendering..." : (ac.portrait_url ? "Re-render" : "Render Outfit")}
                                    </span>
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                                        style={{ backgroundColor: "rgba(251, 191, 36, 0.08)", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
                                        <Zap size={8} className="text-amber-400" />
                                        <span className="text-[9px] font-mono font-bold text-amber-400/80">1</span>
                                    </div>
                                </button>
                            </div>
                        )}

                        {/* Divider */}
                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-white/[0.04]" />
                            <span className="text-[8px] font-mono text-white/20 uppercase tracking-[3px]">Costume Details</span>
                            <div className="h-px flex-1 bg-white/[0.04]" />
                        </div>

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
                                    readOnly={isReadOnly}
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
                    </div>

                    {/* ── Footer with Lock/Unlock State Machine ── */}
                    <div className="px-8 py-5 shrink-0 flex items-center justify-between border-t border-white/[0.03] bg-black/20">
                        {isLocked ? (
                            /* ── Feature 3: Locked state ── */
                            <>
                                <button
                                    onClick={handleUnlock}
                                    disabled={isUnlocking}
                                    className="flex items-center gap-2.5 px-5 py-3 rounded-xl transition-all cursor-pointer border border-white/[0.08] hover:border-red-500/30 bg-transparent hover:bg-white/[0.02]"
                                >
                                    {isUnlocking ? (
                                        <Loader2 size={13} className="animate-spin text-white/50" />
                                    ) : (
                                        <Unlock size={13} className="text-white/40" />
                                    )}
                                    <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-white/50">
                                        {isUnlocking ? "Unlocking..." : "Edit / Unlock"}
                                    </span>
                                </button>
                                <div className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                    <Lock size={13} className="text-white/30" />
                                    <span className="text-[11px] font-bold uppercase tracking-[2px] text-white/30">
                                        Wardrobe Locked
                                    </span>
                                </div>
                            </>
                        ) : (
                            /* ── Normal: Save + Lock ── */
                            <>
                                <div className="text-[9px] font-mono text-white/20 uppercase tracking-wider">
                                    {isDirty ? "Unsaved changes" : ""}
                                </div>
                                <button onClick={handleSave} disabled={isSaving || isReadOnly}
                                    className={`flex items-center gap-3 px-8 py-3.5 bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer rounded-xl disabled:opacity-40 disabled:cursor-not-allowed ${isDirty ? "" : "opacity-90"}`}
                                    style={{ boxShadow: isDirty ? "0 0 30px rgba(220, 38, 38, 0.4)" : "0 0 15px rgba(220, 38, 38, 0.15)" }}>
                                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                                    <span className="text-[11px] font-bold uppercase tracking-[2px]">{isSaving ? "Locking..." : "Lock Wardrobe"}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
