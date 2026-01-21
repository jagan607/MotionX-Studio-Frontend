"use client";

import Link from "next/link";
import { LogOut, ChevronRight, CreditCard, Settings } from "lucide-react";

interface ProfileHeaderProps {
    user: any;
    activeTab: "subscription" | "settings";
    setActiveTab: (tab: "subscription" | "settings") => void;
    handleLogout: () => void;
}

export default function ProfileHeader({
    user,
    activeTab,
    setActiveTab,
    handleLogout
}: ProfileHeaderProps) {

    // --- STYLES ---
    const styles = {
        headerTitle: {
            fontFamily: 'Anton, sans-serif',
            fontSize: '48px',
            textTransform: 'uppercase' as const,
            lineHeight: 1,
            color: '#EDEDED'
        },
        headerSub: {
            fontFamily: 'monospace',
            color: '#666',
            fontSize: '12px',
            letterSpacing: '2px',
            marginTop: '5px'
        },
        // Navigation Links
        navLink: {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            cursor: 'pointer',
            transition: 'color 0.2s'
        },
        // Tab Container
        tabContainer: {
            display: 'flex',
            gap: '2px',
            marginTop: '40px',
            borderBottom: '1px solid #222'
        },
        tabBtn: (isActive: boolean) => ({
            padding: '12px 24px',
            backgroundColor: isActive ? '#111' : 'transparent',
            color: isActive ? '#FFF' : '#666',
            border: 'none',
            borderTop: isActive ? '2px solid #FF0000' : '2px solid transparent',
            fontFamily: 'monospace',
            fontSize: '12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            outline: 'none'
        })
    };

    return (
        <div>
            <style jsx>{`
                .nav-link:hover { color: #FFF !important; }
                .logout-link:hover { color: #FF0000 !important; }
            `}</style>

            {/* TOP ROW: TITLE & NAVIGATION */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 style={styles.headerTitle}>Operator Profile</h1>
                    <p style={styles.headerSub}>ID: {user?.uid || 'LOADING...'}</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* QUICK EXIT BUTTON */}
                    <button
                        onClick={handleLogout}
                        style={styles.navLink}
                        className="logout-link"
                    >
                        <LogOut size={14} /> EXIT
                    </button>

                    <div className="h-4 w-[1px] bg-[#333]"></div>

                    <Link href="/dashboard" style={styles.navLink} className="nav-link">
                        <ChevronRight size={14} /> RETURN TO TERMINAL
                    </Link>
                </div>
            </div>

            {/* TAB NAVIGATION */}
            <div style={styles.tabContainer}>
                <button
                    onClick={() => setActiveTab("subscription")}
                    style={styles.tabBtn(activeTab === "subscription")}
                >
                    <CreditCard size={14} /> SUBSCRIPTION & TOKENS
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    style={styles.tabBtn(activeTab === "settings")}
                >
                    <Settings size={14} /> SYSTEM SETTINGS
                </button>
            </div>
        </div>
    );
}