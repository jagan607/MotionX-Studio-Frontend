"use client";

import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowRight, Activity, Disc, Globe, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
// [NEW] Import toast for feedback
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRestrictedBrowser, setIsRestrictedBrowser] = useState(false);

  // 1. DETECT IN-APP BROWSERS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || window.navigator.vendor;
    const isInApp = /(LinkedInApp|FBAV|FBAN|Instagram|Line|Twitter|Snapchat)/i.test(ua);
    setIsRestrictedBrowser(isInApp);
  }, []);

  const handleGoogleLogin = async () => {
    if (isRestrictedBrowser) return;

    setIsLoading(true);
    try {
      // 1. Firebase Client Login
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // 2. [EXISTING] Create User Doc if missing
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          credits: 10,
          plan: "free",
          createdAt: serverTimestamp()
        });
      }

      // 3. [NEW] Set Server Session Cookie
      // We get the ID token from Firebase Client and send it to our Next.js Server
      const idToken = await user.getIdToken();

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (response.ok) {
        // 4. Redirect only after cookie is set
        router.push("/dashboard");
      } else {
        console.error("Session creation failed");
        toast.error("Login failed. Please try again.");
        setIsLoading(false);
      }

    } catch (error) {
      console.error("Login failed", error);
      toast.error("Authentication failed");
      setIsLoading(false);
    }
  };

  const styles = {
    container: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#050505', color: '#EDEDED', fontFamily: 'Inter, sans-serif', overflow: 'hidden' },
    leftPanel: { flex: '1.5', position: 'relative' as const, backgroundColor: '#000', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', overflow: 'hidden' },
    bgImage: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' as const, opacity: 0.6, filter: 'grayscale(100%) contrast(120%)', zIndex: 0 },
    overlay: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to bottom, rgba(0,0,0,0.2), #000)', zIndex: 1 },
    hudText: { zIndex: 10, fontFamily: 'monospace', fontSize: '10px', letterSpacing: '2px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' as const, lineHeight: '1.6' },
    heroTitle: { zIndex: 10, padding: '60px', fontFamily: 'Anton, sans-serif', fontSize: '80px', lineHeight: '0.9', textTransform: 'uppercase' as const, color: '#FFF', textShadow: '0 10px 30px rgba(0,0,0,0.8)' },
    rightPanel: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const, backgroundColor: '#050505', padding: '40px' },
    gridBg: { position: 'absolute' as const, inset: 0, backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.5, zIndex: 0 },
    loginBox: { position: 'relative' as const, zIndex: 10, width: '100%', maxWidth: '420px' },
    header: { marginBottom: '40px' },
    logoMark: { backgroundColor: '#E50914', color: 'white', fontFamily: 'Anton', padding: '4px 10px', fontSize: '14px', display: 'inline-block', marginBottom: '15px', borderRadius: '4px' },
    h1: { fontFamily: 'Anton', fontSize: '42px', textTransform: 'uppercase' as const, marginBottom: '10px', lineHeight: 1 },
    p: { fontSize: '13px', color: '#666', lineHeight: '1.5' },
    card: { border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0A0A0A', padding: '5px', borderRadius: '12px' },
    cardInner: { border: '1px solid rgba(255,255,255,0.06)', padding: '30px', backgroundColor: '#080808', borderRadius: '10px' },
    statusRow: { display: 'flex', gap: '15px', marginBottom: '25px', fontSize: '9px', fontFamily: 'monospace', color: '#555', textTransform: 'uppercase' as const },
    dot: { width: '6px', height: '6px', backgroundColor: '#00FF41', borderRadius: '50%', display: 'inline-block', marginRight: '6px' },
    errorDot: { width: '6px', height: '6px', backgroundColor: '#E50914', borderRadius: '50%', display: 'inline-block', marginRight: '6px' },
    btn: { width: '100%', padding: '18px', backgroundColor: isHovered ? '#E50914' : '#FFF', color: isHovered ? '#FFF' : '#000', border: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.3s ease', boxShadow: isHovered ? '0 0 25px rgba(229,9,20,0.35)' : 'none', borderRadius: '8px' },
    errorBox: { width: '100%', padding: '20px', backgroundColor: 'rgba(229, 9, 20, 0.06)', border: '1px solid rgba(229, 9, 20, 0.3)', color: '#E50914', fontFamily: 'Inter', fontSize: '11px', lineHeight: '1.6', letterSpacing: '1px', textTransform: 'uppercase' as const, display: 'flex', flexDirection: 'column' as const, gap: '10px', alignItems: 'center', textAlign: 'center' as const, borderRadius: '8px' },
    footer: { marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Inter', color: '#444', textTransform: 'uppercase' as const, letterSpacing: '1px' },
    backBtn: { position: 'absolute' as const, top: '30px', left: '30px', zIndex: 50, display: 'flex', alignItems: 'center', gap: '8px', color: '#666', textDecoration: 'none', fontSize: '11px', fontFamily: 'Inter', fontWeight: 600, letterSpacing: '1px', transition: 'color 0.2s' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftPanel}>
        <Link href="/" style={styles.backBtn}><ArrowLeft size={14} /> Back</Link>
        <img src="https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2940&auto=format&fit=crop" style={styles.bgImage} />
        <div style={styles.overlay} />
        <div style={{ padding: '40px', ...styles.hudText, display: 'flex', justifyContent: 'space-between' }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF', marginBottom: '5px' }}><Disc size={10} fill="#E50914" color="#E50914" className="animate-pulse" /> MOTIONX STUDIO</div><div style={{ fontSize: '9px', color: '#555' }}>CINEMATIC AI PLATFORM</div></div>
          <div style={{ textAlign: 'right', color: '#555' }}><div>SECURE</div><div>ENCRYPTED</div></div>
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '120px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 5 }}>
          <div style={{ position: 'absolute', top: '-5px', left: '50%', height: '10px', width: '1px', background: 'white' }} />
          <div style={{ position: 'absolute', bottom: '-5px', left: '50%', height: '10px', width: '1px', background: 'white' }} />
          <div style={{ position: 'absolute', left: '-5px', top: '50%', width: '10px', height: '1px', background: 'white' }} />
          <div style={{ position: 'absolute', right: '-5px', top: '50%', width: '10px', height: '1px', background: 'white' }} />
        </div>
        <div style={styles.heroTitle}>Direct <br /> <span style={{ color: '#888' }}>The Impossible</span></div>
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.gridBg} />
        <div style={styles.loginBox}>
          <div style={styles.header}>
            <div style={styles.logoMark}>MX</div>
            <div style={{ fontSize: '11px', fontFamily: 'Inter', letterSpacing: '2px', color: '#555', marginBottom: '10px', fontWeight: 600 }}>SIGN IN</div>
            <h1 style={styles.h1}>Welcome Back</h1>
            <p style={styles.p}>Sign in to your MotionX Studio account.</p>
          </div>
          <div style={styles.card}>
            <div style={styles.cardInner}>
              <div style={styles.statusRow}>
                {isRestrictedBrowser ? (
                  <span style={{ display: 'flex', alignItems: 'center', color: '#E50914' }}><span style={styles.errorDot} /> SECURITY ALERT</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center' }}><span style={styles.dot} /> SYSTEM ONLINE</span>
                )}
                <span style={{ display: 'flex', alignItems: 'center' }}><span style={styles.dot} /> ENCRYPTED</span>
              </div>

              {isRestrictedBrowser ? (
                <div style={styles.errorBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}><AlertTriangle size={16} /> ACCESS RESTRICTED</div>
                  <div>IN-APP BROWSER DETECTED.</div>
                  <div>Please tap <strong>...</strong> and select <strong>Open in Browser</strong>.</div>
                </div>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  style={{ ...styles.btn, opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ? <><Activity size={16} className="animate-spin" /> SIGNING IN...</> : <> CONTINUE WITH GOOGLE <ArrowRight size={16} strokeWidth={3} /> </>}
                </button>
              )}
              <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '9px', fontFamily: 'Inter', color: '#444', letterSpacing: '1px' }}>SECURED BY GOOGLE IDENTITY</div>
            </div>
          </div>
          <div style={styles.footer}><div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>ID: 884-291</div><div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}><Globe size={10} /> REGION: GLOBAL</div></div>
        </div>
      </div>
      <style jsx global>{` @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } } .animate-pulse { animation: pulse 2s infinite; } .animate-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}