"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TourGuideProps {
    step: number;
    onNext: () => void;
    onComplete: () => void;
}

export const TourGuide = ({ step, onNext, onComplete }: TourGuideProps) => {
    // 1. STATE: Store explicit dimensions for both Tooltip and Spotlight
    const [pos, setPos] = useState<{
        tooltipTop: number;
        tooltipLeft: number;
        targetTop: number;
        targetLeft: number;
        targetWidth: number;
        targetHeight: number;
    } | null>(null);

    // DYNAMIC POSITIONING LOGIC
    useEffect(() => {
        if (step === 0) return;

        // 1. Identify which element to hunt for
        const targetId = step === 1 ? "tour-assets-target" : "tour-storyboard-target";
        const el = document.getElementById(targetId);

        if (el) {
            const rect = el.getBoundingClientRect();

            if (step === 1) {
                // STEP 1: ASSETS (Tabs) -> Tooltip BELOW
                setPos({
                    // Spotlight matches target exactly
                    targetTop: rect.top,
                    targetLeft: rect.left,
                    targetWidth: rect.width,
                    targetHeight: rect.height,

                    // Tooltip Position: Below tabs, aligned right
                    tooltipTop: rect.bottom + 20,
                    tooltipLeft: rect.right - 300
                });
            } else {
                // STEP 2: STORYBOARD (Button) -> Tooltip ABOVE
                setPos({
                    // Spotlight matches target exactly
                    targetTop: rect.top,
                    targetLeft: rect.left,
                    targetWidth: rect.width,
                    targetHeight: rect.height,

                    // Tooltip Position: Above button, aligned left
                    tooltipTop: rect.top - 190,
                    tooltipLeft: rect.left
                });
            }
        }
    }, [step]);

    // Don't render until we have a position
    if (step === 0 || !pos) return null;

    // --- STYLES ---

    // 2. SPOTLIGHT STYLE (The Focus Effect)
    const spotlightStyle: React.CSSProperties = {
        position: 'fixed',
        top: pos.targetTop,
        left: pos.targetLeft,
        width: pos.targetWidth,
        height: pos.targetHeight,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85)', // Massive shadow creates the overlay
        borderRadius: '4px',
        zIndex: 9998, // Behind the tooltip
        pointerEvents: 'none', // Allows clicking through to the target
        transition: 'all 0.3s ease'
    };

    const boxStyle: React.CSSProperties = {
        position: 'fixed',
        top: pos.tooltipTop,
        left: pos.tooltipLeft,
        backgroundColor: '#FF0000',
        color: 'white',
        padding: '20px',
        borderRadius: '4px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)',
        zIndex: 9999, // Above spotlight
        width: '300px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        lineHeight: '1.5',
        animation: 'fadeIn 0.3s ease-out',
        transition: 'top 0.3s, left 0.3s'
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
            {/* 3. RENDER SPOTLIGHT */}
            <div style={spotlightStyle} />

            {/* RENDER TOOLTIP */}
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