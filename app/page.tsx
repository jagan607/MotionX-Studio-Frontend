"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ChevronRight, Play, Aperture, Film, Sparkles, Layers,
  ArrowRight, Camera, Sun, Palette, LayoutGrid,
  Clapperboard, Users, Zap, Headphones, TrendingUp,
  Video, Megaphone, Tv, Target, Clock, DollarSign,
  CheckCircle2, Building2, Shield, Server, MessageSquare,
  Scissors, Eye, UserCheck, Volume2, VolumeX,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { fetchGlobalFeed } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CALENDLY_URL = "https://calendly.com/jagan-motionx/30min";

// Firebase Storage URLs for landing page screenshots
const LANDING_IMAGES = {
  dashboard: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-dashboard.png?alt=media&token=6a5f5807-a561-4a27-b512-3f0b9ab0cd8b",
  projectHub: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-project-hub.png?alt=media&token=688a55bf-9fbb-4626-b8bc-c520b663df86",
  preproductionCanvas: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-preproduction-canvas.png?alt=media&token=1c3924ea-e877-4085-a108-a6285a8b4628",
  storyboard: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-storyboard.png?alt=media&token=2d1a689a-ef62-4ce9-b63c-f94909350576",
  postproduction: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-postproduction.png?alt=media&token=ceabf528-f2b2-4760-9ad0-3646c3127086",
  adrTerminal: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-adr-terminal.png?alt=media&token=73e445c4-fcad-481c-8766-5d3d3a65e01e",
  shotConfig: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-shot-config.png?alt=media&token=4c8aae94-9ec5-4aa0-834c-0edbccb42d8e",
  setBlueprint: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-set-blueprint.png?alt=media&token=5db1e0cd-40e6-49ae-a299-eb5b7bdfc4b0",
  characterProfile: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-character-profile.png?alt=media&token=9668c8eb-7ebe-4878-80a3-0f24f9dcdce1",
  treatment: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/landing%2Fnew-treatment.png?alt=media&token=43fee0e4-a94d-4f9d-9119-2069ad98dd9f",
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number], delay: i * 0.12 },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i: number = 0) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number], delay: i * 0.12 },
  }),
};

const slideFromLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: (i: number = 0) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number], delay: i * 0.12 },
  }),
};

const slideFromRight = {
  hidden: { opacity: 0, x: 60 },
  visible: (i: number = 0) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number], delay: i * 0.12 },
  }),
};

const blurIn = {
  hidden: { opacity: 0, filter: 'blur(12px)' },
  visible: (i: number = 0) => ({
    opacity: 1, filter: 'blur(0px)',
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number], delay: i * 0.15 },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

const staggerSlow = {
  visible: { transition: { staggerChildren: 0.2 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION WRAPPER (scroll-triggered reveal)
// ─────────────────────────────────────────────────────────────────────────────

const Section = ({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION BADGE
// ─────────────────────────────────────────────────────────────────────────────

const Badge = ({ children }: { children: React.ReactNode }) => (
  <motion.span
    variants={fadeUp}
    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold tracking-[0.2em] uppercase text-neutral-500 mb-6"
  >
    <Sparkles size={12} className="text-[#E50914]" />
    {children}
  </motion.span>
);

// ─────────────────────────────────────────────────────────────────────────────
// HERO: TYPING EFFECT HOOK
// ─────────────────────────────────────────────────────────────────────────────

const useTypingEffect = (text: string, speed = 50, delay = 800) => {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText("");
    setIsComplete(false);
    let i = 0;
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
        } else {
          setIsComplete(true);
          clearInterval(interval);
        }
      }, speed);
    }, delay);
    return () => clearTimeout(timeout);
  }, [text, speed, delay]);

  return { displayText, isComplete };
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO: VIEWFINDER CORNER BRACKET
// ─────────────────────────────────────────────────────────────────────────────

const ViewfinderCorner = ({ position }: { position: "tl" | "tr" | "bl" | "br" }) => {
  const isRight = position === "tr" || position === "br";
  const isBottom = position === "bl" || position === "br";
  return (
    <div
      className="absolute z-20 pointer-events-none"
      style={{
        ...(isBottom ? { bottom: 28 } : { top: 28 }),
        ...(isRight ? { right: 28 } : { left: 28 }),
        width: 48, height: 48,
      }}
    >
      <div className="absolute" style={{
        [isBottom ? "bottom" : "top"]: 0,
        [isRight ? "right" : "left"]: 0,
        width: 48, height: 1,
        background: "rgba(255,255,255,0.3)",
      }} />
      <div className="absolute" style={{
        [isBottom ? "bottom" : "top"]: 0,
        [isRight ? "right" : "left"]: 0,
        width: 1, height: 48,
        background: "rgba(255,255,255,0.3)",
      }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED COUNTER
// ─────────────────────────────────────────────────────────────────────────────

const AnimatedCounter = ({ target, suffix = "" }: { target: number; suffix?: string }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 2000;
    const stepTime = 30;
    const steps = duration / stepTime;
    const increment = target / steps;
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION
// ─────────────────────────────────────────────────────────────────────────────

const ROTATING_TAGLINES = [
  "Direct your film without a crew",
  "Visualize scenes before production",
  "Edit your footage with AI",
  "Maintain consistency across every shot",
];

const HeroSection = () => {
  const headline = "Script to Film";
  const [countdownDone, setCountdownDone] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const { displayText, isComplete } = useTypingEffect(headline, 65, countdownDone ? 400 : 99999);
  const [activeIdx, setActiveIdx] = useState(0);
  const [heroVideos, setHeroVideos] = useState<string[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [taglineIdx, setTaglineIdx] = useState(0);
  const [taglineFading, setTaglineFading] = useState(false);

  // Film countdown: 3 → 2 → 1 → ACTION → done
  useEffect(() => {
    let step = 3;
    const timer = setInterval(() => {
      step--;
      if (step > 0) {
        setCountdownNum(step);
      } else if (step === 0) {
        setCountdownNum(0); // "ACTION"
      } else {
        setCountdownDone(true);
        clearInterval(timer);
      }
    }, 700);
    return () => clearInterval(timer);
  }, []);

  // Rotate taglines every 3 seconds
  useEffect(() => {
    if (!isComplete) return;
    const timer = setInterval(() => {
      setTaglineFading(true);
      setTimeout(() => {
        setTaglineIdx(prev => (prev + 1) % ROTATING_TAGLINES.length);
        setTaglineFading(false);
      }, 400);
    }, 3000);
    return () => clearInterval(timer);
  }, [isComplete]);

  // Fetch 4 videos from Firebase global feed
  useEffect(() => {
    fetchGlobalFeed().then((shots: any[]) => {
      const vids = shots
        .filter((s: any) => s.video_url)
        .slice(0, 4)
        .map((s: any) => s.video_url);
      setHeroVideos(vids);
    }).catch((e) => {
      console.warn("Global Feed fetching error:", e);
    });
  }, []);

  // Cross-fade every 6 seconds
  useEffect(() => {
    if (heroVideos.length < 2) return;
    const timer = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % heroVideos.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroVideos.length]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      if (i === activeIdx) {
        vid.currentTime = 0;
        vid.play().catch(() => { });
      } else {
        vid.pause();
      }
    });
  }, [activeIdx, heroVideos.length]);

  return (
    <section className="relative w-full flex flex-col items-center justify-center overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Cross-Fade Video Background */}
      {heroVideos.map((src, i) => (
        <video
          key={i}
          ref={el => { videoRefs.current[i] = el; }}
          src={src}
          muted
          playsInline
          loop
          preload={i === 0 ? 'auto' : 'none'}
          className={`hero-slide ${i === activeIdx ? 'hero-slide-active' : ''}`}
          style={{ objectFit: 'cover' }}
        />
      ))}

      {/* Overlays */}
      <div className="absolute inset-0 z-[1] bg-[#050505]/70" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_15%,#050505_75%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#050505] to-transparent z-[2]" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#050505] to-transparent z-[2]" />

      {/* ── Film Countdown Overlay ── */}
      <div
        className="absolute inset-0 z-30 flex items-center justify-center bg-[#050505] pointer-events-none"
        style={{
          opacity: countdownDone ? 0 : 1,
          transition: 'opacity 0.6s ease-out',
          pointerEvents: countdownDone ? 'none' : 'auto',
        }}
      >
        <div className="relative flex flex-col items-center">
          {/* Projector circle */}
          <div
            className="w-32 h-32 rounded-full border-2 border-white/20 flex items-center justify-center"
            style={{ animation: 'countdown-pulse 0.7s ease-in-out infinite' }}
          >
            <span
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-6xl text-white"
              key={countdownNum}
            >
              {countdownNum > 0 ? countdownNum : ''}
            </span>
          </div>
          {countdownNum === 0 && (
            <span
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-2xl tracking-[0.3em] uppercase text-[#E50914] mt-6 animate-fade-up"
            >
              Action
            </span>
          )}
          {/* Film leader marks */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-white/20" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[1px] h-4 bg-white/20" />
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-[1px] bg-white/20" />
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-[1px] bg-white/20" />
        </div>
      </div>

      {/* Viewfinder Frame (Desktop Only) */}
      <div className="hidden md:block">
        <ViewfinderCorner position="tl" />
        <ViewfinderCorner position="tr" />
        <ViewfinderCorner position="bl" />
        <ViewfinderCorner position="br" />
      </div>

      {/* Crosshair Center (Desktop Only) */}
      <div
        className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
        style={{ animation: "viewfinder-pulse 3s ease-in-out infinite" }}
      >
        <div className="w-[1px] h-8 bg-white/10 absolute left-1/2 -top-4 -translate-x-1/2" />
        <div className="w-[1px] h-8 bg-white/10 absolute left-1/2 top-4 -translate-x-1/2" />
        <div className="h-[1px] w-8 bg-white/10 absolute top-1/2 -left-4 -translate-y-1/2" />
        <div className="h-[1px] w-8 bg-white/10 absolute top-1/2 left-4 -translate-y-1/2" />
      </div>

      {/* Viewfinder Metadata (Desktop Only) */}
      <div className="hidden md:flex absolute top-[76px] left-8 z-20 pointer-events-none items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#E50914]" style={{ animation: "rec-blink 1.5s ease-in-out infinite" }} />
          <span className="text-[9px] font-bold tracking-[0.25em] text-[#E50914] uppercase">Rec</span>
        </div>
        <div className="w-[1px] h-3 bg-white/10" />
        <span className="text-[9px] tracking-[0.2em] text-white/25 font-mono">SCENE 01</span>
      </div>
      <div className="hidden md:flex absolute top-[76px] right-8 z-20 pointer-events-none items-center gap-4">
        <span className="text-[9px] tracking-[0.15em] text-white/20 font-mono">24FPS</span>
        <span className="text-[9px] tracking-[0.15em] text-white/20 font-mono">4K</span>
        <span className="text-[9px] tracking-[0.15em] text-white/20 font-mono">S-LOG3</span>
      </div>
      <div className="hidden md:block absolute bottom-14 left-8 z-20 pointer-events-none">
        <span className="text-[9px] tracking-[0.15em] text-white/15 font-mono">F/2.8 · ISO 800 · 1/48s</span>
      </div>
      <div className="hidden md:block absolute bottom-14 right-8 z-20 pointer-events-none">
        <span className="text-[9px] tracking-[0.15em] text-white/15 font-mono">ARRI ALEXA 65</span>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto pt-32 md:pt-40">
        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E50914]/30 bg-[#E50914]/10 backdrop-blur-md mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-white drop-shadow-lg">
            AI Filmmaking Engine
          </span>
        </div>

        {/* Typing Headline */}
        <h1
          style={{
            fontFamily: "Anton, sans-serif",
            fontSize: "clamp(42px, 11vw, 110px)",
            lineHeight: 1.0,
            textTransform: "uppercase",
            letterSpacing: "-1px",
            color: "white",
            minHeight: "clamp(42px, 11vw, 110px)",
            textShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {displayText}
          <span
            className="inline-block w-[4px] ml-2 bg-[#E50914] align-middle"
            style={{
              height: "clamp(36px, 9vw, 80px)",
              animation: "typing-cursor 0.8s step-end infinite",
              opacity: isComplete ? 0 : 1,
              transition: "opacity 0.5s",
            }}
          />
        </h1>

        {/* Rotating Tagline */}
        <div className="mt-5 md:mt-6 h-8 flex items-center justify-center overflow-hidden">
          <p
            className="text-base md:text-xl font-sans font-medium text-neutral-400 tracking-wide transition-all duration-400"
            style={{
              opacity: isComplete ? (taglineFading ? 0 : 1) : 0,
              transform: taglineFading ? 'translateY(10px)' : 'translateY(0)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}
          >
            {ROTATING_TAGLINES[taglineIdx]}
          </p>
        </div>

        {/* Static Subheadline */}
        <p className="animate-fade-up-delay text-sm md:text-base mt-3 max-w-2xl mx-auto font-sans text-neutral-500 leading-relaxed tracking-wide drop-shadow-xl">
          From script to final film — all in one studio. MotionX is an AI-native filmmaking engine that lets you{" "}
          <span className="text-neutral-300 font-medium">direct, generate, and edit</span> films in a single workflow.
        </p>

        {/* CTAs */}
        <div className="animate-fade-up-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 md:mt-10 w-full max-w-sm sm:max-w-none mx-auto">
          <Link
            href="/login"
            className="w-full sm:w-auto justify-center px-8 py-3.5 sm:px-10 sm:py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_40px_rgba(229,9,20,0.5)] flex items-center gap-3 backdrop-blur-md"
          >
            <Play size={14} fill="currentColor" /> Start Creating Your Film
          </Link>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto justify-center px-8 py-3.5 sm:px-10 sm:py-4 bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/50 text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all flex items-center gap-3 backdrop-blur-md"
          >
            Book a Demo
          </a>
        </div>
      </div>

      {/* ── Horizontal Video Reel ── */}
      <div className="relative z-10 w-full mt-12 md:mt-16 overflow-hidden">
        {/* Edge fade masks */}
        <div className="absolute left-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 md:w-40 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

        {/* Scrolling track: duplicated for seamless loop */}
        <div
          className="flex gap-4 items-center"
          style={{
            animation: 'marquee-scroll 30s linear infinite',
            width: 'max-content',
          }}
        >
          {[...heroVideos, ...heroVideos].map((src, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[280px] md:w-[360px] rounded-xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50"
            >
              <video
                src={src}
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
                className="w-full h-auto object-cover"
                style={{ aspectRatio: '16/9' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Scroll Indicator ── */}
      <div className="relative z-10 flex flex-col items-center gap-2 mt-8 mb-4 pb-8">
        <span className="text-[9px] font-semibold tracking-[0.3em] uppercase text-neutral-600">
          Scroll to explore
        </span>
        <div style={{ animation: 'scroll-bounce 2s ease-in-out infinite' }}>
          <ChevronRight size={16} className="text-neutral-600 rotate-90" />
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SHOWCASE VIDEO (with mute/unmute)
// ─────────────────────────────────────────────────────────────────────────────

const ShowcaseVideo = ({ src, index }: { src: string; index: number }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef(null);
  const inView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={containerRef}
      variants={fadeUp}
      custom={index}
      className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all bg-black"
    >
      <video
        ref={videoRef}
        src={src}
        muted={isMuted}
        playsInline
        loop
        autoPlay
        preload="metadata"
        className="w-full h-auto"
      />
      {/* Mute/Unmute Toggle */}
      <button
        onClick={() => {
          setIsMuted(prev => !prev);
          if (videoRef.current) {
            videoRef.current.muted = !isMuted;
          }
        }}
        className="absolute bottom-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-all"
        aria-label={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      {/* Subtle overlay gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
      setShowSticky(window.scrollY > window.innerHeight * 0.6);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="bg-[#050505] min-h-screen text-[#EAEAEA] overflow-x-hidden relative">

      {/* ──────── CUSTOM ANIMATIONS ──────── */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 6px #E50914; }
          50% { opacity: 0.4; box-shadow: 0 0 12px #E50914; }
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ken-burns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.08) translate(-1%, -1%); }
        }
        @keyframes typing-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes viewfinder-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes rec-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes subtle-glow {
          0%, 100% { box-shadow: 0 0 15px rgba(229, 9, 20, 0.15); }
          50% { box-shadow: 0 0 30px rgba(229, 9, 20, 0.3); }
        }
        @keyframes countdown-pulse {
          0%, 100% { transform: scale(1); border-color: rgba(255,255,255,0.2); }
          50% { transform: scale(1.05); border-color: rgba(229, 9, 20, 0.4); }
        }
        @keyframes scroll-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
        .animate-fade-up { animation: fade-up 0.8s ease-out forwards; }
        .animate-fade-up-delay { animation: fade-up 0.8s ease-out 0.2s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.8s ease-out 0.4s forwards; opacity: 0; }
        .hero-slide {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; opacity: 0;
          transition: opacity 1.5s ease-in-out;
          filter: saturate(0.4) brightness(0.5);
        }
        .hero-slide-active {
          opacity: 1;
          animation: ken-burns 6s ease-out forwards;
        }

        /* ── Shimmer heading effect ── */
        @keyframes shimmer-slide {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .shimmer-text {
          background: linear-gradient(
            90deg,
            #ffffff 0%,
            #E50914 25%,
            #ffffff 50%,
            #E50914 75%,
            #ffffff 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 6s linear infinite;
        }

        /* ── Glowing divider ── */
        @keyframes glow-sweep {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .glow-divider {
          position: relative;
          height: 1px;
          background: rgba(255,255,255,0.03);
          overflow: hidden;
        }
        .glow-divider::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(229,9,20,0.4), transparent);
          animation: glow-sweep 4s ease-in-out infinite;
        }

        /* ── Floating particles ── */
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.15; }
          25% { transform: translateY(-30px) translateX(10px); opacity: 0.3; }
          50% { transform: translateY(-15px) translateX(-8px); opacity: 0.15; }
          75% { transform: translateY(-40px) translateX(5px); opacity: 0.25; }
        }

        /* ── Card 3D tilt hover ── */
        .card-tilt {
          transition: transform 0.5s cubic-bezier(0.25, 0.4, 0.25, 1), box-shadow 0.5s ease;
        }
        .card-tilt:hover {
          transform: perspective(800px) rotateY(-2deg) rotateX(2deg) translateY(-4px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 30px rgba(229,9,20,0.05);
        }

        /* ── Screenshot parallax container ── */
        .screenshot-reveal {
          transition: transform 0.7s cubic-bezier(0.25, 0.4, 0.25, 1);
        }
        .screenshot-reveal:hover {
          transform: scale(1.02);
        }

        /* ── Pulsing border ── */
        @keyframes border-pulse {
          0%, 100% { border-color: rgba(229,9,20,0.1); }
          50% { border-color: rgba(229,9,20,0.25); }
        }
      `}</style>

      {/* ──────── FILM GRAIN OVERLAY ──────── */}
      <div
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]"
        style={{
          background:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        }}
      />

      {/* ──────── FLOATING AMBIENT PARTICLES ──────── */}
      <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-[#E50914]"
            style={{
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              left: `${8 + (i * 7.5)}%`,
              top: `${10 + ((i * 23) % 80)}%`,
              opacity: 0.15,
              animation: `float-particle ${6 + (i % 4) * 2}s ease-in-out ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* NAVIGATION                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${scrolled
          ? "py-3 bg-[#050505]/80 backdrop-blur-xl border-b border-white/[0.04]"
          : "py-5 bg-transparent"
          }`}
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-2 h-2 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]"
              style={{ animation: "pulse-dot 2.5s ease-in-out infinite" }}
            />
            <span
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-lg tracking-[0.15em] uppercase text-white"
            >
              Motion X
            </span>
          </Link>
          <div className="flex items-center gap-8">
            <a
              href="#how-it-works"
              className="hidden md:block text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-300 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a
              href="#the-studio"
              className="hidden md:block text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-300 hover:text-white transition-colors"
            >
              The Studio
            </a>
            <a
              href="#enterprise"
              className="hidden md:block text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Enterprise
            </a>
            <Link
              href="/pricing"
              className="hidden md:block text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="hidden md:flex px-5 py-2 border border-white/20 hover:border-white/40 text-white text-[11px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:bg-white/[0.04]"
            >
              Log In
            </Link>
            <Link
              href="/login"
              className="px-5 py-2 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_20px_rgba(229,9,20,0.3)]"
            >
              Start Creating
            </Link>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO                                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <HeroSection />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 2. TRUST + SOCIAL PROOF                                            */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-20 px-6 md:px-10 border-y border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto">
          <motion.p variants={fadeUp} className="text-center text-[11px] font-semibold tracking-[0.25em] uppercase text-neutral-600 mb-12">
            Trusted by independent filmmakers and creative studios
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              { value: 300, suffix: "+", label: "Minutes of film produced monthly", sub: "by filmmakers & studios" },
              { value: 10, suffix: "x", label: "Faster than traditional production", sub: "from script to final cut" },
              { value: 90, suffix: "%", label: "Lower cost than crew-based shoots", sub: "no cameras, crews, or delays" },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} className="text-center">
                <div
                  style={{ fontFamily: "Anton, sans-serif" }}
                  className="text-5xl md:text-6xl text-white mb-2"
                >
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-[13px] text-neutral-300 font-medium">{stat.label}</p>
                <p className="text-[11px] text-neutral-600 mt-1">{stat.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Content types produced */}
          <motion.div variants={fadeUp} custom={3} className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {["Short Films", "Feature Films", "Series & Episodes", "Music Videos", "Branded Cinema"].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] tracking-wider uppercase text-neutral-500"
              >
                {tag}
              </span>
            ))}
          </motion.div>

          {/* Powered by */}
          <motion.div variants={fadeUp} custom={4} className="mt-8 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-neutral-600">
              Powered by Seedance 2.0
            </span>
          </motion.div>
        </div>
      </Section>

      {/* Glowing Divider */}
      <div className="glow-divider max-w-[600px] mx-auto" />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 3. POSITIONING STATEMENT                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-40 px-6 md:px-10">
        <div className="max-w-[900px] mx-auto text-center">
          <motion.p
            variants={fadeUp}
            className="text-[13px] font-semibold tracking-[0.3em] uppercase text-neutral-600 mb-8"
          >
            The real shift
          </motion.p>
          <motion.h2
            variants={blurIn}
            custom={1}
            style={{ fontFamily: "Anton, sans-serif" }}
            className="text-4xl md:text-7xl uppercase tracking-tight leading-[0.95]"
          >
            MotionX doesn&apos;t generate videos.
          </motion.h2>
          <motion.h2
            variants={blurIn}
            custom={2}
            style={{ fontFamily: "Anton, sans-serif" }}
            className="text-4xl md:text-7xl uppercase tracking-tight leading-[0.95] shimmer-text mt-2"
          >
            It helps you make films.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={3}
            className="text-lg md:text-xl text-neutral-500 mt-8 max-w-2xl mx-auto leading-relaxed"
          >
            We don&apos;t help you make more videos faster. We give filmmakers a new way to make films —
            with AI as your crew, your camera, and your editing suite.
          </motion.p>
        </div>
      </Section>

      {/* Glowing Divider */}
      <div className="glow-divider max-w-[600px] mx-auto" />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 4. WHY FILMMAKERS CHOOSE US (BENEFITS)                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <Badge>Why Filmmakers Choose Us</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              A new way to{" "}
              <span className="text-[#E50914]">make films</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Clapperboard,
                title: "Direct Without a Crew",
                desc: "Go from script to screen with AI as your production team. No scheduling, no logistics, no delays.",
                accent: "🎬",
              },
              {
                icon: Eye,
                title: "Visualize Before You Shoot",
                desc: "See your scenes, characters, and sets before committing to production. Iterate freely.",
                accent: "🎥",
              },
              {
                icon: Scissors,
                title: "Edit Your Story, Not Just Clips",
                desc: "Work in a full filmmaking timeline — compose scenes, refine pacing, add audio, and finalize your film.",
                accent: "✂️",
              },
              {
                icon: UserCheck,
                title: "Maintain Visual Consistency",
                desc: "Characters, costumes, locations, and color stay consistent across every shot and scene.",
                accent: "🎭",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={scaleUp}
                custom={i}
                className="card-tilt group relative p-8 md:p-10 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#E50914]/20 hover:bg-white/[0.03] transition-all duration-500"
              >
                <div className="text-4xl mb-6" style={{ animation: `float ${3 + i * 0.5}s ease-in-out infinite` }}>{card.accent}</div>
                <h3
                  style={{ fontFamily: "Anton, sans-serif" }}
                  className="text-xl md:text-2xl uppercase tracking-wide mb-4"
                >
                  {card.title}
                </h3>
                <p className="text-[14px] text-neutral-500 leading-relaxed">{card.desc}</p>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E50914]/0 to-transparent group-hover:via-[#E50914]/30 transition-all duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Glowing Divider */}
      <div className="glow-divider max-w-[600px] mx-auto" />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 5. CORE DIFFERENTIATOR                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          {/* Left Text */}
          <div className="flex-1">
            <Badge>The Difference</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase leading-[0.95] tracking-tight mb-6"
            >
              Not just AI generation, {" "}
              <span className="text-[#E50914]">real filmmaking control</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg text-neutral-500 leading-relaxed mb-8">
              MotionX is built around how directors think. Instead of generating random clips, you control every creative decision.
            </motion.p>
            <motion.p variants={fadeUp} custom={2} className="text-base text-neutral-400 leading-relaxed">
              This allows filmmakers to produce <span className="text-white font-medium">cohesive, cinematic content</span> — not just isolated AI clips.
            </motion.p>
          </div>

          {/* Right Feature Grid */}
          <div className="flex-1 grid grid-cols-2 gap-4 w-full">
            {[
              { icon: Camera, title: "Camera Angles", desc: "Shot composition & framing" },
              { icon: Sun, title: "Lighting", desc: "Cinematic mood & atmosphere" },
              { icon: LayoutGrid, title: "Scene Structure", desc: "Storytelling flow & pacing" },
              { icon: Palette, title: "Color Grading", desc: "Visual consistency & tone" },
            ].map((feat, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#E50914]/15 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#E50914]/10 flex items-center justify-center mb-4 group-hover:bg-[#E50914]/15 transition-colors">
                  <feat.icon size={18} className="text-[#E50914]" />
                </div>
                <h4 style={{ fontFamily: "Anton, sans-serif" }} className="text-base uppercase tracking-wide mb-1">
                  {feat.title}
                </h4>
                <p className="text-[12px] text-neutral-600">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 6. HOW IT WORKS                                                    */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section id="how-it-works" className="py-28 md:py-36 px-6 md:px-10 border-t border-white/[0.04]">
        <div className="max-w-[900px] mx-auto">
          <div className="text-center mb-16">
            <Badge>Workflow</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              From script to final film{" "}
              <span className="text-[#E50914]">in one workflow</span>
            </motion.h2>
          </div>

          <div className="space-y-16 md:space-y-24">
            {[
              {
                step: "01",
                title: "Write Your Script",
                desc: "Describe your vision or upload a screenplay. Set genre, format, and runtime. AI breaks it into scenes and shots automatically.",
                img: "/landing/step-0-script.png",
              },
              {
                step: "02",
                title: "Visualize Scenes & Shots",
                desc: "Build characters, design locations and sets, and plan your visual world. See your storyboard — every scene visualized before production.",
                img: LANDING_IMAGES.preproductionCanvas,
              },
              {
                step: "03",
                title: "Generate Cinematic Footage",
                desc: "Turn storyboard frames into cinematic video powered by Seedance 2.0 — with full camera control, lighting, and visual consistency across every shot.",
                img: LANDING_IMAGES.shotConfig,
              },
              {
                step: "04",
                title: "Edit & Finalize Your Film",
                desc: "Select any region of your footage and transform it with AI — motion transfer, relighting, object removal, and scene modifications. Compose your timeline, add dialogue and score, then export your finished film.",
                img: LANDING_IMAGES.postproduction,
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={i % 2 === 0 ? slideFromLeft : slideFromRight}
                custom={i}
                className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} gap-8 md:gap-12 items-center`}
              >
                {/* Screenshot */}
                <div className="flex-1 w-full">
                  <div className="screenshot-reveal rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40">
                    <img
                      src={item.img}
                      alt={item.title}
                      className="w-full h-auto"
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 w-full md:max-w-md">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center flex-shrink-0" style={{ animation: 'border-pulse 3s ease-in-out infinite' }}>
                      <span
                        style={{ fontFamily: "Anton, sans-serif" }}
                        className="text-[#E50914] text-lg"
                      >
                        {item.step}
                      </span>
                    </div>
                    <h3
                      style={{ fontFamily: "Anton, sans-serif" }}
                      className="text-2xl md:text-3xl uppercase tracking-wide"
                    >
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-[15px] text-neutral-400 leading-relaxed pl-16">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Glowing Divider */}
      <div className="glow-divider max-w-[600px] mx-auto" />

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 7. THE STUDIO — PRODUCTION PHASES                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section id="the-studio" className="py-28 md:py-36 px-6 md:px-10 border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <Badge>The Studio</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              Your complete{" "}
              <span className="text-[#E50914]">filmmaking studio</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-neutral-500 mt-4 text-base md:text-lg max-w-xl mx-auto">
              Everything you need, from first draft to final export
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                phase: "🎬",
                icon: Clapperboard,
                title: "Pre-Production",
                subtitle: "Develop your vision",
                desc: "Script to scene breakdown, characters, locations, set design, mood boards, and visual planning — all before a single frame is generated.",
                img: LANDING_IMAGES.characterProfile,
                features: ["Script Editor", "Character Design", "Location Builder", "Mood & Style"],
              },
              {
                phase: "🎥",
                icon: Camera,
                title: "Production",
                subtitle: "Bring it to life",
                desc: "Generate cinematic shots with camera control, lighting direction, and character consistency. Direct your scenes with the precision of a real set.",
                img: LANDING_IMAGES.storyboard,
                features: ["Storyboard", "Camera Control", "Shot Generation", "Set Design"],
              },
              {
                phase: "🎞️",
                icon: Film,
                title: "Post-Production",
                subtitle: "Edit & export",
                desc: "Edit, refine, add dialogue and sound effects, apply look development, and finalize your film inside one timeline.",
                img: LANDING_IMAGES.postproduction,
                features: ["Timeline Editor", "Dialogue & ADR", "Sound Design", "Look Dev & Export"],
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={scaleUp}
                custom={i}
                className="card-tilt group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#E50914]/20 hover:bg-white/[0.03] transition-all duration-500 overflow-hidden"
              >
                {/* Screenshot */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
                  <div className="absolute bottom-4 left-6 text-3xl">{card.phase}</div>
                </div>

                {/* Content */}
                <div className="p-6 md:p-8">
                  <h3
                    style={{ fontFamily: "Anton, sans-serif" }}
                    className="text-2xl uppercase tracking-wide mb-1"
                  >
                    {card.title}
                  </h3>
                  <p className="text-[12px] text-[#E50914] font-medium tracking-wider uppercase mb-4">
                    {card.subtitle}
                  </p>
                  <p className="text-[14px] text-neutral-500 leading-relaxed mb-6">
                    {card.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {card.features.map((f) => (
                      <span
                        key={f}
                        className="px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-[10px] tracking-wider uppercase text-neutral-500"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E50914]/0 to-transparent group-hover:via-[#E50914]/30 transition-all duration-500" />
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 8. INSIDE THE STUDIO — FEATURE SCREENSHOTS                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <Badge>Inside the Studio</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              Powerful tools for{" "}
              <span className="text-[#E50914]">every stage</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-neutral-500 mt-4 text-base md:text-lg max-w-xl mx-auto">
              A closer look at the tools that power your filmmaking workflow
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { img: LANDING_IMAGES.dashboard, label: "Creative Studio", desc: "Your command center — projects, community feed, and workspace at a glance." },
              { img: LANDING_IMAGES.setBlueprint, label: "Set Blueprint", desc: "Design locations with spatial awareness, angles, props, and atmosphere." },
              { img: LANDING_IMAGES.characterProfile, label: "Character Design", desc: "Full character profiles — wardrobe, accessories, grooming, and costume control." },
              { img: LANDING_IMAGES.adrTerminal, label: "ADR Terminal", desc: "Synthesize dialogue with emotion, sync lip movement to generated characters." },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={blurIn}
                custom={i}
                className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                <img
                  src={item.img}
                  alt={item.label}
                  className="w-full h-auto group-hover:scale-[1.03] transition-transform duration-700"
                  loading="lazy"
                />
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                  <span
                    style={{ fontFamily: "Anton, sans-serif" }}
                    className="text-[13px] tracking-[0.15em] uppercase text-white block mb-1"
                  >
                    {item.label}
                  </span>
                  <span className="text-[12px] text-neutral-400">
                    {item.desc}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 8b. SEE THE OUTPUT — VIDEO SHOWCASE                                */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10 border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <Badge>See the Output</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              Films made with <span className="text-[#E50914]">MotionX</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-neutral-500 mt-4 text-base md:text-lg max-w-xl mx-auto">
              Real cinematic clips — directed, generated, and edited entirely in MotionX Studio
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { src: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/WhatsApp%20Video%202026-03-11%20at%2013.53.49.mp4?alt=media&token=c388f242-8360-4db5-b585-43d643a1d113" },
              { src: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/WhatsApp%20Video%202026-03-11%20at%2013.54.06.mp4?alt=media&token=836bc61d-3024-45aa-83d6-c0829b2c7462" },
              { src: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/WhatsApp%20Video%202026-03-11%20at%2013.55.37.mp4?alt=media&token=4909ea2a-e8e9-4e64-a49a-7e4ec617e1ea" },
              { src: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/WhatsApp%20Video%202026-03-11%20at%2013.57.52.mp4?alt=media&token=2709a580-0525-4e96-a6df-162677717df9" },
            ].map((vid, i) => (
              <ShowcaseVideo key={i} src={vid.src} index={i} />
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 9. ENTERPRISE SECTION                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section id="enterprise" className="py-28 md:py-36 px-6 md:px-10 border-t border-white/[0.04]">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 lg:gap-24 items-start">
            {/* Left */}
            <div className="flex-1">
              <Badge>Enterprise</Badge>
              <motion.h2
                variants={fadeUp}
                style={{ fontFamily: "Anton, sans-serif" }}
                className="text-4xl md:text-6xl uppercase leading-[0.95] tracking-tight mb-6"
              >
                Built for <span className="text-[#E50914]">studios</span><br />
                and teams
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-neutral-500 leading-relaxed mb-6">
                From solo filmmakers to full production studios — MotionX scales with your creative ambitions.
              </motion.p>
              <motion.p variants={fadeUp} custom={2} className="text-[13px] text-neutral-600 leading-relaxed">
                Enterprise plans tailored for studios, agencies, and production companies.
              </motion.p>
              <motion.div variants={fadeUp} custom={3} className="mt-8">
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_30px_rgba(229,9,20,0.3)]"
                >
                  Talk to Enterprise Sales <ArrowRight size={14} />
                </a>
              </motion.div>
            </div>

            {/* Right Features */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {[
                { icon: Users, title: "Multi-user Collaboration", desc: "Work together across teams and departments in real-time." },
                { icon: LayoutGrid, title: "Centralized Workflows", desc: "Unified production pipelines for consistent output." },
                { icon: Server, title: "Priority Rendering", desc: "Dedicated infrastructure for faster, reliable throughput." },
                { icon: Headphones, title: "Dedicated Support", desc: "Enterprise-grade support for your production team." },
              ].map((feat, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i}
                  className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all"
                >
                  <feat.icon size={22} className="text-[#E50914] mb-4" />
                  <h4
                    style={{ fontFamily: "Anton, sans-serif" }}
                    className="text-base uppercase tracking-wide mb-2"
                  >
                    {feat.title}
                  </h4>
                  <p className="text-[12px] text-neutral-600 leading-relaxed">{feat.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 10. FINAL CTA                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10 border-t border-white/[0.04]">
        <div className="max-w-[800px] mx-auto text-center">
          <motion.h2
            variants={fadeUp}
            style={{ fontFamily: "Anton, sans-serif" }}
            className="text-4xl md:text-7xl uppercase tracking-tight mb-6"
          >
            Start making{" "}
            <span className="text-[#E50914]">your film</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-neutral-500 text-lg mb-10 max-w-lg mx-auto">
            From script to final cut — your AI filmmaking studio is ready.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[13px] font-bold tracking-[0.12em] uppercase rounded-full transition-all hover:shadow-[0_0_40px_rgba(229,9,20,0.25)]"
            >
              Start Creating Your Film <ArrowRight size={16} />
            </Link>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-10 py-4 border border-white/20 hover:border-white/40 text-white text-[13px] font-bold tracking-[0.12em] uppercase rounded-full transition-all hover:bg-white/[0.04]"
            >
              Book a Demo
            </a>
          </motion.div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 11. FOOTER                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#020202] pt-20 pb-10 px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto">
          {/* Positioning Line */}
          <div className="mb-16 max-w-2xl">
            <p className="text-[14px] text-neutral-600 leading-relaxed italic">
              MotionX doesn&apos;t generate videos. It helps you make films.
            </p>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
            <h1
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-[80px] md:text-[120px] leading-[0.8] uppercase text-[#111] select-none"
            >
              Motion X
            </h1>

            <div className="flex gap-16 text-[12px] text-neutral-600">
              <div className="flex flex-col gap-3">
                <span className="text-white font-semibold tracking-wider text-[11px] uppercase mb-1">
                  Platform
                </span>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
                <a href="#how-it-works" className="hover:text-white transition-colors">
                  How It Works
                </a>
                <a href="#the-studio" className="hover:text-white transition-colors">
                  The Studio
                </a>
                <a href="#enterprise" className="hover:text-white transition-colors">
                  Enterprise
                </a>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-white font-semibold tracking-wider text-[11px] uppercase mb-1">
                  Connect
                </span>
                <a
                  href="https://discord.gg/hjFJRer8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Discord
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row justify-between text-[10px] text-neutral-700 tracking-wider">
            <span>© 2026 MOTIONX STUDIO. ALL RIGHTS RESERVED.</span>
            <span>BUILT WITH AI</span>
          </div>
        </div>
      </footer>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STICKY "START CREATING" BUTTON                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Link
        href="/login"
        className={`fixed bottom-6 right-6 z-50 px-6 py-3 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold tracking-[0.15em] uppercase rounded-full shadow-lg transition-all duration-500 flex items-center gap-2 ${showSticky
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none"
          }`}
        style={{ animation: showSticky ? "subtle-glow 3s ease-in-out infinite" : "none" }}
      >
        <Play size={12} fill="currentColor" /> Start Creating
      </Link>
    </main>
  );
}