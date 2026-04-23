"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Film, Eye, EyeOff, Loader2, Search, Check } from "lucide-react";

const TEMPLATE_OWNER_UID = "vzRHwyQfpCbmaHRYtVqFiwvf5zQ2";

interface TemplateEntry {
    id: string;
    title: string;
    type: string;
    genre: string;
    style: string;
    aspect_ratio: string;
    is_dashboard_template: boolean;
    moodboard_image_url?: string;
    created_at?: any;
}

export default function AdminTemplatesPage() {
    const [templates, setTemplates] = useState<TemplateEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<string>("all");

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "projects"),
                where("owner_id", "==", TEMPLATE_OWNER_UID)
            );
            const snap = await getDocs(q);
            const entries: TemplateEntry[] = [];
            snap.forEach((d) => {
                const data = d.data();
                if (data.is_sample) return; // skip sample projects
                entries.push({
                    id: d.id,
                    title: data.title || "Untitled",
                    type: data.type || "movie",
                    genre: data.genre || "",
                    style: data.style || "",
                    aspect_ratio: data.aspect_ratio || "16:9",
                    is_dashboard_template: data.is_dashboard_template === true,
                    moodboard_image_url: data.moodboard_image_url || null,
                    created_at: data.created_at,
                });
            });
            entries.sort((a, b) => a.title.localeCompare(b.title));
            setTemplates(entries);
        } catch (e) {
            console.error("[AdminTemplates] Failed to load:", e);
        } finally {
            setLoading(false);
        }
    };

    const toggleTemplate = async (id: string, current: boolean) => {
        setToggling(id);
        try {
            await updateDoc(doc(db, "projects", id), {
                is_dashboard_template: !current,
            });
            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === id ? { ...t, is_dashboard_template: !current } : t
                )
            );
        } catch (e) {
            console.error("[AdminTemplates] Toggle failed:", e);
        } finally {
            setToggling(null);
        }
    };

    const enableAll = async () => {
        for (const t of filtered) {
            if (!t.is_dashboard_template) {
                await toggleTemplate(t.id, false);
            }
        }
    };

    const disableAll = async () => {
        for (const t of filtered) {
            if (t.is_dashboard_template) {
                await toggleTemplate(t.id, true);
            }
        }
    };

    const types = [...new Set(templates.map((t) => t.type))];
    const filtered = templates.filter((t) => {
        const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.genre.toLowerCase().includes(searchQuery.toLowerCase());
        const matchType = filterType === "all" || t.type === filterType;
        return matchSearch && matchType;
    });

    const enabledCount = templates.filter((t) => t.is_dashboard_template).length;
    const TYPE_LABELS: Record<string, string> = { movie: "Film", micro_drama: "Series", ad: "Ad", ugc: "UGC" };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-red-500" />
                <span className="ml-3 text-sm font-mono text-[#666]">Loading template projects...</span>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-2">
                    <Film size={20} className="text-red-500" />
                    <h1 className="text-3xl font-bold font-mono uppercase tracking-tight">
                        Dashboard Templates
                    </h1>
                </div>
                <p className="text-sm text-[#666] font-mono">
                    Control which template projects are visible to users on the dashboard.
                    Toggle ON to show, OFF to hide.
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
                    <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Enabled</span>
                    <span className="text-lg font-bold font-mono text-green-500">{enabledCount}</span>
                </div>
                <div className="w-px h-6 bg-[#222]" />
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#666] uppercase tracking-widest">Hidden</span>
                    <span className="text-lg font-bold font-mono text-red-500">{templates.length - enabledCount}</span>
                </div>
                <div className="flex-1" />
                <button
                    onClick={enableAll}
                    className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-green-900/50 bg-green-900/10 text-green-500 hover:bg-green-900/25 transition-colors cursor-pointer"
                >
                    Enable Filtered
                </button>
                <button
                    onClick={disableAll}
                    className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-red-900/50 bg-red-900/10 text-red-500 hover:bg-red-900/25 transition-colors cursor-pointer"
                >
                    Disable Filtered
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2 px-3 py-2 border-2 border-[#222] bg-[#0A0A0A] flex-1">
                    <Search size={14} className="text-[#666]" />
                    <input
                        type="text"
                        placeholder="Search by title or genre..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent text-sm font-mono text-white placeholder-[#444] focus:outline-none flex-1"
                    />
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => setFilterType("all")}
                        className={`px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 transition-colors cursor-pointer ${
                            filterType === "all"
                                ? "border-red-600 bg-red-900/20 text-red-500"
                                : "border-[#222] text-[#666] hover:text-white hover:border-[#444]"
                        }`}
                    >
                        All
                    </button>
                    {types.map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(filterType === type ? "all" : type)}
                            className={`px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider border-2 transition-colors cursor-pointer ${
                                filterType === type
                                    ? "border-red-600 bg-red-900/20 text-red-500"
                                    : "border-[#222] text-[#666] hover:text-white hover:border-[#444]"
                            }`}
                        >
                            {TYPE_LABELS[type] || type}
                        </button>
                    ))}
                </div>
            </div>

            {/* Template card grid */}
            {filtered.length === 0 ? (
                <div className="p-12 text-center text-sm font-mono text-[#444] border-2 border-[#222]">
                    No templates match your filters.
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtered.map((t) => (
                        <div
                            key={t.id}
                            className={`rounded-lg overflow-hidden border-2 transition-all ${
                                t.is_dashboard_template
                                    ? "border-green-600/50 bg-[#0A0A0A]"
                                    : "border-[#222] bg-[#080808] opacity-60"
                            }`}
                        >
                            {/* Thumbnail — click to toggle */}
                            <button
                                onClick={() => toggleTemplate(t.id, t.is_dashboard_template)}
                                disabled={toggling === t.id}
                                className="w-full aspect-video relative bg-[#111] cursor-pointer border-none p-0 block"
                            >
                                {t.moodboard_image_url ? (
                                    <img
                                        src={t.moodboard_image_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-[#111]">
                                        <Film size={28} className="text-[#333]" />
                                    </div>
                                )}
                                {/* Status overlay */}
                                <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                                    t.is_dashboard_template
                                        ? "bg-green-600 text-white"
                                        : "bg-[#333] text-[#888]"
                                }`}>
                                    {toggling === t.id ? (
                                        <Loader2 size={10} className="animate-spin" />
                                    ) : t.is_dashboard_template ? (
                                        <><Eye size={10} /> Visible</>
                                    ) : (
                                        <><EyeOff size={10} /> Hidden</>
                                    )}
                                </div>
                                {/* Type badge */}
                                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-[9px] font-mono font-bold uppercase tracking-wider text-white/80">
                                    {TYPE_LABELS[t.type] || t.type}
                                </div>
                            </button>

                            {/* Info */}
                            <div className="p-3">
                                <h3 className="text-sm font-mono font-bold text-white truncate mb-1">{t.title}</h3>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-[#666]">
                                    <span>{t.genre || "No genre"}</span>
                                    <span className="text-[#333]">·</span>
                                    <span>{t.aspect_ratio}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <p className="mt-6 text-[10px] font-mono text-[#444]">
                Click any thumbnail to toggle visibility. Changes save instantly.
                Dashboard cache refreshes every 5 minutes.
            </p>
        </div>
    );
}
