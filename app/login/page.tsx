"use client";

import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowRight, Activity, Disc, Globe, ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRestrictedBrowser, setIsRestrictedBrowser] = useState(false);

  // 1. DETECT IN-APP BROWSERS (LINKEDIN, INSTAGRAM, ETC)
  useEffect(() => {
    // Safety check for server-side rendering
    if (typeof window === 'undefined') return;

    const ua = window.navigator.userAgent || window.navigator.vendor;

    // Regex to detect common In-App Browsers (IAB) that block Google Auth
    // FBAN/FBAV = Facebook, Instagram = Instagram, LinkedInApp = LinkedIn, Line = Line
    const isInApp = /(LinkedInApp|FBAV|FBAN|Instagram|Line|Twitter|Snapchat)/i.test(ua);

    setIsRestrictedBrowser(isInApp);
  }, []);

  const handleGoogleLogin = async () => {
    if (isRestrictedBrowser) return; // Prevent click if restricted

    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
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
      router.push("/dashboard");
    } catch (error) {
      console.error("Login failed", error);
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
    logoMark: { backgroundColor: '#FF0000', color: 'black', fontFamily: 'Anton', padding: '4px 8px', fontSize: '14px', display: 'inline-block', marginBottom: '15px' },
    h1: { fontFamily: 'Anton', fontSize: '42px', textTransform: 'uppercase' as const, marginBottom: '10px', lineHeight: 1 },
    p: { fontSize: '13px', color: '#666', lineHeight: '1.5' },
    card: { border: '1px solid #222', backgroundColor: '#0A0A0A', padding: '5px' },
    cardInner: { border: '1px solid #222', padding: '30px', backgroundColor: '#080808' },
    statusRow: { display: 'flex', gap: '15px', marginBottom: '25px', fontSize: '9px', fontFamily: 'monospace', color: '#555', textTransform: 'uppercase' as const },
    dot: { width: '6px', height: '6px', backgroundColor: '#00FF41', borderRadius: '50%', display: 'inline-block', marginRight: '6px' },
    // ERROR DOT STYLE
    errorDot: { width: '6px', height: '6px', backgroundColor: '#FF0000', borderRadius: '50%', display: 'inline-block', marginRight: '6px' },

    btn: { width: '100%', padding: '18px', backgroundColor: isHovered ? '#FF0000' : '#FFF', color: isHovered ? '#FFF' : '#000', border: 'none', fontFamily: 'Inter, sans-serif', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s ease', boxShadow: isHovered ? '0 0 20px rgba(255,0,0,0.4)' : 'none' },

    // ERROR BOX STYLE
    errorBox: { width: '100%', padding: '20px', backgroundColor: '#1a0505', border: '1px solid #FF0000', color: '#FF0000', fontFamily: 'monospace', fontSize: '10px', lineHeight: '1.6', letterSpacing: '1px', textTransform: 'uppercase' as const, display: 'flex', flexDirection: 'column' as const, gap: '10px', alignItems: 'center', textAlign: 'center' as const },

    footer: { marginTop: '30px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'monospace', color: '#444', textTransform: 'uppercase' as const },
    backBtn: {
      position: 'absolute' as const, top: '30px', left: '30px', zIndex: 50,
      display: 'flex', alignItems: 'center', gap: '8px',
      color: '#666', textDecoration: 'none', fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px',
      transition: 'color 0.2s'
    }
  };

  return (
    <div style={styles.container}>

      {/* LEFT PANEL */}
      <div style={styles.leftPanel}>
        <Link href="/" style={styles.backBtn}>
          <ArrowLeft size={14} /> ABORT / BACK TO HOME
        </Link>

        <img src="https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2940&auto=format&fit=crop" style={styles.bgImage} />
        <div style={styles.overlay} />
        <div style={{ padding: '40px', ...styles.hudText, display: 'flex', justifyContent: 'space-between' }}>
          <div><div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFF', marginBottom: '5px' }}><Disc size={12} fill="#FF0000" color="#FF0000" className="animate-pulse" /> REC [00:04:12:09]</div><div>CAM: ARRI ALEXA 65</div></div>
          <div style={{ textAlign: 'right' }}><div>ISO 800</div><div>WB 5600K</div></div>
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '120px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 5 }}>
          <div style={{ position: 'absolute', top: '-5px', left: '50%', height: '10px', width: '1px', background: 'white' }} />
          <div style={{ position: 'absolute', bottom: '-5px', left: '50%', height: '10px', width: '1px', background: 'white' }} />
          <div style={{ position: 'absolute', left: '-5px', top: '50%', width: '10px', height: '1px', background: 'white' }} />
          <div style={{ position: 'absolute', right: '-5px', top: '50%', width: '10px', height: '1px', background: 'white' }} />
        </div>
        <div style={styles.heroTitle}>Direct <br /> <span style={{ color: '#888' }}>The Impossible</span></div>
      </div>

      {/* RIGHT PANEL */}
      <div style={styles.rightPanel}>
        <div style={styles.gridBg} />
        <div style={styles.loginBox}>
          <div style={styles.header}>
            <div style={styles.logoMark}>MX</div>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '3px', color: '#555', marginBottom: '10px' }}>SECURE ACCESS V1.0</div>
            <h1 style={styles.h1}>Welcome Back</h1>
            <p style={styles.p}>Authenticate to access the production mainframe.</p>
          </div>
          <div style={styles.card}>
            <div style={styles.cardInner}>

              {/* DYNAMIC STATUS ROW */}
              <div style={styles.statusRow}>
                {isRestrictedBrowser ? (
                  <span style={{ display: 'flex', alignItems: 'center', color: '#FF0000' }}><span style={styles.errorDot} /> SECURITY ALERT</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center' }}><span style={styles.dot} /> SYSTEM ONLINE</span>
                )}
                <span style={{ display: 'flex', alignItems: 'center' }}><span style={styles.dot} /> ENCRYPTED</span>
              </div>

              {/* TOGGLE BETWEEN BUTTON AND ERROR MESSAGE */}
              {isRestrictedBrowser ? (
                <div style={styles.errorBox}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                    <AlertTriangle size={16} /> ACCESS RESTRICTED
                  </div>
                  <div>EMBEDDED VIEWER DETECTED.</div>
                  <div>PROTOCOL: TAP <strong>...</strong> AND SELECT <strong>OPEN IN SYSTEM BROWSER</strong>.</div>
                </div>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  style={{ ...styles.btn, opacity: isLoading ? 0.7 : 1 }}
                >
                  {isLoading ?
                    <> <Activity size={16} className="animate-spin" /> AUTHENTICATING... </>
                    :
                    <> INITIALIZE SESSION <ArrowRight size={16} strokeWidth={3} /> </>
                  }
                </button>
              )}

              <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '9px', fontFamily: 'monospace', color: '#444' }}>SECURED BY GOOGLE IDENTITY</div>
            </div>
          </div>
          <div style={styles.footer}><div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>ID: 884-291</div><div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}><Globe size={10} /> REGION: GLOBAL</div></div>
        </div>
      </div>
      <style jsx global>{` @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } } .animate-pulse { animation: pulse 2s infinite; } .animate-spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } } `}</style>
    </div>
  );
}