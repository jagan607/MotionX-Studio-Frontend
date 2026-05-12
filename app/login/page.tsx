"use client";

import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowRight, Activity, Disc, Globe, ArrowLeft, AlertTriangle } from "@/lib/lucide";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "@/lib/config";

// --- FIRESTORE SYNC HELPER ---
// Returns true if the user is brand-new (first sign-in)
const syncUserToFirestore = async (user: any): Promise<boolean> => {
  if (!user) return false;
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // 10-day expiry for free credits
      const expireDate = new Date();
      expireDate.setDate(expireDate.getDate() + 10);

      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || "Operative",
        photoURL: user.photoURL || "",
        plan: "free",
        credits: 30,
        subscription_credits: 30,
        topup_credits: 0,
        credits_granted_at: serverTimestamp(),
        credits_expire_at: Timestamp.fromDate(expireDate),
        free_credits_expired: false,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        onboarding: {
          asset_manager_tour: false,
          dashboard_tour: false,
          episode_tour: false,
          playground_tour: false,
          series_tour: false,
          shot_card_tour: false,
          storyboard_tour: false,
          studio_tour: false,
        },
      });
      console.log("✅ New user foundational document created | UID:", user.uid);
      return true; // New user
    } else {
      await setDoc(userRef, { lastActiveAt: serverTimestamp() }, { merge: true });
      console.log("✅ Existing user lastActiveAt updated | UID:", user.uid);
      // Check if profile questionnaire was completed
      const hasProfile = !!userSnap.data()?.profile?.completed_at;
      return !hasProfile; // Needs onboarding if no profile
    }
  } catch (error: any) {
    console.error("❌ syncUserToFirestore FAILED:", error);
    toast.error(`User sync failed: ${error?.message || error}`, { duration: 10000 });
    throw error;
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRestrictedBrowser, setIsRestrictedBrowser] = useState(false);

  // Track if we're redirecting an already-authenticated user.
  // Initialized synchronously from auth.currentUser so the login UI
  // NEVER flashes — we show a loader from the very first render frame.
  const [isRedirecting, setIsRedirecting] = useState(() => !!auth.currentUser);

  // 1. DETECT IN-APP BROWSERS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || window.navigator.vendor;
    const isInApp = /(LinkedInApp|FBAV|FBAN|Instagram|Line|Twitter|Snapchat)/i.test(ua);
    setIsRestrictedBrowser(isInApp);
  }, []);

  // 1b. REDIRECT ALREADY-LOGGED-IN USERS
  // If someone manually navigates to /login while already authenticated,
  // send them to dashboard. The isLoading guard ensures this never fires
  // during an active login pipeline (syncUserToFirestore, user/init, etc.)
  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && !isLoading) {
      setIsRedirecting(true);
      router.push("/dashboard");
    }
  }, [isLoading, router]);

  // 2. GOOGLE LOGIN HANDLER
  const handleGoogleLogin = async () => {
    if (isRestrictedBrowser) return;
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const needsOnboarding = await syncUserToFirestore(user);
      const idToken = await user.getIdToken();

      // Initialize user on backend (welcome credits, welcome email)
      try {
        await fetch(`${API_BASE_URL}/api/v1/user/init`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        });
        console.log('✅ [user/init] Google login: success');
      } catch (e) { console.warn('[user/init] Google login:', e); }

      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        router.push(needsOnboarding ? "/onboarding" : "/dashboard");
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("[Login] Auth session failed:", response.status, errData);
        toast.error(errData.detail || "Login failed. Please try again.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Login failed", error);
      toast.error("Authentication failed");
      setIsLoading(false);
    }
  };

  const styles = {
    fadeIn: { animation: 'fadeSlideIn 0.3s ease-out' }
  };

  // If already authenticated, show a loader instead of flashing the login UI
  if (isRedirecting) {
    return (
      <div className="h-screen w-screen bg-[#111111] flex items-center justify-center">
        <Activity size={32} className="animate-spin text-[#D40A12]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-[#111111] text-[#EDEDED] font-sans overflow-hidden">

      {/* ── LEFT PANEL — hero (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-[1.5] relative bg-black border-r border-[#222] flex-col justify-between overflow-hidden">
        <Link href="/" className="absolute top-6 left-6 z-50 flex items-center gap-2 text-[#666] no-underline text-[11px] font-semibold tracking-[1px] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>

        <img
          src="https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=2940&auto=format&fit=crop"
          alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale contrast-[1.2]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black z-[1]" />

        {/* HUD top */}
        <div className="relative z-10 p-10 flex justify-between font-mono text-[10px] tracking-[2px] uppercase leading-relaxed">
          <div>
            <div className="flex items-center gap-2 text-white mb-1"><Disc size={10} fill="#D40A12" color="#D40A12" className="animate-pulse" /> MOTIONX STUDIO</div>
            <div className="text-[9px] text-[#555]">CINEMATIC AI PLATFORM</div>
          </div>
          <div className="text-right text-[#555]"><div>SECURE</div><div>ENCRYPTED</div></div>
        </div>

        {/* Viewfinder */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[120px] border border-white/10 z-[5]">
          <div className="absolute -top-[5px] left-1/2 h-[10px] w-px bg-white" />
          <div className="absolute -bottom-[5px] left-1/2 h-[10px] w-px bg-white" />
          <div className="absolute -left-[5px] top-1/2 w-[10px] h-px bg-white" />
          <div className="absolute -right-[5px] top-1/2 w-[10px] h-px bg-white" />
        </div>

        {/* Hero title */}
        <div className="relative z-10 p-[60px] font-['Anton'] text-[80px] leading-[0.9] uppercase text-white" style={{ textShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          Direct <br /> <span className="text-[#888]">The Impossible</span>
        </div>
      </div>

      {/* ── RIGHT PANEL — login form ── */}
      <div className="flex-1 flex items-center justify-center relative px-6 sm:px-10 py-10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0F0808 0%, #0C0C0C 40%, #0A0A12 100%)' }}
      >
        {/* Large ambient glow — top right (warm red) */}
        <div className="absolute top-[-30%] right-[-20%] w-[80%] h-[80%] rounded-full blur-[140px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(212,10,18,0.25) 0%, rgba(212,10,18,0.08) 50%, transparent 70%)' }}
        />
        {/* Secondary glow — bottom left (deep crimson) */}
        <div className="absolute bottom-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full blur-[120px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(180,20,20,0.15) 0%, transparent 60%)' }}
        />
        {/* Tertiary accent glow — center (subtle warm) */}
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 w-[50%] h-[40%] rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,120,50,0.06) 0%, transparent 60%)' }}
        />
        
        {/* Subtle dot grid */}
        <div className="absolute inset-0 z-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {/* Noise texture */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none z-0"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }}
        />

        {/* Mobile back link (visible only on small screens) */}
        <Link href="/" className="lg:hidden absolute top-6 left-6 z-50 flex items-center gap-2 text-white/40 no-underline text-[11px] font-semibold tracking-[1px] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="relative z-10 w-full max-w-[400px]">
          {/* Header */}
          <div className="mb-8 text-center">
            {/* Logo mark with strong glow */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 relative"
              style={{
                background: 'linear-gradient(135deg, #E8120A, #9B0000)',
                boxShadow: '0 12px 40px rgba(212,10,18,0.5), 0 0 60px rgba(212,10,18,0.15), 0 0 0 1px rgba(212,10,18,0.3)',
              }}
            >
              <span className="font-['Anton'] text-white text-2xl tracking-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>MX</span>
              <div className="absolute -inset-2 rounded-[20px] border border-[#D40A12]/30" style={{ animation: 'login-ring-pulse 3s ease-in-out infinite' }} />
              <div className="absolute -inset-4 rounded-[24px] border border-[#D40A12]/10" style={{ animation: 'login-ring-pulse 3s ease-in-out infinite 0.5s' }} />
            </div>
            
            <div className="text-[10px] font-bold tracking-[4px] text-[#D40A12] uppercase mb-3" style={{ textShadow: '0 0 20px rgba(212,10,18,0.3)' }}>Sign In</div>
            <h1 className="font-['Anton'] text-[40px] sm:text-[48px] uppercase leading-[0.92] mb-3 text-white">
              Welcome<br /><span className="text-white/30">Back</span>
            </h1>
            <p className="text-[13px] text-white/40 leading-relaxed">
              Enter your AI filmmaking studio.
            </p>
          </div>

          {/* Login Card — animated border */}
          <div className="relative rounded-2xl p-[1px] login-card-border">
            <div className="rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(20,10,10,0.9) 50%, rgba(15,8,8,0.95) 100%)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Red accent line at top */}
              <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #D40A12, transparent)' }} />
              
              <div className="p-7 sm:p-9">
                {/* Status row */}
                <div className="flex items-center justify-center gap-5 mb-7 text-[9px] font-mono uppercase tracking-[1.5px]">
                  {isRestrictedBrowser ? (
                    <span className="flex items-center gap-1.5 text-[#D40A12]"><span className="w-2 h-2 bg-[#D40A12] rounded-full animate-pulse" /> Alert</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-400/80"><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> Online</span>
                  )}
                  <span className="w-[1px] h-3.5 bg-white/[0.1]" />
                  <span className="flex items-center gap-1.5 text-emerald-400/80"><span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> Encrypted</span>
                </div>

                {isRestrictedBrowser ? (
                  <div className="w-full p-5 bg-[#D40A12]/[0.08] border border-[#D40A12]/30 text-[#D40A12] text-[11px] leading-relaxed tracking-[1px] uppercase flex flex-col gap-2.5 items-center text-center rounded-xl">
                    <div className="flex items-center gap-2 text-xs font-bold"><AlertTriangle size={16} /> ACCESS RESTRICTED</div>
                    <div>IN-APP BROWSER DETECTED.</div>
                    <div>Please tap <strong>...</strong> and select <strong>Open in Browser</strong>.</div>
                  </div>
                ) : (
                  <div key="standard" style={styles.fadeIn}>
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                      className="w-full py-[18px] sm:py-5 rounded-xl text-[12px] font-bold tracking-[2px] uppercase flex items-center justify-center gap-3 transition-all duration-300 cursor-pointer border-none disabled:opacity-70 group"
                      style={{
                        backgroundColor: isHovered ? '#D40A12' : '#FFFFFF',
                        color: isHovered ? '#FFF' : '#111',
                        boxShadow: isHovered 
                          ? '0 0 40px rgba(212,10,18,0.5), 0 8px 30px rgba(212,10,18,0.3)' 
                          : '0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                        transform: isHovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                      }}
                    >
                      {isLoading ? (
                        <><Activity size={16} className="animate-spin" /> Signing In...</>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill={isHovered ? "#fff" : "#4285F4"}/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={isHovered ? "#fff" : "#34A853"}/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill={isHovered ? "#fff" : "#FBBC05"}/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={isHovered ? "#fff" : "#EA4335"}/>
                          </svg>
                          Continue with Google <ArrowRight size={16} strokeWidth={2.5} className="transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="text-center mt-5 text-[9px] text-white/25 tracking-[1.5px] uppercase font-medium">
                  Secured by Google Identity
                </div>
              </div>
            </div>
          </div>

          {/* Feature pills — with accent color */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-7">
            {[
              { label: 'Script to Film', color: '#D40A12' },
              { label: 'AI Cinematography', color: '#D4A843' },
              { label: 'Voice Direction', color: '#A855F7' },
            ].map((f) => (
              <div key={f.label} className="px-3.5 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-[1px] transition-all hover:scale-105"
                style={{
                  border: `1px solid ${f.color}25`,
                  background: `${f.color}08`,
                  color: `${f.color}99`,
                }}
              >
                {f.label}
              </div>
            ))}
          </div>

          {/* Footer with subtle branding */}
          <div className="mt-8 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[9px] text-white/20 uppercase tracking-[1.5px] font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D40A12]/60 shadow-[0_0_6px_rgba(212,10,18,0.3)]" />
              v2.0
            </div>
            <div className="text-[9px] text-white/20 uppercase tracking-[1.5px] font-mono flex items-center gap-1.5">
              <Globe size={10} /> Global
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .animate-pulse { animation: pulse 2s infinite; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes login-ring-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes login-border-rotate {
          0% { --login-angle: 0deg; }
          100% { --login-angle: 360deg; }
        }
        .login-card-border {
          background: linear-gradient(135deg, rgba(212,10,18,0.3), rgba(255,255,255,0.06), rgba(212,10,18,0.15), rgba(255,255,255,0.04));
          background-size: 300% 300%;
          animation: login-border-shimmer 6s ease infinite;
        }
        @keyframes login-border-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}