"use client";

import { auth } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, Zap, User } from "lucide-react";
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
            borderBottom: '1px solid #1F1F1F', padding: '20px 40px',
            backgroundColor: '#050505', // Slightly darker than #030303 for better contrast
            position: 'sticky' as const, top: 0, zIndex: 50
        },
        logo: { fontSize: '24px', fontFamily: 'Anton, sans-serif', textTransform: 'uppercase' as const, lineHeight: '1', letterSpacing: '1px', color: '#FFF' },
        subLogo: { fontSize: '9px', color: '#FF0000', letterSpacing: '3px', fontWeight: 'bold' as const, marginTop: '5px', textTransform: 'uppercase' as const },

        // REFINED: Credits Info (Clean, no border box)
        creditsContainer: { display: 'flex', alignItems: 'center', gap: '12px', marginRight: '30px' },
        creditsValue: { fontSize: '14px', color: '#FFF', fontWeight: 'bold' as const, fontFamily: 'monospace' },
        creditsLabel: { fontSize: '9px', color: '#666', fontFamily: 'monospace', textTransform: 'uppercase' as const },

        // REFINED: New Series Button (Dimmed Down)
        createButton: {
            backgroundColor: '#111',
            color: '#888',
            border: '1px solid #333',
            padding: '8px 16px',
            fontSize: '10px',
            fontWeight: 'bold' as const,
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'uppercase' as const,
            transition: 'all 0.2s ease'
        },

        // REFINED: Upgrade Button (Get)
        upgradeBtn: {
            backgroundColor: '#1F1F1F',
            border: 'none',
            color: '#DDD',
            padding: '4px 10px',
            fontSize: '9px',
            fontWeight: 'bold' as const,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            textTransform: 'uppercase' as const,
            transition: 'all 0.2s ease',
            borderRadius: '2px'
        },

        // REFINED: Operator Profile Button
        operatorBtn: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'transparent',
            border: '1px solid #222', // Very subtle border
            padding: '8px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textDecoration: 'none'
        }
    };

    return (
        <div style={styles.header}>
            <style jsx>{`
                /* Hover Effect for New Series */
                .create-btn:hover {
                    border-color: #FF0000 !important;
                    color: #FFF !important;
                    background-color: #1A0505 !important;
                }
                
                /* Hover Effect for Operator */
                .operator-btn:hover {
                    border-color: #444 !important;
                    background-color: #0A0A0A !important;
                }
                .operator-btn:hover p {
                    color: #FFF !important;
                }

                /* Hover for Upgrade */
                .upgrade-btn:hover {
                    background-color: #FF0000 !important;
                    color: #000 !important;
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

                {/* 1. NEW SERIES BUTTON (Dimmed) */}
                <div style={{ marginRight: '30px', borderRight: '1px solid #222', paddingRight: '30px' }}>
                    <Link href="/series/new" style={{ textDecoration: 'none' }}>
                        <button className="create-btn" style={styles.createButton}>
                            <Plus size={12} /> NEW PROJECT
                        </button>
                    </Link>
                </div>

                {/* 2. EVOLVED CREDITS DISPLAY (Heads-up Display Style) */}
                <div style={styles.creditsContainer}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                        <span style={styles.creditsLabel}>Compute Balance</span>
                        <span style={styles.creditsValue}>
                            {credits !== null ? credits : '...'} <span style={{ color: '#444' }}>TOKENS</span>
                        </span>
                    </div>

                    {/* Icon + Top Up */}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Zap size={18} color="#FF0000" fill="rgba(255,0,0,0.2)" />
                        <Link href="/pricing" style={{ textDecoration: 'none' }}>
                            <button className="upgrade-btn" style={styles.upgradeBtn} title="Purchase Credits">
                                <Plus size={8} /> TOP UP
                            </button>
                        </Link>
                    </div>
                </div>

                {/* 3. OPERATOR PROFILE (Refined Dot) */}
                <Link href="/profile" style={{ textDecoration: 'none' }}>
                    <div style={styles.operatorBtn} className="operator-btn">
                        {/* Smaller, dimmer dot */}
                        <div style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: '#00FF41',
                            borderRadius: '50%',
                            boxShadow: '0 0 6px rgba(0, 255, 65, 0.4)' // Reduced glow opacity 
                        }}></div>

                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '9px', color: '#555', fontFamily: 'monospace', lineHeight: 1, marginBottom: '3px' }}>OPERATOR</p>
                            <p style={{ fontSize: '11px', color: '#CCC', fontWeight: 'bold', lineHeight: 1 }}>
                                {auth.currentUser?.displayName || 'UNKNOWN'}
                            </p>
                        </div>
                        <User size={14} color="#333" />
                    </div>
                </Link>

            </div>
        </div>
    );
}