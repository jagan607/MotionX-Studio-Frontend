"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TourGuideProps {
    step: number;
    onNext: () => void;
    onComplete: () => void;
}

export const TourGuide = ({ step, onNext, onComplete }: TourGuideProps) => {
    // State to hold the calculated position
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    // DYNAMIC POSITIONING LOGIC
    useEffect(() => {
        if (step === 0) return;

        // 1. Identify which element to hunt for
        const targetId = step === 1 ? "tour-assets-target" : "tour-storyboard-target";
        const el = document.getElementById(targetId);

        if (el) {
            const rect = el.getBoundingClientRect();

            if (step === 1) {
                // STEP 1: ASSETS (Tabs)
                // Place box BELOW the tabs, aligned to the right side of the tab bar
                setPos({
                    top: rect.bottom + 20, // 20px gap below the tabs
                    left: rect.right - 300 // Shift left by width of box (300px) to align right edges
                });
            } else {
                // STEP 2: STORYBOARD (Button)
                // Place box ABOVE the button
                setPos({
                    top: rect.top - 190, // Move up by height of box + gap
                    left: rect.left      // Align left edges
                });
            }
        }
    }, [step]); // Re-calculate whenever step changes

    // Don't render until we have a position
    if (step === 0 || !pos) return null;

    // --- STYLES ---
    const boxStyle: React.CSSProperties = {
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        backgroundColor: '#FF0000',
        color: 'white',
        padding: '20px',
        borderRadius: '4px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
        width: '300px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        lineHeight: '1.5',
        animation: 'fadeIn 0.3s ease-out',
        transition: 'top 0.3s, left 0.3s' // Smooth movement if window resizes
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        borderBottom: '1px solid rgba(255,255,255,0.3)',
        paddingBottom: '8px',
        fontWeight: 'bold',
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase'
    };

    const btnStyle: React.CSSProperties = {
        marginTop: '15px',
        backgroundColor: 'white',
        color: '#FF0000',
        border: 'none',
        padding: '8px 16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '10px',
        letterSpacing: '1px',
        width: '100%',
        borderRadius: '2px'
    };

    const arrowStyle: React.CSSProperties = {
        position: 'absolute',
        width: 0, height: 0,
        borderStyle: 'solid',
    };

    return (
        <>
            {/* BACKDROP */}
            <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9998, pointerEvents: 'none' }} />

            <div style={boxStyle}>
                {/* DYNAMIC ARROWS */}
                {step === 1 ? (
                    // Arrow pointing UP (Box is below tabs)
                    <div style={{
                        ...arrowStyle,
                        top: '-8px',
                        right: '40px',
                        borderWidth: '0 8px 8px 8px',
                        borderColor: 'transparent transparent #FF0000 transparent'
                    }} />
                ) : (
                    // Arrow Pointing DOWN (Box is above button)
                    <div style={{
                        ...arrowStyle,
                        bottom: '-8px',
                        left: '40px',
                        borderWidth: '8px 8px 0 8px',
                        borderColor: '#FF0000 transparent transparent transparent'
                    }} />
                )}

                <div style={headerStyle}>
                    <span>{step === 1 ? "ASSET LAB" : "STORYBOARD"}</span>
                    <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={step === 1 ? onNext : onComplete} />
                </div>

                <p style={{ opacity: 0.9 }}>
                    {step === 1
                        ? "AI has auto-detected Characters & Locations from your script. Review casting here before filming."
                        : "This is your first scene. Click OPEN STORYBOARD below to enter the Director's View."}
                </p>

                <button style={btnStyle} onClick={step === 1 ? onNext : onComplete}>
                    {step === 1 ? "NEXT" : "GOT IT"}
                </button>
            </div>

            <style>{`
                @keyframes fadeIn { 
                    from { opacity: 0; transform: translateY(5px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
            `}</style>
        </>
    );
};