"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { api, invalidateDashboardCache, cloneProject, fetchTemplateProjects, TemplateProject } from "@/lib/api";
import {
    Smartphone, Film, Megaphone, Sparkles,
    Egg, Layers, Zap,
    LayoutTemplate, FileText, Eye,
    ArrowRight, Check, Disc, Send, Loader2, Copy
} from "lucide-react";
import { toast } from "react-hot-toast";

/* ═══════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════ */
type GoalKey = "social_clips" | "short_film" | "brand_content" | "explore";
type ExpKey = "beginner" | "intermediate" | "advanced";
type WorkflowKey = "template" | "script" | "showcase";

interface Option<T extends string> {
    key: T;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    accent: string;
}

/* ═══════════════════════════════════════════════
   QUESTION DEFINITIONS
   ═══════════════════════════════════════════════ */
const GOAL_OPTIONS: Option<GoalKey>[] = [
    { key: "social_clips",   icon: <Smartphone size={22} />, title: "Social Media Clips",    subtitle: "Reels, TikToks, YouTube Shorts",      accent: "#E50914" },
    { key: "short_film",     icon: <Film size={22} />,       title: "Short Films & Music Videos", subtitle: "Cinematic storytelling",          accent: "#3B82F6" },
    { key: "brand_content",  icon: <Megaphone size={22} />,  title: "Ads & Brand Content",   subtitle: "Product promos, commercials",          accent: "#D4A843" },
    { key: "explore",        icon: <Sparkles size={22} />,   title: "Explore AI Filmmaking",  subtitle: "Curious — just want to try it out",   accent: "#10B981" },
];

const EXP_OPTIONS: Option<ExpKey>[] = [
    { key: "beginner",      icon: <Egg size={22} />,    title: "I'm Completely New",    subtitle: "Never used AI video tools",     accent: "#10B981" },
    { key: "intermediate",  icon: <Layers size={22} />, title: "I've Tried Some Tools", subtitle: "Runway, Pika, Kling, etc.",     accent: "#3B82F6" },
    { key: "advanced",      icon: <Zap size={22} />,    title: "I'm a Pro",             subtitle: "Power user, filmmaker, editor", accent: "#D4A843" },
];

const WORKFLOW_OPTIONS: Option<WorkflowKey>[] = [
    { key: "template", icon: <LayoutTemplate size={22} />, title: "Start with a Template",     subtitle: "Pre-built projects I can customize", accent: "#10B981" },
    { key: "script",   icon: <FileText size={22} />,       title: "I Have an Idea",           subtitle: "Describe my video concept",           accent: "#3B82F6" },
    { key: "showcase", icon: <Eye size={22} />,             title: "Show Me What's Possible",  subtitle: "See examples first, then create",     accent: "#D4A843" },
];

/* ═══════════════════════════════════════════════
   PERSONA-BASED PRESETS
   ═══════════════════════════════════════════════ */
interface PersonaPreset {
    title: string;
    genre: string;
    type: "movie" | "micro_drama" | "ad";
    aspectRatio: "16:9" | "9:16" | "21:9" | "4:5" | "1:1";
    style: "realistic" | "animation_2d" | "animation_3d";
    runtime: number;
    placeholder: string;
    examples: string[];
    showcaseDescription: string;
    showcaseHighlights: string[];
}

const PERSONA_PRESETS: Record<GoalKey, PersonaPreset> = {
    social_clips: {
        title: "",
        genre: "Lifestyle",
        type: "movie",
        aspectRatio: "9:16",
        style: "realistic",
        runtime: 30,
        placeholder: "A street fashion reel in neon-lit Tokyo at night...",
        examples: [
            "A street fashion reel in neon-lit Tokyo at night",
            "A food vlog montage of making pasta from scratch",
            "An aesthetic morning routine in a sun-filled apartment",
            "A skateboarding reel through empty city streets at sunset",
        ],
        showcaseDescription: "MotionX creates scroll-stopping social content with cinematic AI. No cameras, no crew — just your idea.",
        showcaseHighlights: [
            "9:16 vertical format, ready for Instagram, TikTok, Shorts",
            "AI generates characters, backgrounds, and cinematic camera moves",
            "Go from idea to video in under 5 minutes",
            "Professional-grade output that looks hand-crafted",
        ],
    },
    short_film: {
        title: "",
        genre: "Drama",
        type: "movie",
        aspectRatio: "16:9",
        style: "realistic",
        runtime: 60,
        placeholder: "A tense standoff between a detective and an AI gone rogue in 2089...",
        examples: [
            "A detective chasing a rogue android through rain-soaked streets",
            "A girl discovers her grandmother's letters from 1940s Paris",
            "Two strangers share a taxi during a city-wide blackout",
            "An astronaut hallucinating memories of home on a solo mission to Mars",
        ],
        showcaseDescription: "MotionX is a full AI filmmaking engine — from script to screen. Create cinematic short films with professional production value.",
        showcaseHighlights: [
            "AI generates characters, locations, and scene breakdowns from your idea",
            "Professional cinematography with camera angles, lens choices & lighting",
            "Full post-production timeline with sound design & editing",
            "16:9 cinematic widescreen format",
        ],
    },
    brand_content: {
        title: "",
        genre: "Commercial",
        type: "ad",
        aspectRatio: "16:9",
        style: "realistic",
        runtime: 30,
        placeholder: "A luxury watch commercial with golden hour macro shots...",
        examples: [
            "A premium watch ad with slow-motion macro shots and golden light",
            "A sneaker launch ad in a futuristic warehouse with neon accents",
            "A perfume commercial with ethereal slow-motion in a garden",
            "A tech product reveal with particle effects and clean minimalism",
        ],
        showcaseDescription: "Create production-quality brand films and ads without a production crew. From concept to finished commercial in minutes.",
        showcaseHighlights: [
            "Product-focused cinematic shots with professional lighting",
            "AI handles talent, backgrounds, and visual effects",
            "Multi-format export: 16:9, 9:16, 4:5 for every platform",
            "Iterate fast — generate dozens of variations in minutes",
        ],
    },
    explore: {
        title: "",
        genre: "Drama",
        type: "movie",
        aspectRatio: "16:9",
        style: "realistic",
        runtime: 45,
        placeholder: "Anything! A cyberpunk chase, a cooking show, a space opera...",
        examples: [
            "A cyberpunk chase through a neon marketplace at night",
            "Cherry blossoms drifting past a girl on a rooftop at sunset",
            "An underwater city where bioluminescent creatures light the streets",
            "A samurai standing alone in a field of tall grass, wind blowing",
        ],
        showcaseDescription: "MotionX turns your wildest ideas into cinematic reality. Just describe what you imagine — AI handles the rest.",
        showcaseHighlights: [
            "Any genre, any style — realistic, anime, 3D animation",
            "AI creates characters, locations, camera moves from your description",
            "Full filmmaking pipeline: script → pre-production → production → post",
            "30 free credits to experiment with",
        ],
    },
};

/* ═══════════════════════════════════════════════
   AMBIENT VIDEO
   ═══════════════════════════════════════════════ */
const AMBIENT_VIDEO = "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media";

/* ═══════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════ */
export default function OnboardingPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0); // 0-2 = questions, 3 = creation
    const [answers, setAnswers] = useState<{ goal?: GoalKey; experience?: ExpKey; workflow?: WorkflowKey }>({});
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uid, setUid] = useState<string | null>(null);
    const [fadeDirection, setFadeDirection] = useState<"in" | "out">("in");

    // Step 4 (creation) state
    const [idea, setIdea] = useState("");
    const [isCreating, setIsCreating] = useState(false);
    const [showShowcase, setShowShowcase] = useState(false);

    // Template browser state
    const [templateProjects, setTemplateProjects] = useState<TemplateProject[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [cloningId, setCloningId] = useState<string | null>(null);
    const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);

    // Auth guard
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push("/login");
            } else {
                setUid(user.uid);
            }
        });
        return () => unsub();
    }, [router]);

    const QUESTIONS = [
        { id: "goal",     heading: "What brings you to MotionX?", subheading: "This helps us tailor your experience", options: GOAL_OPTIONS },
        { id: "experience", heading: "What's your experience with AI video?", subheading: "We'll adjust the complexity for you", options: EXP_OPTIONS },
        { id: "workflow", heading: "How would you like to start?", subheading: "You can always change this later", options: WORKFLOW_OPTIONS },
    ] as const;

    const isQuestionPhase = currentStep < 3;
    const question = isQuestionPhase ? QUESTIONS[currentStep] : null;
    const preset = answers.goal ? PERSONA_PRESETS[answers.goal] : PERSONA_PRESETS.explore;

    const handleSelect = useCallback((key: string) => {
        setSelectedKey(key);
    }, []);

    // ═══ LOAD TEMPLATES (for template browser) ═══
    const loadTemplates = useCallback(async () => {
        setTemplatesLoading(true);
        try {
            const data = await fetchTemplateProjects();
            setTemplateProjects(data.templates);
        } catch (e) {
            console.error("[Onboarding] Failed to load templates:", e);
        } finally {
            setTemplatesLoading(false);
        }
    }, []);

    // ═══ CLONE TEMPLATE PROJECT ═══
    const handleCloneTemplate = useCallback(async (templateId: string) => {
        if (cloningId) return;
        setCloningId(templateId);
        try {
            const result = await cloneProject(templateId);
            if (auth.currentUser) {
                invalidateDashboardCache(auth.currentUser.uid);
            }
            toast.success(`Cloned: ${result.title}`);
            router.push(`/project/${result.id}/preproduction`);
        } catch (e: any) {
            console.error("[Onboarding] Clone failed:", e);
            toast.error(e.response?.data?.detail || "Failed to clone project");
            setCloningId(null);
        }
    }, [cloningId, router]);

    const handleNext = useCallback(async () => {
        if (!selectedKey) return;

        const updatedAnswers = { ...answers, [question!.id]: selectedKey };
        setAnswers(updatedAnswers as any);

        // After Q3, route by goal × workflow matrix
        if (currentStep === 2) {
            const goal = updatedAnswers.goal as GoalKey;
            const workflow = selectedKey as WorkflowKey;
            const isSocial = goal === "social_clips";

            console.log("[Onboarding] Q3 routing →", { goal, workflow, isSocial, updatedAnswers });

            // Save profile to Firestore (fire-and-forget — never block routing)
            if (uid) {
                setDoc(doc(db, "users", uid), {
                    profile: {
                        goal,
                        experience: updatedAnswers.experience,
                        workflow,
                        completed_at: serverTimestamp(),
                    }
                }, { merge: true }).catch(e => console.error("[Onboarding] Profile save failed:", e));
            }

            // ── Route based on goal × workflow ──

            if (workflow === "showcase") {
                // Any goal + "Show me what's possible" → Explore gallery
                console.log("[Onboarding] → /explore");
                router.push("/explore");
                return;
            }

            if (isSocial && workflow === "template") {
                // Social + Template → Playground with tour
                console.log("[Onboarding] → /playground?tour=true");
                router.push("/playground?tour=true");
                return;
            }

            if (isSocial && workflow === "script") {
                // Social + I have an idea → Step 4 (idea input for playground)
                console.log("[Onboarding] → Step 4 (social idea input)");
                setFadeDirection("out");
                setIsTransitioning(true);
                setTimeout(() => {
                    setCurrentStep(3);
                    setSelectedKey(null);
                    setFadeDirection("in");
                    setIsTransitioning(false);
                }, 350);
                return;
            }

            if (!isSocial && (workflow === "template")) {
                // Non-social + Template → Template Browser
                console.log("[Onboarding] → Step 4 (template browser)");
                setShowTemplateBrowser(true);
                loadTemplates();
                setFadeDirection("out");
                setIsTransitioning(true);
                setTimeout(() => {
                    setCurrentStep(3);
                    setSelectedKey(null);
                    setFadeDirection("in");
                    setIsTransitioning(false);
                }, 350);
                return;
            }

            if (!isSocial && (workflow === "script")) {
                // Non-social + I have an idea → New Project page
                console.log("[Onboarding] → /project/new");
                router.push("/project/new");
                return;
            }

            // Fallback (should never reach here)
            console.warn("[Onboarding] No route matched!", { goal, workflow });
            router.push("/dashboard");
            return;
        }

        // Standard Q→Q transition
        setFadeDirection("out");
        setIsTransitioning(true);
        setTimeout(() => {
            setCurrentStep(prev => prev + 1);
            setSelectedKey(null);
            setFadeDirection("in");
            setIsTransitioning(false);
        }, 350);
    }, [selectedKey, answers, question, currentStep, uid, router, loadTemplates]);

    // ═══ CREATE PROJECT (or redirect to playground for social) ═══
    const handleCreateProject = useCallback(async () => {
        const text = idea.trim();
        if (!text || isCreating) return;
        setIsCreating(true);

        // Social media + I have an idea → redirect to playground with idea
        const isSocial = answers.goal === "social_clips";
        if (isSocial) {
            const encoded = encodeURIComponent(text);
            router.push(`/playground?idea=${encoded}&tour=true`);
            return;
        }

        // Non-social: create project with presets
        const stopWords = new Set(["a", "an", "the", "in", "on", "at", "for", "with", "and", "or", "of", "to", "from", "by", "about", "like", "my", "is", "its", "that", "this"]);
        const words = text.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && w.length > 2);
        const title = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || "My Project";

        try {
            const res = await api.post("/api/v1/project/create", {
                title,
                genre: preset.genre,
                type: preset.type,
                aspect_ratio: preset.aspectRatio,
                style: preset.style,
                runtime_seconds: preset.runtime,
            });
            const projectId = res.data.id;

            await setDoc(doc(db, "projects", projectId), {
                is_quickstart: true,
            }, { merge: true });

            if (auth.currentUser) {
                invalidateDashboardCache(auth.currentUser.uid);
            }

            const blob = new Blob([text], { type: "text/plain" });
            const formData = new FormData();
            formData.append("project_id", projectId);
            formData.append("script_title", title);
            formData.append("runtime_seconds", String(preset.runtime));
            formData.append("file", new File([blob], "script.txt"));

            await api.post("/api/v1/script/upload-script", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            toast.success("Your project is being created...");
            router.push(`/project/${projectId}/preproduction`);
        } catch (e: any) {
            console.error("[Onboarding] Create failed:", e);
            toast.error(e.response?.data?.detail || "Failed to create project");
            setIsCreating(false);
        }
    }, [idea, isCreating, preset, uid, router, answers.goal]);

    const handleSkip = useCallback(async () => {
        try {
            if (uid) {
                await setDoc(doc(db, "users", uid), {
                    profile: {
                        goal: answers.goal || null,
                        experience: answers.experience || null,
                        workflow: answers.workflow || null,
                        completed_at: serverTimestamp(),
                        skipped: true,
                    }
                }, { merge: true });
            }
        } catch (e) {
            console.error("[Onboarding] Skip save failed:", e);
        }
        router.push("/dashboard");
    }, [uid, answers, router]);

    if (!uid) {
        return (
            <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
                <Disc size={24} className="animate-spin text-[#E50914]" />
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-[#050505] text-white overflow-hidden flex flex-col z-[9999]">
            <style jsx global>{`
                @keyframes onb-fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes onb-fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-12px); } }
                @keyframes onb-cardIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
                @keyframes onb-pulse { 0%,100% { box-shadow: 0 0 20px rgba(229,9,20,0.15); } 50% { box-shadow: 0 0 40px rgba(229,9,20,0.3); } }
                @keyframes onb-breathe { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
                @keyframes onb-shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
                .onb-fade-in { animation: onb-fadeIn 0.5s ease both; }
                .onb-fade-out { animation: onb-fadeOut 0.35s ease both; }
            `}</style>

            {/* ── Ambient Background ── */}
            <div className="absolute inset-0 pointer-events-none">
                <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.1 }} src={AMBIENT_VIDEO} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #050505 0%, rgba(5,5,5,0.8) 30%, rgba(5,5,5,0.6) 60%, #050505 100%)" }} />
                <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 20%, rgba(5,5,5,0.95) 80%)" }} />
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                        backgroundSize: "200px 200px",
                    }} />
            </div>

            {/* ── Header ── */}
            <div className="relative z-10 flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-2">
                    <Disc size={10} fill="#E50914" color="#E50914" className="animate-pulse" />
                    <span className="text-[10px] font-mono tracking-[3px] uppercase text-white/40">MotionX Studio</span>
                </div>
                <button
                    onClick={handleSkip}
                    disabled={isSaving || isCreating}
                    className="text-[10px] font-mono tracking-[2px] uppercase text-white/25 hover:text-white/60 transition-colors cursor-pointer"
                >
                    SKIP →
                </button>
            </div>

            {/* ── Progress Bar ── */}
            <div className="relative z-10 px-8">
                <div className="max-w-lg mx-auto flex gap-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex-1 h-[2px] rounded-full overflow-hidden bg-white/[0.06]">
                            <div
                                className="h-full rounded-full transition-all duration-500 ease-out"
                                style={{
                                    width: i < currentStep ? "100%" : i === currentStep ? "50%" : "0%",
                                    background: i === 3 ? "linear-gradient(90deg, #10B981, #34D399)" : "linear-gradient(90deg, #E50914, #FF4D58)",
                                }}
                            />
                        </div>
                    ))}
                </div>
                <div className="text-center mt-2">
                    <span className="text-[9px] font-mono text-white/20 tracking-[2px] uppercase">
                        {currentStep < 3 ? `${currentStep + 1} of 4` : "Let's create"}
                    </span>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="relative z-10 flex-1 flex items-center justify-center px-6 overflow-y-auto">
                {isQuestionPhase && question ? (
                    /* ═══ QUESTION STEP ═══ */
                    <div
                        className={`w-full max-w-2xl ${fadeDirection === "in" ? "onb-fade-in" : "onb-fade-out"}`}
                        key={currentStep}
                    >
                        <div className="text-center mb-10">
                            <h1 className="font-['Anton'] text-[32px] sm:text-[40px] uppercase tracking-[2px] text-white leading-tight">
                                {question.heading}
                            </h1>
                            <p className="text-[12px] text-white/30 mt-2 tracking-wide">
                                {question.subheading}
                            </p>
                        </div>

                        <div className={`grid gap-3 ${question.options.length === 4 ? "grid-cols-2" : "grid-cols-1 max-w-md mx-auto"}`}>
                            {question.options.map((opt, i) => {
                                const isSelected = selectedKey === opt.key;
                                return (
                                    <button
                                        key={opt.key}
                                        onClick={() => handleSelect(opt.key)}
                                        disabled={isTransitioning || isSaving}
                                        className="relative group text-left rounded-xl border p-5 transition-all duration-300 cursor-pointer overflow-hidden"
                                        style={{
                                            animation: `onb-cardIn 0.5s ease ${i * 80}ms both`,
                                            borderColor: isSelected ? `${opt.accent}60` : "rgba(255,255,255,0.06)",
                                            background: isSelected ? `linear-gradient(135deg, ${opt.accent}10, ${opt.accent}05)` : "rgba(255,255,255,0.02)",
                                            boxShadow: isSelected ? `0 0 30px ${opt.accent}15` : "none",
                                        }}
                                    >
                                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
                                            style={{ background: `radial-gradient(ellipse at center, ${opt.accent}08 0%, transparent 70%)` }} />
                                        <div className="relative flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300"
                                                style={{
                                                    borderColor: isSelected ? `${opt.accent}40` : "rgba(255,255,255,0.06)",
                                                    background: isSelected ? `${opt.accent}15` : "rgba(255,255,255,0.03)",
                                                    color: isSelected ? opt.accent : "rgba(255,255,255,0.4)",
                                                }} >
                                                {opt.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text-[14px] font-semibold tracking-wide transition-colors duration-300 ${isSelected ? "text-white" : "text-white/70 group-hover:text-white"}`}>
                                                    {opt.title}
                                                </h3>
                                                <p className="text-[11px] text-white/25 mt-0.5">{opt.subtitle}</p>
                                            </div>
                                            <div className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 mt-1"
                                                style={{
                                                    borderColor: isSelected ? opt.accent : "rgba(255,255,255,0.1)",
                                                    background: isSelected ? opt.accent : "transparent",
                                                }} >
                                                {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* ═══ STEP 4: PERSONALIZED CREATION ═══ */
                    <div
                        className={`w-full max-w-3xl ${fadeDirection === "in" ? "onb-fade-in" : "onb-fade-out"}`}
                        key="creation"
                    >
                        {/* ═══ TEMPLATE BROWSER (non-social + template) ═══ */}
                        {showTemplateBrowser ? (
                            <div>
                                <div className="text-center mb-8">
                                    <h1 className="font-['Anton'] text-[30px] sm:text-[36px] uppercase tracking-[2px] text-white leading-tight">
                                        Choose a Template
                                    </h1>
                                    <p className="text-[12px] text-white/30 mt-2 tracking-wide max-w-lg mx-auto">
                                        Pick a project to clone into your account. All scenes, shots, and assets will be copied.
                                    </p>
                                </div>

                                {templatesLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <Loader2 size={28} className="animate-spin text-[#E50914] mb-3" />
                                        <span className="text-[10px] font-mono text-white/30 uppercase tracking-[2px]">Loading templates...</span>
                                    </div>
                                ) : templateProjects.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Film size={32} className="text-white/10 mx-auto mb-3" />
                                        <p className="text-[12px] text-white/30">No templates available yet.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                        {templateProjects.map((tpl, i) => {
                                            const isCloning = cloningId === tpl.id;
                                            return (
                                                <button
                                                    key={tpl.id}
                                                    onClick={() => handleCloneTemplate(tpl.id)}
                                                    disabled={!!cloningId}
                                                    className="group relative aspect-video rounded-xl border overflow-hidden text-left transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{
                                                        animation: `onb-cardIn 0.5s ease ${i * 80}ms both`,
                                                        borderColor: isCloning ? "#E50914" : "rgba(255,255,255,0.08)",
                                                        background: "rgba(255,255,255,0.02)",
                                                    }}
                                                >
                                                    {/* Preview image */}
                                                    {(tpl.preview_image || tpl.moodboard_image_url) ? (
                                                        <img
                                                            src={tpl.preview_image || tpl.moodboard_image_url || ""}
                                                            alt={tpl.title}
                                                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
                                                        />
                                                    ) : (
                                                        <div className="absolute inset-0 bg-gradient-to-br from-[#111] to-[#0a0a0a] flex items-center justify-center">
                                                            <Film size={28} className="text-white/10" />
                                                        </div>
                                                    )}

                                                    {/* Gradient overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                                                    {/* Clone icon overlay on hover */}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
                                                        {isCloning ? (
                                                            <div className="bg-black/80 backdrop-blur-sm rounded-full p-3">
                                                                <Loader2 size={20} className="animate-spin text-[#E50914]" />
                                                            </div>
                                                        ) : (
                                                            <div className="bg-[#E50914]/90 backdrop-blur-sm rounded-full p-3 shadow-lg shadow-[#E50914]/30">
                                                                <Copy size={18} className="text-white" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Bottom info */}
                                                    <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                                                        <h3 className="text-[12px] font-bold text-white truncate uppercase tracking-wide">
                                                            {tpl.title}
                                                        </h3>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[8px] font-mono text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded uppercase">
                                                                {tpl.genre || tpl.type}
                                                            </span>
                                                            <span className="text-[8px] font-mono text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded uppercase">
                                                                {tpl.aspect_ratio}
                                                            </span>
                                                            {tpl.scene_count > 0 && (
                                                                <span className="text-[8px] font-mono text-white/40 bg-white/[0.06] px-1.5 py-0.5 rounded">
                                                                    {tpl.scene_count} scene{tpl.scene_count !== 1 ? "s" : ""}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ═══ Creation input view ═══ */
                            <div>
                                <div className="text-center mb-6">
                                    <h1 className="font-['Anton'] text-[30px] sm:text-[36px] uppercase tracking-[2px] text-white leading-tight">
                                        {answers.goal === "social_clips" ? "Describe Your Clip" : "Describe Your Video"}
                                    </h1>
                                    <p className="text-[12px] text-white/30 mt-2 tracking-wide">
                                        {answers.goal === "social_clips"
                                            ? "Tell us your idea — we'll set up the Playground for you."
                                            : "One line is all it takes. AI handles the rest."}
                                    </p>
                                </div>

                                {/* Config pills */}
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] font-mono text-white/30 uppercase tracking-wider">
                                        {preset.aspectRatio}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] font-mono text-white/30 uppercase tracking-wider">
                                        {preset.runtime}s
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] font-mono text-white/30 uppercase tracking-wider">
                                        {preset.style}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] font-mono text-white/30 uppercase tracking-wider">
                                        {preset.genre}
                                    </span>
                                </div>

                                {/* Main input */}
                                <div className="max-w-xl mx-auto mb-6">
                                    <div className={`rounded-2xl border p-5 transition-all duration-300 ${
                                        idea ? "border-[#E50914]/30 bg-[#E50914]/[0.03] shadow-[0_0_40px_rgba(229,9,20,0.08)]" : "border-white/[0.08] bg-white/[0.03]"
                                    } focus-within:border-[#E50914]/40`}>
                                        <textarea
                                            value={idea}
                                            onChange={(e) => setIdea(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCreateProject(); } }}
                                            placeholder={preset.placeholder}
                                            className="w-full bg-transparent text-[15px] text-white placeholder-white/20 focus:outline-none resize-none leading-relaxed caret-[#E50914] min-h-[60px]"
                                            rows={2}
                                            disabled={isCreating}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Inspiration chips */}
                                <div className="max-w-xl mx-auto mb-8">
                                    <p className="text-[9px] font-mono text-white/15 uppercase tracking-[2px] mb-2.5">Try one of these</p>
                                    <div className="flex flex-wrap gap-2">
                                        {preset.examples.map((ex, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setIdea(ex)}
                                                disabled={isCreating}
                                                className="px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[10px] text-white/30 hover:text-white/60 hover:border-white/[0.12] hover:bg-white/[0.04] transition-all duration-300 cursor-pointer disabled:opacity-50"
                                            >
                                                {ex.length > 50 ? ex.slice(0, 50) + "..." : ex}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Create button */}
                                <div className="max-w-xl mx-auto text-center">
                                    <button
                                        onClick={handleCreateProject}
                                        disabled={!idea.trim() || isCreating}
                                        className="inline-flex items-center gap-3 px-10 py-4 rounded-xl text-[12px] font-bold tracking-[2px] uppercase transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-none"
                                        style={{
                                            background: idea.trim() ? "linear-gradient(135deg, #E50914, #B30710)" : "rgba(255,255,255,0.05)",
                                            color: idea.trim() ? "white" : "rgba(255,255,255,0.3)",
                                            boxShadow: idea.trim() ? "0 8px 32px rgba(229,9,20,0.3)" : "none",
                                            animation: idea.trim() ? "onb-pulse 3s ease-in-out infinite" : "none",
                                        }}
                                    >
                                        {isCreating ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" />
                                                Creating Your Project...
                                            </>
                                        ) : (
                                            <>
                                                Create & Start Directing
                                                <Sparkles size={14} />
                                            </>
                                        )}
                                    </button>
                                    <p className="text-[9px] text-white/15 mt-3 tracking-wider">
                                        Uses 0 credits — your first project is on us ✨
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Footer CTA (Questions only) ── */}
            {isQuestionPhase && (
                <div className="relative z-10 px-8 pb-8">
                    <div className="max-w-2xl mx-auto flex justify-center">
                        <button
                            onClick={handleNext}
                            disabled={!selectedKey || isTransitioning || isSaving}
                            className="flex items-center gap-3 px-10 py-4 rounded-xl text-[12px] font-bold tracking-[2px] uppercase transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed border-none"
                            style={{
                                background: selectedKey ? "linear-gradient(135deg, #E50914, #B30710)" : "rgba(255,255,255,0.05)",
                                color: selectedKey ? "white" : "rgba(255,255,255,0.3)",
                                boxShadow: selectedKey ? "0 8px 32px rgba(229,9,20,0.3)" : "none",
                            }}
                        >
                            Continue
                            <ArrowRight size={14} strokeWidth={3} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
