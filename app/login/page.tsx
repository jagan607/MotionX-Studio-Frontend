"use client";

import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, SAMLAuthProvider, OAuthProvider, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ArrowRight, Activity, Disc, Globe, ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRestrictedBrowser, setIsRestrictedBrowser] = useState(false);

  // SSO Toggle State
  const [isSSOView, setIsSSOView] = useState(false);
  const [ssoInput, setSsoInput] = useState("");
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoPayload, setSsoPayload] = useState<{ type: 'email' | 'workspace_slug'; value: string } | null>(null);

  // Home Realm Discovery
  const [hrdInput, setHrdInput] = useState("");
  const [isResolving, setIsResolving] = useState(false);

  // 1. DETECT IN-APP BROWSERS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || window.navigator.vendor;
    const isInApp = /(LinkedInApp|FBAV|FBAN|Instagram|Line|Twitter|Snapchat)/i.test(ua);
    setIsRestrictedBrowser(isInApp);
  }, []);

  // 2. HANDLE SSO REDIRECT CALLBACK
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setIsLoading(true);

          const idToken = await result.user.getIdToken();
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          if (response.ok) {
            router.push("/dashboard");
          } else {
            toast.error("Session creation failed during SSO.");
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error("SSO Redirect Callback Failed:", error);
        toast.error("Failed to authenticate with your organization.");
        setIsLoading(false);
      }
    };

    handleRedirectResult();
  }, [router]);

  const handleGoogleLogin = async () => {
    if (isRestrictedBrowser) return;
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid, email: user.email, displayName: user.displayName,
          photoURL: user.photoURL, credits: 10, plan: "free", createdAt: serverTimestamp()
        });
      }
      const idToken = await user.getIdToken();
      const response = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (response.ok) {
        router.push("/dashboard");
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

  // SSO Continue Handler — resolves provider and redirects
  const handleSSOContinue = async () => {
    const trimmed = ssoInput.trim();
    if (!trimmed) {
      toast.error("Please enter your email or workspace slug");
      return;
    }

    // Parse input as email or workspace slug
    const payload = trimmed.includes("@")
      ? { type: "email" as const, value: trimmed }
      : { type: "workspace_slug" as const, value: trimmed };
    setSsoPayload(payload);
    setSsoLoading(true);

    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/auth/resolve-sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: payload.value }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        // FastAPI 422 returns detail as an array of objects; extract the message safely
        const message = Array.isArray(errData?.detail)
          ? errData.detail.map((e: any) => e.msg).join(", ")
          : typeof errData?.detail === "string"
            ? errData.detail
            : "Organization not found. Please check your input.";
        toast.error(message);
        setSsoLoading(false);
        return;
      }

      const data = await res.json();
      const { provider_id, tenant_id } = data;

      // 2. CRITICAL: Set tenant before provider instantiation
      auth.tenantId = tenant_id;

      // 3. Dynamically instantiate the correct provider
      let provider;
      if (provider_id.startsWith("saml.")) {
        provider = new SAMLAuthProvider(provider_id);
      } else if (provider_id.startsWith("oidc.")) {
        provider = new OAuthProvider(provider_id);
      } else if (provider_id === "google.com") {
        provider = new GoogleAuthProvider();
      } else {
        console.error("Unsupported SSO provider format:", provider_id);
        toast.error("Invalid workspace configuration. Contact your admin.");
        setSsoLoading(false);
        return;
      }

      // 4. Sign in — use popup for Google, redirect for SAML/OIDC
      if (provider_id === "google.com") {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          const idToken = await result.user.getIdToken();
          const loginRes = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
          if (loginRes.ok) {
            router.push("/dashboard");
          } else {
            toast.error("Session creation failed.");
            setSsoLoading(false);
          }
        }
      } else {
        await signInWithRedirect(auth, provider);
      }
    } catch (error) {
      console.error("SSO redirect failed:", error);
      toast.error("SSO authentication failed. Please try again.");
      setSsoLoading(false);
    }
  };

  // ── Home Realm Discovery: resolve tenant → auto-route ──
  const handleHRDResolve = async () => {
    const identifier = hrdInput.trim();
    if (!identifier) { toast.error("Please enter your email or workspace slug"); return; }
    setIsResolving(true);
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/auth/resolve-tenant?identifier=${encodeURIComponent(identifier)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const message = typeof errData?.detail === "string" ? errData.detail : "Workspace not found. Please check your email or slug.";
        toast.error(message);
        setIsResolving(false);
        return;
      }
      const data = await res.json();
      const ssoProvider = (data.sso_provider || "").toLowerCase();

      // If response includes tenant_id, set it on auth
      if (data.tenant_id) { auth.tenantId = data.tenant_id; }

      // Auto-route to the correct provider
      let provider;
      if (ssoProvider === "google" || ssoProvider === "google.com") {
        provider = new GoogleAuthProvider();
      } else if (ssoProvider === "microsoft" || ssoProvider === "microsoft.com") {
        provider = new OAuthProvider('microsoft.com');
        provider.setCustomParameters({ prompt: 'select_account' });
      } else if (ssoProvider === "okta" || ssoProvider.startsWith("oidc.")) {
        provider = new OAuthProvider(ssoProvider.startsWith("oidc.") ? ssoProvider : 'oidc.okta');
      } else if (ssoProvider.startsWith("saml.")) {
        provider = new SAMLAuthProvider(ssoProvider);
      } else {
        toast.error(`Unsupported provider: ${ssoProvider}. Contact your admin.`);
        setIsResolving(false);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid, email: user.email, displayName: user.displayName,
          photoURL: user.photoURL, credits: 10, plan: "free", createdAt: serverTimestamp()
        });
      }
      const idToken = await user.getIdToken();
      const loginRes = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (loginRes.ok) { router.push("/dashboard"); }
      else { toast.error("Session creation failed."); setIsResolving(false); }
    } catch (error: any) {
      console.error("HRD resolve/login failed:", error);
      if (error?.code === 'auth/operation-not-allowed') {
        toast.error("SSO configuration pending for this provider. Contact your admin.");
      } else {
        toast.error("Authentication failed. Please try again.");
      }
      setIsResolving(false);
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
    backBtn: { position: 'absolute' as const, top: '30px', left: '30px', zIndex: 50, display: 'flex', alignItems: 'center', gap: '8px', color: '#666', textDecoration: 'none', fontSize: '11px', fontFamily: 'Inter', fontWeight: 600, letterSpacing: '1px', transition: 'color 0.2s' },
    // SSO styles
    ssoToggle: { width: '100%', padding: '12px', backgroundColor: 'transparent', border: 'none', color: '#666', fontFamily: 'Inter, sans-serif', fontSize: '10px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' as const, cursor: 'pointer', textAlign: 'center' as const, marginTop: '12px', transition: 'color 0.2s ease' },
    ssoInput: { width: '100%', padding: '16px 18px', backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', color: '#EDEDED', fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none', marginBottom: '12px', transition: 'border-color 0.2s ease', boxSizing: 'border-box' as const },
    fadeIn: { animation: 'fadeSlideIn 0.3s ease-out' }
  };

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
              ) : isSSOView ? (
                /* ════════ ORGANIZATION LOGIN VIEW ════════ */
                <div key="sso" style={styles.fadeIn} className="space-y-3">
                  {/* HRD Form */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={hrdInput}
                      onChange={(e) => setHrdInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleHRDResolve()}
                      placeholder="name@company.com or workspace slug"
                      disabled={isResolving}
                      className="w-full px-4 py-3.5 bg-[#111] border border-[#333] rounded-lg text-[13px] text-white font-sans placeholder-[#555] outline-none focus:border-[#E50914] transition-colors disabled:opacity-60"
                      autoFocus
                    />
                    <button
                      onClick={handleHRDResolve}
                      disabled={isResolving || isLoading}
                      onMouseEnter={() => setIsHovered(true)}
                      onMouseLeave={() => setIsHovered(false)}
                      className="w-full py-4 rounded-lg text-[11px] font-bold tracking-[2px] uppercase flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-white/10 disabled:opacity-60"
                      style={{
                        backgroundColor: isHovered && !isResolving ? '#E50914' : '#FFF',
                        color: isHovered && !isResolving ? '#FFF' : '#000',
                        boxShadow: isHovered && !isResolving ? '0 0 25px rgba(229,9,20,0.35)' : 'none'
                      }}
                    >
                      {isResolving ? (
                        <><Activity size={14} className="animate-spin" /> Locating Workspace...</>
                      ) : (
                        <><ArrowRight size={14} strokeWidth={3} /> Continue</>
                      )}
                    </button>
                  </div>

                  {/* Back link */}
                  <button onClick={() => { setIsSSOView(false); setHrdInput(''); }} className="w-full pt-2 text-center text-[9px] font-semibold tracking-[1.5px] uppercase text-[#555] hover:text-white transition-colors cursor-pointer bg-transparent border-none">
                    ← Back to standard login
                  </button>
                </div>
              ) : (
                /* ════════ DEFAULT B2C LOGIN VIEW ════════ */
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
                  <button onClick={() => setIsSSOView(true)} style={styles.ssoToggle}>
                    Organization Login →
                  </button>
                </div>
              )}
              <div className="text-center mt-4 text-[9px] text-[#444] tracking-[1px]">{isSSOView ? 'ENTERPRISE SINGLE SIGN-ON' : 'SECURED BY GOOGLE IDENTITY'}</div>
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