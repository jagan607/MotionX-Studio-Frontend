"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
    Sparkles, X, Loader2, Save, Users, Package, CloudFog, Building2,
    ChevronLeft, ChevronRight, Eye, ImagePlus, Paintbrush, Download, AlertTriangle, Coins
} from "lucide-react";
import { generateSetDesign, updateSetDesign, inpaintSetDesign, cloneSetDesign } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { InpaintEditor } from "./InpaintEditor";

/* ── Backend schema ─────────────────────────────────────────────── */
interface ExtraItem { role: string; count?: number; placement?: string; }
interface SetDressingItem { item: string; placement?: string; }

interface SetDesignData {
    extras?: ExtraItem[];
    set_dressing?: SetDressingItem[];
    atmosphere?: string;
    architecture_notes?: string;
    image_prompt?: string;
    image_url?: string | null;
    image_urls?: { front?: string; back?: string; left?: string; right?: string; };
    image_status?: string;
    is_locked?: boolean;
}

interface LocationAsset {
    id: string;
    name: string;
    image_url?: string;
    image_views?: { wide?: string; front?: string; left?: string; right?: string; back?: string; };
}

interface SiblingScene {
    id: string;
    scene_number?: number;
    slugline?: string;
    location?: string;
    location_name?: string;
    location_id?: string;
    set_design?: SetDesignData;
}

interface SetDesignPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    sceneId: string;
    existingData?: SetDesignData | null;
    onUpdate?: (data: SetDesignData) => void;
    locationName?: string;
    locations?: LocationAsset[];
    sceneAction?: string;
    onOpenAssets?: () => void;
    sceneList?: SiblingScene[];
    currentSceneNumber?: number;
}

const ANGLE_LABELS: Record<string, string> = { wide: "ESTABLISHING", front: "FRONT", left: "LEFT", right: "RIGHT", back: "BACK" };

/* ── Helpers: convert arrays to editable text and back ────────── */
const extrasToText = (arr?: ExtraItem[]): string =>
    arr?.map(e => `${e.count || 1}x ${e.role}${e.placement ? ` — ${e.placement}` : ""}`).join("\n") || "";

const textToExtras = (text: string): ExtraItem[] =>
    text.split("\n").filter(l => l.trim()).map(line => {
        const m = line.match(/^(\d+)x?\s+(.+?)(?:\s*[—–-]\s*(.+))?$/i);
        return m ? { role: m[2].trim(), count: parseInt(m[1]) || 1, placement: m[3]?.trim() }
            : { role: line.trim(), count: 1 };
    });

const dressingToText = (arr?: SetDressingItem[]): string =>
    arr?.map(d => d.placement ? `${d.item} — ${d.placement}` : d.item).join("\n") || "";

const textToDressing = (text: string): SetDressingItem[] =>
    text.split("\n").filter(l => l.trim()).map(line => {
        const [item, placement] = line.split(/\s*[—–-]\s*/);
        return { item: item.trim(), ...(placement && { placement: placement.trim() }) };
    });

/* ── Angle-based filtering ───────────────────────────────────── */
const ANGLE_KEYWORDS: Record<string, RegExp> = {
    front: /\b(front|far\s*end|entrance|doorway)\b/i,
    back:  /\b(back|rear|near\s*end|behind)\b/i,
    left:  /\b(left)\b/i,
    right: /\b(right)\b/i,
};

/** Returns true if the line's placement matches the given angle, or has no directional keyword (neutral). */
const lineMatchesAngle = (line: string, angle: string): boolean => {
    // Extract placement after the dash
    const dashMatch = line.match(/\s*[—–-]\s*(.+)$/);
    const placement = dashMatch ? dashMatch[1] : "";
    if (!placement) return true; // No placement → show everywhere

    const angleRegex = ANGLE_KEYWORDS[angle];
    if (!angleRegex) return true; // Unknown angle (wide/establishing) → show all

    // Check if placement has ANY directional keyword
    const hasAnyDirection = Object.values(ANGLE_KEYWORDS).some(rx => rx.test(placement));
    if (!hasAnyDirection) return true; // Neutral placement ("center of room") → show everywhere

    return angleRegex.test(placement);
};

const filterTextByAngle = (text: string, angle: string): string =>
    text.split("\n").filter(line => !line.trim() || lineMatchesAngle(line, angle)).join("\n");

export const SetDesignPanel: React.FC<SetDesignPanelProps> = ({
    isOpen, onClose, projectId, episodeId, sceneId,
    existingData, onUpdate, locationName, locations = [], sceneAction, onOpenAssets,
    sceneList = [], currentSceneNumber,
}) => {
    const [extrasText, setExtrasText] = useState("");
    const [dressingText, setDressingText] = useState("");
    const [atmosphere, setAtmosphere] = useState("");
    const [archNotes, setArchNotes] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeView, setActiveView] = useState<string>("front");
    const [isVisible, setIsVisible] = useState(false);
    const [showInpaint, setShowInpaint] = useState(false);
    const [isCloning, setIsCloning] = useState(false);
    const [showImportMenu, setShowImportMenu] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const location = locations.find(
        l => l.name === locationName || l.id === locationName?.replace(/[\s.]+/g, '_').toUpperCase()
    );
    
    const generatedViews = existingData?.image_urls;
    const generatedImage = generatedViews ? (generatedViews[activeView as keyof typeof generatedViews] || existingData?.image_url) : existingData?.image_url;
    const heroImage = generatedImage || location?.image_views?.[activeView as keyof typeof location.image_views] || location?.image_url;
    
    let availableViews: [string, string][] = [];
    if (generatedViews && Object.keys(generatedViews).length > 0) {
        availableViews = Object.entries(generatedViews).filter(([, url]) => url) as [string, string][];
    } else if (location?.image_views) {
        availableViews = Object.entries(location.image_views).filter(([, url]) => url) as [string, string][];
    }

    const hasData = !!(existingData?.extras?.length || existingData?.set_dressing?.length || existingData?.atmosphere || existingData?.image_prompt);
    const isGeneratingImage = existingData?.image_status === "generating";

    // --- SIBLING SET DETECTION ---
    const availableSiblingSets = useMemo(() => {
        if (!locationName || !sceneList.length) return [];

        const normalizedLoc = locationName.toLowerCase().trim();
        return sceneList.filter(s => {
            if (s.id === sceneId) return false; // Skip self
            const sLoc = (s.location || s.location_name || s.location_id || "").toLowerCase().trim();
            return sLoc === normalizedLoc && s.set_design && (s.set_design.extras?.length || s.set_design.set_dressing?.length || s.set_design.atmosphere);
        });
    }, [locationName, sceneList, sceneId]);


    // Sync
    useEffect(() => {
        if (existingData) {
            setExtrasText(extrasToText(existingData.extras));
            setDressingText(dressingToText(existingData.set_dressing));
            setAtmosphere(existingData.atmosphere || "");
            setArchNotes(existingData.architecture_notes || "");
        } else {
            setExtrasText(""); setDressingText(""); setAtmosphere(""); setArchNotes("");
        }
    }, [existingData]);

    useEffect(() => {
        if (isOpen) requestAnimationFrame(() => setIsVisible(true));
        else setIsVisible(false);
    }, [isOpen]);

    const isDirty =
        extrasText !== extrasToText(existingData?.extras) ||
        dressingText !== dressingToText(existingData?.set_dressing) ||
        atmosphere !== (existingData?.atmosphere || "") ||
        archNotes !== (existingData?.architecture_notes || "");

    const isGeneratingRef = useRef(false);

    const handleGenerate = async () => {
        if (isGeneratingRef.current) return;
        isGeneratingRef.current = true;
        setIsGenerating(true);

        // Immediately flip the local UI state if it's an overhaul
        if (hasData && onUpdate && existingData?.is_locked) {
            onUpdate({ ...existingData, is_locked: false });
        }

        try {
            const overrideLock = true;
            const res = await generateSetDesign(projectId, episodeId, sceneId, sceneAction, locationName, overrideLock);
            const data = res.set_design || res;
            setExtrasText(extrasToText(data.extras));
            setDressingText(dressingToText(data.set_dressing));
            setAtmosphere(data.atmosphere || "");
            setArchNotes(data.architecture_notes || "");
            if (onUpdate) onUpdate(data);
            toastSuccess("Set design generation queued");
        } catch (e: any) {
            if (e?.response?.status === 402) {
                toastError("Insufficient credits. You need 2 credits to build a set.");
            } else {
                toastError(e?.response?.data?.detail || "Failed to generate set design");
            }
        } finally {
            isGeneratingRef.current = false;
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload: SetDesignData = {
                ...existingData, // Preserve image fields
                extras: textToExtras(extrasText),
                set_dressing: textToDressing(dressingText),
                atmosphere,
                architecture_notes: archNotes,
                is_locked: true,
            };
            await updateSetDesign(projectId, episodeId, sceneId, payload);
            if (onUpdate) onUpdate(payload);
            toastSuccess("Set design saved");
        } catch (e: any) {
            toastError("Failed to save set design");
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => { setIsVisible(false); setTimeout(onClose, 300); };

    // --- INPAINT HANDLERS ---
    const handleInpaintSave = async (prompt: string, maskBase64: string, refImages: File[]): Promise<string | null> => {
        if (!heroImage) return null;
        try {
            const res = await inpaintSetDesign(
                projectId, episodeId, sceneId,
                activeView, prompt, heroImage, maskBase64, refImages
            );
            if (res.image_url) return res.image_url;
            return null;
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Inpaint failed");
            return null;
        }
    };

    const handleInpaintApply = async (newUrl: string) => {
        // 1. Update local state immediately for snappy UI
        const updatedUrls = { ...existingData?.image_urls, [activeView]: newUrl };
        
        // If we are editing the 'front' view, we should also update the master thumbnail
        const updatedData: SetDesignData = { 
            ...existingData, 
            image_urls: updatedUrls,
            ...(activeView === "front" ? { image_url: newUrl } : {})
        };
        
        if (onUpdate) onUpdate(updatedData);

        // 2. Persist to backend explicitly
        try {
            await updateSetDesign(projectId, episodeId, sceneId, updatedData, true);
            toastSuccess(`${ANGLE_LABELS[activeView] || activeView} frame updated`);
        } catch (e) {
            toastError("Failed to save inpainted frame to database");
        }

        // 3. Close the terminal
        setShowInpaint(false);
    };

    // --- CLONE HANDLER ---
    const handleCloneFromSibling = async (sourceSceneId: string) => {
        setIsCloning(true);
        try {
            const res = await cloneSetDesign(projectId, episodeId, sceneId, sourceSceneId);
            const data = res.set_design || res;
            if (onUpdate) onUpdate(data);
            toastSuccess("Set design imported successfully");
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Failed to import set design");
        } finally {
            setIsCloning(false);
        }
    };

    if (!isOpen) return null;

    // View navigation for chevron carousel
    const currentViewIndex = availableViews.findIndex(([angle]) => angle === activeView);
    const handlePrevView = () => {
        if (availableViews.length <= 1) return;
        const prevIndex = (currentViewIndex - 1 + availableViews.length) % availableViews.length;
        setActiveView(availableViews[prevIndex][0]);
    };
    const handleNextView = () => {
        if (availableViews.length <= 1) return;
        const nextIndex = (currentViewIndex + 1) % availableViews.length;
        setActiveView(availableViews[nextIndex][0]);
    };

    // Compute angle-filtered display values (only when multi-angle views exist)
    const isMultiAngle = availableViews.length > 1;
    const displayExtras = isMultiAngle ? filterTextByAngle(extrasText, activeView) : extrasText;
    const displayDressing = isMultiAngle ? filterTextByAngle(dressingText, activeView) : dressingText;
    const angleLabel = isMultiAngle ? (ANGLE_LABELS[activeView] || activeView).toUpperCase() : null;

    const sections = [
        { key: "extras", label: "Scene Extras", sublabel: "Background characters that populate this world", icon: Users, value: extrasText, displayValue: displayExtras, setter: setExtrasText, placeholder: "2x Juror — seated in jury box\n1x Bailiff — standing by door\n1x Court reporter — at desk\n5x Spectator — filling gallery rows", filterable: true },
        { key: "dressing", label: "Set Dressing & Props", sublabel: "Physical objects that define the space", icon: Package, value: dressingText, displayValue: displayDressing, setter: setDressingText, placeholder: "Mahogany judge's bench — center, elevated\nAmerican flag — floor stand, stage right\nWitness stand microphone — small flex mic\nEvidence table — labeled manila folders, water pitcher", filterable: true },
        { key: "atmosphere", label: "Atmosphere & Lighting", sublabel: "The invisible character of the space", icon: CloudFog, value: atmosphere, displayValue: atmosphere, setter: setAtmosphere, placeholder: "Warm afternoon light slanting through tall arched windows casting long shadows across the hardwood floor, dust motes suspended in golden beams, a sense of weight and consequence in the air...", filterable: false },
        { key: "notes", label: "Architecture Notes", sublabel: "Structural and spatial context", icon: Building2, value: archNotes, displayValue: archNotes, setter: setArchNotes, placeholder: "Classic American federal courthouse — wood paneling, high ceilings, symmetrical layout. The bench is elevated 3 feet above the floor. Gallery seating for ~40 people.", filterable: false },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex" style={{ opacity: isVisible ? 1 : 0, transition: "opacity 0.3s ease" }}>
            {/* === BACKDROP === */}
            <div className="absolute inset-0">
                {heroImage ? (
                    <>
                        <img src={heroImage} alt="Set" className={`absolute inset-0 w-full h-full object-cover ${isGeneratingImage ? "opacity-30 mix-blend-luminosity blur-md" : "opacity-100"}`}
                            style={{ transform: isVisible ? "scale(1)" : "scale(1.05)", transition: "transform 0.8s ease-out, opacity 1s ease, filter 1s ease" }} />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/40" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-[#050505]">
                        <div className="absolute inset-0 opacity-[0.03]"
                            style={{ backgroundImage: "repeating-linear-gradient(90deg, #fff 0px, transparent 1px, transparent 100px)", backgroundSize: "100px 100%" }} />
                    </div>
                )}
            </div>

            {/* === CONTENT === */}
            <div className="relative z-10 flex w-full h-full p-6 md:p-10 gap-8 lg:gap-12 overflow-hidden items-center">
                {/* LEFT: Floating Planner */}
                <div className="w-[420px] lg:w-[480px] shrink-0 h-full max-h-[90vh] flex flex-col rounded-3xl overflow-hidden bg-black/50 backdrop-blur-[30px] border border-white/[0.08] shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-20"
                    style={{ transform: isVisible ? "translateY(0)" : "translateY(40px)", opacity: isVisible ? 1 : 0, transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s" }}>

                    <div className="px-8 pt-8 pb-5 shrink-0 border-b border-white/[0.03] bg-gradient-to-b from-white/[0.02] to-transparent">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-[1px] bg-red-500" />
                                <span className="text-[10px] font-mono text-red-400 uppercase tracking-[4px]">Set Blueprint</span>
                            </div>
                        </div>
                        <h1 className="text-white leading-none uppercase pr-4 truncate mb-2 flex items-center gap-3"
                            style={{ fontFamily: "Anton, sans-serif", fontSize: "clamp(24px, 3vw, 40px)", letterSpacing: "1px" }}>
                            <span className="text-white/50 text-2xl tracking-[2px] font-mono mr-3">
                                SCN {currentSceneNumber || "X"}
                            </span>
                            {locationName || "THE SET"}
                        </h1>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-white/30 uppercase tracking-widest">
                            <span>SCN {sceneId?.slice(0, 6) || "XXX"}</span>
                            <div className="w-1 h-1 rounded-full bg-white/20" />
                            <span>PRJ {projectId?.slice(0, 6) || "XXX"}</span>
                        </div>
                        
                        {isGeneratingImage && (
                            <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded uppercase tracking-widest">
                                <Loader2 size={12} className="animate-spin" />
                                Rendering View
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>

                        {/* Fields */}
                        <div className="space-y-4">
                            {sections.map(({ key, label, sublabel, icon: Icon, value, displayValue, setter, placeholder, filterable }) => (
                                <div key={key} className="relative group bg-white/[0.01] rounded-2xl p-4 border border-white/[0.03] hover:border-white/[0.08] transition-colors">
                                    <div className="flex items-baseline gap-3 mb-2">
                                        <span className="text-[11px] font-bold text-red-300 uppercase tracking-widest">{label}</span>
                                        {filterable && angleLabel && displayValue !== value ? (
                                            <span className="text-[8px] font-mono text-red-400/60 bg-red-500/10 px-2 py-0.5 rounded uppercase tracking-widest border border-red-500/10">
                                                {angleLabel} VIEW
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-mono text-white/25 uppercase">{sublabel}</span>
                                        )}
                                    </div>
                                    <textarea value={displayValue} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                                        readOnly={filterable && isMultiAngle && displayValue !== value}
                                        rows={key === "extras" || key === "dressing" ? 3 : 2}
                                        className={`w-full bg-transparent text-[13px] text-white/80 focus:outline-none resize-none placeholder:text-white/10 leading-relaxed font-sans ${filterable && isMultiAngle && displayValue !== value ? "cursor-default" : ""}`} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT: Floating Visual Previews */}
                <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center relative bg-transparent pointer-events-none"
                    style={{ transform: isVisible ? "translateX(0)" : "translateX(40px)", opacity: isVisible ? 1 : 0, transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s" }}>
                    
                    <button onClick={handleClose}
                        className="absolute top-0 right-0 z-30 w-12 h-12 flex items-center justify-center text-white/40 hover:text-white transition-all cursor-pointer bg-black/40 backdrop-blur-xl rounded-full border border-white/10 pointer-events-auto hover:bg-white/10 hover:scale-105">
                        <X size={18} />
                    </button>

                    {availableViews.length > 1 && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex items-center text-[11px] bg-black/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl gap-1 pointer-events-auto shadow-2xl">
                            {availableViews.map(([angle]) => (
                                <button key={angle} onClick={() => setActiveView(angle)}
                                    className={`px-5 py-2 uppercase tracking-widest transition-all cursor-pointer font-bold rounded-xl ${activeView === angle ? "bg-red-600/90 text-white shadow-lg" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                                    {ANGLE_LABELS[angle] || angle}
                                </button>
                            ))}
                        </div>
                    )}

                    {heroImage ? (
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-r-3xl bg-black">
                            {/* Viewport Image */}
                            <img src={heroImage} alt="Angle Preview" className="absolute inset-0 w-full h-full object-contain opacity-100" />
                            
                            {/* Chevron Navigation */}
                            {availableViews.length > 1 && !isGeneratingImage && (
                                <>
                                    <button
                                        onClick={handlePrevView}
                                        className="absolute left-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white/60 hover:text-white backdrop-blur-sm border border-white/0 hover:border-white/10 transition-all cursor-pointer pointer-events-auto"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={handleNextView}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 z-30 w-12 h-12 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/80 text-white/60 hover:text-white backdrop-blur-sm border border-white/0 hover:border-white/10 transition-all cursor-pointer pointer-events-auto"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </>
                            )}

                            {/* Cinematic HUD Overlay */}
                            <div className="absolute inset-4 border border-white/10 z-20 pointer-events-none">
                                {/* Corners */}
                                <div className="absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-red-500/70" />
                                <div className="absolute -top-[1px] -right-[1px] w-4 h-4 border-t-2 border-r-2 border-red-500/70" />
                                <div className="absolute -bottom-[1px] -left-[1px] w-4 h-4 border-b-2 border-l-2 border-red-500/70" />
                                <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-red-500/70" />
                                
                                {/* Center Crosshair */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <div className="w-8 h-[1px] bg-white/30 absolute top-1/2 -translate-y-1/2 -left-4" />
                                    <div className="w-[1px] h-8 bg-white/30 absolute left-1/2 -translate-x-1/2 -top-4" />
                                </div>
                                
                                {/* Safe Margins */}
                                <div className="absolute inset-[15%] border border-dashed border-white/15 rounded-3xl" />
                                
                                {/* Top and Bottom Letterbox Bars (Fake Anamorphic) */}
                                <div className="absolute top-0 inset-x-0 h-[10%] bg-black/40 backdrop-blur-[2px]" />
                                <div className="absolute bottom-0 inset-x-0 h-[10%] bg-black/40 backdrop-blur-[2px]" />
                            </div>

                            {availableViews.length > 1 && (
                                <div className="absolute bottom-12 right-12 text-right z-30 pointer-events-none">
                                    <div className="text-[10px] font-mono text-red-500 uppercase tracking-[4px] mb-1">ANGLE</div>
                                    <div className="font-mono text-white/80 uppercase" style={{ fontSize: "2rem", letterSpacing: "2px" }}>
                                        {ANGLE_LABELS[activeView] || activeView}
                                    </div>
                                </div>
                            )}
                            
                            {isGeneratingImage && (
                                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none font-mono">
                                    <div className="w-16 h-16 rounded-full border border-red-500/50 flex items-center justify-center relative overflow-hidden mb-6">
                                        <div className="absolute inset-0 bg-red-500/20 animate-ping" />
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    </div>
                                    <div className="text-[14px] font-bold text-red-400 uppercase tracking-[6px] mb-3">Rendering</div>
                                    <div className="text-[11px] text-white/50 max-w-[320px] text-center leading-relaxed">
                                        {existingData?.image_prompt || "Compositing location, extras, and props into preview frame..."}
                                    </div>
                                </div>
                            )}

                            <div className="absolute bottom-12 left-12 z-30 flex items-center gap-3 pointer-events-auto">
                                {/* Import dropdown OR concept frame pill */}
                                {availableSiblingSets.length > 0 ? (
                                    <div className="relative">
                                        {/* Dropdown Menu */}
                                        {showImportMenu && (
                                            <div className="absolute bottom-full left-0 mb-2 w-max min-w-[180px] bg-black/90 border border-white/10 rounded-xl p-1.5 flex flex-col gap-1 backdrop-blur-xl shadow-2xl z-40">
                                                <div className="px-2 py-1.5 text-[9px] font-mono text-white/40 uppercase tracking-widest border-b border-white/5 mb-1">
                                                    Select Set to Import
                                                </div>
                                                {availableSiblingSets.map(sib => (
                                                    <button
                                                        key={sib.id}
                                                        onClick={() => {
                                                            setShowImportMenu(false);
                                                            if (hasData) {
                                                                setConfirmAction({
                                                                    title: "Import Set Design?",
                                                                    message: "This will overwrite your current set design with the design from the selected scene. This action cannot be undone.",
                                                                    onConfirm: () => handleCloneFromSibling(sib.id),
                                                                });
                                                            } else {
                                                                handleCloneFromSibling(sib.id);
                                                            }
                                                        }}
                                                        className="text-left px-3 py-2 text-[10px] font-mono text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors uppercase tracking-[1px] cursor-pointer"
                                                    >
                                                        SCN {sib.scene_number || '?'} SET
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Toggle Button */}
                                        <button
                                            onClick={() => setShowImportMenu(!showImportMenu)}
                                            disabled={isCloning}
                                            className="inline-flex items-center gap-2 bg-black/70 hover:bg-black/90 border border-red-500/40 hover:border-red-500/80 text-red-400 px-4 py-2 rounded-sm backdrop-blur-md text-[10px] font-mono uppercase tracking-[2px] transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {isCloning ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                            {isCloning ? "IMPORTING..." : "IMPORT SET"}
                                        </button>
                                    </div>
                                ) : (
                                    generatedImage && !isGeneratingImage && (
                                        <div className="inline-flex items-center gap-3 bg-black/70 border border-red-500/40 text-red-400 px-4 py-2 rounded-sm backdrop-blur-md text-[10px] font-mono uppercase tracking-[3px]">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                            CONCEPT FRAME
                                        </div>
                                    )
                                )}

                                {/* Edit frame — only when generated image exists */}
                                {generatedImage && !isGeneratingImage && (
                                    <button
                                        onClick={() => setShowInpaint(true)}
                                        className="inline-flex items-center gap-2 bg-black/70 hover:bg-black/90 border border-white/20 hover:border-white/40 text-white/70 hover:text-white px-4 py-2 rounded-sm backdrop-blur-md text-[10px] font-mono uppercase tracking-[2px] transition-all cursor-pointer"
                                    >
                                        <Paintbrush size={12} />
                                        Edit Frame
                                    </button>
                                )}

                                {/* Generate / Overhaul button */}
                                <button
                                    onClick={() => {
                                        if (hasData) {
                                            setConfirmAction({
                                                title: "Overhaul Set Design?",
                                                message: "This will completely overwrite your current set dressing, props, and lighting for this scene and cost 2 credits. This action cannot be undone.",
                                                onConfirm: () => handleGenerate(),
                                            });
                                        } else {
                                            handleGenerate();
                                        }
                                    }}
                                    disabled={isGenerating}
                                    className="inline-flex items-center gap-2 justify-center bg-red-600/80 hover:bg-red-600 border border-red-500/60 hover:border-red-400 text-white px-4 py-2 rounded-sm backdrop-blur-md text-[10px] font-mono uppercase tracking-[2px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(229,9,20,0.15)]"
                                >
                                    {isGenerating ? "GENERATING..." : (isGeneratingImage ? "RETRY DESIGN" : (hasData ? "OVERHAUL DESIGN" : "GENERATE SET"))}
                                    {!isGenerating && <span className="inline-flex items-center gap-1 ml-1 text-white/50"><Coins size={10} />2</span>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 text-center px-10 pointer-events-auto">
                            <div className="w-24 h-24 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
                                <Building2 size={32} className="text-white/10" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-white/30 uppercase tracking-[3px] mb-2">No Location Preview</div>
                                <div className="text-[11px] text-white/15 max-w-[240px] leading-relaxed mb-5">Generate a location image in Assets to see a visual preview of your set here.</div>
                                {onOpenAssets && (
                                    <button
                                        onClick={() => { onOpenAssets(); handleClose(); }}
                                        className="inline-flex items-center gap-2.5 px-5 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.2] rounded-xl text-[11px] font-bold text-white/70 hover:text-white uppercase tracking-widest transition-all cursor-pointer"
                                    >
                                        <ImagePlus size={14} />
                                        Open in Assets
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* INPAINT EDITOR OVERLAY */}
            {showInpaint && heroImage && (
                <InpaintEditor
                    src={heroImage}
                    styles={{}}
                    onClose={() => setShowInpaint(false)}
                    onSave={handleInpaintSave}
                    onApply={handleInpaintApply}
                />
            )}

            {/* CONFIRMATION MODAL */}
            {confirmAction && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
                    <div className="relative w-full max-w-md mx-6 bg-[#0A0A0A] border border-white/[0.08] rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-start gap-4 p-6 border-b border-white/[0.04]">
                            <div className="w-10 h-10 shrink-0 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <AlertTriangle size={18} className="text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-white text-[14px] font-bold uppercase tracking-[1.5px]" style={{ fontFamily: "Anton, sans-serif" }}>
                                    {confirmAction.title}
                                </h3>
                                <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed">
                                    {confirmAction.message}
                                </p>
                            </div>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-3 p-5">
                            <button
                                onClick={() => setConfirmAction(null)}
                                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-[2px] border border-white/10 text-white/60 hover:text-white hover:bg-white/[0.04] rounded-xl transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-[2px] bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all cursor-pointer"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
