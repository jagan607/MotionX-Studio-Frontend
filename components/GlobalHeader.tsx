"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, User } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import CreditModal from "@/app/components/modals/CreditModal";

export default function GlobalHeader() {
    const pathname = usePathname();
    const { credits } = useCredits();
    const [showTopUp, setShowTopUp] = useState(false);

    // --- LOGIC UPDATE: Hide Header on "App Mode" Pages ---
    // This prevents double-headers on the Script/Studio pages
    const isEditorPage = pathname.includes('/project/') && (
        pathname.includes('/script') ||
        pathname.includes('/studio') ||
        pathname.includes('/draft') ||
        pathname.includes('/assets') ||
        pathname.includes('/new')
    );

    // If we are on Login, Landing, Pricing, OR an Editor Page -> Hide this header
    if (pathname === "/login" || pathname === "/" || pathname === "/pricing" || isEditorPage) {
        return null;
    }

    // --- SHARED STYLES (Unchanged) ---
    const styles = {
        header: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #1F1F1F', padding: '16px 40px',
            backgroundColor: '#050505',
            position: 'sticky' as const, top: 0, zIndex: 50
        },
        logo: { fontSize: '24px', fontFamily: 'Anton, sans-serif', textTransform: 'uppercase' as const, lineHeight: '1', letterSpacing: '1px', color: '#FFF' },
        subLogo: { fontSize: '9px', color: '#FF0000', letterSpacing: '3px', fontWeight: 'bold' as const, marginTop: '4px', textTransform: 'uppercase' as const },
        creditsWrapper: { display: 'flex', alignItems: 'center', gap: '16px', marginRight: '32px' },
        creditsValue: { fontSize: '13px', color: '#FFF', fontWeight: 'bold' as const, fontFamily: 'monospace', letterSpacing: '0.5px' },
        creditsLabel: { fontSize: '8px', color: '#FFF', fontFamily: 'monospace', textTransform: 'uppercase' as const, display: 'block', lineHeight: 1, marginBottom: '2px' },
        topUpBtn: {
            backgroundColor: 'rgba(255, 0, 0, 0.1)', border: '1px solid rgba(255, 0, 0, 0.3)',
            color: '#FFF', padding: '6px 14px', fontSize: '9px', fontWeight: 'bold' as const,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            textTransform: 'uppercase' as const, transition: 'all 0.3s ease', borderRadius: '2px',
            boxShadow: '0 0 10px rgba(255, 0, 0, 0.1)'
        },
        operatorBtn: {
            display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: 'transparent',
            border: '1px solid #1F1F1F', padding: '7px 16px', cursor: 'pointer',
            transition: 'all 0.2s ease', textDecoration: 'none', borderRadius: '4px'
        }
    };

    return (
        <>
            <CreditModal isOpen={showTopUp} onClose={() => setShowTopUp(false)} />
            <div style={styles.header}>
                <style jsx>{`
                    .topup-btn:hover { background-color: rgba(255, 0, 0, 0.2) !important; border-color: #FF0000 !important; box-shadow: 0 0 15px rgba(255, 0, 0, 0.3) !important; }
                    .header-btn:hover { border-color: #333 !important; background-color: rgba(255,255,255,0.05) !important; }
                    .op-text { color: #FFF !important; opacity: 1 !important; }
                `}</style>

                <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                    <div>
                        <h1 style={styles.logo}>Motion X <span style={{ color: '#FF0000' }}>Studio</span></h1>
                        <p style={styles.subLogo}>/// PRODUCTION_TERMINAL_V1</p>
                    </div>
                </Link>

                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={styles.creditsWrapper}>
                        <div style={{ textAlign: 'right' }}>
                            <span style={styles.creditsLabel}>Credits</span>
                            <div style={styles.creditsValue}>{credits !== null ? credits : '---'}</div>
                        </div>
                        <button className="topup-btn" style={styles.topUpBtn} onClick={() => setShowTopUp(true)}>
                            <Plus size={10} strokeWidth={4} /> TOP UP
                        </button>
                    </div>

                    <Link href="/project/new">
                        <button className="flex items-center gap-2 bg-[#1A1A1A] border border-[#333] text-xs font-bold tracking-[2px] text-white px-6 py-3 uppercase hover:bg-[#222] transition-colors mr-4">
                            <Plus className="w-3 h-3" strokeWidth={3} /> New Project
                        </button>
                    </Link>

                    <Link href="/profile" style={{ textDecoration: 'none' }}>
                        <div style={styles.operatorBtn} className="header-btn">
                            <div style={{ width: '6px', height: '6px', backgroundColor: '#00FF41', borderRadius: '50%', boxShadow: '0 0 8px rgba(0, 255, 65, 0.4)' }}></div>
                            <div style={{ textAlign: 'left' }}>
                                <p className="op-text" style={{ fontSize: '8px', fontFamily: 'monospace', lineHeight: 1, marginBottom: '2px', textTransform: 'uppercase' }}>Operator</p>
                                <p className="op-text" style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: 1 }}>{auth.currentUser?.displayName || 'OPERATOR_01'}</p>
                            </div>
                            <User size={14} color="#FFF" style={{ opacity: 1 }} />
                        </div>
                    </Link>
                </div>
            </div>
        </>
    );
}