"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import Image from "next/image";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { api, invalidateDashboardCache, checkJobStatus } from "@/lib/api";
import {
    Film, Tv, Loader2,
    Megaphone, BrainCircuit, Send,
    Upload, FileText, X,
    ChevronRight
} from "lucide-react";
import { toast } from "react-hot-toast";

type ProjectType = "movie" | "micro_drama" | "adaptation" | "ad";
type Phase = "prompt" | "processing";

const FORMAT_BG: Record<string, string> = {
    film: "/img/formats/film.png",
    series: "/img/formats/series.png",
    ad: "/img/formats/commercial.png",
};

const PLACEHOLDERS = [
    "A cyberpunk thriller set in Neo-Tokyo 2089. Rain-soaked neon streets, a detective chasing an AI gone rogue...",
    "A coming-of-age drama about a young musician in 1970s Lagos, discovering Afrobeat and finding their voice...",
    "A luxury watch commercial — slow-motion macro shots, golden hour light, precision engineering...",
    "A micro drama series about rival food truck owners who secretly fall for each other...",
    "A sci-fi epic where humanity discovers an ancient alien library buried beneath the Sahara...",
    "A horror short — an AI home assistant starts making decisions its owners never asked for...",
];



/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function NewProjectPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // ══════ PHASE STATE ══════
    const [phase, setPhase] = useState<Phase>("prompt");
    const [vision, setVision] = useState("");
    const [title, setTitle] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
    const [isTyping, setIsTyping] = useState(true);
    const [selectedFormat, setSelectedFormat] = useState<string>("film");
    const [selectedStyle, setSelectedStyle] = useState<"realistic" | "animation_2d" | "animation_3d">("realistic");
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "21:9" | "9:16" | "4:5">("16:9");
    const [scriptFile, setScriptFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [runtime, setRuntime] = useState<number>(30);
    const [processingStatus, setProcessingStatus] = useState("");
    const [createdProjectId, setCreatedProjectId] = useState("");

    // ══════ AUTH ══════
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // ══════ TYPEWRITER ══════
    useEffect(() => {
        if (vision || phase !== "prompt") return;
        const target = PLACEHOLDERS[placeholderIdx];
        let charIdx = 0;
        let timeout: NodeJS.Timeout;
        if (isTyping) {
            const typeChar = () => {
                if (charIdx <= target.length) { setDisplayedPlaceholder(target.slice(0, charIdx)); charIdx++; timeout = setTimeout(typeChar, 25 + Math.random() * 15); }
                else { timeout = setTimeout(() => setIsTyping(false), 3000); }
            };
            typeChar();
        } else {
            let eraseIdx = target.length;
            const eraseChar = () => {
                if (eraseIdx >= 0) { setDisplayedPlaceholder(target.slice(0, eraseIdx)); eraseIdx--; timeout = setTimeout(eraseChar, 12); }
                else { setPlaceholderIdx((p) => (p + 1) % PLACEHOLDERS.length); setIsTyping(true); }
            };
            eraseChar();
        }
        return () => clearTimeout(timeout);
    }, [placeholderIdx, isTyping, vision, phase]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
        }
    }, [vision]);



    // ══════ FILE HANDLERS ══════
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        if (!f.name.endsWith(".pdf") && !f.type.includes("pdf")) return toast.error("Please upload a PDF script");
        setScriptFile(f);
    };
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith(".pdf") && !f.type.includes("pdf")) return toast.error("Please upload a PDF script");
        setScriptFile(f);
    };

    // ══════ CREATE PROJECT ══════
    const handleCreate = async () => {
        if (!vision.trim() && !scriptFile) return toast.error("Describe your vision or upload a script");
        setPhase("processing");
        try {
            const FORMAT_MAP: Record<string, ProjectType> = { film: "movie", series: "micro_drama", ad: "ad" };
            const type = FORMAT_MAP[selectedFormat] || "movie";
            const cleanFilename = (name: string) => name.replace('.pdf', '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
            const projectTitle = title.trim() || (vision ? vision.split(/[.\n]/)[0].slice(0, 60).trim() : (scriptFile ? cleanFilename(scriptFile.name) : "Untitled Project"));

            setProcessingStatus("Creating project...");
            const res = await api.post("/api/v1/project/create", {
                title: projectTitle, genre: vision || "Script uploaded",
                type, aspect_ratio: aspectRatio, style: selectedStyle,
            });
            const projectId = res.data.id;
            setCreatedProjectId(projectId);
            if (auth.currentUser) invalidateDashboardCache(auth.currentUser.uid);

            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", projectTitle);
            formData.append("runtime_seconds", String(runtime));

            if (scriptFile) {
                setProcessingStatus("Uploading script...");
                formData.append("file", scriptFile);
            } else {
                setProcessingStatus("Generating script from your vision...");
                const content = `[TYPE: SYNOPSIS/TREATMENT]\n\n${vision}`;
                const blob = new Blob([content], { type: "text/plain" });
                formData.append("file", new File([blob], "synopsis.txt"));
            }

            const uploadRes = await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            const jobId = uploadRes.data.job_id;
            setProcessingStatus("Processing script...");

            const pollInterval = setInterval(async () => {
                const job = await checkJobStatus(jobId);
                if (job.progress) setProcessingStatus(job.progress);
                if (job.status === "completed") {
                    clearInterval(pollInterval);
                    // Route directly to Moodboard — backend handles scenes silently
                    router.push(`/project/${projectId}/moodboard?episode_id=main`);
                } else if (job.status === "failed") {
                    clearInterval(pollInterval); setPhase("prompt"); setProcessingStatus("");
                    toast.error(job.error || "Script processing failed");
                }
            }, 1000);
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Something went wrong.");
            setPhase("prompt"); setProcessingStatus("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey && phase === "prompt") { e.preventDefault(); handleCreate(); }
    };

    // ══════ COMPUTED ══════
    const projectTitle = title.trim() || (vision ? vision.split(/[.\n]/)[0].slice(0, 60).trim() : (scriptFile ? scriptFile.name.replace(".pdf", "") : ""));

    // ══════ RENDER ══════
    return (
        <div className="flex-1 min-h-0 bg-[#080808] text-white overflow-hidden flex flex-col relative">
            <style jsx global>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes grain { 0%,100% { transform: translate(0,0); } 10% { transform: translate(-2%,-2%); } 20% { transform: translate(1%,3%); } 30% { transform: translate(-3%,1%); } 40% { transform: translate(3%,-1%); } 50% { transform: translate(-1%,2%); } 60% { transform: translate(2%,-3%); } 70% { transform: translate(-2%,1%); } 80% { transform: translate(1%,-2%); } 90% { transform: translate(-1%,3%); } }
                @keyframes breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
                @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 20px rgba(229,9,20,0.08); } 50% { box-shadow: 0 0 40px rgba(229,9,20,0.15); } }
                @keyframes scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
                .fade-in { animation: fadeIn 0.6s ease both; }
                .fade-in-1 { animation: fadeIn 0.6s ease 0.1s both; }
                .fade-in-2 { animation: fadeIn 0.6s ease 0.25s both; }
                .fade-in-3 { animation: fadeIn 0.6s ease 0.4s both; }
            `}</style>

            {/* ══════ BACKGROUND (always visible) ══════ */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/70 to-[#080808]/80" />
                {Object.entries(FORMAT_BG).map(([key, src]) => (
                    <div key={key} className="absolute inset-0 transition-opacity duration-[2000ms]"
                        style={{ opacity: key === selectedFormat ? 0.15 : 0 }}>
                        <Image src={src} alt="" fill className="object-cover" priority={key === "film"} />
                    </div>
                ))}
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(8,8,8,0.85) 100%)" }} />
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                        backgroundSize: "200px 200px", animation: "grain 0.5s steps(5) infinite",
                    }}
                />
                <div className="absolute top-[30%] left-[35%] w-[700px] h-[500px] rounded-full blur-[200px]"
                    style={{ background: "radial-gradient(circle, rgba(229,9,20,0.03) 0%, transparent 70%)", animation: "breathe 10s ease-in-out infinite" }} />
            </div>



            {/* ══════ MAIN CONTENT ══════ */}
            <div className="relative z-10 flex-1 flex flex-col items-center overflow-y-auto">
                <div className="w-full max-w-xl px-6 flex-1 flex flex-col justify-center py-8">

                    {/* Processing overlay */}
                    {phase === "processing" && (
                        <div className="fixed inset-0 z-50 bg-[#080808]/80 backdrop-blur-md flex flex-col items-center justify-center transition-all duration-500">
                            <div className="relative flex flex-col items-center w-full max-w-md px-8">
                                {/* Ambient Glow */}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#E50914]/10 rounded-full blur-[60px] animate-pulse" />

                                {/* Central Scanning Element */}
                                <div className="relative w-16 h-16 mb-8 flex items-center justify-center">
                                    <div className="absolute inset-0 border border-white/[0.05] rounded-full" />
                                    <div className="absolute inset-0 border border-[#E50914]/40 rounded-full border-t-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
                                    <div className="absolute inset-2 border border-[#E50914]/20 rounded-full border-b-transparent animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
                                    <BrainCircuit size={20} className="text-[#E50914] animate-pulse" />
                                </div>

                                {/* Status Text */}
                                <h3 className="text-white font-anton uppercase tracking-[3px] text-xl mb-3 text-center">
                                    {processingStatus.includes('...') ? processingStatus.replace('...', '') : processingStatus}
                                </h3>

                                <p className="text-[11px] text-neutral-500 tracking-[1px] uppercase font-mono text-center mb-8">
                                    Do not close this window
                                </p>

                                {/* Indeterminate Scanning Bar */}
                                <div className="w-full h-[2px] bg-white/[0.05] rounded-full overflow-hidden relative">
                                    <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent animate-[scan_2s_ease-in-out_infinite]" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Hero Text ── */}
                    <div className="text-center mb-6 fade-in">
                        <p className="text-white font-anton uppercase tracking-wide text-[28px]">
                            What do you want to make?
                        </p>
                    </div>

                    {/* ── Title Input ── */}
                    <div className="mb-5">
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-transparent text-[16px] text-white placeholder-neutral-600 focus:outline-none tracking-[1px] caret-[#E50914] border-b border-white/[0.06] pb-2 focus:border-white/[0.12] transition-colors"
                            placeholder="Project Name" autoComplete="off" />
                    </div>

                    {/* ── Prompt Box ── */}
                    <div className="relative fade-in-1">
                        <div className="rounded-2xl border border-white/[0.06] bg-black/40 backdrop-blur-sm p-5 focus-within:border-[#E50914]/20 focus-within:bg-black/50 focus-within:shadow-[0_0_60px_rgba(229,9,20,0.04)]">

                            {/* Editable textarea */}
                            <textarea ref={textareaRef} autoFocus value={vision}
                                onChange={(e) => setVision(e.target.value)} onKeyDown={handleKeyDown}
                                className="w-full bg-transparent text-[15px] text-white focus:outline-none resize-none leading-[1.7] caret-[#E50914] min-h-[80px]"
                                placeholder={displayedPlaceholder || " "} rows={3} />

                            {/* Script attachment */}
                            {scriptFile && (
                                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                                    <FileText size={14} className="text-[#E50914] shrink-0" />
                                    <span className="text-[11px] text-neutral-300 truncate flex-1">{scriptFile.name}</span>
                                    <span className="text-[9px] text-neutral-600">{(scriptFile.size / 1024 / 1024).toFixed(1)} MB</span>
                                    <button onClick={() => setScriptFile(null)} className="text-neutral-600 hover:text-white transition-colors cursor-pointer"><X size={12} /></button>
                                </div>
                            )}

                            {/* Action bar */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => fileInputRef.current?.click()}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)} onDrop={handleFileDrop}
                                        className={`flex items-center gap-1.5 text-[9px] tracking-wider uppercase cursor-pointer transition-all ${isDragging ? 'text-[#E50914]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                        <Upload size={11} />{scriptFile ? 'Replace' : 'Upload script'}
                                    </button>
                                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                                    <span className="text-[9px] text-neutral-800">⏎ to create</span>
                                </div>
                                <button onClick={handleCreate}
                                    disabled={phase !== 'prompt' || (!vision.trim() && !scriptFile)}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-semibold tracking-[1px] transition-all duration-300 cursor-pointer
                                        ${phase !== 'prompt' || (!vision.trim() && !scriptFile) ? 'text-neutral-700 cursor-not-allowed' : 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.12)] hover:shadow-[0_0_30px_rgba(229,9,20,0.2)] hover:bg-[#ff1a25]'}`}>
                                    <Send size={11} /> Create
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Format / Engine / Aspect / Runtime pills ── */}
                    <div>
                        <div className="mt-6 flex items-center justify-center gap-2 fade-in-2">
                            {[
                                { icon: Film, text: 'Film', key: 'film', seed: 'A feature film about ' },
                                { icon: Tv, text: 'Series', key: 'series', seed: 'A micro drama series about ' },
                                { icon: Megaphone, text: 'Ad', key: 'ad', seed: 'A commercial for ' },
                            ].map((h) => (
                                <button key={h.text}
                                    onClick={() => { setSelectedFormat(h.key); if (!vision) setVision(h.seed); textareaRef.current?.focus(); }}
                                    className={`px-3.5 py-1.5 rounded-full border text-[9px] tracking-[2px] uppercase transition-all cursor-pointer flex items-center gap-1.5
                                        ${selectedFormat === h.key ? 'border-white/[0.15] text-white bg-white/[0.06]' : 'border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.12] hover:bg-white/[0.03]'}`}>
                                    <h.icon size={10} />{h.text}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 fade-in-2">
                            {([
                                { text: 'Live-Action', key: 'realistic' as const },
                                { text: 'Animation (2D)', key: 'animation_2d' as const },
                                { text: 'Animation (3D)', key: 'animation_3d' as const },
                            ] as const).map((s) => (
                                <button key={s.key}
                                    onClick={() => setSelectedStyle(s.key)}
                                    className={`px-3.5 py-1.5 rounded-full border text-[9px] tracking-[2px] uppercase transition-all cursor-pointer
                                        ${selectedStyle === s.key ? 'border-white/[0.15] text-white bg-white/[0.06]' : 'border-white/[0.06] text-neutral-500 hover:text-neutral-300 hover:border-white/[0.12] hover:bg-white/[0.03]'}`}>
                                    {s.text}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1.5 fade-in-3">
                            {(['16:9', '9:16', '21:9', '4:5'] as const).map((r) => (
                                <button key={r} onClick={() => setAspectRatio(r)}
                                    className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider transition-all cursor-pointer ${aspectRatio === r ? 'text-white bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-1.5 fade-in-3">
                            {[{ label: '15s', value: 15 }, { label: '30s', value: 30 }, { label: '60s', value: 60 }, { label: '2m', value: 120 }, { label: '5m', value: 300 }, { label: '10m', value: 600 }].map((r) => (
                                <button key={r.value} onClick={() => setRuntime(r.value)}
                                    className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider transition-all cursor-pointer ${runtime === r.value ? 'text-white bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                    {r.label}
                                </button>
                            ))}
                            <span className="text-neutral-700 text-[9px] mx-1">or</span>
                            <div className="flex items-center gap-1">
                                <input type="number" min={1} value={runtime || ''}
                                    onChange={(e) => setRuntime(parseInt(e.target.value) || 0)}
                                    onBlur={() => { if (runtime < 1) setRuntime(30); }}
                                    className="w-12 bg-white/[0.04] rounded px-1.5 py-1 text-[9px] font-mono text-white text-center focus:outline-none focus:bg-white/[0.08] border border-white/[0.06] caret-[#E50914]" />
                                <span className="text-[9px] text-neutral-600 font-mono">sec</span>
                            </div>
                        </div>
                        {currentUser?.email?.endsWith('@motionx.in') && (
                            <div className="mt-5 text-center">
                                <button onClick={() => router.push('/project/new?mode=adaptation')}
                                    className="text-[8px] text-neutral-800 hover:text-neutral-500 tracking-[2px] uppercase transition-colors cursor-pointer">
                                    <BrainCircuit size={9} className="inline mr-1 -mt-0.5" /> Adaptation
                                </button>
                            </div>
                        )}
                    </div>


                </div>
            </div>
        </div>
    );
}