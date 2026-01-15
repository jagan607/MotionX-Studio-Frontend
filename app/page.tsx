"use client";
import Head from "next/head";
import Link from "next/link";
import { ArrowRight, Film, LayoutTemplate, Wand2, CheckCircle2, Zap, ChevronRight, Play, Check, Box, Layers } from "lucide-react";

export default function LandingPage() {

  // --- INLINE STYLES FOR STABILITY ---
  const styles = {
    // LAYOUT UTILS
    section: { padding: '100px 40px', maxWidth: '1200px', margin: '0 auto', borderBottom: '1px solid #111' },
    heroContainer: { position: 'relative' as const, height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#000' },
    videoBg: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' as const, opacity: 0.4, zIndex: 0 },
    overlay: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at center, transparent 0%, #000 90%)', zIndex: 1 },
    nav: { position: 'fixed' as const, top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 40px', borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' },

    // TYPOGRAPHY
    h2: { fontFamily: 'Anton', fontSize: '64px', textTransform: 'uppercase' as const, marginBottom: '20px', lineHeight: 0.9 },
    subtitle: { fontFamily: 'monospace', fontSize: '12px', color: '#FF0000', letterSpacing: '3px', textTransform: 'uppercase' as const, marginBottom: '20px', display: 'block' },
    p: { fontSize: '16px', color: '#888', lineHeight: 1.6, maxWidth: '600px' },

    // CARDS
    card: { backgroundColor: '#080808', border: '1px solid #222', padding: '40px', display: 'flex', flexDirection: 'column' as const, height: '100%' },
    priceCard: { flex: 1, backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '50px', position: 'relative' as const, display: 'flex', flexDirection: 'column' as const },
    priceHighlight: { flex: 1, backgroundColor: '#111', border: '1px solid #FF0000', padding: '50px', position: 'relative' as const, display: 'flex', flexDirection: 'column' as const, transform: 'scale(1.05)', boxShadow: '0 0 50px rgba(255,0,0,0.1)' },

    // BUTTONS
    ctaBtn: { backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '15px 30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', textTransform: 'uppercase' as const, cursor: 'pointer', marginTop: 'auto' },
    ghostBtn: { backgroundColor: 'transparent', color: '#FFF', border: '1px solid #333', padding: '15px 30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', textTransform: 'uppercase' as const, cursor: 'pointer', marginTop: 'auto' }
  };

  // ASSETS ARRAY
  const castingImages = [
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(1).png?alt=media&token=4125c260-6236-49d0-abb5-d06b20278eb0",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-3%20(2).png?alt=media&token=07a27ac4-8a69-4d8d-bcde-f6a079eb5f4d",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-2%20(2).png?alt=media&token=92858dec-04d2-4dae-b8c1-c815705c2141",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(2).png?alt=media&token=c1755e67-9fc0-49e5-a000-77a92198fae1"
  ];

  return (
    <main style={{ backgroundColor: '#050505', minHeight: '100vh', color: 'white', fontFamily: 'Inter, sans-serif' }}>

      {/* Metadata */}
      <Head>
        <title>MotionX Studio | Direct AI Cinema</title>
        <meta name="description" content="The first AI-native operating system for filmmakers. Turn scripts into consistent characters, storyboards, and 4K video assets. Start creating for free." />
        <meta name="keywords" content="AI Filmmaking, Script to Video, Consistent Characters, AI Storyboard, Runway Alternative, Midjourney for Video, MotionX, Nano Banana Pro, Seedance, Film Production Software" />
        <meta name="author" content="MotionX Studio" />
        <meta name="creator" content="MotionX Studio" />
        <meta name="publisher" content="MotionX Studio" />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="MotionX Studio | Direct AI Cinema" />
        <meta property="og:description" content="Turn raw scripts into production-ready video assets. Features consistent casting, auto-directing, and 4K upscaling." />
        <meta property="og:url" content="https://studio.motionx.in" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-share-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="MotionX Studio | Direct AI Cinema" />
        <meta name="twitter:description" content="The first AI-native operating system for filmmakers." />
        <meta name="twitter:image" content="/og-share-image.png" />
        <meta name="robots" content="index, follow" />
      </Head>

      {/* 1. NAVBAR */}
      <nav style={styles.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#FF0000', color: 'black', padding: '4px 8px', fontFamily: 'Anton', fontSize: '18px' }}>MX</div>
          <div><h1 style={{ fontFamily: 'Anton', fontSize: '20px', lineHeight: 1, textTransform: 'uppercase' }}>Motion X</h1></div>
        </div>
        <Link href="/login" style={{ textDecoration: 'none' }}>
          <button style={{ backgroundColor: 'white', color: 'black', border: 'none', padding: '12px 24px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Initialize Studio <ChevronRight size={14} />
          </button>
        </Link>
      </nav>

      {/* 2. HERO SECTION */}
      <section style={styles.heroContainer}>
        <video autoPlay loop muted playsInline style={styles.videoBg}>
          <source src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media&token=8b2fd5b3-3280-48b5-b141-1f399daf00ac" type="video/mp4" />
        </video>
        <div style={styles.overlay} />
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '900px', padding: '0 20px' }}>
          <div style={{ marginBottom: '20px', display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span style={{ fontSize: '10px', color: '#AAA', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>/// SYSTEM ONLINE: V1.0</span>
          </div>
          <h1 style={{ fontFamily: 'Anton', fontSize: 'clamp(60px, 10vw, 140px)', lineHeight: 0.9, textTransform: 'uppercase', marginBottom: '30px', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            Direct <br /> <span style={{ color: '#888' }}>AI Cinema</span>
          </h1>
          <p style={{ fontSize: '16px', color: '#CCC', maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.6 }}>The first operating system that turns raw scripts into consistent characters, storyboards, and 4K video assets.</p>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <button style={{ backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '20px 50px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 0 40px rgba(255,0,0,0.4)' }}>Start Creating Free</button>
          </Link>
        </div>
      </section>

      {/* 3. MANIFESTO / PROBLEM */}
      <section style={{ ...styles.section, textAlign: 'center', padding: '150px 40px' }}>
        <h2 style={{ fontFamily: 'Anton', fontSize: '42px', color: '#333', textTransform: 'uppercase', marginBottom: '20px' }}>The Old Way is Broken</h2>
        <p style={{ fontSize: '24px', lineHeight: 1.5, maxWidth: '800px', margin: '0 auto', color: '#FFF' }}>
          Filmmaking used to require millions of dollars, hundreds of crew members, and years of production time. <span style={{ color: '#FF0000' }}>Motion X reduces this to a single terminal.</span>
        </p>
      </section>

      {/* 4. FEATURE: CONSISTENCY GRID */}
      <section style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '60px' }}>
          <div>
            <span style={styles.subtitle}>/// MODULE 01: IDENTITY ENGINE</span>
            <h2 style={styles.h2}>Consistent Casting</h2>
            <p style={styles.p}>Define your actor once. Use them in 100 shots. We maintain facial identity across wide shots, close-ups, and different lighting.</p>
          </div>
          {/* FIXED: Removed invalid 'md' style property */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#555' }}>ACCURACY: 99.8%</div>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#555' }}>MODEL: FLUX_V2</div>
          </div>
        </div>

        {/* The Grid of Faces */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          {castingImages.map((src, i) => (
            <div key={i} style={{ aspectRatio: '1/1', backgroundColor: '#111', border: '1px solid #333', position: 'relative', overflow: 'hidden' }}>
              <img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }} className="hover:scale-105" alt={`Character variation ${i}`} />
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', fontSize: '9px', backgroundColor: '#000', padding: '2px 5px', color: '#FFF', fontFamily: 'monospace' }}>
                VAR_0{i + 1}_CONFIRMED
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. FEATURE: SCRIPT TO VIDEO */}
      <section style={styles.section}>
        <span style={styles.subtitle}>/// MODULE 02: AUTO-DIRECTOR</span>
        <h2 style={styles.h2}>Script to Screen</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '60px' }}>
          {/* Left: The Script */}
          <div style={{ backgroundColor: '#0A0A0A', borderLeft: '2px solid #FF0000', padding: '40px' }}>
            <h3 style={{ fontFamily: 'monospace', color: '#666', marginBottom: '20px' }}>INPUT: RAW_SCRIPT.TXT</h3>
            <p style={{ fontFamily: 'Courier New', fontSize: '14px', lineHeight: 1.8, color: '#DDD' }}>
              EXT. NEON STREET - NIGHT <br /><br />
              A rain-slicked cyberpunk alleyway. STEAM rises from vents. <br />
              A FIGURE in a trench coat walks away from camera.<br />
              Red neon lights reflect in the puddles.
            </p>
          </div>
          {/* Right: The Visual */}
          <div style={{ aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <video
              autoPlay loop muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Demo.mp4?alt=media&token=bd3499d7-b714-4b3d-9c78-8c2fe113abba"
            />
          </div>
        </div>
      </section>

      {/* 6. PRICING / COMING SOON SECTION */}
      <section style={{ padding: '100px 40px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <span style={styles.subtitle}>/// PRODUCTION ECONOMY</span>
        <h2 style={styles.h2}>Membership Access</h2>

        <div style={{
          marginTop: '60px',
          border: '1px solid #222',
          backgroundColor: '#0A0A0A',
          padding: '80px 40px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Background Texture */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #0A0A0A 25%, #0A0A0A 75%, #111 75%, #111)',
            backgroundPosition: '0 0, 10px 10px',
            backgroundSize: '20px 20px',
            opacity: 0.1
          }} />

          <div style={{ position: 'relative', zIndex: 10, maxWidth: '600px' }}>
            <div style={{
              display: 'inline-block', padding: '8px 16px',
              border: '1px solid #FF0000', color: '#FF0000',
              fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px',
              marginBottom: '30px', backgroundColor: 'rgba(255, 0, 0, 0.1)'
            }}>
              SYSTEM STATUS: INITIALIZING PRICING MODULE
            </div>

            <h3 style={{ fontFamily: 'Anton', fontSize: '48px', color: '#FFF', marginBottom: '20px', textTransform: 'uppercase' }}>
              Public Access Opening Soon
            </h3>

            <p style={{ color: '#888', fontSize: '16px', lineHeight: 1.6, marginBottom: '40px' }}>
              We are currently onboarding studios and independent creators in waves to ensure GPU stability. The "Studio Pro" and "Short Film" passes will unlock shortly.
            </p>

            {/* VISUAL PROGRESS BAR */}
            <div style={{ width: '100%', height: '4px', backgroundColor: '#222', marginBottom: '15px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '75%', backgroundColor: '#FF0000', boxShadow: '0 0 10px #FF0000' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10px', fontFamily: 'monospace', color: '#666' }}>
              <span>LOADING_ASSETS...</span>
              <span>75% COMPLETE</span>
            </div>

            {/* NOTIFY BUTTON (Visual Only) */}
            <div style={{ marginTop: '50px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <input type="email" placeholder="ENTER EMAIL FOR EARLY ACCESS" style={{ backgroundColor: '#111', border: '1px solid #333', padding: '15px', color: 'white', fontSize: '12px', width: '250px', outline: 'none', fontFamily: 'monospace' }} />
              <button style={{ backgroundColor: '#FFF', color: 'black', border: 'none', padding: '15px 30px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', fontFamily: 'monospace' }}>NOTIFY ME</button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer style={{ borderTop: '1px solid #222', padding: '60px 40px', textAlign: 'center', backgroundColor: 'black' }}>
        <h2 style={{ fontFamily: 'Anton', fontSize: '32px', marginBottom: '20px', textTransform: 'uppercase' }}>Motion X</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '10px', fontFamily: 'monospace', color: '#666' }}>
          <span>PRIVACY POLICY</span>
          <span>TERMS OF SERVICE</span>
          <span>DOCUMENTATION</span>
        </div>
        <p style={{ fontSize: '10px', color: '#444', fontFamily: 'monospace', marginTop: '20px' }}>© 2026 MOTIONX STUDIO.</p>
      </footer>
    </main>
  );
}