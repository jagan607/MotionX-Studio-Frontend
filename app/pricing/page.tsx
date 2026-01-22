"use client";

import { useState, useCallback, useEffect } from "react";
import { usePayment } from "@/lib/payment";
import PricingCard from "@/app/components/PricingCard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { ArrowRight, MessageSquare, CheckCircle2 } from "lucide-react";
import { auth } from "@/lib/firebase";

// --- PRICING CONFIGURATION ---
const PRICING_MAP = {
    free: { USD: "$0", INR: "₹0" },
    starter: { USD: "$20", INR: "₹1,832" },
    pro: { USD: "$40", INR: "₹3,663" },
    agency: { USD: "$80", INR: "₹7,325" }
};

export default function PricingPage() {
    const { subscribe } = usePayment();
    const [loading, setLoading] = useState<string | null>(null);
    const [currency, setCurrency] = useState<"USD" | "INR">("USD");
    const router = useRouter();

    useEffect(() => {
        try {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (timeZone === "Asia/Kolkata" || timeZone === "IST") {
                setCurrency("INR");
            }
        } catch (e) {
            console.warn("Timezone check failed, defaulting to USD");
        }
    }, []);

    const terminalToast = (message: string, type: "success" | "error") => {
        toast(message, {
            icon: type === "success" ? "🟩" : "🟥",
            style: {
                borderRadius: "0px",
                background: "#000",
                color: type === "success" ? "#00FF00" : "#FF0000",
                border: `1px solid ${type === "success" ? "#00FF00" : "#FF0000"}`,
                fontFamily: "monospace",
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

        // Special handling for Free Tier
        if (plan === "free") {
            terminalToast("FREE TIER ACTIVATED", "success");
            setTimeout(() => router.push("/dashboard"), 1000);
            return;
        }

        setLoading(plan);

        subscribe({
            planType: plan,
            onSuccess: () => {
                setLoading(null);
                terminalToast(`SYSTEM UPDATE: ${plan.toUpperCase()} ACTIVATED`, "success");
                setTimeout(() => router.push("/dashboard"), 1500);
            },
            onError: (err) => {
                console.error("Subscription Failed:", err);
                setLoading(null);
                terminalToast("TRANSACTION FAILURE", "error");
            },
        });
    }, [subscribe, loading, router]);

    return (
        <div className="min-h-screen bg-[#050505] text-[#EDEDED] flex flex-col font-sans selection:bg-[#FF0000] selection:text-white">
            <Toaster position="bottom-right" />

            {/* --- HEADER --- */}
            <div className="flex justify-between items-end px-6 md:px-10 py-6 border-b border-[#1F1F1F] bg-[#030303] sticky top-0 z-50">
                <Link href="/dashboard" className="no-underline group">
                    <div>
                        <h1 className="font-anton text-2xl uppercase leading-none tracking-[1px] text-white group-hover:opacity-80 transition-opacity">
                            Motion X <span className="text-[#FF0000]">Studio</span>
                        </h1>
                        <p className="text-[9px] text-[#FF0000] tracking-[3px] font-bold mt-1.5 uppercase">
                            /// PRODUCTION_TERMINAL_V1
                        </p>
                    </div>
                </Link>
                <Link href="/dashboard">
                    <button className="bg-[#111] border border-[#333] text-[#EDEDED] px-5 py-2 text-[10px] font-bold tracking-[2px] hover:bg-[#222] hover:border-[#666] transition-all uppercase flex items-center gap-2">
                        Dashboard <ArrowRight size={14} className="text-[#666]" />
                    </button>
                </Link>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col items-center py-16 px-4 md:px-8 relative">
                <div className="text-center mb-16 max-w-3xl z-10">
                    <p className="text-[#FF0000] text-[10px] font-bold tracking-[3px] mb-4 uppercase animate-pulse">
                        /// STUDIO INFRASTRUCTURE
                    </p>
                    <h1 className="text-5xl md:text-7xl text-white mb-6 uppercase tracking-tight font-anton">
                        PRODUCTION CAPACITY
                    </h1>
                    <p className="text-[#666] text-xs tracking-[2px] uppercase leading-relaxed max-w-lg mx-auto">
                        Upgrade your terminal to unlock 4K rendering, private generation mode, and collaborative seats.
                    </p>
                </div>

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0 pointer-events-none" />

                {/* --- PRICING GRID (4 COLS) --- */}
                <div className="w-full max-w-[1400px] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start z-10">

                    {/* 1. FREE */}
                    <PricingCard
                        title="Free"
                        price={PRICING_MAP.free[currency]}
                        description="Evaluation Mode"
                        credits="30 CREDITS (ONE TIME)"
                        features={[
                            "200 MB Cloud Storage",
                            "1 Active Project",
                            "Public Gallery Showcase",
                            "Standard Queue"
                        ]}
                        notIncluded={["Recurring Credits", "Commercial License", "4K Upscaling", "Private Mode"]}
                        isLoading={false}
                        onClick={() => handleSubscribe("free")}
                        buttonText="INITIALIZE"
                    />

                    {/* 2. STARTER */}
                    <PricingCard
                        title="Starter"
                        price={PRICING_MAP.starter[currency]}
                        description="Entry Level"
                        credits="50 CREDITS / MO"
                        features={[
                            "50 Images OR 16 Videos",
                            "5 GB Cloud Storage",
                            "2 Active Projects",
                            "Public Gallery Showcase",
                            "Standard Queue"
                        ]}
                        notIncluded={["Commercial License", "4K Upscaling", "Private Mode"]}
                        isLoading={loading === "starter"}
                        onClick={() => handleSubscribe("starter")}
                    />

                    {/* 3. PRO */}
                    <PricingCard
                        title="Pro"
                        price={PRICING_MAP.pro[currency]}
                        description="Studio Standard"
                        credits="100 CREDITS / MO"
                        isPopular={true}
                        features={[
                            "100 Images OR 34 Videos",
                            "20 GB Cloud Storage",
                            "5 Active Projects",
                            "High Priority Queue",
                            "Private Mode Enabled",
                            "Commercial License",
                            "4K Upscaling Matrix"
                        ]}
                        isLoading={loading === "pro"}
                        onClick={() => handleSubscribe("pro")}
                    />

                    {/* 4. AGENCY */}
                    <PricingCard
                        title="Agency"
                        price={PRICING_MAP.agency[currency]}
                        description="Production House"
                        credits="200 CREDITS / MO"
                        features={[
                            "200 Images OR 67 Videos",
                            "40 GB Cloud Storage",
                            "9 Active Projects",
                            "Turbo Priority Queue",
                            "Private Mode Enabled",
                            "Commercial License",
                            "4K Native Resolution"
                        ]}
                        isLoading={loading === "agency"}
                        onClick={() => handleSubscribe("agency")}
                    />
                </div>

                {/* --- ENTERPRISE SECTION --- */}
                <div className="w-full max-w-[1400px] mt-12 z-10">
                    <div className="border border-[#333] bg-[#080808] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF0000] opacity-5 blur-[100px] rounded-full pointer-events-none group-hover:opacity-10 transition-opacity" />

                        <div className="text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-3xl md:text-4xl text-white font-anton uppercase">Enterprise</h2>
                                <span className="bg-[#111] border border-[#333] text-[#EDEDED] text-[9px] px-2 py-1 tracking-widest font-bold uppercase">Custom Solutions</span>
                            </div>
                            <p className="text-[#888] text-sm max-w-xl leading-relaxed">
                                Dedicated GPU clusters, custom AI model fine-tuning, API access, and unlimited seats for large-scale production houses.
                            </p>
                            <div className="flex gap-4 mt-4 text-[10px] text-[#666] font-mono uppercase tracking-wider">
                                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#FF0000]" /> SSO Integration</span>
                                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#FF0000]" /> SLA Support</span>
                                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#FF0000]" /> On-Premise</span>
                            </div>
                        </div>

                        <a
                            href="https://calendly.com/jagan-motionx/30min"
                            target="_blank"
                            rel="noreferrer"
                            className="whitespace-nowrap bg-[#EDEDED] text-black px-8 py-4 font-bold text-xs tracking-[2px] uppercase hover:bg-white hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <MessageSquare size={16} /> Contact Sales
                        </a>
                    </div>
                </div>

                <div className="mt-20 text-[#333] text-[10px] uppercase tracking-[2px] border-t border-[#111] pt-8 w-full max-w-6xl text-center flex justify-between z-10">
                    <span>System Status: Operational</span>
                    <span>SECURE PAYMENT GATEWAY: RAZORPAY ENCRYPTED</span>
                </div>
            </div>
        </div>
    );
}