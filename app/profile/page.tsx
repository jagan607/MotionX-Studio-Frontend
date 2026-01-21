"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { updateProfile, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCredits } from "@/hooks/useCredits";
import { Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// --- COMPONENT IMPORTS ---
import ProfileHeader from "./components/ProfileHeader";
import SubscriptionTab from "./components/SubscriptionTab";
import SettingsTab from "./components/SettingsTab";

export default function ProfilePage() {
    const router = useRouter();
    const { credits } = useCredits();

    // --- STATE ---
    const [user, setUser] = useState<any>(null);
    const [plan, setPlan] = useState<string>("free");
    const [activeTab, setActiveTab] = useState<"subscription" | "settings">("subscription");
    const [loading, setLoading] = useState(true);

    // Form State (Managed here to persist across tab switches if needed)
    const [displayName, setDisplayName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // --- 1. DATA FETCHING ---
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            if (u) {
                setUser(u);
                setDisplayName(u.displayName || "");

                try {
                    const userDocRef = doc(db, "users", u.uid);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        setPlan(userDocSnap.data().plan || "free");
                    }
                } catch (error) {
                    console.error("Error fetching user plan:", error);
                } finally {
                    setLoading(false);
                }
            } else {
                router.push("/login");
            }
        });
        return () => unsubscribe();
    }, [router]);

    // --- 2. ACTION HANDLERS ---
    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateProfile(user, { displayName: displayName });
            toast.success("OPERATOR ID UPDATED");
        } catch (error) {
            console.error(error);
            toast.error("UPDATE FAILED");
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

    // --- 3. RENDER ---
    if (loading) {
        return (
            <div className="min-h-screen bg-[#030303] flex items-center justify-center text-[#444]">
                <Loader2 className="animate-spin" />
            </div>
        );
    }

    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#030303', padding: '40px 20px' }}>
            <Toaster
                position="bottom-right"
                toastOptions={{
                    style: { background: '#111', color: '#FFF', borderRadius: '0', border: '1px solid #333', fontFamily: 'monospace' }
                }}
            />

            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

                {/* HEADER & NAV */}
                <ProfileHeader
                    user={user}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    handleLogout={handleLogout}
                />

                {/* CONTENT AREA */}
                {activeTab === "subscription" ? (
                    <SubscriptionTab
                        plan={plan}
                        credits={credits}
                    />
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