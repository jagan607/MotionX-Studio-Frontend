"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, invalidateDashboardCache } from "@/lib/api";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { Sparkles, Loader2, ArrowRight, Film } from "lucide-react";
import { toast } from "react-hot-toast";

const HERO_VIDEO = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/WhatsApp%20Video%202026-03-11%20at%2013.54.06.mp4?alt=media&token=836bc61d-3024-45aa-83d6-c0829b2c7462";

const INSPIRATION = [
    "A detective chasing a rogue android through rain-soaked streets",
    "Cherry blossoms drifting past a girl on a rooftop at sunset",
    "A luxury watch commercial with golden hour macro shots",
    "A street fashion reel in neon-lit Tokyo at night",
];

export default function EmptyStateHero() {
    const router = useRouter();
    const [idea, setIdea] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onReady = () => setVideoLoaded(true);
        v.addEventListener("canplay", onReady);
        // If already buffered (cached)
        if (v.readyState >= 3) setVideoLoaded(true);
        return () => v.removeEventListener("canplay", onReady);
    }, []);

    const handleCreate = async () => {
        const text = idea.trim();
        if (!text || isCreating) return;
        setIsCreating(true);

        const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "with", "and", "or", "of", "to", "from", "by", "about", "like", "my", "is", "its", "that", "this"]);
        const words = text.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);
        const title = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "My Project";

        try {
            const res = await api.post("/api/v1/project/create", {
                title, genre: "Drama", type: "movie", aspect_ratio: "16:9", style: "realistic", runtime_seconds: 60,
            });
            const projectId = res.data.id;
            await setDoc(doc(db, "projects", projectId), { is_quickstart: true }, { merge: true });
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);

            const blob = new Blob([text], { type: "text/plain" });
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", title);
            formData.append("runtime_seconds", "60");
            formData.append("file", new File([blob], "script.txt"));
            await api.post("/api/v1/script/upload-script", formData, { headers: { "Content-Type": "multipart/form-data" } });

            toast.success("Your project is being created...");
            router.push(`/project/${projectId}/preproduction`);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Failed to create project");
            setIsCreating(false);
        }
    };

    return (
        <div className="relative rounded-2xl overflow-hidden flex flex-col shrink-0 border border-white/[0.04]" style={{ animation: "fadeIn 0.6s ease" }}>
            {/* Background video */}
            <video
                ref={videoRef}
                src={HERO_VIDEO}
                autoPlay loop muted playsInline
                preload="auto"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? 'opacity-25' : 'opacity-0'}`}
            />
            {/* Fallback gradient while video loads */}
            <div className={`absolute inset-0 transition-opacity duration-1000 ${videoLoaded ? 'opacity-0' : 'opacity-100'}`}
                style={{ background: 'linear-gradient(135deg, #1a0000, #0a0a0a, #0a0505)' }} />
            {/* Video loading indicator */}
            {!videoLoaded && (
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/40 backdrop-blur-sm border border-white/[0.04]">
                    <div className="w-3 h-3 rounded-full border border-white/10 border-t-[#E50914]/40 animate-spin" />
                    <span className="text-[8px] font-mono text-white/20 uppercase tracking-wider">Loading cinematic</span>
                </div>
            )}
            {/* Dark overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-[#0a0a0a]/40" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center text-center px-6 sm:px-10 py-12 sm:py-16 lg:py-20 max-w-2xl mx-auto w-full">
                {/* Badge */}
                <div className="flex items-center gap-2 mb-5" style={{ animation: "fadeIn 0.6s ease 0.15s both" }}>
                    <div className="w-1.5 h-1.5 bg-[#E50914] rounded-full animate-pulse shadow-[0_0_8px_rgba(229,9,20,0.6)]" />
                    <span className="text-[9px] font-mono text-white/25 uppercase tracking-[3px]">Your studio is ready</span>
                </div>

                {/* Headline */}
                <h1 className="font-['Anton'] text-[32px] sm:text-[44px] lg:text-[52px] uppercase leading-[0.92] tracking-[2px] text-white mb-3"
                    style={{ animation: "fadeIn 0.6s ease 0.25s both" }}>
                    Your First Film Is<br />
                    <span style={{ background: "linear-gradient(135deg, #E50914, #FF4D58)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        One Idea Away
                    </span>
                </h1>

                <p className="text-[12px] text-white/30 mb-8 max-w-sm leading-relaxed" style={{ animation: "fadeIn 0.6s ease 0.35s both" }}>
                    Describe your film in one sentence. AI handles the script, characters, locations, and cinematography.
                </p>

                {/* Input */}
                <div className="w-full max-w-xl mb-4" style={{ animation: "fadeIn 0.6s ease 0.45s both" }}>
                    <div className={`rounded-2xl border p-4 transition-all duration-300 backdrop-blur-sm ${
                        idea ? "border-[#E50914]/30 bg-[#E50914]/[0.04] shadow-[0_0_40px_rgba(229,9,20,0.1)]" : "border-white/[0.08] bg-white/[0.03]"
                    } focus-within:border-[#E50914]/40`}>
                        <textarea
                            value={idea}
                            onChange={e => setIdea(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCreate(); } }}
                            placeholder="A tense standoff between a detective and an AI gone rogue in 2089..."
                            className="w-full bg-transparent text-[14px] text-white placeholder-white/20 focus:outline-none resize-none leading-relaxed caret-[#E50914]"
                            rows={2}
                            disabled={isCreating}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Inspiration chips */}
                <div className="flex flex-wrap justify-center gap-2 mb-6" style={{ animation: "fadeIn 0.6s ease 0.55s both" }}>
                    <span className="text-[8px] font-mono text-white/15 uppercase tracking-[2px] w-full mb-1">Try one of these</span>
                    {INSPIRATION.map((ex, i) => (
                        <button key={i} onClick={() => setIdea(ex)} disabled={isCreating}
                            className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[9px] text-white/25 hover:text-white/50 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all cursor-pointer disabled:opacity-50">
                            {ex.length > 45 ? ex.slice(0, 45) + "…" : ex}
                        </button>
                    ))}
                </div>

                {/* Create button */}
                <button onClick={handleCreate} disabled={!idea.trim() || isCreating}
                    className="flex items-center gap-3 px-10 py-3.5 rounded-xl text-[11px] font-bold tracking-[2px] uppercase transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed border-none"
                    style={{
                        background: idea.trim() ? "linear-gradient(135deg, #E50914, #B30710)" : "rgba(255,255,255,0.05)",
                        color: idea.trim() ? "white" : "rgba(255,255,255,0.3)",
                        boxShadow: idea.trim() ? "0 8px 32px rgba(229,9,20,0.3)" : "none",
                        animation: "fadeIn 0.6s ease 0.65s both",
                    }}>
                    {isCreating ? <><Loader2 size={14} className="animate-spin" /> Creating Your Film...</> : <><Sparkles size={14} /> Create & Start Directing <ArrowRight size={14} /></>}
                </button>
                <p className="text-[8px] text-white/12 mt-3 tracking-wider mb-4">Uses 0 credits — your first project is on us ✨</p>

                {/* Or browse templates hint */}
                <div className="flex items-center gap-3 text-[9px] text-white/15" style={{ animation: "fadeIn 0.6s ease 0.75s both" }}>
                    <div className="w-8 h-px bg-white/[0.06]" />
                    <span>or browse <button className="text-[#E50914]/50 hover:text-[#E50914] transition-colors bg-transparent border-none cursor-pointer text-[9px] underline underline-offset-2" onClick={() => document.getElementById('tour-templates')?.scrollIntoView({ behavior: 'smooth' })}>templates</button> below</span>
                    <div className="w-8 h-px bg-white/[0.06]" />
                </div>
            </div>

            {/* Full-screen loading overlay when creating */}
            {isCreating && (
                <div className="absolute inset-0 z-30 bg-[#030303]/80 backdrop-blur-sm flex flex-col items-center justify-center" style={{ animation: "fadeIn 0.3s ease" }}>
                    <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full border-2 border-[#E50914]/20 border-t-[#E50914] animate-spin" />
                        <Film size={20} className="text-[#E50914] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <span className="text-[11px] font-bold text-white/60 uppercase tracking-[3px]">Creating Your Film</span>
                    <span className="text-[9px] text-white/20 mt-2">Setting up script, characters & locations…</span>
                </div>
            )}
        </div>
    );
}
