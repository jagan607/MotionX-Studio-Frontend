"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Zap, AlertTriangle, LayoutGrid, HardDrive, Users, TrendingUp, Settings, XCircle, Loader2, CalendarClock, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { usePayment } from "@/lib/payment";
import toast from "react-hot-toast";
import { auth } from "@/lib/firebase";
import { api } from "@/lib/api";
import CancelConfirmModal from "@/app/components/modals/CancelConfirmModal";
import CreditModal from "@/app/components/modals/CreditModal";

// --- API RESPONSE TYPE ---
interface SubscriptionStatus {
    plan: string;
    plan_name: string;
    status: "active" | "authenticated" | "created" | "pending" | "halted" | "expired" | "none";
    credits: number;
    credits_per_cycle: number;
    next_billing_at: number | null;
    current_period_start: string | null;
    amount: number;
    currency: string;
    cancel_at_period_end: boolean;
    cancel_requested_at: string | null;
    expires_at: number | null;
    limits: { projects: number; storage_gb: number; seats: number } | null;
    razorpay_sub_id: string | null;
}

// --- FREE TIER DEFAULTS ---
const FREE_DEFAULTS: SubscriptionStatus = {
    plan: "free",
    plan_name: "Free",
    status: "none",
    credits: 0,
    credits_per_cycle: 30,
    next_billing_at: null,
    current_period_start: null,
    amount: 0,
    currency: "USD",
    cancel_at_period_end: false,
    cancel_requested_at: null,
    expires_at: null,
    limits: { projects: 1, storage_gb: 1, seats: 1 },
    razorpay_sub_id: null,
};

// --- FEATURES BY PLAN (static, not from API) ---
const PLAN_FEATURES: Record<string, string[]> = {
    free: ["Standard Queue", "Public Generation", "720p Export"],
    starter: ["Standard Queue", "Public Gallery", "1080p Export"],
    pro: ["High Priority Queue", "Private Mode", "Commercial License", "4K Upscaling"],
    agency: ["Turbo Queue", "Private Mode", "Commercial License", "4K Native"],
};

// --- TRANSACTION FORMATTING HELPERS ---
const formatTxType = (type: string) => {
    switch (type) {
        case 'top_up': return 'Credit Top-up';
        case 'subscription_charge': return 'Subscription Renewal';
        case 'payment_failed': return 'Failed Payment';
        case 'subscription_cancelled': return 'Plan Cancellation';
        default: return type.replace(/_/g, ' ');
    }
};

const formatCurrency = (amount: number, currency: string = 'USD') => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const formatTxDate = (isoString: string) => {
    if (!isoString) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(isoString));
};

interface SubscriptionTabProps {
    credits: number | null;
}

export default function SubscriptionTab({ credits: realtimeCredits }: SubscriptionTabProps) {
    const { cancelSubscription, loading } = usePayment();
    const router = useRouter();

    // --- STATE ---
    const [subData, setSubData] = useState<SubscriptionStatus | null>(null);
    const [fetching, setFetching] = useState(true);
    const [isCancelling, setIsCancelling] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoadingTx, setIsLoadingTx] = useState(true);

    // --- FETCH SUBSCRIPTION STATUS ---
    useEffect(() => {
        const fetchStatus = async () => {
            if (!auth.currentUser) return;
            try {
                const res = await api.get("/api/v1/payment/subscription-status");
                setSubData(res.data);
            } catch (e) {
                console.error("Failed to fetch subscription status", e);
                setSubData(FREE_DEFAULTS);
            } finally {
                setFetching(false);
            }
        };
        fetchStatus();
    }, []);

    // --- FETCH TRANSACTION HISTORY ---
    useEffect(() => {
        const fetchTransactions = async () => {
            try {
                const user = auth.currentUser;
                if (!user) return;
                const idToken = await user.getIdToken();
                const res = await api.get("/api/v1/payment/transaction-history");
                const data = res.data;
                if (data.status === 'success') {
                    setTransactions(data.transactions);
                }
            } catch (error) {
                console.error("Failed to fetch transactions:", error);
            } finally {
                setIsLoadingTx(false);
            }
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) fetchTransactions();
            else setIsLoadingTx(false);
        });
        return () => unsubscribe();
    }, []);

    // --- LOADING STATE ---
    if (fetching || !subData) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#333]" size={24} />
            </div>
        );
    }

    // --- DERIVED VALUES ---
    // Razorpay "authenticated" = first payment done, recurring not yet started.
    // Treat it identically to "active" so paid-tier UI (Cancel, billing date) shows correctly.
    const PAID_STATUSES = new Set(["active", "authenticated", "created", "pending", "halted"]);
    const isPaidPlan = subData.plan !== "free" && subData.status !== "none";
    const isActive = PAID_STATUSES.has(subData.status) && !subData.cancel_at_period_end;
    const isCancelling_ = PAID_STATUSES.has(subData.status) && subData.cancel_at_period_end;
    const isExpired = subData.status === "expired";
    const isFree = subData.status === "none" || subData.plan === "free";

    // Use realtime credits from hook if available, otherwise API value
    const currentCredits = realtimeCredits ?? subData.credits;
    const maxCredits = subData.credits_per_cycle || 30;
    const limits = subData.limits || { projects: 1, storage_gb: 1, seats: 1 };
    const features = PLAN_FEATURES[subData.plan] || PLAN_FEATURES.free;

    // Currency symbol
    const currencySymbol = subData.currency === "INR" ? "₹" : "$";

    // Format date from unix timestamp
    const formatDate = (ts: number | null) => {
        if (!ts) return "—";
        return new Date(ts * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    };

    // Storage display
    const storageDisplay = limits.storage_gb >= 1 ? `${limits.storage_gb} GB` : `${limits.storage_gb * 1000} MB`;

    // Subtitle text
    let subtitleText = "Free plan · No billing";
    if (isCancelling_) {
        subtitleText = `Cancels on ${formatDate(subData.expires_at)}`;
    } else if (isActive) {
        subtitleText = `Renews on ${formatDate(subData.next_billing_at)} · ${currencySymbol}${subData.amount}/month`;
    }

    // Credit bar
    const percentageAvailable = maxCredits > 0 ? (currentCredits / maxCredits) * 100 : 0;
    const visualPercent = Math.min(100, percentageAvailable);
    const isSurplus = currentCredits > maxCredits;
    const isLowBalance = currentCredits < 10 && !isSurplus;

    let barColor = '#2D8B4E';
    let statusText = "Balance healthy";
    let statusIcon = <CheckCircle2 size={13} className="text-[#2D8B4E]" />;
    let statusColor = "#555";

    if (isSurplus) {
        barColor = '#2D8B4E';
        statusText = "Surplus balance active";
        statusIcon = <TrendingUp size={13} className="text-[#2D8B4E]" />;
        statusColor = "#2D8B4E";
    } else if (isLowBalance) {
        barColor = '#B91C1C';
        statusText = "Low credit balance";
        statusIcon = <AlertTriangle size={13} className="text-[#B91C1C]" />;
        statusColor = "#CC6666";
    }

    // --- HANDLERS ---
    const handleCancelClick = () => setShowCancelModal(true);

    const executeCancellation = () => {
        setIsCancelling(true);
        cancelSubscription({
            onSuccess: () => {
                toast.success("Subscription renewal cancelled");
                setIsCancelling(false);
                setShowCancelModal(false);
                window.location.reload();
            },
            onError: (err: string) => {
                toast.error("Cancellation failed: " + err);
                setIsCancelling(false);
                setShowCancelModal(false);
            }
        });
    };

    // --- STATUS BADGE ---
    const renderStatusBadge = () => {
        if (isExpired) {
            return (
                <span className="bg-[#1a0a0a] border border-[#3a1a1a] px-2.5 py-0.5 text-[9px] text-[#B91C1C] font-semibold flex items-center gap-1.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" /> Expired
                </span>
            );
        }
        if (isCancelling_) {
            return (
                <span className="bg-[#1a1500] border border-[#3d3010] px-2.5 py-0.5 text-[9px] text-[#B8860B] font-semibold flex items-center gap-1.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#B8860B]" /> Cancelling
                </span>
            );
        }
        if (isActive) {
            return (
                <span className="bg-[#0a1a0a] border border-[#1a3a1a] px-2.5 py-0.5 text-[9px] text-[#2D8B4E] font-semibold flex items-center gap-1.5 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2D8B4E] animate-pulse" /> Active
                </span>
            );
        }
        return null; // Free — no badge
    };

    // --- ACTION BUTTONS ---
    const renderActions = () => {
        if (isExpired) {
            return (
                <Link href="/pricing">
                    <button className="flex items-center gap-2 text-[10px] font-semibold tracking-wide px-4 py-2 border border-[#2D8B4E] text-[#2D8B4E] bg-transparent rounded-md hover:bg-[rgba(45,139,78,0.08)] transition-all cursor-pointer">
                        <RefreshCw size={12} /> Resubscribe
                    </button>
                </Link>
            );
        }
        if (isCancelling_) {
            return (
                <Link href="/pricing">
                    <button className="flex items-center gap-2 text-[10px] font-semibold tracking-wide px-4 py-2 border border-[#333] text-[#ccc] bg-transparent rounded-md hover:border-[#666] hover:text-white transition-all cursor-pointer">
                        <Settings size={12} /> Reactivate
                    </button>
                </Link>
            );
        }
        if (isActive) {
            return (
                <>
                    <Link href="/pricing">
                        <button className="flex items-center gap-2 text-[10px] font-semibold tracking-wide px-4 py-2 border border-[#333] text-[#ccc] bg-transparent rounded-md hover:border-[#666] hover:text-white transition-all cursor-pointer">
                            <Settings size={12} /> Change Plan
                        </button>
                    </Link>
                    <button
                        onClick={handleCancelClick}
                        disabled={isCancelling || loading}
                        className="flex items-center gap-2 text-[10px] font-semibold tracking-wide px-4 py-2 border border-[#333] text-[#ccc] bg-transparent rounded-md hover:border-[#666] hover:text-white transition-all cursor-pointer disabled:opacity-50"
                    >
                        {isCancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Cancel Renewal
                    </button>
                </>
            );
        }
        // Free
        return (
            <Link href="/pricing">
                <button className="flex items-center gap-2 text-[10px] font-semibold tracking-wide px-4 py-2 border border-[#2D8B4E] text-[#2D8B4E] bg-transparent rounded-md hover:bg-[rgba(45,139,78,0.08)] transition-all cursor-pointer">
                    <Zap size={12} fill="currentColor" /> Upgrade
                </button>
            </Link>
        );
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5 mt-6">
            {/* --- MODALS --- */}
            <CancelConfirmModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={executeCancellation}
                isProcessing={isCancelling}
                expiryDate={subData.next_billing_at ? formatDate(subData.next_billing_at) : undefined}
            />

            <CreditModal
                isOpen={showTopUpModal}
                onClose={() => setShowTopUpModal(false)}
            />

            {/* --- PLAN STATUS CARD --- */}
            <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-6 hover:border-[#333] transition-colors">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <h2 className="text-xl font-anton uppercase text-white">{subData.plan_name}</h2>
                            {renderStatusBadge()}
                        </div>
                        <p className="text-[11px] text-[#555]">{subtitleText}</p>
                    </div>
                    <div className="flex gap-2">
                        {renderActions()}
                    </div>
                </div>

                {/* Limits Grid */}
                <div className="grid grid-cols-3 gap-px bg-[#1a1a1a] border border-[#1a1a1a] mb-6 rounded-lg overflow-hidden">
                    <div className="bg-[#0f0f0f] p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#555] mb-1.5">
                            <LayoutGrid size={11} /> <span className="text-[9px] font-semibold uppercase tracking-wide">Projects</span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{limits.projects}</p>
                    </div>
                    <div className="bg-[#0f0f0f] p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#555] mb-1.5">
                            <HardDrive size={11} /> <span className="text-[9px] font-semibold uppercase tracking-wide">Storage</span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{storageDisplay}</p>
                    </div>
                    <div className="bg-[#0f0f0f] p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-[#555] mb-1.5">
                            <Users size={11} /> <span className="text-[9px] font-semibold uppercase tracking-wide">Seats</span>
                        </div>
                        <p className="text-lg font-bold text-white leading-none">{limits.seats}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                    {features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-[#888]">
                            <CheckCircle2 size={13} className="text-[#333] shrink-0" /> {feat}
                        </div>
                    ))}
                </div>
            </div>

            {/* --- CREDIT USAGE CARD --- */}
            <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-6 hover:border-[#333] transition-colors">
                <div className="flex justify-between items-end mb-4">
                    <div className="flex items-center gap-2.5">
                        <Zap size={16} className={isLowBalance ? "text-[#B91C1C]" : "text-[#2D8B4E]"} />
                        <h2 className="text-base font-anton uppercase text-white">Credit Usage</h2>
                    </div>

                    <p className="text-xl font-mono font-bold text-white leading-none">
                        {currentCredits} <span className="text-[#444] text-sm">/ {maxCredits}</span>
                    </p>
                </div>

                {/* PROGRESS BAR */}
                <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                            width: `${visualPercent}%`,
                            backgroundColor: barColor,
                            boxShadow: isSurplus ? `0 0 10px ${barColor}40` : 'none'
                        }}
                    />
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: statusColor }}>
                        {statusIcon}
                        <p className="text-[11px] font-medium">{statusText}</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-[10px] text-[#555]">
                            {Math.round(percentageAvailable)}% available
                        </span>

                        <button
                            onClick={() => {
                                if (subData.plan === "free") {
                                    router.push("/pricing?from=topup");
                                } else {
                                    setShowTopUpModal(true);
                                }
                            }}
                            className="text-[10px] font-semibold text-[#E50914] hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                        >
                            + Top Up
                        </button>
                    </div>
                </div>
            </div>

            {/* --- BILLING HISTORY TABLE --- */}
            {!isLoadingTx && transactions.length > 0 && (
                <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg overflow-hidden hover:border-[#333] transition-colors">
                    <div className="px-6 py-4 border-b border-[#1a1a1a]">
                        <h2 className="text-base font-anton uppercase text-white">Billing History</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] text-[#A0A0A0]">
                            <thead className="bg-[#111] border-b border-[#1a1a1a] uppercase tracking-[1px] text-[9px]">
                                <tr>
                                    <th className="px-5 py-4 font-medium">Date</th>
                                    <th className="px-5 py-4 font-medium">Description</th>
                                    <th className="px-5 py-4 font-medium">Amount</th>
                                    <th className="px-5 py-4 font-medium">Credits</th>
                                    <th className="px-5 py-4 font-medium">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-4 whitespace-nowrap text-white">
                                            {formatTxDate(tx.timestamp)}
                                        </td>
                                        <td className="px-5 py-4 font-medium text-white capitalize">
                                            {formatTxType(tx.type)}
                                            {tx.package_id && (
                                                <span className="text-[#555] ml-2 text-[9px] uppercase tracking-wider">
                                                    ({tx.package_id.replace('topup_', '')})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {formatCurrency(tx.amount, tx.currency)}
                                        </td>
                                        <td className={`px-5 py-4 whitespace-nowrap font-medium ${tx.credits_added > 0 ? 'text-[#00FF41]' : 'text-[#A0A0A0]'}`}>
                                            {tx.credits_added > 0 ? `+${tx.credits_added}` : '—'}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            {tx.type === 'payment_failed' ? (
                                                <span className="flex items-center gap-1.5 text-[#E50914] font-medium">
                                                    <AlertCircle size={12} /> Failed
                                                </span>
                                            ) : tx.type === 'subscription_cancel_requested' ? (
                                                <span className="flex items-center gap-1.5 text-[#F5A623] font-medium">
                                                    <Clock size={12} /> Pending Cancel
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[#00FF41] font-medium">
                                                    <CheckCircle2 size={12} /> Successful
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}