"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Loader2, X, Send } from "lucide-react";
import { ProjectTemplate, getTemplatesForGoal } from "@/lib/templates";
import { api, invalidateDashboardCache } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";

interface QuickStartTemplatesProps {
    userGoal?: string | null;
    onDismiss?: () => void;
}

export default function QuickStartTemplates({ userGoal, onDismiss }: QuickStartTemplatesProps) {
    const router = useRouter();
    const templates = getTemplatesForGoal(userGoal);
    const [idea, setIdea] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);

    const handleTemplateClick = (template: ProjectTemplate) => {
        setSelectedTemplate(template);
        setIdea(template.synopsis.split(".")[0] + ".");
    };

    const handleCreate = async () => {
        const text = idea.trim();
        if (!text || isCreating) return;
        setIsCreating(true);

        // Generate a short title (2-3 key words from the idea)
        const t = selectedTemplate;
        const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "with", "and", "or", "of", "to", "from", "by", "about", "like", "my", "is", "its", "that", "this"]);
        const words = text.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);
        const title = t?.title || words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "My Project";
        const genre = t?.genre || "Drama";
        const type = t?.type || "movie";
        const aspectRatio = t?.aspectRatio || "16:9";
        const style = t?.style || "realistic";
        const runtime = t?.runtime || 30;

        try {
            // 1. Create project
            const res = await api.post("/api/v1/project/create", {
                title,
                genre,
                type,
                aspect_ratio: aspectRatio,
                style,
                runtime_seconds: runtime,
            });
            const projectId = res.data.id;

            // 2. Mark as quickstart so preproduction skips gates
            await setDoc(doc(db, "projects", projectId), {
                is_quickstart: true,
            }, { merge: true });

            // 3. Invalidate dashboard cache
            if (auth.currentUser) {
                invalidateDashboardCache(auth.currentUser.uid);
            }

            // 4. Upload the idea as a script to trigger AI processing
            const blob = new Blob([text], { type: "text/plain" });
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", title);
            formData.append("runtime_seconds", String(runtime));
            formData.append("file", new File([blob], "script.txt"));

            await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            toast.success("Creating your project...");

            // 5. Navigate directly to preproduction
            router.push(`/project/${projectId}/preproduction`);
        } catch (e: any) {
            console.error("[QuickStart] Failed:", e);
            toast.error(e.response?.data?.detail || "Failed to create project");
            setIsCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleCreate();
        }
    };

    return (
        <div className="shrink-0 px-1">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-[#E50914]" />
                    <span className="text-[10px] font-bold tracking-[2px] uppercase text-white/40">Quick Start</span>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-white/15 hover:text-white/40 transition-colors cursor-pointer p-1"
                        title="Dismiss"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* Input Field */}
            <div className="relative mb-3">
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-all duration-300 ${
                    idea ? "border-[#E50914]/30 bg-[#E50914]/[0.03]" : "border-white/[0.06] bg-white/[0.02]"
                } focus-within:border-[#E50914]/40 focus-within:bg-[#E50914]/[0.04]`}>
                    <Sparkles size={14} className="text-[#E50914]/50 shrink-0" />
                    <input
                        type="text"
                        value={idea}
                        onChange={(e) => {
                            setIdea(e.target.value);
                            if (selectedTemplate && e.target.value !== selectedTemplate.synopsis.split(".")[0] + ".") {
                                setSelectedTemplate(null);
                            }
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your video in one line... e.g. A street fashion reel in neon-lit Tokyo"
                        className="flex-1 bg-transparent text-[13px] text-white placeholder-white/20 focus:outline-none caret-[#E50914] tracking-wide"
                        disabled={isCreating}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!idea.trim() || isCreating}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[9px] font-bold tracking-[1.5px] uppercase transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-none shrink-0"
                        style={{
                            background: idea.trim() ? "linear-gradient(135deg, #E50914, #B30710)" : "rgba(255,255,255,0.05)",
                            color: idea.trim() ? "white" : "rgba(255,255,255,0.3)",
                            boxShadow: idea.trim() ? "0 4px 16px rgba(229,9,20,0.25)" : "none",
                        }}
                    >
                        {isCreating ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <>
                                Create
                                <Send size={10} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Template Chips */}
            <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => {
                    const isSelected = selectedTemplate?.id === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => handleTemplateClick(t)}
                            disabled={isCreating}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] tracking-wide transition-all duration-300 cursor-pointer disabled:opacity-50"
                            style={{
                                borderColor: isSelected ? `${t.accent}50` : "rgba(255,255,255,0.06)",
                                background: isSelected ? `${t.accent}12` : "rgba(255,255,255,0.02)",
                                color: isSelected ? t.accent : "rgba(255,255,255,0.35)",
                            }}
                        >
                            <span>{t.icon}</span>
                            <span className="font-medium">{t.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
