"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TourProps {
    step: number;
    onComplete: () => void;
}

export const SeriesTour = ({ step, onComplete }: TourProps) => {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (step === 0) return;

        const el = document.getElementById("tour-series-new-ep");
        if (el) {
            const rect = el.getBoundingClientRect();
            setPos({
                top: rect.bottom + 20,
                // Align to right side of button, shifting left to fit box
                left: rect.right - 300
            });
        }
    }, [step]);

    if (step === 0 || !pos) return null;

    const boxStyle: React.CSSProperties = {
        position: 'fixed', top: pos.top, left: pos.left,
        backgroundColor: '#FF0000', color: 'white', padding: '20px', borderRadius: '2px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)', zIndex: 9999, width: '300px',
        fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px', lineHeight: '1.5',
        animation: 'fadeIn 0.3s ease-out', transition: 'all 0.3s ease'
    };

    const arrowStyle: React.CSSProperties = {
        position: 'absolute', width: 0, height: 0, borderStyle: 'solid',
        top: '-8px', right: '30px', borderWidth: '0 8px 8px 8px',
        borderColor: 'transparent transparent #FF0000 transparent'
    };

    const btnStyle: React.CSSProperties = {
        marginTop: '15px', backgroundColor: 'white', color: '#FF0000', border: 'none',
        padding: '8px 16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '10px',
        letterSpacing: '1px', width: '100%', borderRadius: '2px'
    };

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9998, pointerEvents: 'none' }} />
            <div style={boxStyle}>
                <div style={arrowStyle} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '8px', fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>
                    <span>INITIALIZE SEQUENCE</span>
                    <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={onComplete} />
                </div>
                <p style={{ opacity: 0.9 }}>
                    Initialize your first Episode Sequence here. You can upload an existing script (PDF/TXT) or start with a blank slate.
                </p>
                <button style={btnStyle} onClick={onComplete}>GOT IT</button>
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </>
    );
};