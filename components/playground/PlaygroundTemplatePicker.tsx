"use client";

/**
 * PlaygroundTemplatePicker — Seedance 2.0 Template Sidebar
 *
 * Data source:
 *   1. Firestore `playground_templates` (visible only, client-filtered) — admin-managed
 *   2. Falls back to hardcoded templates if Firestore is empty
 *
 * Templates are NOT filtered by duration — user picks duration in the prompt bar.
 * De-duplicated by style/fightType so only one card per type shows.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Sparkles, Wand2, Play, User, Users, MapPin, Loader2 } from "lucide-react";
import { usePlayground } from "@/app/context/PlaygroundContext";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    type TemplateFamily, type SuperheroStyle, type FightType, type FightOutcome,
    type PlaygroundTemplate,
    SUPERHERO_STYLES, FIGHT_TYPES,
    SUPERHERO_TEMPLATES, FIGHT_TEMPLATES,
    assembleSuperheroPrompt, assembleFightPrompt,
    type Duration,
} from "@/lib/playgroundTemplates";


// Extended template type for Firestore entries
interface FirestoreTemplate extends PlaygroundTemplate {
    promptText?: string;
}

const FIRESTORE_COLLECTION = "playground_templates";


export default function PlaygroundTemplatePicker() {
    const { setPendingPrompt, setStylePref, setPendingVideoSettings } = usePlayground();

    const [family, setFamily] = useState<TemplateFamily>("superhero");
    const [styleFilter, setStyleFilter] = useState<SuperheroStyle | null>(null);
    const [fightFilter, setFightFilter] = useState<FightType | null>(null);
    const [fightOutcome, setFightOutcome] = useState<FightOutcome>("a_wins");
    const [appliedId, setAppliedId] = useState<string | null>(null);

    // Firestore-backed templates
    const [fsTemplates, setFsTemplates] = useState<FirestoreTemplate[]>([]);
    const [fsLoading, setFsLoading] = useState(true);
    const [useFirestore, setUseFirestore] = useState(false);

    // Fetch ALL templates from Firestore, filter visible client-side (no composite index needed)
    useEffect(() => {
        (async () => {
            try {
                const q = query(
                    collection(db, FIRESTORE_COLLECTION),
                    orderBy("order", "asc")
                );
                const snap = await getDocs(q);
                const entries: FirestoreTemplate[] = [];
                snap.forEach((d) => {
                    const data = d.data();
                    // Client-side visibility filter
                    if (data.visible === false) return;
                    entries.push({
                        id: d.id,
                        family: data.family || "superhero",
                        title: data.title || "",
                        subtitle: data.subtitle || "",
                        style: data.style,
                        fightType: data.fightType,
                        duration: data.duration || "5",
                        accent: data.accent || "#D4A843",
                        emoji: data.emoji || "⛰️",
                        previewVideoUrl: data.previewVideoUrl || "",
                        promptText: data.promptText || "",
                        requiredImages: data.requiredImages || 1,
                        supportsLocation: data.supportsLocation ?? true,
                    });
                });
                if (entries.length > 0) {
                    setFsTemplates(entries);
                    setUseFirestore(true);
                }
            } catch (e) {
                console.warn("[TemplatePicker] Firestore fetch failed, using hardcoded:", e);
            } finally {
                setFsLoading(false);
            }
        })();
    }, []);

    // Select the data source — de-duplicate by style/fightType (show one per type, not per duration)
    const dedup = useCallback((templates: FirestoreTemplate[], key: "style" | "fightType") => {
        const seen = new Set<string>();
        return templates.filter(t => {
            const k = (t as any)[key] || t.title;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, []);

    const allSuperhero = useMemo(() => {
        const src = useFirestore
            ? fsTemplates.filter(t => t.family === "superhero")
            : SUPERHERO_TEMPLATES as FirestoreTemplate[];
        return dedup(src, "style");
    }, [useFirestore, fsTemplates, dedup]);

    const allFight = useMemo(() => {
        const src = useFirestore
            ? fsTemplates.filter(t => t.family === "fight")
            : FIGHT_TEMPLATES as FirestoreTemplate[];
        return dedup(src, "fightType");
    }, [useFirestore, fsTemplates, dedup]);

    // Filter by optional style/type
    const filtered = (family === "superhero" ? allSuperhero : allFight)
        .filter(t => {
            if (family === "superhero" && styleFilter) return t.style === styleFilter;
            if (family === "fight" && fightFilter) return t.fightType === fightFilter;
            return true;
        });

    const handleClick = useCallback((template: FirestoreTemplate) => {
        let prompt: string;

        // Firestore templates have promptText directly
        if (template.promptText) {
            prompt = template.promptText;
        } else if (template.family === "superhero" && template.style) {
            prompt = assembleSuperheroPrompt(template.style as SuperheroStyle, template.duration as Duration, false);
        } else if (template.family === "fight" && template.fightType) {
            prompt = assembleFightPrompt(template.fightType as FightType, template.duration as Duration, fightOutcome, false);
        } else return;

        setPendingPrompt(prompt);
        setStylePref("style", "cinematic");
        // Auto-configure video settings (duration from user's current selection, not template)
        setPendingVideoSettings({
            mode: 'video',
            provider: 'seedance-2',
            duration: template.duration,
            quality: 'pro',
        });
        setAppliedId(template.id);
        setTimeout(() => setAppliedId(null), 2500);
    }, [setPendingPrompt, setStylePref, setPendingVideoSettings, fightOutcome]);

    const styleEntries = Object.entries(SUPERHERO_STYLES) as [SuperheroStyle, typeof SUPERHERO_STYLES[SuperheroStyle]][];
    const fightEntries = Object.entries(FIGHT_TYPES) as [FightType, typeof FIGHT_TYPES[FightType]][];

    return (
        <div className="h-full flex flex-col bg-[#050505]">
            {/* ── Header ── */}
            <div className="px-4 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-5 h-5 rounded-md bg-[#E50914]/15 border border-[#E50914]/20 flex items-center justify-center">
                        <Sparkles size={10} className="text-[#E50914]" />
                    </div>
                    <span className="text-[10px] font-mono text-white/50 uppercase tracking-[2px] font-bold">
                        Seedance 2.0
                    </span>
                    {useFirestore && (
                        <span className="text-[7px] font-mono text-green-500/50 uppercase tracking-[1px]">● Live</span>
                    )}
                </div>
            </div>

            {/* ── Family Toggle ── */}
            <div className="px-3 py-2.5 border-b border-white/[0.04] shrink-0">
                <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.04]">
                    {([["superhero", "⚡ Transformation"], ["fight", "⚔️ Fight"]] as [TemplateFamily, string][]).map(([f, label]) => (
                        <button key={f} onClick={() => { setFamily(f); setStyleFilter(null); setFightFilter(null); }}
                            className={`flex-1 px-2 py-1.5 text-[8px] font-bold uppercase tracking-[1px] rounded-md transition-all cursor-pointer border-none ${
                                family === f ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                            }`}>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Style / Type Filter ── */}
            <div className="px-3 py-2 border-b border-white/[0.04] shrink-0">
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => { setStyleFilter(null); setFightFilter(null); }}
                        className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border ${
                            (family === 'superhero' ? !styleFilter : !fightFilter)
                                ? 'border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]'
                                : 'border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/15'
                        }`}>
                        All
                    </button>
                    {family === "superhero"
                        ? styleEntries.map(([key, meta]) => (
                            <button key={key}
                                onClick={() => setStyleFilter(styleFilter === key ? null : key)}
                                className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border`}
                                style={styleFilter === key
                                    ? { borderColor: `${meta.accent}50`, backgroundColor: `${meta.accent}18`, color: meta.accent }
                                    : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }
                                }>
                                {meta.emoji} {meta.label.split('/')[0].trim()}
                            </button>
                        ))
                        : fightEntries.map(([key, meta]) => (
                            <button key={key}
                                onClick={() => setFightFilter(fightFilter === key ? null : key)}
                                className={`px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border`}
                                style={fightFilter === key
                                    ? { borderColor: `${meta.accent}50`, backgroundColor: `${meta.accent}18`, color: meta.accent }
                                    : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }
                                }>
                                {meta.emoji} {meta.label.split(' ')[0]}
                            </button>
                        ))
                    }
                </div>
            </div>

            {/* ── Fight Outcome Selector (only for fight family) ── */}
            {family === "fight" && (
                <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
                    <span className="text-[7px] font-mono text-white/25 uppercase tracking-[1px]">Outcome</span>
                    <div className="flex gap-1">
                        {([["a_wins", "A Wins"], ["b_wins", "B Wins"], ["unresolved", "Draw"]] as [FightOutcome, string][]).map(([o, label]) => (
                            <button key={o} onClick={() => setFightOutcome(o)}
                                className={`px-2 py-1 rounded-full text-[7px] font-bold uppercase tracking-[1px] transition-all cursor-pointer border ${
                                    fightOutcome === o
                                        ? 'border-[#E50914]/30 bg-[#E50914]/10 text-[#E50914]'
                                        : 'border-white/[0.06] text-white/25 hover:text-white/50'
                                }`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Template Cards ── */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
                {fsLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2">
                        <Loader2 size={14} className="animate-spin text-[#E50914]/50" />
                        <span className="text-[9px] font-mono text-white/20">Loading templates…</span>
                    </div>
                ) : (
                    <>
                        {filtered.map((template, i) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                index={i}
                                isApplied={appliedId === template.id}
                                onClick={() => handleClick(template as FirestoreTemplate)}
                            />
                        ))}
                        {filtered.length === 0 && (
                            <div className="text-center py-8 text-[10px] text-white/15 font-mono">No templates match</div>
                        )}
                    </>
                )}
            </div>

            {/* ── Footer ── */}
            <div className="px-4 py-3 border-t border-white/[0.04] shrink-0">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                        {family === "superhero"
                            ? <><User size={9} className="text-blue-400/60" /><span className="text-[7px] text-white/20 font-mono">1 character image required</span></>
                            : <><Users size={9} className="text-blue-400/60" /><span className="text-[7px] text-white/20 font-mono">2 character images required</span></>
                        }
                    </div>
                    <div className="flex items-center gap-1.5">
                        <MapPin size={9} className="text-emerald-400/60" />
                        <span className="text-[7px] text-white/20 font-mono">Location image optional</span>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes tplCardIn {
                    from { opacity: 0; transform: translateX(8px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
//  TEMPLATE CARD — Higgsfield-style video preview
// ═══════════════════════════════════════════════════════════════

function TemplateCard({ template, index, isApplied, onClick }: {
    template: PlaygroundTemplate;
    index: number;
    isApplied: boolean;
    onClick: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`w-full group relative rounded-xl border overflow-hidden text-left transition-all duration-300 cursor-pointer ${
                isApplied
                    ? "border-[#E50914]/40 bg-[#E50914]/10"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
            style={{
                animation: `tplCardIn 0.35s ease ${index * 50}ms both`,
                borderColor: isHovered && !isApplied ? `${template.accent}35` : undefined,
            }}
        >
            {/* Video / Gradient thumbnail */}
            <div className="h-[100px] w-full relative overflow-hidden">
                {/* Gradient fallback */}
                <div className="absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${template.accent}20, ${template.accent}08, #0a0a0a)` }} />

                {/* Auto-playing video preview */}
                {template.previewVideoUrl && (
                    <video
                        src={template.previewVideoUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}

                {/* Overlay content */}
                <div className="absolute inset-0 flex items-center justify-between p-3 z-10">
                    <span className="text-3xl">{template.emoji}</span>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                            isHovered ? 'bg-white/20 scale-110' : 'bg-white/10'
                        }`}>
                            <Play size={11} fill="white" className="text-white ml-0.5" />
                        </div>
                    </div>
                </div>

                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-[5]"
                    style={{ background: `radial-gradient(ellipse at top, ${template.accent}12 0%, transparent 60%)` }} />
            </div>

            {/* Info */}
            <div className="p-3 pt-2.5">
                <h3 className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors leading-tight mb-0.5">
                    {template.title}
                </h3>
                <p className="text-[8px] text-white/20 group-hover:text-white/35 transition-colors">
                    {template.subtitle}
                </p>

                {isApplied ? (
                    <div className="flex items-center gap-1 mt-2">
                        <Wand2 size={9} className="text-[#E50914]" />
                        <span className="text-[8px] font-mono text-[#E50914] uppercase tracking-[1px] font-bold">
                            Applied ✓
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Wand2 size={8} className="text-white/30" />
                        <span className="text-[7px] font-mono text-white/30 uppercase tracking-[1px]">
                            Click to apply
                        </span>
                    </div>
                )}
            </div>
        </button>
    );
}
