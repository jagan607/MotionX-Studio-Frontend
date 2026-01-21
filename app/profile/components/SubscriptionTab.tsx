"use client";

import Link from "next/link";
import { CheckCircle2, Zap, AlertTriangle, LayoutGrid, HardDrive, Users, TrendingUp } from "lucide-react";

// --- PLAN CONFIGURATION (Matched to Backend) ---
interface PlanDetails {
    name: string; // Added specific display name
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

    // 1. Resolve Plan Data
    const currentPlanKey = (plan || "free").toLowerCase();
    const planData = PLAN_CONFIG[currentPlanKey] || PLAN_CONFIG.free;
    const maxCredits = planData.credits;

    // 2. Token Bar Logic
    const currentCredits = credits ?? 0;

    // Calculate percentage
    const usagePercent = maxCredits > 0 ? (currentCredits / maxCredits) * 100 : 0;

    // Cap visual bar at 100%
    const visualPercent = Math.min(100, usagePercent);

    // Status Logic
    const isSurplus = currentCredits > maxCredits;
    const isLowBalance = currentCredits <= 10 && !isSurplus;

    // Visual State Defaults
    let barColor = '#00FF41'; // Bright Green
    let statusText = "SYSTEM OPERATIONAL";
    let statusIcon = <CheckCircle2 size={14} className="text-[#00FF41]" />;
    let statusColor = "#444";

    if (isSurplus) {
        barColor = '#00FF41';
        statusText = "SURPLUS BALANCE ACTIVE";
        statusIcon = <TrendingUp size={14} className="text-[#00FF41]" />;
        statusColor = "#00FF41";
    } else if (isLowBalance) {
        barColor = '#FF0000';
        statusText = "CRITICAL: LOW TOKEN BALANCE";
        statusIcon = <AlertTriangle size={14} className="text-[#FF0000]" />;
        statusColor = "#FF8888";
    }

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
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* --- PLAN STATUS CARD --- */}
            <div style={styles.card}>
                {/* Compact Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            {/* Uses specific Name from Config (e.g. "Pro Tier") */}
                            <h2 style={styles.sectionTitle}>{planData.name}</h2>
                            <span className="bg-[#111] border border-[#333] px-2 py-0.5 text-[9px] text-[#00FF41] font-mono flex items-center gap-1.5 rounded-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" /> ACTIVE
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono">
                            {currentPlanKey === 'free' ? "UPGRADE TO UNLOCK FULL POWER" : "RENEWS AUTOMATICALLY"}
                        </p>
                    </div>
                </div>

                {/* Compact Limits Grid */}
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

                {/* Compact Features List */}
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
                        <Zap size={16} className={isLowBalance ? "text-[#FF0000]" : "text-[#00FF41]"} />
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

                {/* Compact Status Footer */}
                <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-2" style={{ color: statusColor }}>
                        {statusIcon}
                        <p className="text-[10px] font-mono font-bold">{statusText}</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono text-[#666]">
                            {Math.round(usagePercent)}% USED
                        </span>
                        <Link href="/pricing" className="text-[10px] text-[#FF0000] underline hover:text-white transition-colors font-mono">
                            + TOP UP
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}