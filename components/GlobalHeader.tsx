"use client";

import { auth } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, Zap, User } from "lucide-react"; // Removed LogOut
import { useCredits } from "@/hooks/useCredits";

export default function GlobalHeader() {
    const pathname = usePathname();
    const { credits } = useCredits();

    // 1. HIDE ON LOGIN, HOME, AND PRICING PAGES
    if (pathname === "/login" || pathname === "/" || pathname === "/pricing") return null;

    // --- SHARED STYLES ---
    const styles = {
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            borderBottom: '1px solid #333', padding: '20px 40px',
            backgroundColor: '#030303',
            position: 'sticky' as const, top: 0, zIndex: 50
        },
        logo: { fontSize: '24px', fontFamily: 'Anton, sans-serif', textTransform: 'uppercase' as const, lineHeight: '1', letterSpacing: '1px', color: '#FFF' },
        subLogo: { fontSize: '9px', color: '#FF0000', letterSpacing: '3px', fontWeight: 'bold' as const, marginTop: '5px', textTransform: 'uppercase' as const },

        // Generic Info Box (Credits)
        infoBox: { display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid #333', paddingRight: '20px', marginRight: '20px' },

        // Buttons
        createButton: { backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '10px 20px', fontSize: '10px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const },
        upgradeBtn: { backgroundColor: '#111', border: '1px solid #333', color: '#EDEDED', padding: '4px 8px', fontSize: '9px', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '5px', textTransform: 'uppercase' as const, transition: 'all 0.2s ease' },

        // Operator Profile Button Style
        operatorBtn: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#0A0A0A',
            border: '1px solid #333',
            padding: '8px 16px',
            marginRight: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textDecoration: 'none'
        }
    };

    return (
        <div style={styles.header}>
            <style jsx>{`
                .operator-btn:hover {
                    border-color: #666 !important;
                    background-color: #111 !important;
                }
                .operator-btn:hover p {
                    color: #FFF !important;
                }
            `}</style>

            {/* LEFT: LOGO */}
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <div>
                    <h1 style={styles.logo}>Motion X <span style={{ color: '#FF0000' }}>Studio</span></h1>
                    <p style={styles.subLogo}>/// PRODUCTION_TERMINAL_V1</p>
                </div>
            </Link>

            {/* RIGHT: CONTROLS */}
            <div style={{ display: 'flex', alignItems: 'center' }}>

                {/* 1. OPERATOR PROFILE BUTTON */}
                <Link href="/profile" style={{ textDecoration: 'none' }}>
                    <div style={styles.operatorBtn} className="operator-btn">
                        <div style={{ width: '8px', height: '8px', backgroundColor: '#00FF41', borderRadius: '50%', boxShadow: '0 0 10px #00FF41' }}></div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace', lineHeight: 1, marginBottom: '2px' }}>OPERATOR</p>
                            <p style={{ fontSize: '11px', color: '#DDD', fontWeight: 'bold', lineHeight: 1 }}>
                                {auth.currentUser?.displayName || 'UNKNOWN'}
                            </p>
                        </div>
                        <User size={14} color="#444" />
                    </div>
                </Link>

                {/* 2. CREDITS INFO */}
                <div id="tour-credits-target" style={styles.infoBox}>
                    <Zap size={14} color="#FF0000" />
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>CREDITS</p>
                        <p style={{ fontSize: '10px', color: credits && credits > 0 ? '#FFF' : '#FF0000', fontWeight: 'bold' }}>
                            {credits !== null ? credits : '...'}
                        </p>
                    </div>

                    <Link href="/pricing" style={{ textDecoration: 'none' }}>
                        <button style={styles.upgradeBtn} title="Upgrade Plan">
                            <Plus size={10} /> GET
                        </button>
                    </Link>
                </div>

                {/* EXIT BUTTON REMOVED HERE */}

                <div style={{ marginLeft: '0px' }}> {/* Removed left margin since Exit button is gone */}
                    <Link href="/series/new" style={{ textDecoration: 'none' }}>
                        <button id="tour-new-series-target" style={styles.createButton}>
                            <Plus size={14} strokeWidth={3} /> NEW SERIES
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}