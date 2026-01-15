"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Plus, LogOut, Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

export default function GlobalHeader() {
    const router = useRouter();
    const pathname = usePathname();
    const { credits } = useCredits();

    // 1. HIDE ON LOGIN PAGE
    if (pathname === "/login") return null;

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

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
        infoBox: { display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid #333', paddingRight: '20px', marginRight: '20px' },
        logoutBtn: { backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '8px 16px', fontSize: '10px', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' as const },
        createButton: { backgroundColor: '#FF0000', color: 'black', border: 'none', padding: '10px 20px', fontSize: '10px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const },
    };

    return (
        <div style={styles.header}>
            {/* LEFT: LOGO */}
            <Link href="/" style={{ textDecoration: 'none' }}>
                <div>
                    <h1 style={styles.logo}>Motion X <span style={{ color: '#FF0000' }}>Studio</span></h1>
                    <p style={styles.subLogo}>/// PRODUCTION_TERMINAL_V1</p>
                </div>
            </Link>

            {/* RIGHT: CONTROLS */}
            <div style={{ display: 'flex', alignItems: 'center' }}>

                {/* 1. OPERATOR INFO */}
                <div style={styles.infoBox}>
                    <div style={{ width: '6px', height: '6px', backgroundColor: '#00FF41', borderRadius: '50%', boxShadow: '0 0 10px #00FF41' }}></div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>OPERATOR</p>
                        <p style={{ fontSize: '10px', color: '#FFF', fontWeight: 'bold' }}>{auth.currentUser?.displayName || 'UNKNOWN'}</p>
                    </div>
                </div>

                {/* 2. CREDITS INFO (Target ID Added) */}
                <div id="tour-credits-target" style={styles.infoBox}>
                    <Zap size={14} color="#FF0000" />
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>CREDITS</p>
                        <p style={{ fontSize: '10px', color: credits && credits > 0 ? '#FFF' : '#FF0000', fontWeight: 'bold' }}>
                            {credits !== null ? credits : '...'}
                        </p>
                    </div>
                </div>

                <button onClick={handleLogout} style={styles.logoutBtn}> <LogOut size={14} /> EXIT</button>

                <div style={{ marginLeft: '20px' }}>
                    <Link href="/series/new" style={{ textDecoration: 'none' }}>
                        {/* 3. NEW SERIES BUTTON (Target ID Added) */}
                        <button id="tour-new-series-target" style={styles.createButton}>
                            <Plus size={14} strokeWidth={3} /> NEW SERIES
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}