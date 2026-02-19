"use client";

import { useCredits } from "@/hooks/useCredits";
import { Zap, Coins } from "lucide-react";

export default function CreditBadge() {
    const { credits, loading } = useCredits();

    // STYLES (Cyber-Brutalist & Inline)
    const styles = {
        container: {
            position: 'fixed' as const,
            top: '20px',
            right: '30px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(10, 10, 10, 0.75)',
            backdropFilter: 'blur(16px) saturate(180%)',
            WebkitBackdropFilter: 'blur(16px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '10px 20px',
            borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontFamily: 'monospace',
            transition: 'all 0.3s ease',
            cursor: 'default',
        },
        label: {
            fontSize: '9px',
            color: '#666',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            marginBottom: '2px',
        },
        value: {
            fontSize: '14px',
            fontWeight: 'bold',
            color: credits !== null && credits > 0 ? '#FFF' : '#E50914',
        },
        iconBox: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: credits !== null && credits > 0 ? '#00FF41' : '#E50914',
        }
    };

    if (loading) return null; // Or a small spinner

    return (
        <div style={styles.container}>
            {/* Icon Section */}
            <div style={styles.iconBox}>
                {credits && credits > 0 ? <Coins size={16} /> : <Zap size={16} />}
            </div>

            {/* Text Section */}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                <span style={styles.label}>Aval. Credits</span>
                <span style={styles.value}>
                    {credits !== null ? credits : 0}
                </span>
            </div>

            {/* Optional: Visual "Indicator" Light */}
            <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: credits && credits > 0 ? '#00FF41' : '#E50914',
                boxShadow: credits && credits > 0 ? '0 0 8px #00FF41' : '0 0 8px #E50914'
            }} />
        </div>
    );
}