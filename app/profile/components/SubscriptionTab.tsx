"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Zap, AlertTriangle, LayoutGrid, HardDrive, Users, TrendingUp, Settings, XCircle, Loader2, CalendarClock } from "lucide-react";
import { usePayment } from "@/lib/payment";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import CancelConfirmModal from "@/app/components/modals/CancelConfirmModal";
import CreditModal from "@/app/components/modals/CreditModal"; // <--- 1. IMPORT CREDIT MODAL

// --- PLAN CONFIGURATION ---
interface PlanDetails {
    name: string;
    credits: number;
    limits: { projects: number; storage: string; seats: number };
    features: string[];
}

const PLAN_CONFIG: Record<string, PlanDetails> = {
    free: {
        name: "Free Tier",
        credits: 50,
        limits: { projects: 1, storage: "1 GB", seats: 1 },
        features: ["Standard Queue", "Public Generation", "720p Export"]
    },
    starter: {
        name: "Starter Tier",
        credits: 50,
        limits: { projects: 2, storage: "5 GB", seats: 1 },
        features: ["Standard Queue", "Public Gallery", "1080p Export"]
    },
    pro: {
        name: "Pro Tier",
        credits: 100,
        limits: { projects: 5, storage: "20 GB", seats: 1 },
        features: ["High Priority Queue", "Private Mode", "Commercial License", "4K Upscaling"]
    },
    agency: {
        name: "Agency Tier",
        credits: 200,
        limits: { projects: 9, storage: "40 GB", seats: 3 },
        features: ["Turbo Queue", "Private Mode", "Commercial License", "4K Native"]
    }
};

interface SubscriptionTabProps {
    plan: string;
    credits: number | null;
}

export default function SubscriptionTab({ plan, credits }: SubscriptionTabProps) {
    const router = useRouter();
    const { cancelSubscription, loading } = usePayment();

    // --- STATE ---
    const [isCancelling, setIsCancelling] = useState(false);
    const [subDetails, setSubDetails] = useState<any>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false); // <--- 2. TOP UP MODAL STATE

    // 1. Fetch Subscription Details on Mount
    useEffect(() => {
        const fetchSubDetails = async () => {
            if (!auth.currentUser) return;
            try {
                const subRef = doc(db, "users", auth.currentUser.uid, "subscription", "current");
                const snap = await getDoc(subRef);
                if (snap.exists()) {
                    setSubDetails(snap.data());
                }
            } catch (e) {
                console.error("Failed to fetch sub details", e);
            }
        };
        fetchSubDetails();
    }, []);

    // 2. Resolve Plan Data
    const currentPlanKey = (plan || "free").toLowerCase();
    const planData = PLAN_CONFIG[currentPlanKey] || PLAN_CONFIG.free;
    const maxCredits = planData.credits;
    const isPaidPlan = currentPlanKey !== "free";

    // Check if cancellation is scheduled
    const isScheduledForCancellation = subDetails?.cancel_at_period_end === true;

    // Format Date Helper
    const formatDate = (timestamp: any) => {
        if (!timestamp) return "End of Cycle";
        const date = new Date(timestamp.seconds ? timestamp.seconds * 1000 : timestamp * 1000);
        return date.toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' });
    };

    // 3. Token Bar Logic
    const currentCredits = credits ?? 0;

    // Logic: Bar represents AVAILABLE balance, not used.
    // e.g. 46/50 = 92% Available.
    const percentageAvailable = maxCredits > 0 ? (currentCredits / maxCredits) * 100 : 0;
    const visualPercent = Math.min(100, percentageAvailable); // Cap visual bar at 100%

    const isSurplus = currentCredits > maxCredits;
    const isLowBalance = currentCredits <= 10 && !isSurplus;

    let barColor = '#00FF41';
    let statusText = "SYSTEM OPERATIONAL";
    let statusIcon = <CheckCircle2 size={14} className="text-[#00FF41]" />;
    let statusColor = "#444";

    if (isSurplus) {
        barColor = '#00FF41';
        statusText = "SURPLUS BALANCE ACTIVE";
        statusIcon = <TrendingUp size={14} className="text-[#00FF41]" />;
        statusColor = "#00FF41";
    } else if (isLowBalance) {
        barColor = '#E50914';
        statusText = "CRITICAL: LOW TOKEN BALANCE";
        statusIcon = <AlertTriangle size={14} className="text-[#E50914]" />;
        statusColor = "#FF8888";
    }

    // --- HANDLERS ---

    const handleCancelClick = () => {
        setShowCancelModal(true);
    };

    const executeCancellation = () => {
        setIsCancelling(true);
        cancelSubscription({
            onSuccess: () => {
                toast.success("AUTO-RENEWAL CANCELLED");
                setIsCancelling(false);
                setShowCancelModal(false);
                window.location.reload();
            },
            onError: (err: string) => {
                toast.error("CANCELLATION FAILED: " + err);
                setIsCancelling(false);
                setShowCancelModal(false);
            }
        });
    };

    // --- STYLES ---
    const styles = {
        card: {
            backgroundColor: '#0A0A0A',
            border: '1px solid #222',
            padding: '24px',
            marginTop: '20px',
            position: 'relative' as const
        },
        sectionTitle: {
            fontFamily: 'Anton, sans-serif',
            fontSize: '20px',
            textTransform: 'uppercase' as const,
            color: '#EDEDED',
            marginBottom: '0'
        },
        progressBarBg: {
            width: '100%',
            height: '6px',
            backgroundColor: '#222',
            marginTop: '12px',
            borderRadius: '3px',
            overflow: 'hidden'
        },
        progressBarFill: {
            width: `${visualPercent}%`,
            height: '100%',
            backgroundColor: barColor,
            transition: 'width 1s ease, background-color 0.3s',
            boxShadow: isSurplus ? '0 0 10px rgba(0,255,65,0.3)' : 'none'
        },
        manageBtn: {
            fontSize: '10px',
            fontWeight: 'bold' as const,
            fontFamily: 'monospace',
            padding: '8px 16px',
            border: '1px solid #333',
            color: '#CCC',
            backgroundColor: 'transparent',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        },
        cancelBtn: {
            fontSize: '10px',
            fontWeight: 'bold' as const,
            fontFamily: 'monospace',
            padding: '8px 16px',
            border: '1px solid #330000',
            color: '#FF4444',
            backgroundColor: 'rgba(229,9,20,0.05)',
            textTransform: 'uppercase' as const,
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <style jsx>{`
                .manage-btn:hover { border-color: #666 !important; color: white !important; }
                .cancel-btn:hover { background-color: rgba(229,9,20,0.15) !important; border-color: #E50914 !important; }
            `}</style>

            {/* --- MODALS --- */}
            <CancelConfirmModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={executeCancellation}
                isProcessing={isCancelling}
                expiryDate={subDetails?.next_billing_at ? formatDate(subDetails.next_billing_at) : undefined}
            />

            <CreditModal
                isOpen={showTopUpModal}
                onClose={() => setShowTopUpModal(false)}
            />

            {/* --- PLAN STATUS CARD --- */}
            <div style={styles.card}>
                {/* ... (Header with Manage Actions - No changes here) ... */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 style={styles.sectionTitle}>{planData.name}</h2>
                            {isPaidPlan && isScheduledForCancellation ? (
                                <span className="bg-[#1a1500] border border-[#664d03] px-2 py-0.5 text-[9px] text-[#FFC107] font-mono flex items-center gap-1.5 rounded-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC107]" /> EXPIRING
                                </span>
                            ) : (
                                <span className="bg-[#111] border border-[#333] px-2 py-0.5 text-[9px] text-[#00FF41] font-mono flex items-center gap-1.5 rounded-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" /> ACTIVE
                                </span>
                            )}
                        </div>
                        {isPaidPlan && isScheduledForCancellation ? (
                            <p className="text-[10px] text-[#FFC107] font-mono flex items-center gap-2">
                                <CalendarClock size={12} /> Access valid until {formatDate(subDetails?.next_billing_at)}
                            </p>
                        ) : (
                            <p className="text-[10px] text-gray-500 font-mono">
                                {isPaidPlan ? "RENEWS AUTOMATICALLY • SECURE BILLING" : "UPGRADE TO UNLOCK FULL POWER"}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {isPaidPlan ? (
                            <>
                                {isScheduledForCancellation ? (
                                    <Link href="/pricing">
                                        <button style={styles.manageBtn} className="manage-btn">
                                            <Settings size={12} /> REACTIVATE / CHANGE
                                        </button>
                                    </Link>
                                ) : (
                                    <>
                                        <Link href="/pricing">
                                            <button style={styles.manageBtn} className="manage-btn">
                                                <Settings size={12} /> CHANGE PLAN
                                            </button>
                                        </Link>
                                        <button onClick={handleCancelClick} disabled={isCancelling || loading} style={styles.cancelBtn} className="cancel-btn">
                                            {isCancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} CANCEL RENEWAL
                                        </button>
                                    </>
                                )}
                            </>
                        ) : (
                            <Link href="/pricing">
                                <button style={{ ...styles.manageBtn, borderColor: '#00FF41', color: '#00FF41' }} className="manage-btn">
                                    <Zap size={12} fill="currentColor" /> UPGRADE NOW
                                </button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Limits Grid (Same as before) */}
                <div className="grid grid-cols-3 gap-px bg-[#222] border border-[#222] mb-6 rounded-sm overflow-hidden">
                    <div className="bg-[#080808] p-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#666] mb-1">
                            <LayoutGrid size={10} /> <span className="text-[9px] font-mono uppercase">Projects</span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{planData.limits.projects}</p>
                    </div>
                    <div className="bg-[#080808] p-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#666] mb-1">
                            <HardDrive size={10} /> <span className="text-[9px] font-mono uppercase">Storage</span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{planData.limits.storage}</p>
                    </div>
                    <div className="bg-[#080808] p-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#666] mb-1">
                            <Users size={10} /> <span className="text-[9px] font-mono uppercase">Seats</span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{planData.limits.seats}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                    {planData.features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                            <CheckCircle2 size={12} className="text-[#333]" /> {feat}
                        </div>
                    ))}
                </div>
            </div>

            {/* --- TOKEN USAGE CARD --- */}
            <div style={styles.card}>
                <div className="flex justify-between items-end mb-3">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className={isLowBalance ? "text-[#E50914]" : "text-[#00FF41]"} />
                        <div>
                            <h2 style={{ ...styles.sectionTitle, fontSize: '16px' }}>Token Usage</h2>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="text-xl font-mono font-bold text-white leading-none">
                            {currentCredits} <span className="text-[#444] text-sm">/ {maxCredits}</span>
                        </p>
                    </div>
                </div>

                {/* PROGRESS BAR */}
                <div style={styles.progressBarBg}>
                    <div style={styles.progressBarFill} />
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: statusColor }}>
                        {statusIcon}
                        <p className="text-[10px] font-mono font-bold">{statusText}</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* 3. CHANGED LABEL: 'USED' -> 'AVAILABLE' */}
                        <span className="text-[10px] font-mono text-[#666]">
                            {Math.round(percentageAvailable)}% AVAILABLE
                        </span>

                        {/* 4. BUTTON TO OPEN MODAL */}
                        <button
                            onClick={() => setShowTopUpModal(true)}
                            className="text-[10px] text-[#E50914] underline hover:text-white transition-colors font-mono uppercase bg-transparent border-none cursor-pointer"
                        >
                            + TOP UP
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}