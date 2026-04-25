"use client";

/**
 * PlaygroundTemplatePicker — Multi-model Template Sidebar
 *
 * Model tabs: Seedance 2.0 | Kling 3.0
 *
 * Seedance: Firestore `playground_templates` → hardcoded fallback
 * Kling:    Hardcoded klingTemplates.ts (admin Firestore support can be added later)
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Sparkles, Wand2, Play, User, Users, MapPin, Loader2, ImageIcon, Video } from "lucide-react";
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
import {
    type KlingTemplate, type EmotionFamily,
    KLING_TEMPLATES, EMOTION_FAMILIES,
} from "@/lib/klingTemplates";

type ModelTab = "seedance" | "kling";

interface FirestoreTemplate extends PlaygroundTemplate {
    promptText?: string;
}

const FIRESTORE_COLLECTION = "playground_templates";

export default function PlaygroundTemplatePicker() {
    const { setPendingPrompt, setStylePref, setPendingVideoSettings } = usePlayground();

    const [modelTab, setModelTab] = useState<ModelTab>("seedance");

    // ── Seedance state ──
    const [family, setFamily] = useState<TemplateFamily>("superhero");
    const [styleFilter, setStyleFilter] = useState<SuperheroStyle | null>(null);
    const [fightFilter, setFightFilter] = useState<FightType | null>(null);
    const [fightOutcome, setFightOutcome] = useState<FightOutcome>("a_wins");
    const [appliedId, setAppliedId] = useState<string | null>(null);

    // Firestore-backed Seedance templates
    const [fsTemplates, setFsTemplates] = useState<FirestoreTemplate[]>([]);
    const [fsLoading, setFsLoading] = useState(true);
    const [useFirestore, setUseFirestore] = useState(false);

    // ── Kling state ──
    const [klingEmoFilter, setKlingEmoFilter] = useState<EmotionFamily | null>(null);
    const [fsKling, setFsKling] = useState<KlingTemplate[]>([]);
    const [useKlingFs, setUseKlingFs] = useState(false);

    // Fetch Seedance templates from Firestore
    useEffect(() => {
        (async () => {
            try {
                const q = query(collection(db, FIRESTORE_COLLECTION), orderBy("order", "asc"));
                const snap = await getDocs(q);
                const entries: FirestoreTemplate[] = [];
                snap.forEach((d) => {
                    const data = d.data();
                    if (data.visible === false) return;
                    entries.push({
                        id: d.id, family: data.family || "superhero",
                        title: data.title || "", subtitle: data.subtitle || "",
                        style: data.style, fightType: data.fightType,
                        duration: data.duration || "5", accent: data.accent || "#D4A843",
                        emoji: data.emoji || "⛰️", previewVideoUrl: data.previewVideoUrl || "",
                        promptText: data.promptText || "",
                        requiredImages: data.requiredImages || 1,
                        supportsLocation: data.supportsLocation ?? true,
                    });
                });
                if (entries.length > 0) { setFsTemplates(entries); setUseFirestore(true); }
            } catch (e) {
                console.warn("[TemplatePicker] Seedance Firestore fetch failed, using hardcoded:", e);
            } finally { setFsLoading(false); }
        })();
        // Fetch Kling templates from Firestore
        (async () => {
            try {
                const q = query(collection(db, "kling_templates"), orderBy("order", "asc"));
                const snap = await getDocs(q);
                const entries: KlingTemplate[] = [];
                snap.forEach((d) => {
                    const data = d.data();
                    if (data.visible === false) return;
                    entries.push({
                        id: d.id,
                        emotionFamily: (data.emotionFamily || "tender") as EmotionFamily,
                        title: data.title || "", subtitle: data.subtitle || "",
                        accent: data.accent || "#06B6D4", emoji: data.emoji || "🎬",
                        promptText: data.promptText || "",
                        previewVideoUrl: data.previewVideoUrl || "",
                        requiredImages: data.requiredImages ?? 1,
                    });
                });
                if (entries.length > 0) { setFsKling(entries); setUseKlingFs(true); }
            } catch (e) {
                console.warn("[TemplatePicker] Kling Firestore fetch failed, using hardcoded:", e);
            }
        })();
    }, []);

    // De-duplicate Seedance templates
    const dedup = useCallback((templates: FirestoreTemplate[], key: "style" | "fightType") => {
        const seen = new Set<string>();
        return templates.filter(t => {
            const k = (t as any)[key] || t.title;
            if (seen.has(k)) return false;
            seen.add(k); return true;
        });
    }, []);

    const allSuperhero = useMemo(() => dedup(useFirestore ? fsTemplates.filter(t => t.family === "superhero") : SUPERHERO_TEMPLATES as FirestoreTemplate[], "style"), [useFirestore, fsTemplates, dedup]);
    const allFight = useMemo(() => dedup(useFirestore ? fsTemplates.filter(t => t.family === "fight") : FIGHT_TEMPLATES as FirestoreTemplate[], "fightType"), [useFirestore, fsTemplates, dedup]);

    const seedanceFiltered = (family === "superhero" ? allSuperhero : allFight).filter(t => {
        if (family === "superhero" && styleFilter) return t.style === styleFilter;
        if (family === "fight" && fightFilter) return t.fightType === fightFilter;
        return true;
    });

    // Kling filtered — Firestore if available, else hardcoded
    const klingSource = useKlingFs ? fsKling : KLING_TEMPLATES;
    const klingFiltered = useMemo(() => {
        if (klingEmoFilter) return klingSource.filter(t => t.emotionFamily === klingEmoFilter);
        return klingSource;
    }, [klingSource, klingEmoFilter]);

    // ── Click handlers ──
    const handleSeedanceClick = useCallback((template: FirestoreTemplate) => {
        let prompt: string;
        if (template.promptText) { prompt = template.promptText; }
        else if (template.family === "superhero" && template.style) { prompt = assembleSuperheroPrompt(template.style as SuperheroStyle, template.duration as Duration, false); }
        else if (template.family === "fight" && template.fightType) { prompt = assembleFightPrompt(template.fightType as FightType, template.duration as Duration, fightOutcome, false); }
        else return;
        setPendingPrompt(prompt);
        setStylePref("style", "cinematic");
        setPendingVideoSettings({ mode: 'video', provider: 'seedance-2', duration: template.duration, quality: 'pro' });
        setAppliedId(template.id);
        setTimeout(() => setAppliedId(null), 2500);
    }, [setPendingPrompt, setStylePref, setPendingVideoSettings, fightOutcome]);

    const handleKlingClick = useCallback((template: KlingTemplate) => {
        setPendingPrompt(template.promptText);
        setStylePref("style", "cinematic");
        setPendingVideoSettings({ mode: 'video', provider: 'kling-v3', duration: '5', quality: 'pro' });
        setAppliedId(template.id);
        setTimeout(() => setAppliedId(null), 2500);
    }, [setPendingPrompt, setStylePref, setPendingVideoSettings]);

    const styleEntries = Object.entries(SUPERHERO_STYLES) as [SuperheroStyle, typeof SUPERHERO_STYLES[SuperheroStyle]][];
    const fightEntries = Object.entries(FIGHT_TYPES) as [FightType, typeof FIGHT_TYPES[FightType]][];
    const emoEntries = Object.entries(EMOTION_FAMILIES) as [EmotionFamily, typeof EMOTION_FAMILIES[EmotionFamily]][];

    return (
        <div className="h-full flex flex-col bg-[#050505]">
            {/* ── Header with model tabs ── */}
            <div className="px-3 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-5 h-5 rounded-md bg-[#E50914]/15 border border-[#E50914]/20 flex items-center justify-center">
                        <Sparkles size={10} className="text-[#E50914]" />
                    </div>
                    <span className="text-[10px] font-mono text-white/50 uppercase tracking-[2px] font-bold">
                        Templates
                    </span>
                    {((useFirestore && modelTab === "seedance") || (useKlingFs && modelTab === "kling")) && (
                        <span className="text-[7px] font-mono text-green-500/50 uppercase tracking-[1px]">● Live</span>
                    )}
                </div>
                {/* Model selector */}
                <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.04]">
                    <button onClick={() => setModelTab("seedance")}
                        className={`flex-1 px-2 py-1.5 text-[8px] font-bold uppercase tracking-[1px] rounded-md transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                            modelTab === "seedance" ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
                        }`}>
                        <Video size={9} /> Seedance 2.0
                    </button>
                    <button onClick={() => setModelTab("kling")}
                        className={`flex-1 px-2 py-1.5 text-[8px] font-bold uppercase tracking-[1px] rounded-md transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                            modelTab === "kling" ? 'bg-[#06B6D4]/20 text-[#06B6D4]' : 'text-white/30 hover:text-white/50'
                        }`}>
                        <Video size={9} /> Kling 3.0
                    </button>
                </div>
            </div>

            {/* ═══ SEEDANCE TAB ═══ */}
            {modelTab === "seedance" && (
                <>
                    {/* Family Toggle */}
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

                    {/* Style/Type Filter */}
                    <div className="px-3 py-2 border-b border-white/[0.04] shrink-0">
                        <div className="flex flex-wrap gap-1.5">
                            <FilterChip active={family === 'superhero' ? !styleFilter : !fightFilter}
                                onClick={() => { setStyleFilter(null); setFightFilter(null); }} label="All" />
                            {family === "superhero"
                                ? styleEntries.map(([key, meta]) => (
                                    <FilterChip key={key} active={styleFilter === key}
                                        onClick={() => setStyleFilter(styleFilter === key ? null : key)}
                                        label={`${meta.emoji} ${meta.label.split('/')[0].trim()}`}
                                        activeColor={meta.accent} />
                                ))
                                : fightEntries.map(([key, meta]) => (
                                    <FilterChip key={key} active={fightFilter === key}
                                        onClick={() => setFightFilter(fightFilter === key ? null : key)}
                                        label={`${meta.emoji} ${meta.label.split(' ')[0]}`}
                                        activeColor={meta.accent} />
                                ))
                            }
                        </div>
                    </div>

                    {/* Fight Outcome */}
                    {family === "fight" && (
                        <div className="px-3 py-2 border-b border-white/[0.04] shrink-0 flex items-center gap-2">
                            <span className="text-[7px] font-mono text-white/25 uppercase tracking-[1px]">Outcome</span>
                            <div className="flex gap-1">
                                {([["a_wins", "A Wins"], ["b_wins", "B Wins"], ["unresolved", "Draw"]] as [FightOutcome, string][]).map(([o, label]) => (
                                    <FilterChip key={o} active={fightOutcome === o} onClick={() => setFightOutcome(o)} label={label} small />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Seedance Cards */}
                    <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
                        {fsLoading ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                                <Loader2 size={14} className="animate-spin text-[#E50914]/50" />
                                <span className="text-[9px] font-mono text-white/20">Loading templates…</span>
                            </div>
                        ) : (
                            <>
                                {seedanceFiltered.map((template, i) => (
                                    <TemplateCard key={template.id} template={template} index={i}
                                        isApplied={appliedId === template.id}
                                        onClick={() => handleSeedanceClick(template as FirestoreTemplate)} />
                                ))}
                                {seedanceFiltered.length === 0 && (
                                    <div className="text-center py-8 text-[10px] text-white/15 font-mono">No templates match</div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Seedance Footer */}
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
                </>
            )}

            {/* ═══ KLING TAB ═══ */}
            {modelTab === "kling" && (
                <>
                    {/* Emotion filter chips */}
                    <div className="px-3 py-2.5 border-b border-white/[0.04] shrink-0">
                        <div className="flex flex-wrap gap-1.5">
                            <FilterChip active={!klingEmoFilter} onClick={() => setKlingEmoFilter(null)}
                                label="All" activeColor="#06B6D4" />
                            {emoEntries.map(([key, meta]) => (
                                <FilterChip key={key} active={klingEmoFilter === key}
                                    onClick={() => setKlingEmoFilter(klingEmoFilter === key ? null : key)}
                                    label={`${meta.emoji} ${meta.label}`}
                                    activeColor={meta.accent} />
                            ))}
                        </div>
                    </div>

                    {/* Kling Cards */}
                    <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-3 space-y-2">
                        {klingFiltered.map((template, i) => (
                            <KlingCard key={template.id} template={template} index={i}
                                isApplied={appliedId === template.id}
                                onClick={() => handleKlingClick(template)} />
                        ))}
                        {klingFiltered.length === 0 && (
                            <div className="text-center py-8 text-[10px] text-white/15 font-mono">No templates match</div>
                        )}
                    </div>

                    {/* Kling Footer */}
                    <div className="px-4 py-3 border-t border-white/[0.04] shrink-0">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                                <User size={9} className="text-[#06B6D4]/60" />
                                <span className="text-[7px] text-white/20 font-mono">1 character reference image required</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[7px] text-white/15 font-mono">Auto-sets Kling 3.0 provider</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

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
//  FILTER CHIP
// ═══════════════════════════════════════════════════════════════

function FilterChip({ active, onClick, label, activeColor, small }: {
    active: boolean; onClick: () => void; label: string;
    activeColor?: string; small?: boolean;
}) {
    return (
        <button onClick={onClick}
            className={`px-2.5 py-1 rounded-full font-bold uppercase transition-all cursor-pointer border ${
                small ? 'text-[7px] tracking-[1px]' : 'text-[8px] tracking-[1px]'
            }`}
            style={active
                ? { borderColor: `${activeColor || '#E50914'}50`, backgroundColor: `${activeColor || '#E50914'}18`, color: activeColor || '#E50914' }
                : { borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }
            }>
            {label}
        </button>
    );
}


// ═══════════════════════════════════════════════════════════════
//  SEEDANCE TEMPLATE CARD
// ═══════════════════════════════════════════════════════════════

function TemplateCard({ template, index, isApplied, onClick }: {
    template: PlaygroundTemplate; index: number; isApplied: boolean; onClick: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
            className={`w-full group relative rounded-xl border overflow-hidden text-left transition-all duration-300 cursor-pointer ${
                isApplied ? "border-[#E50914]/40 bg-[#E50914]/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
            style={{ animation: `tplCardIn 0.35s ease ${index * 50}ms both`, borderColor: isHovered && !isApplied ? `${template.accent}35` : undefined }}>
            <div className="h-[100px] w-full relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${template.accent}20, ${template.accent}08, #0a0a0a)` }} />
                {template.previewVideoUrl && (
                    <video src={template.previewVideoUrl} autoPlay muted loop playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-between p-3 z-10">
                    <span className="text-3xl">{template.emoji}</span>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isHovered ? 'bg-white/20 scale-110' : 'bg-white/10'}`}>
                        <Play size={11} fill="white" className="text-white ml-0.5" />
                    </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-[5]"
                    style={{ background: `radial-gradient(ellipse at top, ${template.accent}12 0%, transparent 60%)` }} />
            </div>
            <div className="p-3 pt-2.5">
                <h3 className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors leading-tight mb-0.5">{template.title}</h3>
                <p className="text-[8px] text-white/20 group-hover:text-white/35 transition-colors">{template.subtitle}</p>
                {isApplied ? (
                    <div className="flex items-center gap-1 mt-2">
                        <Wand2 size={9} className="text-[#E50914]" />
                        <span className="text-[8px] font-mono text-[#E50914] uppercase tracking-[1px] font-bold">Applied ✓</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Wand2 size={8} className="text-white/30" />
                        <span className="text-[7px] font-mono text-white/30 uppercase tracking-[1px]">Click to apply</span>
                    </div>
                )}
            </div>
        </button>
    );
}


// ═══════════════════════════════════════════════════════════════
//  KLING TEMPLATE CARD
// ═══════════════════════════════════════════════════════════════

function KlingCard({ template, index, isApplied, onClick }: {
    template: KlingTemplate; index: number; isApplied: boolean; onClick: () => void;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const emoMeta = EMOTION_FAMILIES[template.emotionFamily];

    return (
        <button onClick={onClick} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}
            className={`w-full group relative rounded-xl border overflow-hidden text-left transition-all duration-300 cursor-pointer ${
                isApplied ? "border-[#06B6D4]/40 bg-[#06B6D4]/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
            style={{ animation: `tplCardIn 0.35s ease ${index * 50}ms both`, borderColor: isHovered && !isApplied ? `${template.accent}35` : undefined }}>
            <div className="h-[100px] w-full relative overflow-hidden">
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${template.accent}20, ${template.accent}08, #0a0a0a)` }} />
                {template.previewVideoUrl && (
                    <video src={template.previewVideoUrl} autoPlay muted loop playsInline preload="auto" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-between p-3 z-10">
                    <span className="text-3xl">{template.emoji}</span>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isHovered ? 'bg-white/20 scale-110' : 'bg-white/10'}`}>
                            <Play size={11} fill="white" className="text-white ml-0.5" />
                        </div>
                        {template.requiredImages === 1 && (
                            <span className="text-[6px] font-mono text-white/30 bg-black/40 px-1.5 py-0.5 rounded-full uppercase">
                                I2V
                            </span>
                        )}
                    </div>
                </div>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-[5]"
                    style={{ background: `radial-gradient(ellipse at top, ${template.accent}12 0%, transparent 60%)` }} />
            </div>
            <div className="p-3 pt-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors leading-tight">{template.title}</h3>
                    {emoMeta && (
                        <span className="text-[6px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ backgroundColor: `${emoMeta.accent}15`, color: `${emoMeta.accent}90` }}>
                            {emoMeta.writer}
                        </span>
                    )}
                </div>
                <p className="text-[8px] text-white/20 group-hover:text-white/35 transition-colors">{template.subtitle}</p>
                {isApplied ? (
                    <div className="flex items-center gap-1 mt-2">
                        <Wand2 size={9} className="text-[#06B6D4]" />
                        <span className="text-[8px] font-mono text-[#06B6D4] uppercase tracking-[1px] font-bold">Applied ✓</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Wand2 size={8} className="text-white/30" />
                        <span className="text-[7px] font-mono text-white/30 uppercase tracking-[1px]">Click to apply</span>
                    </div>
                )}
            </div>
        </button>
    );
}
