"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { updateProfile, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCredits } from "@/hooks/useCredits";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// --- COMPONENT IMPORTS ---
import ProfileHeader from "./components/ProfileHeader";
import SubscriptionTab from "./components/SubscriptionTab";
import SettingsTab from "./components/SettingsTab";
import OrganizationTab from "./components/OrganizationTab";

export default function ProfilePage() {
    const router = useRouter();
    const { credits } = useCredits();

    // --- STATE ---
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"subscription" | "settings" | "organization">("subscription");
    const [loading, setLoading] = useState(true);
    const [isEnterprise, setIsEnterprise] = useState(false);

    // Form State
    const [displayName, setDisplayName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // --- DATA FETCHING ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            if (u) {
                setUser(u);
                setDisplayName(u.displayName || "");
                setIsEnterprise(!!u.tenantId);
                setLoading(false);
            } else {
                router.push("/login");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // --- ACTION HANDLERS ---
    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateProfile(user, { displayName: displayName });
            toast.success("Profile updated");
        } catch (error) {
            console.error(error);
            toast.error("Update failed");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    // --- RENDER ---
    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <Loader2 className="animate-spin text-[#333]" size={28} />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#050505] py-14 px-5">
            <div className="max-w-[880px] mx-auto">

                {/* HEADER & NAV */}
                <ProfileHeader
                    user={user}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    handleLogout={handleLogout}
                    showOrgTab={isEnterprise}
                />

                {/* CONTENT AREA */}
                {activeTab === "subscription" ? (
                    <SubscriptionTab credits={credits} />
                ) : activeTab === "organization" ? (
                    <OrganizationTab />
                ) : (
                    <SettingsTab
                        user={user}
                        displayName={displayName}
                        setDisplayName={setDisplayName}
                        handleUpdateProfile={handleUpdateProfile}
                        handleLogout={handleLogout}
                        isSaving={isSaving}
                    />
                )}
            </div>
        </main>
    );
}