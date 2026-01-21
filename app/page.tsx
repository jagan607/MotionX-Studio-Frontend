"use client";
import Link from "next/link";
import { ChevronRight, Check, X } from "lucide-react";

// --- HELPER COMPONENT FOR LANDING PAGE ---
const CompactPricingCard = ({ title, price, features, isPopular = false }: { title: string, price: string, features: string[], isPopular?: boolean }) => (
  <div style={{
    border: isPopular ? '1px solid #FF0000' : '1px solid #222',
    backgroundColor: isPopular ? 'rgba(255,0,0,0.05)' : '#0A0A0A',
    padding: '30px',
    textAlign: 'left',
    position: 'relative'
  }}>
    {isPopular && (
      <div style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#FF0000', color: 'black', fontSize: '9px', fontWeight: 'bold', padding: '2px 8px', fontFamily: 'monospace' }}>
        RECOMMENDED
      </div>
    )}
    <h3 style={{ fontFamily: 'Anton', fontSize: '24px', textTransform: 'uppercase', marginBottom: '10px' }}>{title}</h3>
    <div style={{ fontSize: '32px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '20px' }}>{price}</div>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {features.map((f, i) => (
        <li key={i} style={{ fontSize: '12px', color: '#888', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={12} color="#FF0000" /> {f}
        </li>
      ))}
    </ul>
  </div>
);

export default function LandingPage() {

  const castingImages = [
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(1).png?alt=media&token=4125c260-6236-49d0-abb5-d06b20278eb0",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-3%20(2).png?alt=media&token=07a27ac4-8a69-4d8d-bcde-f6a079eb5f4d",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-2%20(2).png?alt=media&token=92858dec-04d2-4dae-b8c1-c815705c2141",
    "https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/shot-1%20(2).png?alt=media&token=c1755e67-9fc0-49e5-a000-77a92198fae1"
  ];

  return (
    <main style={{ backgroundColor: '#050505', minHeight: '100vh', color: 'white', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

      <style jsx>{`
        .nav-container { padding: 20px; }
        .hero-title { font-size: 48px; line-height: 1; }
        .section-padding { padding: 80px 20px; }
        .grid-split { display: grid; grid-template-columns: 1fr; gap: 40px; } 
        .flex-between { display: flex; flex-direction: column; gap: 20px; }
        .hide-mobile { display: none; }
        .show-mobile { display: inline; }
        .script-box { border-left: 2px solid #FF0000; border-top: none; }
        .pricing-grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 60px; }
        .nav-link { color: #888; text-decoration: none; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; transition: color 0.3s; }
        .nav-link:hover { color: #FFF; }

        @media (min-width: 768px) {
          .nav-container { padding: 24px 40px; }
          .hero-title { font-size: 120px; line-height: 0.9; }
          .section-padding { padding: 100px 40px; }
          .grid-split { grid-template-columns: 1fr 1fr; gap: 60px; } 
          .flex-between { flex-direction: row; justify-content: space-between; align-items: flex-end; }
          .hide-mobile { display: inline; }
          .show-mobile { display: none; }
          .script-box { border-left: 2px solid #FF0000; border-top: none; }
          .pricing-grid { grid-template-columns: 1fr 1fr 1fr; }
        }
      `}</style>

      {/* 1. NAVBAR */}
      <nav className="nav-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ backgroundColor: '#FF0000', color: 'black', padding: '4px 8px', fontFamily: 'Anton', fontSize: '18px' }}>MX</div>
          <div><h1 style={{ fontFamily: 'Anton', fontSize: '20px', lineHeight: 1, textTransform: 'uppercase' }}>Motion X</h1></div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <Link href="/pricing" className="nav-link hide-mobile">Pricing</Link>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <button style={{ backgroundColor: 'white', color: 'black', border: 'none', padding: '10px 20px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="hide-mobile">Initialize Studio</span>
              <span className="show-mobile">Login</span> <ChevronRight size={14} />
            </button>
          </Link>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section style={{ position: 'relative', height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#000' }}>
        <video autoPlay loop muted playsInline style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4, zIndex: 0 }}>
          <source src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/MotionX%20Showreel%20(1).mp4?alt=media&token=8b2fd5b3-3280-48b5-b141-1f399daf00ac" type="video/mp4" />
        </video>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at center, transparent 0%, #000 90%)', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '900px', padding: '0 20px' }}>
          <div style={{ marginBottom: '20px', display: 'inline-block', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <span style={{ fontSize: '10px', color: '#AAA', letterSpacing: '3px', fontWeight: 'bold', textTransform: 'uppercase' }}>/// SYSTEM ONLINE: V1.0</span>
          </div>
          <h1 className="hero-title" style={{ fontFamily: 'Anton', textTransform: 'uppercase', marginBottom: '30px', textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            Direct <br /> <span style={{ color: '#888' }}>AI Cinema</span>
          </h1>
          <p style={{ fontSize: '16px', color: '#CCC', maxWidth: '600px', margin: '0 auto 40px', lineHeight: 1.6 }}>The first operating system that turns raw scripts into consistent characters, storyboards, and 4K video assets.</p>
          <Link href="/login" style={{ textDecoration: 'none' }}>
            <button style={{ backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '20px 50px', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 0 40px rgba(255,0,0,0.4)' }}>Start Creating Free</button>
          </Link>
        </div>
      </section>

      {/* 3. MANIFESTO / PROBLEM */}
      <section className="section-padding" style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', borderBottom: '1px solid #111' }}>
        <h2 style={{ fontFamily: 'Anton', fontSize: '42px', color: '#333', textTransform: 'uppercase', marginBottom: '20px' }}>The Old Way is Broken</h2>
        <p style={{ fontSize: '20px', lineHeight: 1.5, maxWidth: '800px', margin: '0 auto', color: '#FFF' }}>
          Filmmaking used to require millions of dollars, hundreds of crew members, and years of production time. <span style={{ color: '#FF0000' }}>Motion X reduces this to a single terminal.</span>
        </p>
      </section>

      {/* 4. FEATURE: CONSISTENCY GRID */}
      <section className="section-padding" style={{ maxWidth: '1200px', margin: '0 auto', borderBottom: '1px solid #111' }}>
        <div className="flex-between" style={{ marginBottom: '60px' }}>
          <div>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#FF0000', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>/// MODULE 01: IDENTITY ENGINE</span>
            <h2 style={{ fontFamily: 'Anton', fontSize: '48px', textTransform: 'uppercase', lineHeight: 0.9 }}>Consistent Casting</h2>
            <p style={{ fontSize: '16px', color: '#888', lineHeight: 1.6, maxWidth: '600px', marginTop: '20px' }}>Define your actor once. Use them in 100 shots. We maintain facial identity across wide shots, close-ups, and different lighting.</p>
          </div>
          <div className="hide-mobile" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#555' }}>ACCURACY: 99.8%</div>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#555' }}>MODEL: FLUX_V2</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>
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
      <section className="section-padding" style={{ maxWidth: '1200px', margin: '0 auto', borderBottom: '1px solid #111' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#FF0000', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>/// MODULE 02: AUTO-DIRECTOR</span>
        <h2 style={{ fontFamily: 'Anton', fontSize: '48px', textTransform: 'uppercase', lineHeight: 0.9 }}>Script to Screen</h2>

        <div className="grid-split" style={{ marginTop: '60px' }}>
          <div className="script-box" style={{ backgroundColor: '#0A0A0A', padding: '40px' }}>
            <h3 style={{ fontFamily: 'monospace', color: '#666', marginBottom: '20px' }}>INPUT: RAW_SCRIPT.TXT</h3>
            <p style={{ fontFamily: 'Courier New', fontSize: '14px', lineHeight: 1.8, color: '#DDD' }}>
              EXT. NEON STREET - NIGHT <br /><br />
              A rain-slicked cyberpunk alleyway. STEAM rises from vents. <br />
              A FIGURE in a trench coat walks away from camera.<br />
              Red neon lights reflect in the puddles.
            </p>
          </div>
          <div style={{ aspectRatio: '16/9', backgroundColor: '#000', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <video
              autoPlay loop muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              src="https://firebasestorage.googleapis.com/v0/b/motionx-studio.firebasestorage.app/o/Demo.mp4?alt=media&token=bd3499d7-b714-4b3d-9c78-8c2fe113abba"
            />
          </div>
        </div>
      </section>

      {/* 6. PRICING SECTION (NEW) */}
      <section className="section-padding" style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#FF0000', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>/// PRODUCTION ECONOMY</span>
        <h2 style={{ fontFamily: 'Anton', fontSize: '48px', textTransform: 'uppercase', lineHeight: 0.9 }}>Membership Access</h2>

        <div className="pricing-grid">
          <CompactPricingCard
            title="Starter"
            price="$20"
            features={["50 Images OR 16 Videos", "5 GB Cloud Storage", "Public Gallery"]}
          />
          <CompactPricingCard
            title="Pro"
            price="$40"
            features={["100 Images OR 34 Videos", "Commercial License", "Private Mode"]}
            isPopular={true}
          />
          <CompactPricingCard
            title="Agency"
            price="$80"
            features={["200 Images OR 67 Videos", "Turbo Queue", "3 Operator Seats"]}
          />
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="section-padding" style={{ borderTop: '1px solid #222', textAlign: 'center', backgroundColor: 'black' }}>
        <h2 style={{ fontFamily: 'Anton', fontSize: '32px', marginBottom: '20px', textTransform: 'uppercase' }}>Motion X</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '10px', fontFamily: 'monospace', color: '#666' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
            <span>PRIVACY POLICY</span>
            <span>TERMS OF SERVICE</span>
          </div>
          <span>© 2026 MOTIONX STUDIO.</span>
        </div>
      </footer>
    </main>
  );
}