"use client";

import { useState, useCallback } from "react";
import { usePayment } from "@/lib/payment";
import PricingCard from "@/app/components/PricingCard";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function PricingPage() {
    const { subscribe } = usePayment();
    const [loading, setLoading] = useState<string | null>(null);
    const router = useRouter();

    // Custom Toast Style for Terminal Look
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

    const handleSubscribe = useCallback((plan: "starter" | "pro" | "agency") => {
        if (loading) return; // Prevent double clicks

        // 1. Guest Check (Redirect to Login if not authenticated)
        if (!auth.currentUser) {
            terminalToast("AUTHENTICATION REQUIRED", "error");
            setTimeout(() => router.push("/login"), 1000);
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

            {/* --- CUSTOM HEADER --- */}
            <div className="flex justify-between items-end px-6 md:px-10 py-6 border-b border-[#1F1F1F] bg-[#030303] sticky top-0 z-50">

                {/* LEFT: BRAND LOGO (Matches GlobalHeader) */}
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

                {/* RIGHT: DASHBOARD CTA */}
                <Link href="/dashboard">
                    <button className="bg-[#111] border border-[#333] text-[#EDEDED] px-5 py-2 text-[10px] font-bold tracking-[2px] hover:bg-[#222] hover:border-[#666] transition-all uppercase flex items-center gap-2">
                        Dashboard <ArrowRight size={14} className="text-[#666]" />
                    </button>
                </Link>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col items-center py-16 px-4 md:px-8 relative">

                {/* HEADLINES */}
                <div className="text-center mb-16 max-w-3xl z-10">
                    <p className="text-[#FF0000] text-[10px] font-bold tracking-[3px] mb-4 uppercase animate-pulse">
                        /// STUDIO INFRASTRUCTURE
                    </p>
                    {/* Main Title */}
                    <h1 className="text-5xl md:text-7xl text-white mb-6 uppercase tracking-tight font-anton">
                        PRODUCTION CAPACITY
                    </h1>
                    <p className="text-[#666] text-xs tracking-[2px] uppercase leading-relaxed max-w-lg mx-auto">
                        Upgrade your terminal to unlock 4K rendering, private generation mode, and collaborative seats.
                    </p>
                </div>

                {/* Background Grid Line Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] z-0 pointer-events-none" />

                {/* PRICING GRID */}
                <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start z-10">

                    {/* 1. STARTER */}
                    <PricingCard
                        title="Starter"
                        price="$20"
                        description="Entry Level"
                        credits="50 CREDITS"
                        features={[
                            "50 Images OR 16 Videos",
                            "5 GB Cloud Storage",
                            "2 Active Projects",
                            "1 Operator Seat",
                            "Standard Queue",
                            "Public Gallery"
                        ]}
                        notIncluded={["Commercial License", "4K Upscaling", "Private Mode"]}
                        isLoading={loading === "starter"}
                        onClick={() => handleSubscribe("starter")}
                    />

                    {/* 2. PRO (Popular) */}
                    <PricingCard
                        title="Pro"
                        price="$40"
                        description="Studio Standard"
                        credits="100 CREDITS"
                        isPopular={true}
                        features={[
                            "100 Images OR 34 Videos",
                            "20 GB Cloud Storage",
                            "5 Active Projects",
                            "1 Operator Seat",
                            "High Priority Queue",
                            "Private Mode Enabled",
                            "Commercial License",
                            "4K Upscaling Matrix"
                        ]}
                        isLoading={loading === "pro"}
                        onClick={() => handleSubscribe("pro")}
                    />

                    {/* 3. AGENCY */}
                    <PricingCard
                        title="Agency"
                        price="$80"
                        description="Production House"
                        credits="200 CREDITS"
                        features={[
                            "200 Images OR 67 Videos",
                            "40 GB Cloud Storage",
                            "9 Active Projects",
                            "3 Operator Seats",
                            "Turbo Priority Queue",
                            "Private Mode Enabled",
                            "Commercial License",
                            "4K Native Resolution"
                        ]}
                        isLoading={loading === "agency"}
                        onClick={() => handleSubscribe("agency")}
                    />
                </div>

                {/* FOOTER NOTE */}
                <div className="mt-20 text-[#333] text-[10px] uppercase tracking-[2px] border-t border-[#111] pt-8 w-full max-w-6xl text-center flex justify-between z-10">
                    <span>System Status: Operational</span>
                    <span>SECURE PAYMENT GATEWAY: RAZORPAY ENCRYPTED</span>
                </div>

            </div>
        </div>
    );
}