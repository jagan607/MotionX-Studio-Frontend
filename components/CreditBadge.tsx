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
            backgroundColor: 'rgba(5, 5, 5, 0.85)', // Dark Glass
            backdropFilter: 'blur(10px)',
            border: '1px solid #333',
            padding: '10px 20px',
            borderRadius: '0px', // Square edges for brutalist look
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
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
            color: credits !== null && credits > 0 ? '#FFF' : '#FF0000', // Red if 0
        },
        iconBox: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: credits !== null && credits > 0 ? '#00FF41' : '#FF0000', // Green if has credits
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
                backgroundColor: credits && credits > 0 ? '#00FF41' : '#FF0000',
                boxShadow: credits && credits > 0 ? '0 0 8px #00FF41' : '0 0 8px #FF0000'
            }} />
        </div>
    );
}