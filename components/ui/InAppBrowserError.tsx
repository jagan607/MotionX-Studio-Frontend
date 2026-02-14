"use client";

import { AlertTriangle, Copy } from "lucide-react";
import { useState } from "react";

export default function InAppBrowserError() {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        if (typeof window !== "undefined") {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const styles = {
        container: {
            width: '100%',
            padding: '25px',
            backgroundColor: '#1a0505', // Deep red/black background
            border: '1px solid #FF0000',
            color: '#FF0000',
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: '1.6',
            letterSpacing: '1px',
            textTransform: 'uppercase' as const,
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '15px',
            alignItems: 'center',
            textAlign: 'center' as const,
            boxShadow: '0 0 20px rgba(255, 0, 0, 0.1)'
        },
        header: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            fontWeight: 'bold',
            borderBottom: '1px solid rgba(255,0,0,0.3)',
            paddingBottom: '10px',
            width: '100%',
            justifyContent: 'center'
        },
        instruction: {
            color: '#ff6b6b' // Slightly lighter red for readability
        },
        copyBtn: {
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid #FF0000',
            color: '#FF0000',
            padding: '8px 16px',
            fontSize: '10px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '5px',
            textTransform: 'uppercase' as const,
            transition: 'all 0.2s'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <AlertTriangle size={18} />
                SECURITY PROTOCOL: RESTRICTED
            </div>

            <div>
                GOOGLE IDENTITY SERVICES BLOCKED IN EMBEDDED VIEWER.
            </div>

            <div style={styles.instruction}>
                PLEASE TAP THE <strong>...</strong> MENU AND SELECT
                <br />
                <strong>"OPEN IN SYSTEM BROWSER"</strong>
            </div>

            {/* Helpful feature: Let them copy the link easily if they want to paste it in Chrome */}
            <button onClick={handleCopyLink} style={styles.copyBtn}>
                {copied ? "URL COPIED TO CLIPBOARD" : <><Copy size={12} /> COPY PAGE URL</>}
            </button>
        </div>
    );
}