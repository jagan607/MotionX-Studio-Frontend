"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import Image from "next/image";

import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { api, invalidateDashboardCache } from "@/lib/api";
import {
    Film, Tv,
    Megaphone, BrainCircuit, Send,
    Upload, FileText, X,
    Check, Sparkles
} from "lucide-react";
import { toast } from "react-hot-toast";

type ProjectType = "movie" | "micro_drama" | "adaptation" | "ad";
type Phase = "prompt" | "processing" | "complete";

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
   SCANNER STEP DEFINITIONS
   ═══════════════════════════════════════════════════════════ */
const SCANNER_STEPS = [
    { key: "loading", label: "Loading Script", patterns: ["loading", "uploading", "creating project", "downloading"] },
    { key: "cinematic", label: "Analyzing Cinematic DNA", patterns: ["cinematic dna", "analyzing"] },
    { key: "scenes", label: "Extracting Structural Scenes", patterns: ["structural scene", "extracting"] },
    { key: "workspace", label: "Creating Workspace", patterns: ["workspace", "draft", "blueprint"] },
    { key: "moodboards", label: "Generating Visual Moodboards", patterns: ["moodboard", "visual moodboards", "generating visual"] },
];

function matchStep(status: string): number {
    if (!status) return 0;
    const lower = status.toLowerCase();
    for (let i = SCANNER_STEPS.length - 1; i >= 0; i--) {
        if (SCANNER_STEPS[i].patterns.some(p => lower.includes(p.toLowerCase()))) return i;
    }
    return 0;
}


/* ═══════════════════════════════════════════════════════════
   CINEMATIC SCANNER COMPONENT
   ═══════════════════════════════════════════════════════════ */
interface CinematicScannerProps {
    processingStatus: string;
    detectedArchetype: string;
    phase: Phase;
    isTransitioning: boolean;
}

function CinematicScanner({ processingStatus, detectedArchetype, phase, isTransitioning }: CinematicScannerProps) {
    const activeStep = matchStep(processingStatus);
    const [archetypeVisible, setArchetypeVisible] = useState(false);

    // Animate archetype reveal
    useEffect(() => {
        if (detectedArchetype) {
            const t = setTimeout(() => setArchetypeVisible(true), 300);
            return () => clearTimeout(t);
        }
    }, [detectedArchetype]);

    if (phase === "prompt") return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-700"
            style={{
                background: isTransitioning
                    ? "radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, rgba(8,8,8,0.95) 60%)"
                    : "radial-gradient(ellipse at center, rgba(229,9,20,0.04) 0%, rgba(8,8,8,0.95) 60%)"
            }}>

            {/* Backdrop blur layer */}
            <div className="absolute inset-0 backdrop-blur-xl" />

            {/* Film grain overlay */}
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    backgroundSize: "200px 200px", animation: "grain 0.5s steps(5) infinite",
                }}
            />

            {/* Central content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-8">

                {/* ── Ambient glow ── */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[100px] transition-all duration-1000 pointer-events-none"
                    style={{
                        background: isTransitioning
                            ? "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)"
                            : "radial-gradient(circle, rgba(229,9,20,0.1) 0%, transparent 70%)",
                        animation: "breathe 6s ease-in-out infinite"
                    }} />

                {/* ── Central icon ── */}
                <div className="relative w-20 h-20 mb-10 flex items-center justify-center">
                    {/* Outer ring */}
                    <div className={`absolute inset-0 rounded-full border transition-all duration-700 ${isTransitioning ? "border-emerald-500/40" : "border-white/[0.05]"
                        }`} />
                    {/* Spinning ring */}
                    <div className={`absolute inset-0 rounded-full border border-t-transparent transition-all duration-700 ${isTransitioning ? "border-emerald-400/50" : "border-[#E50914]/40"
                        }`}
                        style={{ animation: isTransitioning ? "none" : "spin 1.5s linear infinite" }} />
                    {/* Inner ring */}
                    <div className={`absolute inset-2 rounded-full border border-b-transparent transition-all duration-700 ${isTransitioning ? "border-emerald-400/30" : "border-[#E50914]/20"
                        }`}
                        style={{ animation: isTransitioning ? "none" : "spin 2s linear infinite reverse" }} />

                    {/* Icon swap */}
                    {isTransitioning ? (
                        <div className="animate-[scaleIn_0.4s_ease_both]">
                            <Check size={24} className="text-emerald-400" strokeWidth={3} />
                        </div>
                    ) : (
                        <BrainCircuit size={22} className="text-[#E50914] animate-pulse" />
                    )}
                </div>

                {/* ── Status heading ── */}
                <h3 className={`font-anton uppercase tracking-[3px] text-xl mb-2 text-center transition-colors duration-700 ${isTransitioning ? "text-emerald-300" : "text-white"
                    }`}>
                    {isTransitioning
                        ? "Scan Complete"
                        : (processingStatus.includes('...') ? processingStatus.replace('...', '') : processingStatus || "Initializing")
                    }
                </h3>

                <p className="text-[10px] text-neutral-600 tracking-[1.5px] uppercase font-mono text-center mb-10">
                    {isTransitioning ? "Entering moodboard" : "Do not close this window"}
                </p>

                {/* ── Step tracker ── */}
                <div className="w-full space-y-0 mb-8">
                    {SCANNER_STEPS.map((step, i) => {
                        const isActive = i === activeStep && !isTransitioning;
                        const isDone = i < activeStep || isTransitioning;

                        return (
                            <div key={step.key}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${isActive ? "bg-white/[0.04]" : ""
                                    }`}>
                                {/* Step indicator */}
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all duration-500 ${isDone
                                        ? "border-emerald-500/50 bg-emerald-500/10"
                                        : isActive
                                            ? "border-[#E50914]/50 bg-[#E50914]/10"
                                            : "border-white/[0.06] bg-transparent"
                                    }`}>
                                    {isDone ? (
                                        <Check size={10} className="text-emerald-400" strokeWidth={3} />
                                    ) : isActive ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
                                    ) : (
                                        <div className="w-1 h-1 rounded-full bg-white/10" />
                                    )}
                                </div>

                                {/* Step label */}
                                <span className={`text-[10px] tracking-[1.5px] uppercase font-mono transition-all duration-500 ${isDone
                                        ? "text-emerald-400/60"
                                        : isActive
                                            ? "text-white"
                                            : "text-neutral-700"
                                    }`}>
                                    {step.label}
                                </span>

                                {/* Scanning indicator for active step */}
                                {isActive && (
                                    <div className="ml-auto w-16 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                                        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent animate-[scan_1.5s_ease-in-out_infinite]" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Archetype glimpse ── */}
                {detectedArchetype && (
                    <div className={`w-full transition-all duration-700 ${archetypeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                        }`}>
                        <div className="relative rounded-xl border border-[#E50914]/20 bg-[#E50914]/[0.04] backdrop-blur-sm px-5 py-4 overflow-hidden"
                            style={{ animation: "pulseGlow 4s ease-in-out infinite" }}>
                            {/* Inner scan line */}
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                <div className="absolute top-0 bottom-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-[#E50914]/10 to-transparent animate-[scan_3s_ease-in-out_infinite]" />
                            </div>

                            <div className="relative flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center shrink-0">
                                    <Sparkles size={14} className="text-[#E50914]" />
                                </div>
                                <div>
                                    <p className="text-[8px] text-[#E50914]/60 tracking-[2px] uppercase font-mono mb-0.5">
                                        Archetype Locked
                                    </p>
                                    <p className="text-[14px] text-white font-medium tracking-wide">
                                        {detectedArchetype}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Bottom progress bar ── */}
                <div className="w-full mt-8 h-[2px] bg-white/[0.04] rounded-full overflow-hidden">
                    {isTransitioning ? (
                        <div className="h-full w-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 transition-all duration-700" />
                    ) : (
                        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#E50914] to-transparent animate-[scan_2s_ease-in-out_infinite]" />
                    )}
                </div>
            </div>
        </div>
    );
}


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
    const [genre, setGenre] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
    const [isTyping, setIsTyping] = useState(true);
    const [selectedFormat, setSelectedFormat] = useState<string>("film");
    const [selectedStyle, setSelectedStyle] = useState<"realistic" | "animation_2d" | "animation_3d">("realistic");
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "21:9" | "9:16" | "4:5" | "1:1">("16:9");
    const [scriptFile, setScriptFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [runtime, setRuntime] = useState<number>(30);
    const [runtimeUnit, setRuntimeUnit] = useState<'sec' | 'min'>('sec');
    const [validationErrors, setValidationErrors] = useState<{ title?: boolean; genre?: boolean }>({});

    // ══════ PROCESSING / SCANNER STATE ══════
    const [processingStatus, setProcessingStatus] = useState("");
    const [createdProjectId, setCreatedProjectId] = useState("");
    const [detectedArchetype, setDetectedArchetype] = useState("");
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Refs for listener cleanup
    const unsubJobRef = useRef<(() => void) | null>(null);
    const unsubProjectRef = useRef<(() => void) | null>(null);
    const projectDataRef = useRef<any>(null);

    // ══════ AUTH ══════
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    // ══════ CLEANUP LISTENERS ON UNMOUNT ══════
    useEffect(() => {
        return () => {
            unsubJobRef.current?.();
            unsubProjectRef.current?.();
        };
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

    // ══════ SETUP REAL-TIME LISTENERS ══════
    const setupListeners = (jobId: string, projectId: string) => {
        // Clean up any existing listeners
        unsubJobRef.current?.();
        unsubProjectRef.current?.();

        // ── Listener 1: Job progress (jobs/{jobId}) ──
        const jobRef = doc(db, "jobs", jobId);
        unsubJobRef.current = onSnapshot(jobRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();

            // Update progress text
            if (data.progress) {
                setProcessingStatus(data.progress);
            }

            // Handle completion
            if (data.status === "completed") {
                unsubJobRef.current?.();
                unsubJobRef.current = null;

                // Graceful handoff — show success state, then route
                setIsTransitioning(true);
                setTimeout(() => {
                    unsubProjectRef.current?.();
                    unsubProjectRef.current = null;
                    const epId = projectDataRef.current?.default_episode_id || 'main';
                    router.push(`/project/${projectId}/moodboard?episode_id=${epId}`);
                }, 1500);
            }

            // Handle failure
            if (data.status === "failed") {
                unsubJobRef.current?.();
                unsubJobRef.current = null;
                unsubProjectRef.current?.();
                unsubProjectRef.current = null;
                setPhase("prompt");
                setProcessingStatus("");
                toast.error(data.error || "Script processing failed");
            }
        }, (error) => {
            console.error("Job listener error:", error);
            toast.error("Lost connection to processing status");
        });

        // ── Listener 2: Project taxonomy (projects/{projectId}) ──
        const projectRef = doc(db, "projects", projectId);
        unsubProjectRef.current = onSnapshot(projectRef, (snapshot) => {
            if (!snapshot.exists()) return;
            const data = snapshot.data();

            // Track project data for dynamic episode routing
            projectDataRef.current = data;

            // Check for taxonomy_profile appearing
            if (data.taxonomy_profile?.name && !detectedArchetype) {
                setDetectedArchetype(data.taxonomy_profile.name);
            }
        }, (error) => {
            console.error("Project listener error:", error);
            // Non-critical — archetype glimpse is optional, don't toast
        });
    };

    // ══════ CREATE PROJECT ══════
    const handleCreate = async () => {
        // Validate required fields
        const errors: { title?: boolean; genre?: boolean } = {};
        if (!title.trim()) errors.title = true;
        if (!genre.trim()) errors.genre = true;
        if (errors.title || errors.genre) {
            setValidationErrors(errors);
            const missing = [errors.title && 'Project Name', errors.genre && 'Genre'].filter(Boolean).join(' and ');
            toast.error(`Please fill in ${missing}`);
            setTimeout(() => setValidationErrors({}), 2000);
            return;
        }
        if (!vision.trim() && !scriptFile) return toast.error("Describe your vision or upload a script");
        setPhase("processing");
        setDetectedArchetype("");
        setIsTransitioning(false);

        try {
            const FORMAT_MAP: Record<string, ProjectType> = { film: "movie", series: "micro_drama", ad: "ad" };
            const type = FORMAT_MAP[selectedFormat] || "movie";
            const cleanFilename = (name: string) => name.replace('.pdf', '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
            const projectTitle = title.trim() || (vision ? vision.split(/[.\n]/)[0].slice(0, 60).trim() : (scriptFile ? cleanFilename(scriptFile.name) : "Untitled Project"));

            setProcessingStatus("Creating project...");
            const res = await api.post("/api/v1/project/create", {
                title: projectTitle, genre: genre.trim() || "Drama",
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
            setProcessingStatus("Loading script into AI memory...");

            // Set up real-time Firestore listeners instead of polling
            setupListeners(jobId, projectId);

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
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
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
                        backgroundSize: "200px 200px",
                    }}
                />
                <div className="absolute top-[30%] left-[35%] w-[700px] h-[500px] rounded-full blur-[200px]"
                    style={{ background: "radial-gradient(circle, rgba(229,9,20,0.03) 0%, transparent 70%)", animation: "breathe 10s ease-in-out infinite" }} />
            </div>



            {/* ══════ MAIN CONTENT ══════ */}
            <div className="relative z-10 flex-1 flex flex-col items-center overflow-y-auto">
                <div className="w-full max-w-xl px-6 flex-1 flex flex-col justify-center py-8">

                    {/* Cinematic Scanner overlay */}
                    <CinematicScanner
                        processingStatus={processingStatus}
                        detectedArchetype={detectedArchetype}
                        phase={phase}
                        isTransitioning={isTransitioning}
                    />

                    {/* ── Hero Text ── */}
                    <div className="text-center mb-6 fade-in">
                        <p className="text-white font-anton uppercase tracking-wide text-[28px]">
                            What do you want to make?
                        </p>
                    </div>

                    {/* ── Title Input ── */}
                    <div className="mb-5">
                        <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); if (validationErrors.title) setValidationErrors(v => ({ ...v, title: false })); }}
                            className={`w-full bg-transparent text-[16px] text-white placeholder-neutral-600 focus:outline-none tracking-[1px] caret-[#E50914] border-b pb-2 transition-all duration-300 ${validationErrors.title ? 'border-[#E50914]/60 placeholder-[#E50914]/40' : 'border-white/[0.06] focus:border-white/[0.12]'}`}
                            placeholder="Project Name *" autoComplete="off" />
                    </div>

                    {/* ── Genre Input ── */}
                    <div className="mb-5">
                        <input type="text" value={genre} onChange={(e) => { setGenre(e.target.value); if (validationErrors.genre) setValidationErrors(v => ({ ...v, genre: false })); }}
                            className={`w-full bg-transparent text-[16px] text-white placeholder-neutral-600 focus:outline-none tracking-[1px] caret-[#E50914] border-b pb-2 transition-all duration-300 ${validationErrors.genre ? 'border-[#E50914]/60 placeholder-[#E50914]/40' : 'border-white/[0.06] focus:border-white/[0.12]'}`}
                            placeholder="Genre (e.g. Thriller, Comedy, Horror) *" autoComplete="off" />
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
                                    disabled={phase !== 'prompt' || !title.trim() || !genre.trim() || (!vision.trim() && !scriptFile)}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-semibold tracking-[1px] transition-all duration-300 cursor-pointer
                                        ${phase !== 'prompt' || !title.trim() || !genre.trim() || (!vision.trim() && !scriptFile) ? 'text-neutral-700 cursor-not-allowed' : 'bg-[#E50914] text-white shadow-[0_0_20px_rgba(229,9,20,0.12)] hover:shadow-[0_0_30px_rgba(229,9,20,0.2)] hover:bg-[#ff1a25]'}`}>
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
                        <div className="mt-3 flex items-center justify-center gap-2 fade-in-3">
                            {(['16:9', '9:16', '21:9', '4:5', '1:1'] as const).map((r) => (
                                <button key={r} onClick={() => setAspectRatio(r)}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider transition-all cursor-pointer ${aspectRatio === r ? 'text-white bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-2 fade-in-3">
                            {[{ label: '15s', value: 15 }, { label: '30s', value: 30 }, { label: '60s', value: 60 }, { label: '2m', value: 120 }, { label: '5m', value: 300 }, { label: '10m', value: 600 }].map((r) => (
                                <button key={r.value} onClick={() => { setRuntime(r.value); setRuntimeUnit('sec'); }}
                                    className={`px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider transition-all cursor-pointer ${runtime === r.value ? 'text-white bg-white/[0.08]' : 'text-neutral-600 hover:text-neutral-400'}`}>
                                    {r.label}
                                </button>
                            ))}
                            <span className="text-neutral-700 text-[11px] mx-1">or</span>
                            <div className="flex items-center gap-1.5">
                                <input type="number" min={1}
                                    value={runtimeUnit === 'min' ? (runtime ? Math.round(runtime / 60 * 10) / 10 : '') : (runtime || '')}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        setRuntime(runtimeUnit === 'min' ? Math.round(val * 60) : Math.round(val));
                                    }}
                                    onBlur={() => { if (runtime < 1) setRuntime(30); }}
                                    className="w-14 bg-white/[0.04] rounded px-2 py-1.5 text-[11px] font-mono text-white text-center focus:outline-none focus:bg-white/[0.08] border border-white/[0.06] caret-[#E50914]" />
                                <button onClick={() => setRuntimeUnit(u => u === 'sec' ? 'min' : 'sec')}
                                    className="text-[11px] text-neutral-500 hover:text-white font-mono uppercase tracking-wider cursor-pointer transition-colors px-1.5 py-0.5 rounded hover:bg-white/[0.06]">
                                    {runtimeUnit}
                                </button>
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