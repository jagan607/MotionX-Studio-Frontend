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
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { fetchGlobalFeed } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CALENDLY_URL = "https://calendly.com/jagan-motionx/30min";

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

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
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

const HeroSection = () => {
  const headline = "AI Filmmaking Platform";
  const { displayText, isComplete } = useTypingEffect(headline, 65, 600);
  const [activeIdx, setActiveIdx] = useState(0);
  const [heroVideos, setHeroVideos] = useState<string[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

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
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
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
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#050505] to-transparent z-[2]" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#050505] to-transparent z-[2]" />

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
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E50914]/30 bg-[#E50914]/10 backdrop-blur-md mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-white drop-shadow-lg">
            Enterprise AI Studio
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

        {/* Single concise subheadline */}
        <p className="animate-fade-up-delay text-base md:text-xl mt-5 md:mt-6 max-w-2xl mx-auto font-sans font-medium text-neutral-300 leading-relaxed tracking-wide drop-shadow-xl">
          Produce <span className="text-white font-bold">10x more video</span> at <span className="text-white font-bold bg-white/10 border border-white/20 px-2 py-0.5 rounded-md mx-0.5 whitespace-nowrap">90% lower cost</span> , no cameras, no large crews, or delays.
        </p>

        {/* CTAs */}
        <div className="animate-fade-up-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 md:mt-10 w-full max-w-sm sm:max-w-none mx-auto">
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto justify-center px-8 py-3.5 sm:px-10 sm:py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_40px_rgba(229,9,20,0.5)] flex items-center gap-3 backdrop-blur-md"
          >
            <Play size={14} fill="currentColor" /> Book Enterprise Demo
          </a>
          <Link
            href="/login"
            className="w-full sm:w-auto justify-center px-8 py-3.5 sm:px-10 sm:py-4 bg-white/10 border border-white/20 hover:bg-white/20 hover:border-white/50 text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all flex items-center gap-3 backdrop-blur-md"
          >
            Start Free Trial
          </Link>
        </div>
      </div>

      {/* Bottom Accent */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <div className="w-[1px] h-8 bg-gradient-to-b from-transparent to-white/20" />
      </div>
    </section>
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
      `}</style>

      {/* ──────── FILM GRAIN OVERLAY ──────── */}
      <div
        className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]"
        style={{
          background:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
        }}
      />

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
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_20px_rgba(229,9,20,0.3)]"
            >
              Book Demo
            </a>
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
            Used by global teams producing high-volume video content
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {[
              { value: 300, suffix: "+", label: "Minutes of content produced monthly", sub: "by partner studios" },
              { value: 10, suffix: "x", label: "Faster content delivery", sub: "compared to traditional production" },
              { value: 90, suffix: "%", label: "Lower production costs", sub: "no cameras, crews, or delays" },
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
            {["Advertisements", "Microdramas", "Long-form Storytelling", "Social Content", "Sports Promos"].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] tracking-wider uppercase text-neutral-500"
              >
                {tag}
              </span>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 3. WHO THIS IS FOR                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <Badge>Built For Scale</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              Built for teams producing{" "}
              <span className="text-[#E50914]">content at scale</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Clapperboard,
                title: "Studios & Production Houses",
                desc: "Create films, series, and branded content without traditional production bottlenecks.",
                accent: "🎬",
              },
              {
                icon: Megaphone,
                title: "Advertising Agencies",
                desc: "Generate ad concepts, campaign visuals, and client-ready videos in hours instead of weeks.",
                accent: "📢",
              },
              {
                icon: Tv,
                title: "Media Networks",
                desc: "Produce promos, fillers, and episodic content at scale with consistent quality.",
                accent: "📺",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="group relative p-8 md:p-10 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#E50914]/20 hover:bg-white/[0.03] transition-all duration-500 hover:-translate-y-1"
              >
                <div className="text-4xl mb-6">{card.accent}</div>
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 4. WHAT YOU CAN CREATE                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10 border-t border-white/[0.04]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <Badge>Capabilities</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              From idea to cinematic output
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-neutral-500 mt-4 text-base md:text-lg max-w-xl mx-auto">
              All in one platform
            </motion.p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Target, label: "High-quality advertisements and brand films" },
              { icon: Film, label: "Episodic content and microdrama series" },
              { icon: Video, label: "Social media videos and short-form content" },
              { icon: Zap, label: "Sports promos and event marketing videos" },
              { icon: Layers, label: "Film scenes and long-form storytelling" },
              { icon: Sparkles, label: "Campaign visuals and client pitches" },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="flex items-center gap-4 p-5 rounded-xl border border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08] hover:bg-white/[0.03] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#E50914]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#E50914]/15 transition-colors">
                  <item.icon size={18} className="text-[#E50914]" />
                </div>
                <span className="text-[14px] text-neutral-300">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 5. CORE DIFFERENTIATOR                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-16 lg:gap-24 items-center">
          {/* Left Text */}
          <div className="flex-1">
            <Badge>Your Moat</Badge>
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
              This allows teams to produce <span className="text-white font-medium">cohesive, cinematic content</span> , not just isolated AI clips.
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
              From concept to final video{" "}
              <span className="text-[#E50914]">in minutes</span>
            </motion.h2>
          </div>

          <div className="space-y-16 md:space-y-24">
            {[
              {
                step: "01",
                title: "Upload Your Script",
                desc: "Describe your vision or upload a screenplay. Set genre, format, aspect ratio, and runtime.",
                img: "/landing/step-0-script.png",
              },
              {
                step: "02",
                title: "Build Your World",
                desc: "Create characters, locations, and props with AI. Your cast and sets persist across every scene.",
                img: "/landing/step-1-assets.png",
              },
              {
                step: "03",
                title: "Set the Mood",
                desc: "Choose a cinematic style , color palette, lighting, texture, atmosphere , and apply it globally.",
                img: "/landing/step-2-moodboard.png",
              },
              {
                step: "04",
                title: "Storyboard & Direct",
                desc: "AI breaks your script into scenes and generates shots with full control over shot type, cast, and framing.",
                img: "/landing/step-3-storyboard.png",
              },
              {
                step: "05",
                title: "Fine-Tune the Camera",
                desc: "Use the 3D Camera Rig to adjust lens, angle, and framing , then regenerate with precision.",
                img: "/landing/step-4-camera.png",
              },
              {
                step: "06",
                title: "Animate & Export",
                desc: "Turn storyboard frames into motion. Choose duration, model, and quality , then export production-ready video.",
                img: "/landing/step-5-animate.png",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className={`flex flex-col ${i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"} gap-8 md:gap-12 items-center`}
              >
                {/* Screenshot */}
                <div className="flex-1 w-full">
                  <div className="rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40">
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
                    <div className="w-12 h-12 rounded-full bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center flex-shrink-0">
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

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 7. COST & SPEED COMPARISON                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-16">
            <Badge>The Economics</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              Traditional production vs{" "}
              <span className="text-[#E50914]">MotionX</span>
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              variants={fadeUp}
              className="p-8 md:p-10 rounded-2xl bg-white/[0.02] border border-white/[0.06]"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-3 h-3 rounded-full bg-neutral-700" />
                <span
                  style={{ fontFamily: "Anton, sans-serif" }}
                  className="text-xl uppercase tracking-wide text-neutral-400"
                >
                  Traditional Production
                </span>
              </div>

              <div className="space-y-5">
                {[
                  { icon: DollarSign, text: "$50K–$100K+ budgets" },
                  { icon: Users, text: "Large crews and equipment" },
                  { icon: Clock, text: "Weeks to months of production" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
                      <item.icon size={16} className="text-neutral-600" />
                    </div>
                    <span className="text-[15px] text-neutral-500">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={1}
              className="p-8 md:p-10 rounded-2xl bg-gradient-to-br from-[#E50914]/5 to-transparent border border-[#E50914]/15 relative overflow-hidden"
            >
              
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914]/5 rounded-full blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-3 h-3 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]" />
                  <span
                    style={{ fontFamily: "Anton, sans-serif" }}
                    className="text-xl uppercase tracking-wide text-white"
                  >
                    MotionX AI Production
                  </span>
                </div>

                <div className="space-y-5">
                  {[
                    { icon: DollarSign, text: "$5K–$10K equivalent output" },
                    { icon: Zap, text: "No physical production required" },
                    { icon: TrendingUp, text: "Delivered in days" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-[#E50914]/10 flex items-center justify-center">
                        <item.icon size={16} className="text-[#E50914]" />
                      </div>
                      <span className="text-[15px] text-white">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <motion.p
            variants={fadeUp}
            custom={2}
            className="text-center mt-10 text-neutral-500 text-lg"
          >
            Scale content production <span className="text-white font-medium">without scaling costs.</span>
          </motion.p>
        </div>
      </Section> */}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 8. ENTERPRISE SECTION                                              */}
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
                Built for <span className="text-[#E50914]">teams</span>,<br />
                not just individuals
              </motion.h2>
              <motion.p variants={fadeUp} custom={1} className="text-lg text-neutral-500 leading-relaxed mb-6">
                MotionX is designed for organizations producing content at scale.
              </motion.p>
              <motion.p variants={fadeUp} custom={2} className="text-[13px] text-neutral-600 leading-relaxed">
                Enterprise plans tailored for studios, agencies, and media companies.
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
      {/* 9. USE CASE EXAMPLES                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <Section className="py-28 md:py-36 px-6 md:px-10">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <Badge>Use Cases</Badge>
            <motion.h2
              variants={fadeUp}
              style={{ fontFamily: "Anton, sans-serif" }}
              className="text-4xl md:text-6xl uppercase tracking-tight"
            >
              Real-world use cases
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                stat: "100+",
                title: "Episode Series",
                desc: "Produce entire series without traditional production infrastructure.",
              },
              {
                stat: "24-48h",
                title: "Ad Creatives",
                desc: "Generate campaign-ready ad creatives in hours, not weeks.",
              },
              {
                stat: "Instant",
                title: "Sports Promos",
                desc: "Create sports promos and campaign videos on demand.",
              },
              {
                stat: "End-to-End",
                title: "Content Pipelines",
                desc: "Build entire production pipelines powered by AI.",
              },
            ].map((useCase, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                custom={i}
                className="flex gap-5 p-6 md:p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-all group"
              >
                <div className="flex-shrink-0">
                  <span
                    style={{ fontFamily: "Anton, sans-serif" }}
                    className="text-2xl md:text-3xl text-[#E50914]"
                  >
                    {useCase.stat}
                  </span>
                </div>
                <div>
                  <h4
                    style={{ fontFamily: "Anton, sans-serif" }}
                    className="text-lg uppercase tracking-wide mb-1"
                  >
                    {useCase.title}
                  </h4>
                  <p className="text-[13px] text-neutral-500 leading-relaxed">{useCase.desc}</p>
                </div>
              </motion.div>
            ))}
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
            Start producing content{" "}
            <span className="text-[#E50914]">at scale</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-neutral-500 text-lg mb-10 max-w-lg mx-auto">
            See how your team can produce faster, cheaper, and at scale with MotionX.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-10 py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[13px] font-bold tracking-[0.12em] uppercase rounded-full transition-all hover:shadow-[0_0_40px_rgba(229,9,20,0.25)]"
            >
              Book Enterprise Demo <ArrowRight size={16} />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-10 py-4 border border-white/20 hover:border-white/40 text-white text-[13px] font-bold tracking-[0.12em] uppercase rounded-full transition-all hover:bg-white/[0.04]"
            >
              Start Free Trial
            </Link>
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
              MotionX is an AI filmmaking platform designed to transform how studios, agencies,
              and media companies produce content.
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
                <a href="#enterprise" className="hover:text-white transition-colors">
                  Enterprise
                </a>
              </div>
              {/* <div className="flex flex-col gap-3">
                <span className="text-white font-semibold tracking-wider text-[11px] uppercase mb-1">
                  Legal
                </span>
                <span>Terms of Service</span>
                <span>Privacy Policy</span>
                <span>Copyright</span>
              </div> */}
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
      {/* STICKY "BOOK DEMO" BUTTON                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <a
        href={CALENDLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`fixed bottom-6 right-6 z-50 px-6 py-3 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold tracking-[0.15em] uppercase rounded-full shadow-lg transition-all duration-500 flex items-center gap-2 ${showSticky
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none"
          }`}
        style={{ animation: showSticky ? "subtle-glow 3s ease-in-out infinite" : "none" }}
      >
        <Play size={12} fill="currentColor" /> Book Demo
      </a>
    </main>
  );
}