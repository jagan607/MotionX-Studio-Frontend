"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { signOut, updateProfile } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCredits } from "@/hooks/useCredits";
import Link from "next/link";
import {
    User, CreditCard, Settings, Zap,
    LogOut, CheckCircle2, AlertTriangle, ChevronRight, Loader2
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// --- MOCK PLAN DATA (Replace with real DB data later) ---
const PLAN_LIMITS = {
    free: 10,
    starter: 50,
    pro: 100,
    agency: 200
};

export default function ProfilePage() {
    const router = useRouter();
    const { credits } = useCredits(); // Real-time credits from your hook
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"subscription" | "settings">("subscription");
    const [loading, setLoading] = useState(true);

    // Settings Form State
    const [displayName, setDisplayName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // 1. Fetch User Data
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            if (u) {
                setUser(u);
                setDisplayName(u.displayName || "");
                setLoading(false);
            } else {
                router.push("/login");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // 2. Calculate Usage Stats
    // In production, fetch 'planType' from Firestore user doc to determine maxCredits
    const maxCredits = PLAN_LIMITS.pro;
    const usagePercent = Math.min(100, ((credits || 0) / maxCredits) * 100);

    // 3. Handle Actions
    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateProfile(user, { displayName: displayName });
            toast.success("OPERATOR ID UPDATED");
        } catch (error) {
            console.error(error);
            toast.error("UPDATE FAILED");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center text-[#444]">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    // --- STYLES ---
    const styles = {
        container: {
            minHeight: '100vh',
            backgroundColor: '#030303',
            color: '#EDEDED',
            fontFamily: 'Inter, sans-serif',
            padding: '40px 20px',
        },
        contentWrapper: {
            maxWidth: '1000px',
            margin: '0 auto',
        },
        // Header
        headerTitle: { fontFamily: 'Anton, sans-serif', fontSize: '48px', textTransform: 'uppercase' as const, lineHeight: 1 },
        headerSub: { fontFamily: 'monospace', color: '#666', fontSize: '12px', letterSpacing: '2px' },

        // Tabs
        tabContainer: { display: 'flex', gap: '2px', marginTop: '40px', borderBottom: '1px solid #222' },
        tabBtn: (isActive: boolean) => ({
            padding: '12px 24px',
            backgroundColor: isActive ? '#111' : 'transparent',
            color: isActive ? '#FFF' : '#666',
            border: 'none',
            borderTop: isActive ? '2px solid #FF0000' : '2px solid transparent',
            fontFamily: 'monospace',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
        }),

        // Cards
        card: {
            backgroundColor: '#0A0A0A',
            border: '1px solid #222',
            padding: '30px',
            marginTop: '30px',
            position: 'relative' as const
        },
        sectionTitle: { fontFamily: 'Anton', fontSize: '24px', textTransform: 'uppercase' as const, marginBottom: '20px' },

        // Inputs
        inputGroup: { marginBottom: '20px' },
        label: { display: 'block', fontFamily: 'monospace', fontSize: '10px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' as const },
        input: {
            width: '100%',
            backgroundColor: '#050505',
            border: '1px solid #333',
            padding: '12px',
            color: 'white',
            fontFamily: 'monospace',
            fontSize: '14px',
            outline: 'none'
        },
        saveBtn: {
            backgroundColor: '#FFF', color: '#000',
            padding: '12px 24px', border: 'none',
            fontWeight: 'bold' as const, cursor: 'pointer',
            marginTop: '10px', fontSize: '12px',
            display: 'flex', alignItems: 'center', gap: '8px'
        },

        // Credits Bar
        progressBarBg: { width: '100%', height: '8px', backgroundColor: '#222', marginTop: '15px', borderRadius: '4px', overflow: 'hidden' },
        progressBarFill: { width: `${usagePercent}%`, height: '100%', backgroundColor: credits && credits < 10 ? '#FF0000' : '#00FF41', transition: 'width 1s ease' }
    };

    return (
        <main style={styles.container}>
            <Toaster position="bottom-right" toastOptions={{ style: { background: '#111', color: '#FFF', borderRadius: '0', border: '1px solid #333', fontFamily: 'monospace' } }} />

            <div style={styles.contentWrapper}>
                {/* HEADER */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 style={styles.headerTitle}>Operator Profile</h1>
                        <p style={styles.headerSub}>ID: {user?.uid}</p>
                    </div>
                    <div className="flex items-center gap-6">
                        {/* QUICK EXIT BUTTON */}
                        <button
                            onClick={handleLogout}
                            className="text-xs font-mono text-gray-500 hover:text-[#FF0000] flex items-center gap-2 transition-colors"
                        >
                            <LogOut size={14} /> EXIT
                        </button>

                        <div className="h-4 w-[1px] bg-[#333]"></div>

                        <Link href="/dashboard" className="text-xs font-mono text-gray-500 hover:text-white flex items-center gap-2 transition-colors">
                            <ChevronRight size={14} /> RETURN TO TERMINAL
                        </Link>
                    </div>
                </div>

                {/* TABS */}
                <div style={styles.tabContainer}>
                    <button
                        onClick={() => setActiveTab("subscription")}
                        style={styles.tabBtn(activeTab === "subscription")}
                    >
                        <CreditCard size={14} /> SUBSCRIPTION & TOKENS
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        style={styles.tabBtn(activeTab === "settings")}
                    >
                        <Settings size={14} /> SYSTEM SETTINGS
                    </button>
                </div>

                {/* --- TAB 1: SUBSCRIPTION --- */}
                {activeTab === "subscription" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                        {/* PLAN STATUS */}
                        <div style={styles.card}>
                            <div className="absolute top-0 right-0 bg-[#111] px-3 py-1 border-l border-b border-[#333]">
                                <span className="text-[10px] text-[#00FF41] font-mono flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse" /> ACTIVE
                                </span>
                            </div>

                            <h2 style={styles.sectionTitle}>Current Plan</h2>
                            <p className="text-4xl font-mono font-bold text-white mb-2">PRO LICENSE</p>
                            <p className="text-xs text-gray-500 font-mono mb-8">RENEWS ON FEB 20, 2026</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {["Access to Flux Models", "Private Generation Mode", "Commercial License", "Priority Queue"].map((feat, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm text-gray-300 font-mono">
                                        <CheckCircle2 size={14} className="text-[#FF0000]" /> {feat}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CREDITS USAGE */}
                        <div style={styles.card}>
                            <div className="flex justify-between items-end mb-4">
                                <div>
                                    <h2 style={styles.sectionTitle} className="flex items-center gap-3">
                                        <Zap size={20} className="text-[#FF0000]" /> Token Usage
                                    </h2>
                                    <p className="text-xs text-gray-500 font-mono">AVAILABLE COMPUTE UNITS</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-mono font-bold">{credits} / {maxCredits}</p>
                                    <Link href="/pricing" className="text-[10px] text-[#FF0000] underline hover:text-white transition-colors">
                                        + PURCHASE TOP-UP
                                    </Link>
                                </div>
                            </div>

                            {/* PROGRESS BAR */}
                            <div style={styles.progressBarBg}>
                                <div style={styles.progressBarFill} />
                            </div>

                            {credits !== null && credits < 20 && (
                                <div className="mt-4 flex items-center gap-3 bg-[#110505] border border-[#330000] p-3">
                                    <AlertTriangle size={16} className="text-[#FF0000]" />
                                    <p className="text-xs text-[#FF8888] font-mono">
                                        CRITICAL: LOW TOKEN BALANCE. GENERATION MAY BE PAUSED.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- TAB 2: SETTINGS --- */}
                {activeTab === "settings" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div style={styles.card}>
                            <h2 style={styles.sectionTitle}>Operator Identity</h2>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>DISPLAY NAME</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    style={styles.input}
                                    placeholder="ENTER CALLSIGN"
                                />
                            </div>

                            <div style={styles.inputGroup}>
                                <label style={styles.label}>EMAIL ADDRESS (LOCKED)</label>
                                <input
                                    type="text"
                                    value={user?.email || ""}
                                    disabled
                                    style={{ ...styles.input, opacity: 0.5, cursor: 'not-allowed' }}
                                />
                            </div>

                            <button onClick={handleUpdateProfile} disabled={isSaving} style={styles.saveBtn}>
                                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <User size={14} />}
                                {isSaving ? "SAVING..." : "UPDATE IDENTITY"}
                            </button>
                        </div>

                        <div style={{ ...styles.card, borderColor: '#330000' }}>
                            <h2 style={{ ...styles.sectionTitle, color: '#FF0000' }}>Danger Zone</h2>
                            <p className="text-xs text-gray-500 font-mono mb-4">
                                TERMINATING YOUR SESSION WILL REQUIRE RE-AUTHENTICATION.
                            </p>
                            <button
                                onClick={handleLogout}
                                className="border border-[#330000] text-[#FF0000] px-4 py-3 text-xs font-bold font-mono hover:bg-[#330000] transition-colors flex items-center gap-2"
                            >
                                <LogOut size={14} /> TERMINATE SESSION
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}