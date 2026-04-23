"use client";

/**
 * Admin Playground Templates — CRUD management for Seedance 2.0 templates.
 *
 * Firestore collection: `playground_templates`
 * Each doc: { family, style, fightType, duration, title, subtitle, accent, emoji,
 *             previewVideoUrl, promptText, visible, order, requiredImages, supportsLocation }
 */

import { useEffect, useState, useCallback } from "react";
import {
    collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Sparkles, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Save, X,
    ChevronDown, Film, Video, Upload,
} from "lucide-react";
import {
    ALL_TEMPLATES,
    assembleSuperheroPrompt, assembleFightPrompt,
    type SuperheroStyle, type Duration, type FightType,
} from "@/lib/playgroundTemplates";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface PGTemplate {
    id: string;
    family: string;
    style?: string;
    fightType?: string;
    duration: string;
    title: string;
    subtitle: string;
    accent: string;
    emoji: string;
    previewVideoUrl: string;
    promptText: string;
    visible: boolean;
    order: number;
    requiredImages: number;
    supportsLocation: boolean;
    created_at?: any;
    updated_at?: any;
}

const EMPTY_TEMPLATE: Omit<PGTemplate, "id"> = {
    family: "superhero",
    style: "ground",
    fightType: "",
    duration: "5",
    title: "",
    subtitle: "",
    accent: "#D4A843",
    emoji: "⛰️",
    previewVideoUrl: "",
    promptText: "",
    visible: true,
    order: 0,
    requiredImages: 1,
    supportsLocation: true,
};

const FAMILY_OPTIONS = [
    { value: "superhero", label: "Superhero Transformation" },
    { value: "fight", label: "Fight" },
];

const STYLE_OPTIONS = [
    { value: "ground", label: "Ground / Land", accent: "#D4A843", emoji: "⛰️" },
    { value: "mystic", label: "Mystic / Magical", accent: "#A855F7", emoji: "✨" },
    { value: "tech", label: "Tech / Futuristic", accent: "#3B82F6", emoji: "⚡" },
    { value: "dark", label: "Dark / Shadow", accent: "#6B7280", emoji: "🌑" },
    { value: "water", label: "Water / Elemental", accent: "#06B6D4", emoji: "🌊" },
];

const FIGHT_OPTIONS = [
    { value: "hand", label: "Hand Combat", accent: "#EF4444", emoji: "👊" },
    { value: "weapon", label: "Weapon Combat", accent: "#F59E0B", emoji: "⚔️" },
    { value: "superhero_combat", label: "Superhero Combat", accent: "#8B5CF6", emoji: "💥" },
    { value: "hybrid", label: "Hybrid Combat", accent: "#EC4899", emoji: "🔥" },
];

const COLLECTION = "playground_templates";

// ═══════════════════════════════════════════════════════════════
//  PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminPlaygroundTemplatesPage() {
    const [templates, setTemplates] = useState<PGTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<PGTemplate | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);
    const [filterFamily, setFilterFamily] = useState<string>("all");
    const [seeding, setSeeding] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, COLLECTION), orderBy("order", "asc"));
            const snap = await getDocs(q);
            const entries: PGTemplate[] = [];
            snap.forEach((d) => {
                entries.push({ id: d.id, ...d.data() } as PGTemplate);
            });
            setTemplates(entries);
        } catch (e) {
            console.error("[PGTemplates] Load failed:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const handleCreate = () => {
        setIsNew(true);
        setEditing({ ...EMPTY_TEMPLATE, id: "", order: templates.length } as PGTemplate);
    };

    const handleEdit = (t: PGTemplate) => {
        setIsNew(false);
        setEditing({ ...t });
    };

    const handleSave = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            const { id, ...data } = editing;
            const payload = { ...data, updated_at: serverTimestamp() };
            if (isNew) {
                (payload as any).created_at = serverTimestamp();
                await addDoc(collection(db, COLLECTION), payload);
            } else {
                await updateDoc(doc(db, COLLECTION, id), payload);
            }
            setEditing(null);
            await loadTemplates();
        } catch (e) {
            console.error("[PGTemplates] Save failed:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this template permanently?")) return;
        setDeleting(id);
        try {
            await deleteDoc(doc(db, COLLECTION, id));
            setTemplates((prev) => prev.filter((t) => t.id !== id));
        } catch (e) {
            console.error("[PGTemplates] Delete failed:", e);
        } finally {
            setDeleting(null);
        }
    };

    const handleToggle = async (id: string, current: boolean) => {
        setToggling(id);
        try {
            await updateDoc(doc(db, COLLECTION, id), { visible: !current });
            setTemplates((prev) =>
                prev.map((t) => (t.id === id ? { ...t, visible: !current } : t))
            );
        } catch (e) {
            console.error("[PGTemplates] Toggle failed:", e);
        } finally {
            setToggling(null);
        }
    };

    const filtered = filterFamily === "all"
        ? templates
        : templates.filter((t) => t.family === filterFamily);

    const visibleCount = templates.filter((t) => t.visible).length;

    // ── SEED FROM CODE ──
    const handleSeed = async () => {
        if (!confirm(`Seed ${ALL_TEMPLATES.length} templates from code into Firestore?`)) return;
        setSeeding(true);
        try {
            let order = 0;
            for (const t of ALL_TEMPLATES) {
                let promptText = "";
                if (t.family === "superhero" && t.style) {
                    promptText = assembleSuperheroPrompt(t.style as SuperheroStyle, t.duration as Duration, false);
                } else if (t.family === "fight" && t.fightType) {
                    promptText = assembleFightPrompt(t.fightType as FightType, t.duration as Duration, "a_wins", false);
                }
                await addDoc(collection(db, COLLECTION), {
                    family: t.family, style: t.style || "", fightType: t.fightType || "",
                    duration: t.duration, title: t.title, subtitle: t.subtitle,
                    accent: t.accent, emoji: t.emoji,
                    previewVideoUrl: t.previewVideoUrl || "",
                    promptText, visible: true, order,
                    requiredImages: t.requiredImages, supportsLocation: t.supportsLocation,
                    created_at: serverTimestamp(), updated_at: serverTimestamp(),
                });
                order++;
            }
            await loadTemplates();
        } catch (e) {
            console.error("[PGTemplates] Seed failed:", e);
        } finally {
            setSeeding(false);
        }
    };

    // ── RENDER ──

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-red-500" />
                <span className="ml-3 text-sm font-mono text-[#666]">Loading playground templates...</span>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Sparkles size={20} className="text-red-500" />
                    <h1 className="text-3xl font-bold font-mono uppercase tracking-tight">
                        Playground Templates
                    </h1>
                </div>
                <p className="text-sm text-[#666] font-mono">
                    Create, edit, hide, or delete Seedance 2.0 video templates shown in the Playground sidebar.
                </p>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 mb-6 p-4 border-2 border-[#222] bg-[#0A0A0A]">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Total</span>
                    <span className="text-lg font-bold font-mono text-white">{templates.length}</span>
                </div>
                <div className="w-px h-6 bg-[#222]" />
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Visible</span>
                    <span className="text-lg font-bold font-mono text-green-500">{visibleCount}</span>
                </div>
                <div className="w-px h-6 bg-[#222]" />
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Hidden</span>
                    <span className="text-lg font-bold font-mono text-red-500">{templates.length - visibleCount}</span>
                </div>
                <div className="flex-1" />
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer"
                >
                    <Plus size={14} /> New Template
                </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 mb-6">
                {[{ value: "all", label: "All" }, ...FAMILY_OPTIONS].map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilterFamily(f.value)}
                        className={`px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 transition-colors cursor-pointer ${
                            filterFamily === f.value
                                ? "border-red-600 bg-red-900/20 text-red-500"
                                : "border-[#222] text-[#666] hover:text-white hover:border-[#444]"
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Template grid */}
            {filtered.length === 0 && templates.length === 0 ? (
                <div className="p-12 text-center border-2 border-[#222] bg-[#0A0A0A]">
                    <Video size={36} className="text-[#333] mx-auto mb-4" />
                    <h3 className="text-lg font-mono font-bold text-white mb-2">No Templates in Firestore</h3>
                    <p className="text-sm font-mono text-[#666] mb-6 max-w-md mx-auto">
                        The <code className="text-red-500/60">playground_templates</code> collection is empty.
                        Seed all {ALL_TEMPLATES.length} hardcoded templates into Firestore to get started.
                    </p>
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {seeding ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {seeding ? `Seeding ${ALL_TEMPLATES.length} templates…` : `Seed ${ALL_TEMPLATES.length} Templates`}
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-sm font-mono text-[#444] border-2 border-[#222]">
                    No templates match the current filter.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((t) => (
                        <div
                            key={t.id}
                            className={`rounded-lg overflow-hidden border-2 transition-all ${
                                t.visible
                                    ? "border-green-600/50 bg-[#0A0A0A]"
                                    : "border-[#222] bg-[#080808] opacity-60"
                            }`}
                        >
                            {/* Video preview */}
                            <div className="aspect-video relative bg-[#111]">
                                {t.previewVideoUrl ? (
                                    <video
                                        src={t.previewVideoUrl}
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center"
                                        style={{ background: `linear-gradient(135deg, ${t.accent}20, #0a0a0a)` }}>
                                        <Video size={28} className="text-[#333]" />
                                    </div>
                                )}
                                {/* Badges */}
                                <div className="absolute top-2 left-2 flex gap-1.5">
                                    <span className="px-2 py-1 rounded bg-black/70 text-[9px] font-mono font-bold uppercase tracking-wider text-white/80">
                                        {t.family === "superhero" ? "Transform" : "Fight"}
                                    </span>
                                    <span className="px-2 py-1 rounded text-[9px] font-mono font-bold uppercase"
                                        style={{ backgroundColor: `${t.accent}30`, color: t.accent }}>
                                        {t.duration}s
                                    </span>
                                </div>
                                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                                    t.visible ? "bg-green-600 text-white" : "bg-[#333] text-[#888]"
                                }`}>
                                    {toggling === t.id ? (
                                        <Loader2 size={10} className="animate-spin" />
                                    ) : t.visible ? (
                                        <><Eye size={10} /> Visible</>
                                    ) : (
                                        <><EyeOff size={10} /> Hidden</>
                                    )}
                                </div>
                            </div>

                            {/* Info + actions */}
                            <div className="p-3">
                                <div className="flex items-start justify-between mb-1">
                                    <div>
                                        <h3 className="text-sm font-mono font-bold text-white truncate">
                                            {t.emoji} {t.title}
                                        </h3>
                                        <p className="text-[10px] font-mono text-[#666]">{t.subtitle}</p>
                                    </div>
                                </div>
                                <p className="text-[9px] font-mono text-[#444] line-clamp-2 mb-3 leading-relaxed">
                                    {t.promptText?.slice(0, 120) || "No prompt text"}…
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleToggle(t.id, t.visible)}
                                        disabled={toggling === t.id}
                                        className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {t.visible ? <EyeOff size={10} /> : <Eye size={10} />}
                                        {t.visible ? "Hide" : "Show"}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(t)}
                                        className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors cursor-pointer"
                                    >
                                        <Pencil size={10} /> Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t.id)}
                                        disabled={deleting === t.id}
                                        className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-red-900/50 text-red-500/70 hover:text-red-400 hover:border-red-700 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {deleting === t.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══ EDIT / CREATE MODAL ═══ */}
            {editing && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div
                        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border-2 border-[#333] rounded-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-4 border-b border-[#222]">
                            <h2 className="text-lg font-mono font-bold text-white uppercase tracking-tight">
                                {isNew ? "Create Template" : "Edit Template"}
                            </h2>
                            <button onClick={() => setEditing(null)} className="p-1 text-[#666] hover:text-white cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <div className="p-4 space-y-4">
                            {/* Row: Family + Style/FightType */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Family">
                                    <select
                                        value={editing.family}
                                        onChange={(e) => {
                                            const fam = e.target.value;
                                            const defaults = fam === "superhero"
                                                ? { style: "ground", fightType: "", requiredImages: 1, accent: "#D4A843", emoji: "⛰️" }
                                                : { style: "", fightType: "hand", requiredImages: 2, accent: "#EF4444", emoji: "👊" };
                                            setEditing({ ...editing, family: fam, ...defaults });
                                        }}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                    >
                                        {FAMILY_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                </FormField>

                                {editing.family === "superhero" ? (
                                    <FormField label="Style">
                                        <select
                                            value={editing.style || "ground"}
                                            onChange={(e) => {
                                                const opt = STYLE_OPTIONS.find((o) => o.value === e.target.value);
                                                setEditing({
                                                    ...editing,
                                                    style: e.target.value,
                                                    accent: opt?.accent || editing.accent,
                                                    emoji: opt?.emoji || editing.emoji,
                                                });
                                            }}
                                            className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                        >
                                            {STYLE_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                                            ))}
                                        </select>
                                    </FormField>
                                ) : (
                                    <FormField label="Fight Type">
                                        <select
                                            value={editing.fightType || "hand"}
                                            onChange={(e) => {
                                                const opt = FIGHT_OPTIONS.find((o) => o.value === e.target.value);
                                                setEditing({
                                                    ...editing,
                                                    fightType: e.target.value,
                                                    accent: opt?.accent || editing.accent,
                                                    emoji: opt?.emoji || editing.emoji,
                                                });
                                            }}
                                            className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                        >
                                            {FIGHT_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
                                            ))}
                                        </select>
                                    </FormField>
                                )}
                            </div>

                            {/* Row: Duration + Order */}
                            <div className="grid grid-cols-3 gap-3">
                                <FormField label="Duration">
                                    <select
                                        value={editing.duration}
                                        onChange={(e) => setEditing({ ...editing, duration: e.target.value })}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                    >
                                        <option value="5">5s</option>
                                        <option value="10">10s</option>
                                        <option value="15">15s</option>
                                    </select>
                                </FormField>
                                <FormField label="Order">
                                    <input
                                        type="number"
                                        value={editing.order}
                                        onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                    />
                                </FormField>
                                <FormField label="Required Images">
                                    <select
                                        value={editing.requiredImages}
                                        onChange={(e) => setEditing({ ...editing, requiredImages: Number(e.target.value) as 1 | 2 })}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                    >
                                        <option value={1}>1 (Transform)</option>
                                        <option value={2}>2 (Fight)</option>
                                    </select>
                                </FormField>
                            </div>

                            {/* Row: Title + Subtitle */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Title">
                                    <input
                                        value={editing.title}
                                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                        placeholder="Ground / Land"
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-red-600"
                                    />
                                </FormField>
                                <FormField label="Subtitle">
                                    <input
                                        value={editing.subtitle}
                                        onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                                        placeholder="5s Transformation"
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-red-600"
                                    />
                                </FormField>
                            </div>

                            {/* Row: Accent + Emoji */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Accent Color">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={editing.accent}
                                            onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
                                            className="w-10 h-8 bg-transparent border border-[#333] rounded cursor-pointer"
                                        />
                                        <input
                                            value={editing.accent}
                                            onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
                                            className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                        />
                                    </div>
                                </FormField>
                                <FormField label="Emoji">
                                    <input
                                        value={editing.emoji}
                                        onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-600"
                                    />
                                </FormField>
                            </div>

                            {/* Preview Video URL */}
                            <FormField label="Preview Video URL">
                                <input
                                    value={editing.previewVideoUrl}
                                    onChange={(e) => setEditing({ ...editing, previewVideoUrl: e.target.value })}
                                    placeholder="https://firebasestorage.googleapis.com/..."
                                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-red-600"
                                />
                                {editing.previewVideoUrl && (
                                    <video
                                        src={editing.previewVideoUrl}
                                        autoPlay muted loop playsInline
                                        className="w-full h-32 object-cover rounded mt-2 border border-[#222]"
                                    />
                                )}
                            </FormField>

                            {/* Prompt Text */}
                            <FormField label="Prompt Text">
                                <textarea
                                    value={editing.promptText}
                                    onChange={(e) => setEditing({ ...editing, promptText: e.target.value })}
                                    placeholder="Full Seedance 2.0 prompt for this template..."
                                    rows={8}
                                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-red-600 resize-y"
                                />
                            </FormField>

                            {/* Toggles */}
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editing.visible}
                                        onChange={(e) => setEditing({ ...editing, visible: e.target.checked })}
                                        className="w-4 h-4 accent-red-600"
                                    />
                                    <span className="text-xs font-mono text-[#888]">Visible to users</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editing.supportsLocation}
                                        onChange={(e) => setEditing({ ...editing, supportsLocation: e.target.checked })}
                                        className="w-4 h-4 accent-red-600"
                                    />
                                    <span className="text-xs font-mono text-[#888]">Supports location image</span>
                                </label>
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#222]">
                            <button
                                onClick={() => setEditing(null)}
                                className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !editing.title || !editing.promptText}
                                className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {isNew ? "Create" : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <p className="mt-6 text-[10px] font-mono text-[#444]">
                Templates are stored in Firestore <code className="text-red-500/60">playground_templates</code>.
                Changes are instant — the Playground fetches visible templates on load.
            </p>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
//  FORM FIELD HELPER
// ═══════════════════════════════════════════════════════════════

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="block text-[9px] font-mono font-bold text-[#666] uppercase tracking-widest mb-1.5">
                {label}
            </label>
            {children}
        </div>
    );
}
