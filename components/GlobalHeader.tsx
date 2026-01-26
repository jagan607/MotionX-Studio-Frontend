"use client";

import { auth } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, User } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

export default function GlobalHeader() {
    const pathname = usePathname();
    const { credits } = useCredits();

    // 1. HIDE ON LOGIN, HOME, AND PRICING PAGES
    if (pathname === "/login" || pathname === "/" || pathname === "/pricing") return null;

    // --- SHARED STYLES ---
    const styles = {
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #1F1F1F', padding: '16px 40px',
            backgroundColor: '#050505',
            position: 'sticky' as const, top: 0, zIndex: 50
        },
        logo: { fontSize: '24px', fontFamily: 'Anton, sans-serif', textTransform: 'uppercase' as const, lineHeight: '1', letterSpacing: '1px', color: '#FFF' },
        subLogo: { fontSize: '9px', color: '#FF0000', letterSpacing: '3px', fontWeight: 'bold' as const, marginTop: '4px', textTransform: 'uppercase' as const },

        // Credits Container (Increased Right Margin for refined spacing)
        creditsWrapper: {
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginRight: '32px'
        },
        creditsValue: { fontSize: '13px', color: '#FFF', fontWeight: 'bold' as const, fontFamily: 'monospace', letterSpacing: '0.5px' },
        creditsLabel: { fontSize: '8px', color: '#FFF', fontFamily: 'monospace', textTransform: 'uppercase' as const, display: 'block', lineHeight: 1, marginBottom: '2px' },

        // Top Up Button (Subtly Highlighted Glow)
        topUpBtn: {
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            color: '#FFF',
            padding: '6px 14px',
            fontSize: '9px',
            fontWeight: 'bold' as const,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textTransform: 'uppercase' as const,
            transition: 'all 0.3s ease',
            borderRadius: '2px',
            boxShadow: '0 0 10px rgba(255, 0, 0, 0.1)'
        },

        // New Project Button (Outlined)
        actionButton: {
            backgroundColor: 'transparent',
            color: '#FFF',
            border: '1px solid #1F1F1F',
            padding: '8px 18px',
            fontSize: '10px',
            fontWeight: 'bold' as const,
            letterSpacing: '1px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'uppercase' as const,
            transition: 'all 0.3s ease',
            borderRadius: '4px'
        },

        // Operator Profile Button (Fixed Height and Brightness)
        operatorBtn: {
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: 'transparent',
            border: '1px solid #1F1F1F',
            padding: '7px 16px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textDecoration: 'none',
            borderRadius: '4px'
        }
    };

    return (
        <div style={styles.header}>
            <style jsx>{`
                .header-btn:hover {
                    border-color: #333 !important;
                    background-color: rgba(255,255,255,0.05) !important;
                }
                
                .topup-btn:hover {
                    background-color: rgba(255, 0, 0, 0.2) !important;
                    border-color: #FF0000 !important;
                    box-shadow: 0 0 15px rgba(255, 0, 0, 0.3) !important;
                }

                .op-text {
                    color: #FFF !important;
                    opacity: 1 !important;
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

                {/* 1. CREDITS SYSTEM */}
                <div style={styles.creditsWrapper}>
                    <div style={{ textAlign: 'right' }}>
                        <span style={styles.creditsLabel}>Credits</span>
                        <div style={styles.creditsValue}>
                            {credits !== null ? credits : '---'}
                        </div>
                    </div>

                    <Link href="/pricing" style={{ textDecoration: 'none' }}>
                        <button className="topup-btn" style={styles.topUpBtn}>
                            <Plus size={10} strokeWidth={4} /> TOP UP
                        </button>
                    </Link>
                </div>

                <Link href="/project/new">
                    <button className="flex items-center gap-2 bg-motion-surface border border-motion-border text-xs font-bold tracking-[2px] text-motion-text px-6 py-3 uppercase hover:bg-motion-bg transition-colors">
                        <Plus className="w-3 h-3" strokeWidth={3} />
                        New Project
                    </button>
                </Link>

                {/* 3. OPERATOR PROFILE */}
                <Link href="/profile" style={{ textDecoration: 'none' }}>
                    <div style={styles.operatorBtn} className="header-btn">
                        {/* Status Light */}
                        <div style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: '#00FF41',
                            borderRadius: '50%',
                            boxShadow: '0 0 8px rgba(0, 255, 65, 0.4)'
                        }}></div>

                        <div style={{ textAlign: 'left' }}>
                            <p className="op-text" style={{ fontSize: '8px', fontFamily: 'monospace', lineHeight: 1, marginBottom: '2px', textTransform: 'uppercase' }}>Operator</p>
                            <p className="op-text" style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: 1 }}>
                                {auth.currentUser?.displayName || 'OPERATOR_01'}
                            </p>
                        </div>
                        <User size={14} color="#FFF" style={{ opacity: 1 }} />
                    </div>
                </Link>

            </div>
        </div>
    );
}