"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, Settings, Building } from "lucide-react";

interface ProfileHeaderProps {
    user: any;
    activeTab: "subscription" | "settings" | "organization";
    setActiveTab: (tab: "subscription" | "settings" | "organization") => void;
    handleLogout: () => void;
    showOrgTab?: boolean;
}

export default function ProfileHeader({
    user,
    activeTab,
    setActiveTab,
    handleLogout,
    showOrgTab = false,
}: ProfileHeaderProps) {
    return (
        <div>
            {/* BREADCRUMB */}
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-[11px] text-[#555] hover:text-white transition-colors no-underline mb-6"
            >
                <ArrowLeft size={13} /> Back to Dashboard
            </Link>

            {/* TITLE */}
            <div>
                <h1 className="font-anton text-4xl md:text-5xl uppercase leading-none tracking-[0.5px] text-white">
                    Account
                </h1>
                <p className="text-[11px] text-[#555] mt-2">
                    Manage your plan, credits, and preferences
                </p>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex gap-1 mt-12 border-b border-[#1a1a1a]">
                <button
                    onClick={() => setActiveTab("subscription")}
                    className={`px-5 py-3 text-[11px] font-semibold tracking-wide flex items-center gap-2 transition-all border-b-2 cursor-pointer bg-transparent outline-none ${activeTab === "subscription"
                        ? "text-white border-[#E50914]"
                        : "text-[#555] border-transparent hover:text-[#999]"
                        }`}
                >
                    <CreditCard size={14} /> Plan & Usage
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={`px-5 py-3 text-[11px] font-semibold tracking-wide flex items-center gap-2 transition-all border-b-2 cursor-pointer bg-transparent outline-none ${activeTab === "settings"
                        ? "text-white border-[#E50914]"
                        : "text-[#555] border-transparent hover:text-[#999]"
                        }`}
                >
                    <Settings size={14} /> Account Settings
                </button>
                {showOrgTab && (
                    <button
                        onClick={() => setActiveTab("organization")}
                        className={`px-5 py-3 text-[11px] font-semibold tracking-wide flex items-center gap-2 transition-all border-b-2 cursor-pointer bg-transparent outline-none ${activeTab === "organization"
                            ? "text-white border-[#E50914]"
                            : "text-[#555] border-transparent hover:text-[#999]"
                            }`}
                    >
                        <Building size={14} /> Organization
                    </button>
                )}
            </div>
        </div>
    );
}