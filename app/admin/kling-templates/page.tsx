"use client";

/**
 * Admin Kling Templates — CRUD management for Kling 3.0 emotional templates.
 *
 * Firestore collection: `kling_templates`
 * Each doc: { emotionFamily, title, subtitle, accent, emoji,
 *             previewVideoUrl, promptText, visible, order, requiredImages }
 */

import { useEffect, useState, useCallback } from "react";
import {
    collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
    Video, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Save, X, Upload,
} from "lucide-react";
import {
    KLING_TEMPLATES as HARDCODED_KLING,
    EMOTION_FAMILIES,
    type EmotionFamily,
} from "@/lib/klingTemplates";

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface KlingTpl {
    id: string;
    emotionFamily: string;
    title: string;
    subtitle: string;
    accent: string;
    emoji: string;
    previewVideoUrl: string;
    promptText: string;
    visible: boolean;
    order: number;
    requiredImages: number;
    created_at?: any;
    updated_at?: any;
}

const EMPTY: Omit<KlingTpl, "id"> = {
    emotionFamily: "tender",
    title: "",
    subtitle: "",
    accent: "#F472B6",
    emoji: "🕊️",
    previewVideoUrl: "",
    promptText: "",
    visible: true,
    order: 0,
    requiredImages: 1,
};

const COLLECTION = "kling_templates";

const emoEntries = Object.entries(EMOTION_FAMILIES) as [EmotionFamily, typeof EMOTION_FAMILIES[EmotionFamily]][];

// ═══════════════════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════════════════

export default function AdminKlingTemplatesPage() {
    const [templates, setTemplates] = useState<KlingTpl[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<KlingTpl | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [toggling, setToggling] = useState<string | null>(null);
    const [filterEmo, setFilterEmo] = useState<string>("all");
    const [seeding, setSeeding] = useState(false);

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, COLLECTION), orderBy("order", "asc"));
            const snap = await getDocs(q);
            const entries: KlingTpl[] = [];
            snap.forEach((d) => entries.push({ id: d.id, ...d.data() } as KlingTpl));
            setTemplates(entries);
        } catch (e) {
            console.error("[KlingTemplates] Load failed:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const handleCreate = () => {
        setIsNew(true);
        setEditing({ ...EMPTY, id: "", order: templates.length } as KlingTpl);
    };

    const handleEdit = (t: KlingTpl) => { setIsNew(false); setEditing({ ...t }); };

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
            console.error("[KlingTemplates] Save failed:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this Kling template permanently?")) return;
        setDeleting(id);
        try {
            await deleteDoc(doc(db, COLLECTION, id));
            setTemplates((prev) => prev.filter((t) => t.id !== id));
        } catch (e) {
            console.error("[KlingTemplates] Delete failed:", e);
        } finally {
            setDeleting(null);
        }
    };

    const handleToggle = async (id: string, current: boolean) => {
        setToggling(id);
        try {
            await updateDoc(doc(db, COLLECTION, id), { visible: !current });
            setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, visible: !current } : t)));
        } catch (e) {
            console.error("[KlingTemplates] Toggle failed:", e);
        } finally {
            setToggling(null);
        }
    };

    const handleSeed = async () => {
        if (!confirm(`Seed ${HARDCODED_KLING.length} Kling templates into Firestore?`)) return;
        setSeeding(true);
        try {
            let order = 0;
            for (const t of HARDCODED_KLING) {
                await addDoc(collection(db, COLLECTION), {
                    emotionFamily: t.emotionFamily,
                    title: t.title, subtitle: t.subtitle,
                    accent: t.accent, emoji: t.emoji,
                    previewVideoUrl: t.previewVideoUrl || "",
                    promptText: t.promptText,
                    visible: true, order,
                    requiredImages: t.requiredImages,
                    created_at: serverTimestamp(), updated_at: serverTimestamp(),
                });
                order++;
            }
            await loadTemplates();
        } catch (e) {
            console.error("[KlingTemplates] Seed failed:", e);
        } finally {
            setSeeding(false);
        }
    };

    const filtered = filterEmo === "all"
        ? templates
        : templates.filter((t) => t.emotionFamily === filterEmo);
    const visibleCount = templates.filter((t) => t.visible).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-cyan-500" />
                <span className="ml-3 text-sm font-mono text-[#666]">Loading Kling templates...</span>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Video size={20} className="text-cyan-500" />
                    <h1 className="text-3xl font-bold font-mono uppercase tracking-tight">
                        Kling 3.0 Templates
                    </h1>
                </div>
                <p className="text-sm text-[#666] font-mono">
                    Manage Kling 3.0 emotional templates shown in the Playground sidebar.
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
                <button onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer">
                    <Plus size={14} /> New Template
                </button>
            </div>

            {/* Filter by emotion */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
                <button onClick={() => setFilterEmo("all")}
                    className={`px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 transition-colors cursor-pointer ${
                        filterEmo === "all" ? "border-cyan-600 bg-cyan-900/20 text-cyan-500" : "border-[#222] text-[#666] hover:text-white hover:border-[#444]"
                    }`}>
                    All
                </button>
                {emoEntries.map(([key, meta]) => (
                    <button key={key} onClick={() => setFilterEmo(key)}
                        className={`px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 transition-colors cursor-pointer ${
                            filterEmo === key ? `border-[${meta.accent}] bg-[${meta.accent}20] text-white` : "border-[#222] text-[#666] hover:text-white hover:border-[#444]"
                        }`}
                        style={filterEmo === key ? { borderColor: meta.accent, backgroundColor: `${meta.accent}20`, color: meta.accent } : undefined}>
                        {meta.emoji} {meta.label}
                    </button>
                ))}
            </div>

            {/* Grid */}
            {filtered.length === 0 && templates.length === 0 ? (
                <div className="p-12 text-center border-2 border-[#222] bg-[#0A0A0A]">
                    <Video size={36} className="text-[#333] mx-auto mb-4" />
                    <h3 className="text-lg font-mono font-bold text-white mb-2">No Kling Templates in Firestore</h3>
                    <p className="text-sm font-mono text-[#666] mb-6 max-w-md mx-auto">
                        Seed all {HARDCODED_KLING.length} emotional templates to get started.
                    </p>
                    <button onClick={handleSeed} disabled={seeding}
                        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer disabled:opacity-50">
                        {seeding ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        {seeding ? `Seeding…` : `Seed ${HARDCODED_KLING.length} Templates`}
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-sm font-mono text-[#444] border-2 border-[#222]">
                    No templates match the current filter.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((t) => {
                        const emo = EMOTION_FAMILIES[t.emotionFamily as EmotionFamily];
                        return (
                            <div key={t.id}
                                className={`rounded-lg overflow-hidden border-2 transition-all ${
                                    t.visible ? "border-green-600/50 bg-[#0A0A0A]" : "border-[#222] bg-[#080808] opacity-60"
                                }`}>
                                <div className="aspect-video relative bg-[#111]">
                                    {t.previewVideoUrl ? (
                                        <video src={t.previewVideoUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"
                                            style={{ background: `linear-gradient(135deg, ${t.accent}20, #0a0a0a)` }}>
                                            <Video size={28} className="text-[#333]" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 left-2 flex gap-1.5">
                                        {emo && (
                                            <span className="px-2 py-1 rounded text-[9px] font-mono font-bold uppercase"
                                                style={{ backgroundColor: `${emo.accent}30`, color: emo.accent }}>
                                                {emo.emoji} {emo.writer}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                                        t.visible ? "bg-green-600 text-white" : "bg-[#333] text-[#888]"
                                    }`}>
                                        {toggling === t.id ? <Loader2 size={10} className="animate-spin" />
                                            : t.visible ? <><Eye size={10} /> Visible</> : <><EyeOff size={10} /> Hidden</>}
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h3 className="text-sm font-mono font-bold text-white truncate">{t.emoji} {t.title}</h3>
                                    <p className="text-[10px] font-mono text-[#666] mb-1">{t.subtitle}</p>
                                    <p className="text-[9px] font-mono text-[#444] line-clamp-2 mb-3 leading-relaxed">
                                        {t.promptText?.slice(0, 120) || "No prompt text"}…
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleToggle(t.id, t.visible)} disabled={toggling === t.id}
                                            className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors cursor-pointer disabled:opacity-50">
                                            {t.visible ? <EyeOff size={10} /> : <Eye size={10} />}
                                            {t.visible ? "Hide" : "Show"}
                                        </button>
                                        <button onClick={() => handleEdit(t)}
                                            className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors cursor-pointer">
                                            <Pencil size={10} /> Edit
                                        </button>
                                        <button onClick={() => handleDelete(t.id)} disabled={deleting === t.id}
                                            className="flex items-center gap-1 px-2 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-red-900/50 text-red-500/70 hover:text-red-400 hover:border-red-700 transition-colors cursor-pointer disabled:opacity-50">
                                            {deleting === t.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* EDIT / CREATE MODAL */}
            {editing && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border-2 border-[#333] rounded-lg"
                        onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-[#222]">
                            <h2 className="text-lg font-mono font-bold text-white uppercase tracking-tight">
                                {isNew ? "Create Kling Template" : "Edit Kling Template"}
                            </h2>
                            <button onClick={() => setEditing(null)} className="p-1 text-[#666] hover:text-white cursor-pointer"><X size={18} /></button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Emotion Family */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Emotion Family">
                                    <select value={editing.emotionFamily || "tender"}
                                        onChange={(e) => {
                                            const emo = e.target.value as EmotionFamily;
                                            const meta = EMOTION_FAMILIES[emo];
                                            setEditing({ ...editing, emotionFamily: emo, accent: meta.accent, emoji: meta.emoji });
                                        }}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-600">
                                        {emoEntries.map(([key, meta]) => (
                                            <option key={key} value={key}>{meta.emoji} {meta.label} — {meta.writer}</option>
                                        ))}
                                    </select>
                                </FormField>
                                <FormField label="Required Images">
                                    <select value={editing.requiredImages}
                                        onChange={(e) => setEditing({ ...editing, requiredImages: Number(e.target.value) })}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-600">
                                        <option value={0}>0 (Text-to-Video)</option>
                                        <option value={1}>1 (Image-to-Video)</option>
                                    </select>
                                </FormField>
                            </div>

                            {/* Order */}
                            <FormField label="Order">
                                <input type="number" value={editing.order}
                                    onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })}
                                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-600" />
                            </FormField>

                            {/* Title + Subtitle */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Title">
                                    <input value={editing.title}
                                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                                        placeholder="Tender Moment"
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-cyan-600" />
                                </FormField>
                                <FormField label="Subtitle">
                                    <input value={editing.subtitle}
                                        onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                                        placeholder="Chekhov — soft, intimate"
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-cyan-600" />
                                </FormField>
                            </div>

                            {/* Accent + Emoji */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Accent Color">
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={editing.accent}
                                            onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
                                            className="w-10 h-8 bg-transparent border border-[#333] rounded cursor-pointer" />
                                        <input value={editing.accent}
                                            onChange={(e) => setEditing({ ...editing, accent: e.target.value })}
                                            className="flex-1 bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-600" />
                                    </div>
                                </FormField>
                                <FormField label="Emoji">
                                    <input value={editing.emoji}
                                        onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                                        className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-600" />
                                </FormField>
                            </div>

                            {/* Preview Video */}
                            <FormField label="Preview Video URL">
                                <input value={editing.previewVideoUrl}
                                    onChange={(e) => setEditing({ ...editing, previewVideoUrl: e.target.value })}
                                    placeholder="https://firebasestorage.googleapis.com/..."
                                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-cyan-600" />
                                {editing.previewVideoUrl && (
                                    <video src={editing.previewVideoUrl} autoPlay muted loop playsInline
                                        className="w-full h-32 object-cover rounded mt-2 border border-[#222]" />
                                )}
                            </FormField>

                            {/* Prompt Text */}
                            <FormField label="Prompt Text">
                                <textarea value={editing.promptText}
                                    onChange={(e) => setEditing({ ...editing, promptText: e.target.value })}
                                    placeholder="Full Kling 3.0 prompt..."
                                    rows={8}
                                    className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm font-mono text-white placeholder-[#444] focus:outline-none focus:border-cyan-600 resize-y" />
                            </FormField>

                            {/* Visible toggle */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={editing.visible}
                                    onChange={(e) => setEditing({ ...editing, visible: e.target.checked })}
                                    className="w-4 h-4 accent-cyan-600" />
                                <span className="text-xs font-mono text-[#888]">Visible to users</span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-4 border-t border-[#222]">
                            <button onClick={() => setEditing(null)}
                                className="px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-colors cursor-pointer">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving || !editing.title || !editing.promptText}
                                className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {isNew ? "Create" : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <p className="mt-6 text-[10px] font-mono text-[#444]">
                Templates stored in Firestore <code className="text-cyan-500/60">kling_templates</code>.
                Changes are instant — the Playground fetches visible templates on load.
            </p>
        </div>
    );
}

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
