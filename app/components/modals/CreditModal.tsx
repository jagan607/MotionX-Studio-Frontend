"use client";

import { useEffect, useState } from "react";
import { X, Zap, ShieldCheck } from "lucide-react";
import { TopUpCard } from "../TopUpCard";
import { usePayment, getUserCurrency } from "@/lib/payment"; // Import helper
import { useCredits } from "@/hooks/useCredits";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

// --- CREDIT PACKAGES CONFIG ---
const PACKAGES = [
    { id: "topup_micro", title: "Micro Refill", credits: 10, bonus: 0, usd: "$5", inr: "₹450" },
    { id: "topup_mini", title: "Mini Pack", credits: 22, bonus: 0, usd: "$10", inr: "₹900" },
    { id: "topup_standard", title: "Standard Pack", credits: 50, bonus: 5, usd: "$20", inr: "₹1,800", label: "POPULAR" },
    { id: "topup_pro", title: "Pro Bundle", credits: 100, bonus: 20, usd: "$40", inr: "₹3,500", label: "SAVER" },
    { id: "topup_studio", title: "Studio Vault", credits: 200, bonus: 60, usd: "$80", inr: "₹7,000", label: "BEST VALUE", isBestValue: true },
];

interface CreditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CreditModal({ isOpen, onClose }: CreditModalProps) {
    const { buyCredits, loading } = usePayment();
    const { credits } = useCredits();

    // Initialize with USD to match server render, update in useEffect
    const [currency, setCurrency] = useState<"USD" | "INR">("USD");
    const [loadingId, setLoadingId] = useState<string | null>(null);

    // Auto-detect Currency on Client Side
    useEffect(() => {
        setCurrency(getUserCurrency());
    }, []);

    // Lock Scroll
    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "unset";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    const handleBuy = (pkg: any) => {
        if (loading) return;
        setLoadingId(pkg.id);

        buyCredits({
            packageId: pkg.id,
            currency: currency, // Pass the detected currency
            onSuccess: () => {
                toast.success(`Successfully added ${pkg.credits + pkg.bonus} credits!`, {
                    style: { background: '#333', color: '#fff', border: '1px solid #00FF41' }
                });
                setLoadingId(null);
                onClose();
            },
            onError: (err: any) => {
                if (err !== "Cancelled") {
                    toast.error("Transaction Failed");
                }
                setLoadingId(null);
            }
        });
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-5xl bg-[#050505] border border-[#222] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-[#1F1F1F] bg-[#0A0A0A]">
                        <div>
                            <h2 className="text-2xl font-anton uppercase text-white tracking-wide flex items-center gap-3">
                                <Zap className="text-[#FF0000]" fill="currentColor" size={24} /> Top Up Credits
                            </h2>
                            <div className="flex items-center gap-4 mt-2">
                                <p className="text-[#666] text-xs font-mono uppercase tracking-wider">
                                    Current Balance: <span className="text-white font-bold">{credits ?? '---'}</span>
                                </p>
                                <div className="h-3 w-[1px] bg-[#333]" />
                                <p className="text-[#666] text-xs font-mono uppercase tracking-wider">
                                    Currency: <span className="text-[#00FF41]">{currency}</span>
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#222] rounded-full transition-colors text-[#666] hover:text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-[#0A0A0A] to-[#050505]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {PACKAGES.map((pkg) => (
                                <TopUpCard
                                    key={pkg.id}
                                    id={pkg.id}
                                    title={pkg.title}
                                    credits={pkg.credits}
                                    bonus={pkg.bonus}
                                    price={currency === "USD" ? pkg.usd : pkg.inr}
                                    label={pkg.label}
                                    isLoading={loadingId === pkg.id}
                                    isBestValue={pkg.isBestValue}
                                    onClick={() => handleBuy(pkg)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#1F1F1F] bg-[#080808] flex justify-between items-center text-[10px] uppercase tracking-wider text-[#444]">
                        <span className="flex items-center gap-2">
                            <ShieldCheck size={12} /> Secure Payment via Razorpay
                        </span>
                        <span>One-Time Purchase • Non-Recurring</span>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}