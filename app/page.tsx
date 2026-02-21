"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchGlobalFeed } from "@/lib/api";
import { ChevronRight, Check, Play, Aperture, Film, Sparkles, Layers, Clapperboard, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// HERO: TYPING EFFECT HOOK
// ─────────────────────────────────────────────────────────────────────────────

const useTypingEffect = (text: string, speed = 70, delay = 800) => {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText('');
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

const ViewfinderCorner = ({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const isRight = position === 'tr' || position === 'br';
  const isBottom = position === 'bl' || position === 'br';
  return (
    <div className="absolute z-20 pointer-events-none" style={{
      ...(isBottom ? { bottom: 28 } : { top: 28 }),
      ...(isRight ? { right: 28 } : { left: 28 }),
      width: 48, height: 48,
    }}>
      {/* Horizontal line */}
      <div className="absolute" style={{
        [isBottom ? 'bottom' : 'top']: 0,
        [isRight ? 'right' : 'left']: 0,
        width: 48, height: 1,
        background: 'rgba(255,255,255,0.3)',
      }} />
      {/* Vertical line */}
      <div className="absolute" style={{
        [isBottom ? 'bottom' : 'top']: 0,
        [isRight ? 'right' : 'left']: 0,
        width: 1, height: 48,
        background: 'rgba(255,255,255,0.3)',
      }} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO: MOSAIC CELL (video or image fallback)
// ─────────────────────────────────────────────────────────────────────────────

const MosaicCell = ({ shot }: { shot: { video_url?: string; image_url?: string } }) => {
  const cellRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = cellRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={cellRef} className="mosaic-cell relative rounded-lg overflow-hidden" style={{ aspectRatio: '3/4' }}>
      {shot.video_url && isVisible ? (
        <video
          ref={videoRef}
          src={shot.video_url}
          poster={shot.image_url}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          className="w-full h-full object-cover"
        />
      ) : (
        <img src={shot.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO SECTION COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const HeroSection = ({ cmsData }: { cmsData: any }) => {
  const { displayText, isComplete } = useTypingEffect(cmsData.headline, 80, 600);
  const [feedShots, setFeedShots] = useState<any[]>([]);

  // Fetch global feed for mosaic
  useEffect(() => {
    fetchGlobalFeed().then(shots => {
      // Prefer shots with video, then fill with images
      const withVideo = shots.filter((s: any) => s.video_url);
      const withImage = shots.filter((s: any) => !s.video_url && s.image_url);
      setFeedShots([...withVideo, ...withImage].slice(0, 20));
    });
  }, []);

  // Build 5 columns, duplicate for seamless loop
  const columns = Array.from({ length: 5 }, (_, colIdx) => {
    if (feedShots.length === 0) return [];
    const colShots: any[] = [];
    for (let r = 0; r < 6; r++) {
      colShots.push(feedShots[(colIdx * 6 + r) % feedShots.length]);
    }
    return [...colShots, ...colShots]; // duplicate for seamless loop
  });

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">

      {/* ── Mosaic Grid Background ── */}
      {feedShots.length > 0 && (
        <div className="absolute inset-0 z-0 flex gap-2 px-2 opacity-50"
          style={{ transform: 'rotate(-4deg) scale(1.4)', transformOrigin: 'center center' }}
        >
          {columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="mosaic-column flex-1 flex flex-col gap-2"
              style={{ animationDelay: `${colIdx * -6}s` }}
            >
              {col.map((shot, rowIdx) => (
                <MosaicCell key={rowIdx} shot={shot} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Dark Overlays ── */}
      <div className="absolute inset-0 z-[1] bg-[#050505]/65" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_center,transparent_15%,#050505_75%)]" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#050505] to-transparent z-[2]" />
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#050505] to-transparent z-[2]" />

      {/* ── Viewfinder Frame ── */}
      <ViewfinderCorner position="tl" />
      <ViewfinderCorner position="tr" />
      <ViewfinderCorner position="bl" />
      <ViewfinderCorner position="br" />

      {/* Crosshair Center */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
        style={{ animation: 'viewfinder-pulse 3s ease-in-out infinite' }}
      >
        <div className="w-[1px] h-8 bg-white/10 absolute left-1/2 -top-4 -translate-x-1/2" />
        <div className="w-[1px] h-8 bg-white/10 absolute left-1/2 top-4 -translate-x-1/2" />
        <div className="h-[1px] w-8 bg-white/10 absolute top-1/2 -left-4 -translate-y-1/2" />
        <div className="h-[1px] w-8 bg-white/10 absolute top-1/2 left-4 -translate-y-1/2" />
      </div>

      {/* Viewfinder Metadata — Top Left (below nav) */}
      <div className="absolute top-[76px] left-8 z-20 pointer-events-none flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#E50914]" style={{ animation: 'rec-blink 1.5s ease-in-out infinite' }} />
          <span className="text-[9px] font-bold tracking-[0.25em] text-[#E50914] uppercase">Rec</span>
        </div>
        <div className="w-[1px] h-3 bg-white/10" />
        <span className="text-[9px] tracking-[0.2em] text-white/25 font-mono">SCENE 01</span>
      </div>

      {/* Viewfinder Metadata — Top Right (below nav) */}
      <div className="absolute top-[76px] right-8 z-20 pointer-events-none flex items-center gap-4">
        <span className="text-[9px] tracking-[0.15em] text-white/20 font-mono">24FPS</span>
        <span className="text-[9px] tracking-[0.15em] text-white/20 font-mono">4K</span>
        <span className="text-[9px] tracking-[0.15em] text-white/20 font-mono">S-LOG3</span>
      </div>

      {/* Viewfinder Metadata — Bottom Left */}
      <div className="absolute bottom-14 left-8 z-20 pointer-events-none">
        <span className="text-[9px] tracking-[0.15em] text-white/15 font-mono">F/2.8 · ISO 800 · 1/48s</span>
      </div>

      {/* Viewfinder Metadata — Bottom Right */}
      <div className="absolute bottom-14 right-8 z-20 pointer-events-none">
        <span className="text-[9px] tracking-[0.15em] text-white/15 font-mono">ARRI ALEXA 65</span>
      </div>



      {/* ── Hero Content ── */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Subhead Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E50914]/20 bg-[#E50914]/5 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]" style={{ animation: 'pulse-dot 2s ease-in-out infinite' }} />
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#ff6b6b]">
            {cmsData.subhead}
          </span>
        </div>

        {/* Typing Headline */}
        <h1
          style={{
            fontFamily: 'Anton, sans-serif',
            fontSize: 'clamp(48px, 10vw, 130px)',
            lineHeight: 0.9,
            textTransform: 'uppercase',
            letterSpacing: '-2px',
            color: 'white',
            minHeight: 'clamp(48px, 10vw, 130px)',
          }}
        >
          {displayText}
          <span
            className="inline-block w-[3px] ml-1 bg-[#E50914] align-middle"
            style={{
              height: 'clamp(40px, 8vw, 100px)',
              animation: 'typing-cursor 0.8s step-end infinite',
              opacity: isComplete ? 0 : 1,
              transition: 'opacity 0.5s',
            }}
          />
        </h1>

        {/* CTAs */}
        <div className="animate-fade-up-delay-2 flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
          <Link href="/login"
            className="px-8 py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_30px_rgba(229,9,20,0.3)] flex items-center gap-2"
          >
            <Play size={14} fill="currentColor" /> Start Creating
          </Link>
          <a href="#showcase"
            className="px-8 py-4 border border-white/20 hover:border-white/40 text-white text-[12px] font-bold tracking-[0.15em] uppercase rounded-full transition-all flex items-center gap-2 hover:bg-white/[0.04]"
          >
            Watch Showreel
          </a>
        </div>
      </div>

      {/* Bottom Accent Line */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <div className="w-[1px] h-8 bg-gradient-to-b from-transparent to-white/20" />
      </div>
    </section>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// PRICING CARD
// ─────────────────────────────────────────────────────────────────────────────

const PricingCard = ({ title, price, features, isPopular = false }: {
  title: string; price: string; features: string[]; isPopular?: boolean;
}) => (
  <Link href="/pricing" className="block h-full group">
    <div className={`relative h-full p-8 rounded-2xl border transition-all duration-500 
      ${isPopular
        ? 'bg-gradient-to-b from-[#E50914]/5 to-transparent border-[#E50914]/20 hover:border-[#E50914]/40 hover:shadow-[0_0_60px_rgba(229,9,20,0.08)]'
        : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03]'
      } hover:-translate-y-1`}
    >
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#E50914] rounded-full text-[10px] font-bold tracking-widest text-white uppercase">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 style={{ fontFamily: 'Anton, sans-serif' }} className="text-2xl uppercase tracking-wide mb-1">
          {title}
        </h3>
        <p className="text-[11px] text-neutral-600 tracking-wider uppercase">
          {title === 'Indie' ? 'For creators' : title === 'Studio' ? 'For professionals' : 'For teams'}
        </p>
      </div>

      <div className="mb-8">
        <span style={{ fontFamily: 'Anton, sans-serif' }} className={`text-5xl ${isPopular ? 'text-[#E50914]' : 'text-white'}`}>
          {price}
        </span>
        <span className="text-neutral-600 text-sm ml-1">/mo</span>
      </div>

      <div className="border-t border-white/[0.06] pt-6 space-y-3">
        {features.map((f, i) => (
          <div key={i} className="flex items-center gap-3 text-[13px] text-neutral-400">
            <div className={`w-1 h-1 rounded-full ${isPopular ? 'bg-[#E50914]' : 'bg-neutral-700'}`} />
            {f}
          </div>
        ))}
      </div>

      <div className={`mt-8 w-full py-3 rounded-xl text-center text-[12px] font-semibold tracking-wider uppercase transition-all
        ${isPopular
          ? 'bg-[#E50914] text-white group-hover:bg-[#ff1a25] group-hover:shadow-[0_0_20px_rgba(229,9,20,0.3)]'
          : 'bg-white/[0.04] text-neutral-400 border border-white/[0.06] group-hover:bg-white/[0.08] group-hover:text-white'
        }`}
      >
        Get Started <ChevronRight className="inline ml-1" size={14} />
      </div>
    </div>
  </Link>
);


// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

const FeatureCard = ({ icon: Icon, title, description }: {
  icon: any; title: string; description: string;
}) => (
  <div className="group relative p-8 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-500 hover:-translate-y-1">
    <div className="w-12 h-12 rounded-xl bg-[#E50914]/10 flex items-center justify-center mb-6 group-hover:bg-[#E50914]/15 transition-colors">
      <Icon size={22} className="text-[#E50914]" />
    </div>
    <h3 style={{ fontFamily: 'Anton, sans-serif' }} className="text-xl uppercase tracking-wide mb-3">{title}</h3>
    <p className="text-[14px] text-neutral-500 leading-relaxed">{description}</p>
  </div>
);


// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [cmsData, setCmsData] = useState({
    headline: "Direct Everything",
    subhead: "AI CINEMA ENGINE",
    heroVideoUrl: ""
  });

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "site_config", "landing_page"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCmsData({
          headline: data.headline || "Direct Everything",
          subhead: data.subhead || "AI CINEMA ENGINE",
          heroVideoUrl: data.heroVideoUrl || ""
        });
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const castingImages = [
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(1).png?alt=media&token=4125c260-6236-49d0-abb5-d06b20278eb0",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-3%20(2).png?alt=media&token=07a27ac4-8a69-4d8d-bcde-f6a079eb5f4d",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-2%20(2).png?alt=media&token=92858dec-04d2-4dae-b8c1-c815705c2141",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(2).png?alt=media&token=c1755e67-9fc0-49e5-a000-77a92198fae1"
  ];

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
        @keyframes mosaic-drift {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
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
        .animate-fade-up { animation: fade-up 0.8s ease-out forwards; }
        .animate-fade-up-delay { animation: fade-up 0.8s ease-out 0.2s forwards; opacity: 0; }
        .animate-fade-up-delay-2 { animation: fade-up 0.8s ease-out 0.4s forwards; opacity: 0; }
        .landing-marquee { 
          display: flex; width: max-content; 
          animation: marquee-scroll 30s linear infinite;
        }
        .landing-marquee:hover { animation-play-state: paused; }
        .mosaic-column {
          animation: mosaic-drift 40s linear infinite;
        }
        .mosaic-column:nth-child(even) {
          animation-duration: 55s;
          animation-direction: reverse;
        }
        .mosaic-column:nth-child(3n) {
          animation-duration: 48s;
        }
        .mosaic-cell {
          filter: saturate(0.3) brightness(0.6);
          transition: all 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .mosaic-cell:hover {
          filter: saturate(1) brightness(1);
          transform: scale(1.05);
          z-index: 10;
        }
      `}</style>

      {/* ──────── FILM GRAIN OVERLAY ──────── */}
      <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03]"
        style={{ background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 1. NAVIGATION                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${scrolled
        ? 'py-3 bg-[#050505]/80 backdrop-blur-xl border-b border-white/[0.04]'
        : 'py-5 bg-transparent'
        }`}>
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-2 h-2 rounded-full bg-[#E50914] shadow-[0_0_8px_#E50914]"
              style={{ animation: 'pulse-dot 2.5s ease-in-out infinite' }}
            />
            <span style={{ fontFamily: 'Anton, sans-serif' }} className="text-lg tracking-[0.15em] uppercase text-white">
              Motion X
            </span>
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/pricing" className="text-[11px] font-semibold tracking-[0.15em] uppercase text-neutral-500 hover:text-white transition-colors">
              Pricing
            </Link>
            <Link href="/login"
              className="px-5 py-2 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[11px] font-bold tracking-[0.15em] uppercase rounded-full transition-all hover:shadow-[0_0_20px_rgba(229,9,20,0.3)]"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 2. HERO — CINEMATIC VIEWFINDER                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <HeroSection cmsData={cmsData} />


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 3. MANIFESTO                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="py-32 md:py-40 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row gap-16 md:gap-24 items-start">
          <div className="flex-1">
            <h2 style={{ fontFamily: 'Anton, sans-serif' }}
              className="text-5xl md:text-7xl uppercase leading-[0.9] tracking-tight"
            >
              One Prompt.<br />
              <span className="text-neutral-700">Entire Production.</span>
            </h2>
          </div>
          <div className="flex-1 pt-2">
            <p className="text-lg md:text-xl text-neutral-500 leading-relaxed">
              Filmmaking used to require millions of dollars and an army of crew.{' '}
              <span className="text-white">
                Motion X collapses the entire production pipeline into a single, intelligent workspace.
              </span>
            </p>
            <div className="mt-10 h-[1px] w-full bg-gradient-to-r from-[#E50914] via-[#E50914]/20 to-transparent" />
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 4. FEATURES                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold tracking-[0.2em] uppercase text-neutral-500 mb-6">
              <Sparkles size={12} className="text-[#E50914]" /> What You Get
            </span>
            <h2 style={{ fontFamily: 'Anton, sans-serif' }} className="text-4xl md:text-5xl uppercase tracking-tight">
              Your Complete Studio
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={Aperture}
              title="Identity Engine"
              description="Create consistent characters that persist across every scene. Build your cast once — use them infinitely across your entire production."
            />
            <FeatureCard
              icon={Film}
              title="Script to Screen"
              description="Write your screenplay, let AI break it into scenes, generate storyboards and animate each shot — all from a single unified workspace."
            />
            <FeatureCard
              icon={Layers}
              title="AI Direction"
              description="Control every detail — camera angles, lighting, mood, color grading. Direct your vision with the precision of a seasoned cinematographer."
            />
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 5. SHOWCASE REEL                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section id="showcase" className="py-24 overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 mb-12">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#E50914] mb-3 block">
                Showcase
              </span>
              <h2 style={{ fontFamily: 'Anton, sans-serif' }} className="text-4xl md:text-5xl uppercase tracking-tight">
                Made With Motion X
              </h2>
            </div>
            <span className="text-[11px] text-neutral-600 tracking-wider uppercase hidden md:block">
              All visuals AI-generated
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="landing-marquee">
            {[...castingImages, ...castingImages].map((src, i) => (
              <div key={i} className="flex-shrink-0 w-[300px] md:w-[400px] h-[400px] md:h-[533px] mx-2 rounded-xl overflow-hidden border border-white/[0.06] group relative">
                <img src={src} alt={`Showcase ${i + 1}`}
                  className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 6. SCRIPT TO SCREEN DEMO                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-12">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#E50914] mb-3 block">
              How It Works
            </span>
            <h2 style={{ fontFamily: 'Anton, sans-serif' }} className="text-4xl md:text-5xl uppercase tracking-tight">
              Script to Screen
            </h2>
          </div>

          <div className="border border-white/[0.06] bg-[#0A0A0A] rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[350px_1fr] h-auto md:h-[550px]">
            <div className="border-b md:border-b-0 md:border-r border-white/[0.06] p-6 md:p-8 flex flex-col">
              <div className="flex items-center gap-3 pb-4 mb-6 border-b border-white/[0.04]">
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
                <span className="ml-auto text-[10px] text-neutral-600 tracking-wider">Script Editor</span>
              </div>
              <div className="flex-1 font-mono text-[13px] text-neutral-500 leading-[1.8] space-y-1">
                <p><span className="text-neutral-700">001</span>{' '}EXT. NEON STREET — NIGHT</p>
                <p>&nbsp;</p>
                <p><span className="text-neutral-700">002</span>{' '}A rain-slicked cyberpunk alleyway. STEAM rises from vents.</p>
                <p>&nbsp;</p>
                <p><span className="text-neutral-700">003</span>{' '}A FIGURE in a trench coat walks away from camera.</p>
                <p>&nbsp;</p>
                <p><span className="text-neutral-700">004</span>{' '}<span className="bg-[#E50914] text-white px-1.5 py-0.5 rounded text-[11px]">Red neon lights</span> reflect in the puddles.</p>
              </div>
              <div className="mt-auto pt-4 border-t border-white/[0.04] text-[10px] text-[#E50914] font-semibold tracking-wider flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
                Processing scene...
              </div>
            </div>

            <div className="flex flex-col">
              <div className="h-10 border-b border-white/[0.06] flex items-center px-5 gap-5 text-neutral-600">
                <Film size={14} />
                <div className="h-3 w-[1px] bg-white/[0.06]" />
                <span className="text-[10px] tracking-wider">1920×1080</span>
                <span className="text-[10px] tracking-wider">24FPS</span>
                <span className="text-[10px] ml-auto text-[#E50914] font-semibold tracking-wider">Render Complete</span>
              </div>
              <div className="flex-1 bg-[#050505] flex items-center justify-center p-6 relative">
                <video autoPlay loop muted playsInline
                  className="w-full max-w-[90%] rounded-lg shadow-2xl shadow-black/50"
                  src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Demo.mp4?alt=media&token=bd3499d7-b714-4b3d-9c78-8c2fe113abba"
                  preload="none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 7. PRICING                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10">
        <div className="max-w-[1100px] mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] font-semibold tracking-[0.2em] uppercase text-neutral-500 mb-6">
            Pricing
          </span>
          <h2 style={{ fontFamily: 'Anton, sans-serif' }} className="text-4xl md:text-5xl uppercase tracking-tight mb-16">
            Start Creating Today
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <PricingCard
              title="Indie"
              price="$20"
              features={["50 AI Images / mo", "16 Gen-3 Videos", "720p Exports", "Standard Queue"]}
            />
            <PricingCard
              title="Studio"
              price="$40"
              features={["100 AI Images / mo", "34 Gen-3 Videos", "4K Upscaling", "Commercial License", "Private Mode"]}
              isPopular={true}
            />
            <PricingCard
              title="Agency"
              price="$80"
              features={["200 AI Images / mo", "67 Gen-3 Videos", "Turbo Render Speed", "Priority Support", "API Access"]}
            />
          </div>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 8. CTA BANNER                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10">
        <div className="max-w-[1000px] mx-auto text-center">
          <h2 style={{ fontFamily: 'Anton, sans-serif' }} className="text-4xl md:text-6xl uppercase tracking-tight mb-6">
            Ready to Direct?
          </h2>
          <p className="text-neutral-500 text-lg mb-10 max-w-lg mx-auto">
            Join thousands of creators using AI to bring their stories to life.
          </p>
          <Link href="/login"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[#E50914] hover:bg-[#ff1a25] text-white text-[13px] font-bold tracking-[0.12em] uppercase rounded-full transition-all hover:shadow-[0_0_40px_rgba(229,9,20,0.25)]"
          >
            Start Your Production <ArrowRight size={16} />
          </Link>
        </div>
      </section>


      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* 9. FOOTER                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#020202] pt-20 pb-10 px-6 md:px-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
            <h1 style={{ fontFamily: 'Anton, sans-serif' }}
              className="text-[80px] md:text-[120px] leading-[0.8] uppercase text-[#111] select-none"
            >
              Motion X
            </h1>

            <div className="flex gap-16 text-[12px] text-neutral-600">
              <div className="flex flex-col gap-3">
                <span className="text-white font-semibold tracking-wider text-[11px] uppercase mb-1">Platform</span>
                <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                <span>Showcase</span>
                <span>Updates</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-white font-semibold tracking-wider text-[11px] uppercase mb-1">Legal</span>
                <span>Terms of Service</span>
                <span>Privacy Policy</span>
                <span>Copyright</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-white font-semibold tracking-wider text-[11px] uppercase mb-1">Connect</span>
                <span>Twitter / X</span>
                <span>Discord</span>
                <span>Instagram</span>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row justify-between text-[10px] text-neutral-700 tracking-wider">
            <span>© 2026 MOTIONX STUDIO. ALL RIGHTS RESERVED.</span>
            <span>BUILT WITH AI</span>
          </div>
        </div>
      </footer>

    </main>
  );
}