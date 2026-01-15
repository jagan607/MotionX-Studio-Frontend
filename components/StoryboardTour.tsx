"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TourProps {
    step: number;
    onNext: () => void;
    onComplete: () => void;
}

export const StoryboardTour = ({ step, onNext, onComplete }: TourProps) => {
    const [pos, setPos] = useState<{ top: number; left: number, arrowRight?: number, arrowLeft?: number } | null>(null);

    useEffect(() => {
        if (step === 0) return;

        const targetId = step === 1 ? "tour-sb-aspect" : "tour-sb-autodirect";
        const el = document.getElementById(targetId);

        if (el) {
            const rect = el.getBoundingClientRect();

            // Logic: Different alignment for Aspect Ratio (Center/Left) vs Auto-Direct (Right)
            if (step === 1) {
                setPos({ top: rect.bottom + 20, left: rect.left, arrowLeft: 30 });
            } else {
                setPos({ top: rect.bottom + 20, left: rect.right - 300, arrowRight: 30 });
            }
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

    // Dynamic arrow position based on step
    const arrowStyle: React.CSSProperties = {
        position: 'absolute', width: 0, height: 0, borderStyle: 'solid',
        top: '-8px',
        right: pos.arrowRight ? `${pos.arrowRight}px` : 'auto',
        left: pos.arrowLeft ? `${pos.arrowLeft}px` : 'auto',
        borderWidth: '0 8px 8px 8px',
        borderColor: 'transparent transparent #FF0000 transparent'
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
        borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '8px',
        fontWeight: 'bold', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase'
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
                <div style={headerStyle}>
                    <span>{step === 1 ? "SET FORMAT" : "AI DIRECTOR"}</span>
                    <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={step === 1 ? onNext : onComplete} />
                </div>
                <p style={{ opacity: 0.9 }}>
                    {step === 1
                        ? "Choose your format first. Select 16:9 for Cinematic widescreen or 9:16 for Social/Reels before generating shots."
                        : "The Magic Button. Click here to let AI automatically generate a shot list, camera angles, and prompts based on your scene action."}
                </p>
                <button style={btnStyle} onClick={step === 1 ? onNext : onComplete}>
                    {step === 1 ? "NEXT" : "UNDERSTOOD"}
                </button>
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </>
    );
};