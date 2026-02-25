"use client";

import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Loader2, TrendingUp, BarChart3, Zap, Clock, User, Cpu } from "lucide-react";
import { auth } from "@/lib/firebase";

interface LeaderboardEntry {
    email: string;
    spent: number;
}

interface Transaction {
    id: string;
    email: string;
    model: string;
    cost: number;
    created_at: string;
}

interface UsageData {
    total_spent: number;
    leaderboard: LeaderboardEntry[];
    recent_transactions: Transaction[];
}

interface OrganizationUsageProps { }

export default function OrganizationUsage({ }: OrganizationUsageProps) {
    const [data, setData] = useState<UsageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                if (!token) return;
                const res = await fetch(`${API_BASE_URL}/api/organization/usage`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                if (res.ok) {
                    setData(await res.json());
                } else {
                    setError(true);
                }
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const formatDate = (iso: string) => {
        try {
            return new Date(iso).toLocaleString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true,
            });
        } catch { return iso; }
    };

    // ─── Loading ───
    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl h-28" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl h-64" />
                    <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl h-64" />
                </div>
            </div>
        );
    }

    // ─── Error ───
    if (error || !data) {
        return (
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-12 text-center">
                <BarChart3 size={32} className="mx-auto mb-3 text-[#333]" />
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#555]">Failed to load usage data</p>
                <p className="text-[9px] text-[#444] mt-1">Check console for details or try refreshing.</p>
            </div>
        );
    }

    // ─── Empty State ───
    if (data.total_spent === 0 && data.leaderboard.length === 0) {
        return (
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-12 text-center">
                <Zap size={32} className="mx-auto mb-3 text-[#333]" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#666]">No credits consumed yet</p>
                <p className="text-[9px] text-[#444] mt-1">No credits have been consumed by your organization yet.</p>
            </div>
        );
    }

    const maxSpent = Math.max(...data.leaderboard.map(e => e.spent), 1);

    // ─── Render ───
    return (
        <div className="space-y-5">

            {/* ═══ KPI CARD ═══ */}
            <div className="bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] border border-[#1a1a1a] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                        <TrendingUp size={18} className="text-[#E50914]" />
                    </div>
                    <div>
                        <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">Total Credits Consumed</span>
                        <span className="text-3xl font-bold font-mono text-white">{data.total_spent.toLocaleString()}</span>
                    </div>
                </div>
                <div className="flex gap-4 text-[9px] font-mono text-[#555]">
                    <span>{data.leaderboard.length} active user{data.leaderboard.length !== 1 ? "s" : ""}</span>
                    <span>•</span>
                    <span>{data.recent_transactions.length} recent transaction{data.recent_transactions.length !== 1 ? "s" : ""}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* ═══ LEADERBOARD ═══ */}
                <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-5 border-b border-[#1a1a1a]">
                        <BarChart3 size={16} className="text-amber-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Usage Leaderboard</h3>
                    </div>
                    {data.leaderboard.length === 0 ? (
                        <div className="p-8 text-center text-[9px] font-mono text-[#555] uppercase tracking-widest">No data</div>
                    ) : (
                        <div className="divide-y divide-[#111]">
                            {data.leaderboard.map((entry, idx) => (
                                <div key={entry.email} className="flex items-center gap-3 px-5 py-3 hover:bg-[#0d0d0d] transition-colors">
                                    {/* Rank */}
                                    <span className={`text-[11px] font-bold font-mono w-6 text-center shrink-0 ${idx === 0 ? "text-amber-400" : idx === 1 ? "text-[#aaa]" : idx === 2 ? "text-amber-700" : "text-[#555]"
                                        }`}>
                                        #{idx + 1}
                                    </span>

                                    {/* User + bar */}
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[10px] font-mono text-white block truncate">{entry.email}</span>
                                        <div className="mt-1 h-1.5 bg-[#111] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? "bg-gradient-to-r from-amber-500 to-amber-400"
                                                    : idx === 1 ? "bg-gradient-to-r from-[#666] to-[#888]"
                                                        : "bg-gradient-to-r from-[#333] to-[#555]"
                                                    }`}
                                                style={{ width: `${(entry.spent / maxSpent) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Spend */}
                                    <span className="text-[10px] font-mono text-[#888] shrink-0 tabular-nums">
                                        {entry.spent.toLocaleString()} cr
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ═══ RECENT TRANSACTIONS ═══ */}
                <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-5 border-b border-[#1a1a1a]">
                        <Clock size={16} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Audit Ledger</h3>
                    </div>
                    {data.recent_transactions.length === 0 ? (
                        <div className="p-8 text-center text-[9px] font-mono text-[#555] uppercase tracking-widest">No transactions</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px]">
                                <thead>
                                    <tr className="border-b border-[#1a1a1a] bg-[#0A0A0A]">
                                        <th className="text-left p-3 text-[8px] font-mono uppercase text-[#666] tracking-widest">Date</th>
                                        <th className="text-left p-3 text-[8px] font-mono uppercase text-[#666] tracking-widest">User</th>
                                        <th className="text-left p-3 text-[8px] font-mono uppercase text-[#666] tracking-widest">Model</th>
                                        <th className="text-right p-3 text-[8px] font-mono uppercase text-[#666] tracking-widest">Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recent_transactions.map((tx) => (
                                        <tr key={tx.id} className="border-b border-[#111] hover:bg-[#0D0D0D] transition-colors">
                                            <td className="p-3 text-[9px] font-mono text-[#888] whitespace-nowrap">{formatDate(tx.created_at)}</td>
                                            <td className="p-3">
                                                <span className="text-[9px] font-mono text-white truncate block max-w-[150px]">{tx.email}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className="text-[8px] font-mono text-[#aaa] bg-[#111] border border-[#222] px-2 py-0.5 rounded uppercase tracking-wider">
                                                    <Cpu size={9} className="inline mr-1 -mt-px" />{tx.model}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <span className="text-[10px] font-mono font-bold text-[#E50914] tabular-nums">
                                                    −{tx.cost.toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
