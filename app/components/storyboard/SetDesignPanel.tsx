"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    Sparkles, X, Loader2, Save, Users, Package, CloudFog, Building2,
    ChevronRight, Eye
} from "lucide-react";
import { generateSetDesign, updateSetDesign } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";

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
}

interface LocationAsset {
    id: string;
    name: string;
    image_url?: string;
    image_views?: { wide?: string; front?: string; left?: string; right?: string; back?: string; };
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

export const SetDesignPanel: React.FC<SetDesignPanelProps> = ({
    isOpen, onClose, projectId, episodeId, sceneId,
    existingData, onUpdate, locationName, locations = [], sceneAction,
}) => {
    const [extrasText, setExtrasText] = useState("");
    const [dressingText, setDressingText] = useState("");
    const [atmosphere, setAtmosphere] = useState("");
    const [archNotes, setArchNotes] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeView, setActiveView] = useState<string>("front");
    const [isVisible, setIsVisible] = useState(false);

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
        try {
            const res = await generateSetDesign(projectId, episodeId, sceneId, sceneAction, locationName);
            const data = res.set_design || res;
            setExtrasText(extrasToText(data.extras));
            setDressingText(dressingToText(data.set_dressing));
            setAtmosphere(data.atmosphere || "");
            setArchNotes(data.architecture_notes || "");
            if (onUpdate) onUpdate(data);
            toastSuccess("Set design generation queued");
        } catch (e: any) {
            toastError(e?.response?.data?.detail || "Failed to generate set design");
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

    if (!isOpen) return null;

    const sections = [
        { key: "extras", label: "Scene Extras", sublabel: "Background characters that populate this world", icon: Users, value: extrasText, setter: setExtrasText, placeholder: "2x Juror — seated in jury box\n1x Bailiff — standing by door\n1x Court reporter — at desk\n5x Spectator — filling gallery rows" },
        { key: "dressing", label: "Set Dressing & Props", sublabel: "Physical objects that define the space", icon: Package, value: dressingText, setter: setDressingText, placeholder: "Mahogany judge's bench — center, elevated\nAmerican flag — floor stand, stage right\nWitness stand microphone — small flex mic\nEvidence table — labeled manila folders, water pitcher" },
        { key: "atmosphere", label: "Atmosphere & Lighting", sublabel: "The invisible character of the space", icon: CloudFog, value: atmosphere, setter: setAtmosphere, placeholder: "Warm afternoon light slanting through tall arched windows casting long shadows across the hardwood floor, dust motes suspended in golden beams, a sense of weight and consequence in the air..." },
        { key: "notes", label: "Architecture Notes", sublabel: "Structural and spatial context", icon: Building2, value: archNotes, setter: setArchNotes, placeholder: "Classic American federal courthouse — wood paneling, high ceilings, symmetrical layout. The bench is elevated 3 feet above the floor. Gallery seating for ~40 people." },
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
                                <span className="text-[10px] font-mono text-red-400 uppercase tracking-[4px]">Production Slate</span>
                            </div>
                        </div>
                        <h1 className="text-white leading-none uppercase pr-4 truncate mb-2"
                            style={{ fontFamily: "Anton, sans-serif", fontSize: "clamp(24px, 3vw, 40px)", letterSpacing: "1px" }}>
                            {locationName || "THE SET"}
                        </h1>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-white/30 uppercase tracking-widest">
                            <span>SCN {sceneId?.slice(0, 6) || "XXX"}</span>
                            <div className="w-1 h-1 rounded-full bg-white/20" />
                            <span>PRJ {projectId?.slice(0, 6) || "XXX"}</span>
                        </div>
                        
                        {hasData && !isGeneratingImage && (
                            <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                Design Active
                            </div>
                        )}
                        {isGeneratingImage && (
                            <div className="mt-4 inline-flex items-center gap-2 text-[10px] font-mono text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded uppercase tracking-widest">
                                <Loader2 size={12} className="animate-spin" />
                                Rendering View
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
                        {/* Generate */}
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
                                    {isGenerating ? "Processing Vision..." : (isGeneratingImage ? "Force Retry Design" : (hasData ? "Overhaul Design" : "Auto-Generate Set"))}
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-white/20 group-hover:text-red-400/50 relative z-10">CMD+G</span>
                        </button>

                        {/* Fields */}
                        <div className="space-y-4">
                            {sections.map(({ key, label, sublabel, icon: Icon, value, setter, placeholder }) => (
                                <div key={key} className="relative group bg-white/[0.01] rounded-2xl p-4 border border-white/[0.03] hover:border-white/[0.08] transition-colors">
                                    <div className="flex items-baseline gap-3 mb-2">
                                        <span className="text-[11px] font-bold text-red-300 uppercase tracking-widest">{label}</span>
                                        <span className="text-[10px] font-mono text-white/25 uppercase">{sublabel}</span>
                                    </div>
                                    <textarea value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                                        rows={key === "extras" || key === "dressing" ? 3 : 2}
                                        className="w-full bg-transparent text-[13px] text-white/80 focus:outline-none resize-none placeholder:text-white/10 leading-relaxed font-sans" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-4 shrink-0 flex items-center justify-between border-t border-white/[0.03] bg-black/20">
                        <button onClick={handleSave} disabled={isSaving}
                            className={`flex items-center gap-3 px-8 py-3 bg-red-600 hover:bg-red-500 text-white transition-all cursor-pointer rounded-xl ${isDirty ? "" : "opacity-90"}`}
                            style={{ boxShadow: isDirty ? "0 0 30px rgba(220, 38, 38, 0.4)" : "0 0 15px rgba(220, 38, 38, 0.15)" }}>
                            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span className="text-[11px] font-bold uppercase tracking-[2px]">{isSaving ? "Saving..." : "Lock Design"}</span>
                        </button>
                        <button onClick={handleClose} className="text-[11px] font-mono text-white/40 uppercase hover:text-white transition-colors cursor-pointer tracking-widest px-4 py-2">
                            Close
                        </button>
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
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
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

                            {generatedImage && !isGeneratingImage && (
                                <div className="absolute bottom-12 left-12 z-30 pointer-events-none">
                                     <div className="inline-flex items-center gap-3 bg-black/70 border border-red-500/40 text-red-400 px-4 py-2 rounded-sm backdrop-blur-md text-[10px] font-mono uppercase tracking-[3px]">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                        CONCEPT FRAME
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 text-center px-10">
                            <div className="w-24 h-24 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center">
                                <Building2 size={32} className="text-white/10" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-white/30 uppercase tracking-[3px] mb-2">No Location Preview</div>
                                <div className="text-[11px] text-white/15 max-w-[240px] leading-relaxed">Generate a location image in Assets to see a visual preview of your set here.</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
