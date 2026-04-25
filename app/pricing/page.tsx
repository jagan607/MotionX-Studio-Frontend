"use client";

import { useState, useCallback, useEffect } from "react";
import { usePayment, getUserCurrency } from "@/lib/payment";
import PricingCard from "@/app/components/PricingCard";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { ArrowRight, MessageSquare, CheckCircle2, ChevronDown, Film, Image as ImageIcon, Mic, Sparkles } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// --- PRICING CONFIGURATION ---
const PRICING_MAP = {
    free: { USD: "$0", INR: "₹0" },
    starter: { USD: "$20", INR: "₹1,832" },
    pro: { USD: "$40", INR: "₹3,663" },
    agency: { USD: "$80", INR: "₹7,325" }
};

// --- FAQ DATA ---
const FAQ_ITEMS = [
    { q: "Can I cancel anytime?", a: "Yes, cancel anytime from your profile. Your credits remain active until the end of your billing period." },
    { q: "Do credits roll over?", a: "No, monthly subscription credits do not roll over. Your credit balance resets to your plan's allotted amount at the beginning of each billing cycle. (However, any separate 'Top-Up' credits you purchase will remain in your account until used)." },
    { q: "What happens when I run out of credits?", a: "You can buy additional credit packs anytime from the Top Up button. Your projects and content remain accessible — only generation requires credits." },
    { q: "Can I use the content commercially?", a: "Commercial license is included with Pro and Agency plans. Free and Starter plan content is for personal use only." },
    { q: "What's the difference between Standard and Turbo queue?", a: "Standard queue processes in order. Pro gets High Priority (faster starts), and Agency gets Turbo Priority (dedicated capacity, 2-3x faster)." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border-b border-white/[0.06] last:border-b-0">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 px-1 text-left cursor-pointer bg-transparent border-none">
                <span className="text-[13px] font-semibold text-white/90">{q}</span>
                <ChevronDown size={16} className={`text-[#555] transition-transform duration-300 shrink-0 ml-4 ${open ? 'rotate-180' : ''}`} />
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 pb-5' : 'max-h-0'}`}>
                <p className="text-[12px] text-[#888] leading-relaxed px-1">{a}</p>
            </div>
        </div>
    );
}

export default function PricingPage() {
    const { subscribe } = usePayment();
    const [loading, setLoading] = useState<string | null>(null);
    const [currency, setCurrency] = useState<"USD" | "INR">("USD");
    const [currentPlan, setCurrentPlan] = useState<string>("free");
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromTopUp = searchParams.get("from") === "topup";

    // 1. DETECT CURRENCY & FETCH USER PLAN
    useEffect(() => {
        setCurrency(getUserCurrency());

        const fetchUserPlan = async () => {
            if (!auth.currentUser) return;
            try {
                const userRef = doc(db, "users", auth.currentUser.uid);
                const snap = await getDoc(userRef);
                if (snap.exists() && snap.data().plan) {
                    setCurrentPlan(snap.data().plan);
                }
            } catch (error) {
                console.error("Failed to fetch user plan", error);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchUserPlan();
        });
        return () => unsubscribe();
    }, []);

    const terminalToast = (message: string, type: "success" | "error") => {
        toast(message, {
            icon: type === "success" ? "✓" : "✕",
            style: {
                borderRadius: "8px",
                background: "#0A0A0A",
                color: type === "success" ? "#00FF00" : "#E50914",
                border: `1px solid ${type === "success" ? "rgba(0,255,0,0.2)" : "rgba(229,9,20,0.3)"}`,
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
            },
        });
    };

    const handleSubscribe = useCallback((plan: "free" | "starter" | "pro" | "agency") => {
        if (loading) return;

        if (!auth.currentUser) {
            terminalToast("AUTHENTICATION REQUIRED", "error");
            setTimeout(() => router.push("/login"), 1000);
            return;
        }

        if (plan === "free") {
            // Usually downgrading to free involves canceling subscription via portal, 
            // but for now we just show visual feedback.
            return;
        }

        setLoading(plan);

        subscribe({
            planType: plan,
            currency: currency,
            onSuccess: () => {
                setLoading(null);
                setCurrentPlan(plan);
                terminalToast(`SYSTEM UPDATE: ${plan.toUpperCase()} ACTIVATED`, "success");
                // If user came here from the top-up flow, redirect back and open top-up modal
                const destination = fromTopUp
                    ? "/dashboard?openTopUp=true"
                    : "/dashboard";
                setTimeout(() => router.push(destination), 1500);
            },
            onError: (err: any) => {
                console.error("Subscription Failed:", err);
                setLoading(null);
                terminalToast("TRANSACTION FAILURE", "error");
            },
        });
    }, [subscribe, loading, router, currency, fromTopUp]);

    return (
        <div className="min-h-screen bg-[#050505] text-[#EDEDED] flex flex-col font-sans selection:bg-[#E50914] selection:text-white">
            <Toaster position="bottom-right" />

            {/* --- HEADER --- */}
            <div className="flex justify-between items-end px-6 md:px-10 py-6 border-b border-white/[0.06] bg-[#030303]/85 backdrop-blur-xl sticky top-0 z-50">
                <Link href="/dashboard" className="no-underline group">
                    <div>
                        <h1 className="font-anton text-2xl uppercase leading-none tracking-[0.5px] text-white group-hover:opacity-80 transition-opacity">
                            Motion X <span className="text-[#E50914]">Studio</span>
                        </h1>
                        <p className="text-[9px] text-[#999] tracking-[3px] font-bold mt-1.5 uppercase">
                            Plans & Pricing
                        </p>
                    </div>
                </Link>
                <Link href="/dashboard">
                    <button className="bg-[#111] border border-[#222] text-[#EDEDED] px-5 py-2 text-[10px] font-bold tracking-[2px] hover:bg-[#1A1A1A] hover:border-[#444] transition-all uppercase flex items-center gap-2 rounded-md">
                        Dashboard <ArrowRight size={14} className="text-[#666]" />
                    </button>
                </Link>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col items-center py-16 px-4 md:px-8 relative">
                {/* ... (Title Section) ... */}
                <div className="text-center mb-16 max-w-3xl z-10">
                    <p className="text-[#E50914] text-[10px] font-semibold tracking-[3px] mb-4 uppercase">
                        PLANS & PRICING
                    </p>
                    <h1 className="text-5xl md:text-7xl text-white mb-6 uppercase tracking-tight font-anton">
                        Choose Your Plan
                    </h1>
                </div>

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0 pointer-events-none" />

                {/* --- PRICING GRID --- */}
                <div className="w-full max-w-[1400px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start z-10">

                    <PricingCard
                        title="Free"
                        price={PRICING_MAP.free[currency]}
                        description="Evaluation Mode"
                        credits="30 CREDITS (ONE TIME)"
                        features={["200 MB Cloud Storage", "1 Active Project", "Public Gallery Showcase", "Standard Queue"]}
                        notIncluded={["Recurring Credits", "Commercial License", "4K Upscaling", "Private Mode"]}
                        isLoading={false}
                        onClick={() => handleSubscribe("free")}
                        isActive={currentPlan === "free"} // <--- PASSING ACTIVE STATE
                        buttonText="DOWNGRADE"
                    />

                    <PricingCard
                        title="Starter"
                        price={PRICING_MAP.starter[currency]}
                        description="Entry Level"
                        credits="50 CREDITS / MO"
                        features={["50 Images OR 16 Videos", "5 GB Cloud Storage", "2 Active Projects", "Public Gallery Showcase", "Standard Queue"]}
                        notIncluded={["Commercial License", "4K Upscaling", "Private Mode"]}
                        isLoading={loading === "starter"}
                        onClick={() => handleSubscribe("starter")}
                        isActive={currentPlan === "starter"} // <--- PASSING ACTIVE STATE
                        buttonText="UPGRADE"
                    />

                    <PricingCard
                        title="Pro"
                        price={PRICING_MAP.pro[currency]}
                        description="Studio Standard"
                        credits="100 CREDITS / MO"
                        isPopular={true}
                        features={["100 Images OR 34 Videos", "20 GB Cloud Storage", "5 Active Projects", "High Priority Queue", "Private Mode Enabled", "Commercial License", "4K Upscaling Matrix"]}
                        isLoading={loading === "pro"}
                        onClick={() => handleSubscribe("pro")}
                        isActive={currentPlan === "pro"} // <--- PASSING ACTIVE STATE
                        buttonText="UPGRADE"
                    />

                    <PricingCard
                        title="Agency"
                        price={PRICING_MAP.agency[currency]}
                        description="Production House"
                        credits="200 CREDITS / MO"
                        features={["200 Images OR 67 Videos", "40 GB Cloud Storage", "9 Active Projects", "Turbo Priority Queue", "Private Mode Enabled", "Commercial License", "4K Native Resolution"]}
                        isLoading={loading === "agency"}
                        onClick={() => handleSubscribe("agency")}
                        isActive={currentPlan === "agency"} // <--- PASSING ACTIVE STATE
                        buttonText="UPGRADE"
                    />
                </div>

                {/* ═══ WHAT 100 CREDITS GETS YOU ═══ */}
                <div className="w-full max-w-[1400px] mt-16 z-10">
                    <div className="text-center mb-10">
                        <p className="text-[#E50914] text-[9px] font-semibold tracking-[3px] mb-3 uppercase">Credit Value</p>
                        <h2 className="text-3xl md:text-4xl text-white font-anton uppercase tracking-tight">What 100 Credits Gets You</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: <Film size={20} />, count: "~33", label: "AI Videos", sub: "10s cinematic clips", color: "#E50914" },
                            { icon: <ImageIcon size={20} />, count: "~100", label: "AI Images", sub: "Storyboard frames", color: "#3B82F6" },
                            { icon: <Mic size={20} />, count: "~50", label: "Voiceovers", sub: "AI voice generation", color: "#8B5CF6" },
                            { icon: <Sparkles size={20} />, count: "~20", label: "Lip Syncs", sub: "Video lip sync", color: "#F59E0B" },
                        ].map((item, i) => (
                            <div key={i} className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6 text-center hover:border-white/10 hover:bg-[#0D0D0D] transition-all group">
                                <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: `${item.color}10`, color: item.color }}>
                                    {item.icon}
                                </div>
                                <div className="text-3xl font-bold text-white font-mono mb-1">{item.count}</div>
                                <div className="text-[11px] font-semibold text-white/80 uppercase tracking-wider mb-1">{item.label}</div>
                                <div className="text-[9px] text-[#555] uppercase tracking-widest">{item.sub}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ═══ FAQ ═══ */}
                <div className="w-full max-w-[700px] mt-20 z-10">
                    <div className="text-center mb-8">
                        <p className="text-[#E50914] text-[9px] font-semibold tracking-[3px] mb-3 uppercase">FAQ</p>
                        <h2 className="text-3xl text-white font-anton uppercase tracking-tight">Common Questions</h2>
                    </div>
                    <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl px-6">
                        {FAQ_ITEMS.map((item, i) => (<FAQItem key={i} q={item.q} a={item.a} />))}
                    </div>
                </div>

                {/* ═══ TRUST BAR ═══ */}
                <div className="w-full max-w-[1400px] mt-16 z-10">
                    <div className="flex items-center justify-center gap-1 mb-6">
                        <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-r from-transparent to-white/10" />
                        <span className="text-[8px] text-[#444] uppercase tracking-[3px] font-semibold px-4">Powered By</span>
                        <div className="h-[1px] flex-1 max-w-[100px] bg-gradient-to-l from-transparent to-white/10" />
                    </div>
                    <div className="flex items-center justify-center gap-8 md:gap-12 flex-wrap">
                        {["Seedance 2.0", "Kling v3", "ElevenLabs", "Gemini 2.5", "Sync Labs", "Flux"].map((name) => (
                            <span key={name} className="text-[11px] font-mono text-[#444] uppercase tracking-wider hover:text-[#666] transition-colors">{name}</span>
                        ))}
                    </div>
                </div>

                {/* --- ENTERPRISE CARD --- */}
                <div className="w-full max-w-[1400px] mt-12 z-10">
                    <div className="border border-[#222] bg-[#080808] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group rounded-lg">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50914] opacity-5 blur-[100px] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity" />
                        <div className="text-left">
                            <h2 className="text-3xl md:text-4xl text-white font-anton uppercase mb-2">Enterprise</h2>
                            <p className="text-[#888] text-sm max-w-xl">Dedicated GPU clusters, custom AI model fine-tuning, and API access.</p>
                        </div>
                        <a href="https://calendly.com/jagan-motionx/30min" target="_blank" rel="noreferrer" className="bg-[#EDEDED] text-black px-8 py-4 font-bold text-xs tracking-[2px] uppercase hover:bg-white transition-all flex items-center gap-2 rounded-md">
                            <MessageSquare size={16} /> Contact Sales
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}