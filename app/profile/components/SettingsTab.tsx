"use client";

import { useState } from "react";
import { User, Loader2, LogOut } from "lucide-react";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";

interface SettingsTabProps {
    user: any;
    displayName: string;
    setDisplayName: (value: string) => void;
    handleUpdateProfile: () => void;
    handleLogout: () => void;
    isSaving: boolean;
}

export default function SettingsTab({
    user,
    displayName,
    setDisplayName,
    handleUpdateProfile,
    handleLogout,
    isSaving
}: SettingsTabProps) {
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5 mt-6">
            {showSignOutConfirm && (
                <DeleteConfirmModal
                    title="Sign Out"
                    message="Are you sure you want to sign out? You'll need to sign in again to access your account."
                    isDeleting={false}
                    onConfirm={handleLogout}
                    onCancel={() => setShowSignOutConfirm(false)}
                />
            )}
            {/* PROFILE CARD */}
            <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-6 hover:border-[#333] transition-colors">
                <h2 className="text-xl font-anton uppercase text-white mb-5">Profile</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-[11px] text-[#555] font-medium mb-1.5">
                            Display Name
                        </label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-[#080808] border border-[#222] rounded-md px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-[#444] transition-colors placeholder:text-[#333]"
                            placeholder="Enter your name"
                            disabled={isSaving}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] text-[#555] font-medium mb-1.5">
                            Email
                        </label>
                        <input
                            type="text"
                            value={user?.email || ""}
                            disabled
                            className="w-full bg-[#080808] border border-[#222] rounded-md px-3.5 py-2.5 text-[13px] text-[#555] outline-none cursor-not-allowed"
                        />
                    </div>
                </div>

                <button
                    onClick={handleUpdateProfile}
                    disabled={isSaving}
                    className="mt-5 flex items-center gap-2 bg-white text-black px-5 py-2.5 text-[11px] font-bold tracking-wide rounded-md hover:bg-[#eee] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <User size={14} />}
                    {isSaving ? "Saving..." : "Save Changes"}
                </button>
            </div>

            {/* SIGN OUT CARD */}
            <div className="bg-[#0A0A0A] border border-[#1a1a1a] rounded-lg p-6 hover:border-[#333] transition-colors">
                <h2 className="text-base font-anton uppercase text-white mb-1.5">Sign Out</h2>
                <p className="text-[11px] text-[#555] mb-4">
                    You'll need to sign in again to access your account.
                </p>
                <button
                    onClick={() => setShowSignOutConfirm(true)}
                    className="flex items-center gap-2 text-[11px] font-semibold px-4 py-2.5 border border-[#222] text-[#999] bg-transparent rounded-md hover:border-[#E50914] hover:text-[#E50914] hover:bg-[rgba(229,9,20,0.04)] transition-all cursor-pointer"
                >
                    <LogOut size={14} /> Sign Out
                </button>
            </div>
        </div>
    );
}