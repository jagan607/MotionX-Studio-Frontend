"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Client SDK
import { ChevronRight, Check, Play, Aperture, Film, Crosshair } from "lucide-react";

// --- HELPER COMPONENT: CINEMATIC PRICING TICKET ---
const CompactPricingCard = ({ title, price, features, isPopular = false }: { title: string, price: string, features: string[], isPopular?: boolean }) => (
  <Link href="/pricing" style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
    <div className={`pricing-card ${isPopular ? 'popular' : ''}`}>
      {/* Corner Brackets for Viewfinder feel */}
      <div className="bracket top-left"></div>
      <div className="bracket top-right"></div>
      <div className="bracket bottom-left"></div>
      <div className="bracket bottom-right"></div>

      {isPopular && (
        <div className="popular-badge">
          <span className="blink-red">●</span> PROD. CHOICE
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 2 }}>
        <h3 style={{ fontFamily: 'Anton', fontSize: '32px', textTransform: 'uppercase', marginBottom: '0px', color: isPopular ? '#FFF' : '#888', letterSpacing: '1px' }}>
          {title}
        </h3>
        <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#555', marginBottom: '20px', letterSpacing: '2px' }}>
          /// LICENSE_TIER_0{price === '$20' ? '1' : price === '$40' ? '2' : '3'}
        </div>

        <div style={{ fontSize: '42px', fontFamily: 'Anton', color: isPopular ? '#FF0000' : '#FFF', marginBottom: '30px' }}>
          {price}<span style={{ fontSize: '14px', color: '#555', fontFamily: 'monospace' }}>/MO</span>
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderTop: '1px dashed #333', paddingTop: '20px' }}>
          {features.map((f, i) => (
            <li key={i} style={{ fontSize: '11px', fontFamily: 'monospace', color: '#CCC', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' }}>
              <div style={{ width: '4px', height: '4px', backgroundColor: isPopular ? '#FF0000' : '#444' }}></div>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  </Link>
);

export default function LandingPage() {
  // --- CMS STATE ---
  const [cmsData, setCmsData] = useState({
    headline: "Direct Everything",
    subhead: "AI CINEMA ENGINE",
    heroVideoUrl: "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media&token=8b2fd5b3-3280-48b5-b141-1f399daf00ac"
  });

  // --- REAL-TIME CMS LISTENER ---
  useEffect(() => {
    // Listen to the 'landing_page' document in 'site_config' collection
    const unsub = onSnapshot(doc(db, "site_config", "landing_page"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCmsData({
          headline: data.headline || "Direct Everything",
          subhead: data.subhead || "AI CINEMA ENGINE",
          // Fallback to default if field is empty in DB
          heroVideoUrl: data.heroVideoUrl || "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media&token=8b2fd5b3-3280-48b5-b141-1f399daf00ac"
        });
      }
    });
    return () => unsub(); // Cleanup on unmount
  }, []);

  // Helper to check if URL is an image (simple check)
  const isImage = (url: string) => {
    return url.match(/\.(jpeg|jpg|gif|png)$/) != null;
  };

  const castingImages = [
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(1).png?alt=media&token=4125c260-6236-49d0-abb5-d06b20278eb0",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-3%20(2).png?alt=media&token=07a27ac4-8a69-4d8d-bcde-f6a079eb5f4d",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-2%20(2).png?alt=media&token=92858dec-04d2-4dae-b8c1-c815705c2141",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(2).png?alt=media&token=c1755e67-9fc0-49e5-a000-77a92198fae1"
  ];

  return (
    <main style={{ backgroundColor: '#050505', minHeight: '100vh', color: '#EAEAEA', fontFamily: 'Inter, sans-serif', overflowX: 'hidden', position: 'relative' }}>

      {/* GLOBAL GRAIN & GRID OVERLAY */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999, background: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.05%22/%3E%3C/svg%3E")', opacity: 0.4 }}></div>

      {/* Global CSS */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;400;700&family=Space+Mono:wght@400;700&display=swap');
        
        ::selection { background: #FF0000; color: #000; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; }
        ::-webkit-scrollbar-thumb:hover { background: #FF0000; }

        .pricing-card {
          background: #080808;
          padding: 40px 30px;
          border: 1px solid #1a1a1a;
          position: relative;
          transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
          height: 100%;
        }
        
        .pricing-card:hover {
          background: #0C0C0C;
          border-color: #333;
          transform: translateY(-5px);
        }

        .pricing-card.popular {
          border: 1px solid #333;
          background: radial-gradient(circle at top right, #1a0505 0%, #080808 60%);
        }

        .pricing-card.popular:hover {
          border-color: #FF0000;
          box-shadow: 0 0 30px rgba(255,0,0,0.1);
        }

        .bracket { position: absolute; width: 10px; height: 10px; border-color: #333; transition: all 0.3s; }
        .pricing-card:hover .bracket { border-color: #FF0000; width: 15px; height: 15px; }
        .top-left { top: 0; left: 0; border-top: 1px solid; border-left: 1px solid; }
        .top-right { top: 0; right: 0; border-top: 1px solid; border-right: 1px solid; }
        .bottom-left { bottom: 0; left: 0; border-bottom: 1px solid; border-left: 1px solid; }
        .bottom-right { bottom: 0; right: 0; border-bottom: 1px solid; border-right: 1px solid; }

        .popular-badge {
          position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
          background: #000; border: 1px solid #FF0000; border-top: none;
          color: #FFF; font-size: 9px; font-weight: bold; letter-spacing: 2px;
          padding: 4px 12px; font-family: 'Space Mono', monospace;
          display: flex; gap: 6px; align-items: center;
        }

        .blink-red { animation: blink 2s infinite; color: #FF0000; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }

        .video-text-overlay { mix-blend-mode: exclusion; color: white; }
        
        .scanline {
          width: 100%;
          height: 1px;
          background: rgba(255, 0, 0, 0.3);
          position: absolute;
          animation: scan 6s linear infinite;
          z-index: 5;
          opacity: 0.5;
        }
        @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }

        /* HUD ELEMENTS */
        .hud-corner {
          position: fixed; width: 40px; height: 40px; border-color: rgba(255,255,255,0.1); z-index: 40; pointer-events: none;
        }
        .hud-tl { top: 20px; left: 20px; border-top: 1px solid; border-left: 1px solid; }
        .hud-tr { top: 20px; right: 20px; border-top: 1px solid; border-right: 1px solid; }
        .hud-bl { bottom: 20px; left: 20px; border-bottom: 1px solid; border-left: 1px solid; }
        .hud-br { bottom: 20px; right: 20px; border-bottom: 1px solid; border-right: 1px solid; }

        @media (max-width: 768px) {
          .mobile-stack { flex-direction: column; }
          .hero-title { font-size: 56px !important; }
          .hud-corner { display: none; }
        }
      `}</style>

      {/* HUD DECORATIONS */}
      <div className="hud-corner hud-tl"></div>
      <div className="hud-corner hud-tr"></div>
      <div className="hud-corner hud-bl"></div>
      <div className="hud-corner hud-br"></div>

      {/* 1. CINEMATIC NAVBAR */}
      <nav style={{ position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 100, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', mixBlendMode: 'difference' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '12px', height: '12px', background: '#FF0000', borderRadius: '50%', boxShadow: '0 0 10px #FF0000' }} className="blink-red"></div>
          <div style={{ fontFamily: 'Space Mono', fontSize: '10px', letterSpacing: '2px', color: '#FFF' }}>REC ● 00:00:00:00</div>
        </div>

        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Anton', fontSize: '24px', letterSpacing: '4px', textTransform: 'uppercase', color: '#FFF' }}>
          Motion X
        </div>

        <div style={{ display: 'flex', gap: '30px', fontFamily: 'Space Mono', fontSize: '11px', fontWeight: 'bold' }}>
          <Link href="/pricing" style={{ color: '#FFF', textDecoration: 'none', textTransform: 'uppercase' }}>[ Pricing ]</Link>
          <Link href="/login" style={{ color: '#FF0000', textDecoration: 'none', textTransform: 'uppercase' }}>[ Initialize ]</Link>
        </div>
      </nav>

      {/* 2. HERO SECTION - IMMERSIVE (CONNECTED TO CMS) */}
      <section style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="scanline"></div>

        {/* Dynamic Background: Supports Video or Image */}
        {isImage(cmsData.heroVideoUrl) ? (
          <img
            src={cmsData.heroVideoUrl}
            alt="Hero Background"
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, filter: 'contrast(1.2) saturation(0)' }}
          />
        ) : (
          <video
            autoPlay loop muted playsInline
            key={cmsData.heroVideoUrl} // Forces reload on URL change
            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6, filter: 'contrast(1.2) saturation(0)' }}
          >
            <source src={cmsData.heroVideoUrl} type="video/mp4" />
          </video>
        )}

        {/* Vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, transparent 20%, #050505 100%)', zIndex: 1 }}></div>

        {/* Content */}
        <div style={{ zIndex: 10, textAlign: 'center', width: '100%', padding: '0 20px' }}>
          {/* CMS: SUBHEAD */}
          <div style={{ fontFamily: 'Space Mono', color: '#FF0000', fontSize: '12px', letterSpacing: '0.5em', marginBottom: '20px' }}>
            {cmsData.subhead}
          </div>

          {/* CMS: HEADLINE */}
          {/* dangerouslySetInnerHTML allows you to use <br> tags in the Admin Panel for line breaks */}
          <h1
            className="hero-title video-text-overlay"
            style={{ fontSize: '140px', fontFamily: 'Anton', lineHeight: 0.85, textTransform: 'uppercase', letterSpacing: '-4px', margin: '0 0 40px 0' }}
            dangerouslySetInnerHTML={{ __html: cmsData.headline.replace(/\n/g, '<br/>') }}
          />

          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', alignItems: 'center' }}>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button style={{
                background: 'transparent', color: '#FFF', border: '1px solid #FFF',
                padding: '15px 40px', fontFamily: 'Space Mono', fontSize: '12px',
                textTransform: 'uppercase', letterSpacing: '2px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '10px',
                transition: 'all 0.3s'
              }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#FFF'; e.currentTarget.style.color = '#000'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#FFF'; }}
              >
                <Play size={14} fill="currentColor" /> Start Production
              </button>
            </Link>
          </div>
        </div>

        {/* Hero Footer */}
        <div style={{ position: 'absolute', bottom: 40, width: '100%', padding: '0 40px', display: 'flex', justifyContent: 'space-between', zIndex: 20, fontFamily: 'Space Mono', fontSize: '10px', color: '#666' }}>
          <div>ISO 800 / f1.4 / 24fps</div>
          <div>SYSTEM_READY</div>
        </div>
      </section>

      {/* 3. MANIFESTO - KINETIC TYPOGRAPHY */}
      <section style={{ padding: '120px 20px', background: '#050505', borderBottom: '1px solid #111' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', gap: '60px', alignItems: 'flex-start' }} className="mobile-stack">
          <div style={{ flex: 1 }}>
            <Aperture size={64} color="#FF0000" style={{ marginBottom: '40px' }} strokeWidth={1} />
            <h2 style={{ fontFamily: 'Anton', fontSize: '64px', lineHeight: 1, textTransform: 'uppercase', color: '#FFF' }}>
              The Old Way <br /><span style={{ color: '#333' }}>is Dead.</span>
            </h2>
          </div>
          <div style={{ flex: 1, paddingTop: '10px' }}>
            <p style={{ fontSize: '24px', lineHeight: 1.5, color: '#CCC', fontFamily: 'Inter', fontWeight: 300 }}>
              Filmmaking used to require millions of dollars and an army of crew.
              <strong style={{ color: '#FFF', fontWeight: 400 }}> Motion X collapses the entire production pipeline into a single prompt.</strong>
            </p>
            <div style={{ marginTop: '40px', height: '1px', width: '100%', background: 'linear-gradient(90deg, #FF0000 0%, transparent 100%)' }}></div>
          </div>
        </div>
      </section>

      {/* 4. CASTING GRID - "CONTACT SHEET" STYLE */}
      <section style={{ padding: '100px 0', borderBottom: '1px solid #111', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', height: '100%', width: '1px', background: '#111', transform: 'translateX(-50%)' }}></div>

        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '60px', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'Space Mono', color: '#FF0000', fontSize: '10px', marginBottom: '10px' }}>01 // IDENTITY ENGINE</div>
              <h2 style={{ fontFamily: 'Anton', fontSize: '56px', textTransform: 'uppercase', lineHeight: 0.9 }}>Consistent<br />Casting</h2>
            </div>
            <div style={{ fontFamily: 'Space Mono', fontSize: '11px', textAlign: 'right', color: '#666' }}>
              MODEL: FLUX_V2_F<br />
              SEED: 9928371<br />
              VARIANTS: INFINITE
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }} className="mobile-stack">
            {castingImages.map((src, i) => (
              <div key={i} style={{ aspectRatio: '3/4', position: 'relative', overflow: 'hidden', border: '1px solid #222', filter: 'grayscale(100%)', transition: 'all 0.5s' }}
                onMouseEnter={(e) => e.currentTarget.style.filter = 'grayscale(0%)'}
                onMouseLeave={(e) => e.currentTarget.style.filter = 'grayscale(100%)'}
              >
                <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="character" />

                {/* Image Overlay UI */}
                <div style={{ position: 'absolute', inset: 0, border: '1px solid rgba(255,255,255,0.1)', margin: '10px' }}></div>
                <div style={{ position: 'absolute', bottom: '20px', left: '20px', fontFamily: 'Space Mono', fontSize: '9px', color: '#FFF', background: 'black', padding: '2px 6px' }}>
                  CAM_0{i + 1}
                </div>
                <Crosshair size={16} color="white" style={{ position: 'absolute', top: '20px', right: '20px', opacity: 0.5 }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. SCRIPT TO SCREEN - "NLE INTERFACE" STYLE */}
      <section style={{ padding: '100px 0', background: '#080808', borderBottom: '1px solid #111' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ fontFamily: 'Space Mono', color: '#FF0000', fontSize: '10px', marginBottom: '10px' }}>02 // AUTO-DIRECTOR</div>
          <h2 style={{ fontFamily: 'Anton', fontSize: '56px', textTransform: 'uppercase', lineHeight: 0.9, marginBottom: '60px' }}>Script to Screen</h2>

          {/* The Interface Container */}
          <div style={{ border: '1px solid #333', background: '#000', display: 'grid', gridTemplateColumns: '350px 1fr', height: '600px' }} className="mobile-stack">

            {/* Left Panel: Script */}
            <div style={{ borderRight: '1px solid #333', padding: '30px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#333' }}></div>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#333' }}></div>
                <div style={{ fontFamily: 'Space Mono', fontSize: '10px', color: '#666', marginLeft: 'auto' }}>SCRIPT_EDITOR_V1</div>
              </div>
              <p style={{ fontFamily: 'Courier New', color: '#AAA', fontSize: '13px', lineHeight: 1.6, flex: 1 }}>
                <span style={{ color: '#555' }}>001</span> EXT. NEON STREET - NIGHT <br /><br />
                <span style={{ color: '#555' }}>002</span> A rain-slicked cyberpunk alleyway. STEAM rises from vents.<br /><br />
                <span style={{ color: '#555' }}>003</span> A FIGURE in a trench coat walks away from camera.<br /><br />
                <span style={{ color: '#555' }}>004</span> <span style={{ background: '#FF0000', color: 'black' }}>Red neon lights</span> reflect in the puddles.
              </p>
              <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '15px', fontFamily: 'Space Mono', fontSize: '10px', color: '#FF0000' }}>
                PROCESSING SCENE...
              </div>
            </div>

            {/* Right Panel: Viewport */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Toolbar */}
              <div style={{ height: '40px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '20px', color: '#555' }}>
                <Film size={14} />
                <div style={{ height: '14px', width: '1px', background: '#333' }}></div>
                <span style={{ fontFamily: 'Space Mono', fontSize: '10px' }}>1920x1080</span>
                <span style={{ fontFamily: 'Space Mono', fontSize: '10px' }}>24FPS</span>
                <span style={{ fontFamily: 'Space Mono', fontSize: '10px', marginLeft: 'auto', color: '#FF0000' }}>RENDER_COMPLETE</span>
              </div>

              {/* Video Player */}
              <div style={{ flex: 1, background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <video
                  autoPlay loop muted playsInline
                  style={{ width: '90%', boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
                  src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Demo.mp4?alt=media&token=bd3499d7-b714-4b3d-9c78-8c2fe113abba"
                />

                {/* Timeline UI at bottom of video */}
                <div style={{ position: 'absolute', bottom: 20, width: '90%', height: '40px', display: 'flex', gap: '2px', alignItems: 'flex-end' }}>
                  {[...Array(20)].map((_, i) => (
                    <div key={i} style={{ width: '5%', height: i % 3 === 0 ? '100%' : '40%', background: i === 5 ? '#FF0000' : 'rgba(255,255,255,0.1)' }}></div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6. PRICING - INDUSTRIAL STYLE */}
      <section style={{ padding: '120px 0', borderBottom: '1px solid #111' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', border: '1px solid #333', padding: '5px 15px', borderRadius: '20px', marginBottom: '20px' }}>
            <span style={{ fontFamily: 'Space Mono', fontSize: '10px', color: '#FF0000', letterSpacing: '2px' }}>PRODUCTION BUDGET</span>
          </div>
          <h2 style={{ fontFamily: 'Anton', fontSize: '48px', textTransform: 'uppercase', marginBottom: '80px' }}>Select Membership</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', alignItems: 'stretch' }}>
            <CompactPricingCard
              title="Indie"
              price="$20"
              features={["50 AI Images / Mo", "16 Gen-3 Videos", "720p Exports", "Standard Queue"]}
            />
            <CompactPricingCard
              title="Studio"
              price="$40"
              features={["100 AI Images / Mo", "34 Gen-3 Videos", "4K Upscaling", "Commercial License", "Private Mode"]}
              isPopular={true}
            />
            <CompactPricingCard
              title="Agency"
              price="$80"
              features={["200 AI Images / Mo", "67 Gen-3 Videos", "Turbo Render Speed", "Priority Support", "API Access"]}
            />
          </div>
        </div>
      </section>

      {/* 7. FOOTER - THE CREDITS */}
      <footer style={{ background: '#000', padding: '80px 20px 40px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '40px' }}>
          <div>
            <h1 style={{ fontFamily: 'Anton', fontSize: '120px', lineHeight: 0.8, textTransform: 'uppercase', color: '#111', margin: 0 }}>Motion X</h1>
          </div>

          <div style={{ display: 'flex', gap: '60px', fontFamily: 'Space Mono', fontSize: '11px', color: '#666' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ color: '#FFF' }}>PLATFORM</span>
              <span>Pricing</span>
              <span>Showcase</span>
              <span>Updates</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ color: '#FFF' }}>LEGAL</span>
              <span>Terms of Service</span>
              <span>Privacy Policy</span>
              <span>Copyright</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ color: '#FFF' }}>CONNECT</span>
              <span>Twitter / X</span>
              <span>Discord</span>
              <span>Instagram</span>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: '1400px', margin: '40px auto 0', borderTop: '1px solid #111', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', fontFamily: 'Space Mono', fontSize: '10px', color: '#333' }}>
          <span>© 2026 MOTIONX STUDIO. ALL RIGHTS RESERVED.</span>
          <span>SYSTEM_STATUS: ONLINE</span>
        </div>
      </footer>

    </main>
  );
}