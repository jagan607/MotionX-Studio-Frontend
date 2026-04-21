"use client";

import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowRight, Activity, Disc, Globe, ArrowLeft, AlertTriangle } from "lucide-react";
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
        credits_granted_at: serverTimestamp(),
        credits_expire_at: Timestamp.fromDate(expireDate),
        free_credits_expired: false,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
        onboarding: {
          asset_manager_tour: false,
          dashboard_tour: false,
          episode_tour: false,
          series_tour: false,
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
    fadeIn: { animation: 'fadeSlideIn 0.3s ease-out' }
  };

  // If already authenticated, show a loader instead of flashing the login UI
  if (isRedirecting) {
    return (
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center">
        <Activity size={32} className="animate-spin text-[#E50914]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-[#050505] text-[#EDEDED] font-sans overflow-hidden">

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
            <div className="flex items-center gap-2 text-white mb-1"><Disc size={10} fill="#E50914" color="#E50914" className="animate-pulse" /> MOTIONX STUDIO</div>
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
      <div className="flex-1 flex items-center justify-center relative bg-[#050505] px-6 sm:px-10 py-10">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-50 z-0"
          style={{ backgroundImage: 'linear-gradient(#111 1px, transparent 1px), linear-gradient(90deg, #111 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        {/* Mobile back link (visible only on small screens) */}
        <Link href="/" className="lg:hidden absolute top-6 left-6 z-50 flex items-center gap-2 text-[#666] no-underline text-[11px] font-semibold tracking-[1px] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back
        </Link>

        <div className="relative z-10 w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-10">
            <div className="bg-[#E50914] text-white font-['Anton'] py-1 px-2.5 text-sm inline-block mb-4 rounded">MX</div>
            <div className="text-[11px] font-semibold tracking-[2px] text-[#555] mb-2.5">SIGN IN</div>
            <h1 className="font-['Anton'] text-[36px] sm:text-[42px] uppercase mb-2.5 leading-none">Welcome Back</h1>
            <p className="text-[13px] text-[#666] leading-relaxed">Sign in to your MotionX Studio account.</p>
          </div>

          {/* Card */}
          <div className="border border-white/[0.08] bg-[#0A0A0A] p-[5px] rounded-xl">
            <div className="border border-white/[0.06] p-6 sm:p-[30px] bg-[#080808] rounded-[10px]">
              {/* Status row */}
              <div className="flex gap-4 mb-6 text-[9px] font-mono text-[#555] uppercase">
                {isRestrictedBrowser ? (
                  <span className="flex items-center text-[#E50914]"><span className="w-1.5 h-1.5 bg-[#E50914] rounded-full inline-block mr-1.5" /> SECURITY ALERT</span>
                ) : (
                  <span className="flex items-center"><span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full inline-block mr-1.5" /> SYSTEM ONLINE</span>
                )}
                <span className="flex items-center"><span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full inline-block mr-1.5" /> ENCRYPTED</span>
              </div>

              {isRestrictedBrowser ? (
                <div className="w-full p-5 bg-[#E50914]/[0.06] border border-[#E50914]/30 text-[#E50914] text-[11px] leading-relaxed tracking-[1px] uppercase flex flex-col gap-2.5 items-center text-center rounded-lg">
                  <div className="flex items-center gap-2 text-xs font-bold"><AlertTriangle size={16} /> ACCESS RESTRICTED</div>
                  <div>IN-APP BROWSER DETECTED.</div>
                  <div>Please tap <strong>...</strong> and select <strong>Open in Browser</strong>.</div>
                </div>
              ) : (
                /* ════════ B2C LOGIN VIEW ════════ */
                <div key="standard" style={styles.fadeIn}>
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className="w-full py-4 sm:py-[18px] rounded-lg text-xs font-bold tracking-[2px] uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer border-none disabled:opacity-70"
                    style={{
                      backgroundColor: isHovered ? '#E50914' : '#FFF',
                      color: isHovered ? '#FFF' : '#000',
                      boxShadow: isHovered ? '0 0 25px rgba(229,9,20,0.35)' : 'none'
                    }}
                  >
                    {isLoading ? <><Activity size={16} className="animate-spin" /> SIGNING IN...</> : <> CONTINUE WITH GOOGLE <ArrowRight size={16} strokeWidth={3} /></>}
                  </button>
                </div>
              )}
              <div className="text-center mt-4 text-[9px] text-[#444] tracking-[1px]">SECURED BY GOOGLE IDENTITY</div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-7 flex justify-between text-[9px] text-[#444] uppercase tracking-[1px]">
            <div className="flex gap-1.5 items-center">ID: 884-291</div>
            <div className="flex gap-1.5 items-center"><Globe size={10} /> REGION: GLOBAL</div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .animate-pulse { animation: pulse 2s infinite; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } } @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}