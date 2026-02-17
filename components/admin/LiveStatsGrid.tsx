"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Users, DollarSign, Activity, Zap } from 'lucide-react';

export function LiveStatsGrid() {
    const [stats, setStats] = useState({
        users: 0,
        dau: 0,
        activeNow: 0,
        mrr: 0,
    });

    useEffect(() => {
        // 1. LISTEN TO USERS
        const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const now = new Date();
            let activeNowCount = 0;
            let dauCount = 0;

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.lastActiveAt) {
                    const lastActive = data.lastActiveAt.toDate();
                    const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
                    const diffHours = diffMinutes / 60;

                    if (diffMinutes <= 15) activeNowCount++;
                    if (diffHours <= 24) dauCount++;
                }
            });

            setStats(prev => ({ ...prev, users: snapshot.size, activeNow: activeNowCount, dau: dauCount }));
        });

        // 2. LISTEN TO TRANSACTIONS (Fixed for 'subscription_charge')
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const q = query(
            collection(db, "transactions"),
            where("timestamp", ">=", Timestamp.fromDate(thirtyDaysAgo))
        );

        const unsubTx = onSnapshot(q, (snapshot) => {
            const uniqueUserPayments = new Map<string, number>();

            snapshot.docs.forEach(doc => {
                const data = doc.data();

                // ⬇️ FIX 1: Match your DB value "subscription_charge"
                if (data.type === 'subscription_charge') {

                    // ⬇️ FIX 2: Use 'uid' field from your DB (not 'userId')
                    const userId = data.uid || doc.id;
                    const amount = data.amount || 0;

                    // Store latest amount for this user
                    uniqueUserPayments.set(userId, amount);
                }
            });

            let trueMrr = 0;
            uniqueUserPayments.forEach((amount) => {
                trueMrr += amount;
            });

            setStats(prev => ({ ...prev, mrr: trueMrr }));
        });

        return () => {
            unsubUsers();
            unsubTx();
        };
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <StatCard
                label="Monthly Recurring Rev"
                value={`$${stats.mrr}`}
                icon={DollarSign}
                sub="Active Subscribers"
            />
            <StatCard
                label="Daily Active Users"
                value={stats.dau}
                icon={Zap}
                sub="Unique Logins (24h)"
                highlight
            />
            <StatCard
                label="Total User Base"
                value={stats.users}
                icon={Users}
                sub="Lifetime Signups"
            />
            <StatCard
                label="Active Sessions"
                value={stats.activeNow}
                icon={Activity}
                sub="Live Websockets"
                isLiveIndicator
            />
        </div>
    );
}

// (Keep the StatCard component below as is)
function StatCard({ label, value, icon: Icon, sub, highlight, isLiveIndicator }: any) {
    return (
        <div className={`bg-[#0A0A0A] border p-6 flex flex-col justify-between h-32 transition-all group relative overflow-hidden ${highlight ? 'border-red-900/40 bg-red-950/5' : 'border-[#222] hover:border-[#444]'}`}>
            <div className="flex justify-between items-start z-10">
                <span className={`text-[9px] uppercase tracking-[0.2em] font-bold ${highlight ? 'text-red-400' : 'text-[#555] group-hover:text-white'}`}>{label}</span>
                {isLiveIndicator ? (
                    <div className={`w-2 h-2 rounded-full ${value > 0 ? 'bg-green-500 animate-pulse' : 'bg-[#333]'}`} />
                ) : (
                    <Icon size={16} className={`${highlight ? 'text-red-500' : 'text-[#333] group-hover:text-[#666]'}`} />
                )}
            </div>
            <div className="z-10">
                <div className="font-anton text-4xl text-white mb-1">{value}</div>
                <div className="text-[9px] font-mono text-[#444] uppercase">{sub}</div>
            </div>
        </div>
    );
}