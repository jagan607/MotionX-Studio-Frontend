"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import PricingCard from "@/app/components/PricingCard"; // Check if path is correct for your project
import { motion, AnimatePresence } from "framer-motion";

// --- CONSTANTS ---
const PRICING_MAP = {
    free: { USD: "$0", INR: "₹0" },
    starter: { USD: "$20", INR: "₹1,832" },
    pro: { USD: "$40", INR: "₹3,663" },
    agency: { USD: "$80", INR: "₹7,325" }
};

interface CreditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreditModal({ isOpen, onClose }: CreditModalProps) {
    // --- LOCAL STATE FOR PRICING INTERACTION ---
    const [currency, setCurrency] = useState<"USD" | "INR">("USD");
    const [loading, setLoading] = useState<string | null>(null);

    const handleSubscribe = async (plan: string) => {
        setLoading(plan);
        console.log(`Processing subscription for: ${plan}`);

        // TODO: Call your payment provider (Stripe/Razorpay) here
        // await createCheckoutSession(plan);

        setTimeout(() => setLoading(null), 2000); // Mock delay
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    // Increased max-width to fit the pricing grid
                    className="relative bg-[#0f0f0f] border border-[#222] rounded-2xl w-full max-w-[90vw] xl:max-w-[1400px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[#222] bg-[#141414] shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/10 rounded-full">
                                <AlertCircle className="text-red-500" size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-wide">INSUFFICIENT CREDITS</h2>
                                <p className="text-xs text-gray-500 font-mono">CHOOSE A PLAN TO RECHARGE & CONTINUE</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Currency Toggle (Optional) */}
                            <div className="hidden md:flex bg-black border border-[#333] rounded-lg p-1">
                                <button
                                    onClick={() => setCurrency("USD")}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${currency === "USD" ? "bg-[#333] text-white" : "text-gray-500"}`}
                                >
                                    USD
                                </button>
                                <button
                                    onClick={() => setCurrency("INR")}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${currency === "INR" ? "bg-[#333] text-white" : "text-gray-500"}`}
                                >
                                    INR
                                </button>
                            </div>

                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-[#222] rounded-full text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content (Scrollable Grid) */}
                    <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#0f0f0f] to-[#050505]">

                        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
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
                                buttonText="CURRENT PLAN"
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

                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}