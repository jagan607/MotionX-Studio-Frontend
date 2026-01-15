"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TourProps {
    step: number;
    onNext: () => void;
    onComplete: () => void;
}

export const DashboardTour = ({ step, onNext, onComplete }: TourProps) => {
    // 1. UPDATE STATE: Store 'rect' to capture width/height of the target
    const [pos, setPos] = useState<{ top: number; left: number, rect?: DOMRect } | null>(null);

    useEffect(() => {
        if (step === 0) return;

        // TARGETS: These IDs must exist in your GlobalHeader
        const targetId = step === 1 ? "tour-credits-target" : "tour-new-series-target";
        const el = document.getElementById(targetId);

        if (el) {
            const rect = el.getBoundingClientRect();
            setPos({
                // Tooltip position
                top: rect.bottom + 20,
                left: rect.right - 300,
                // 2. SAVE RECT: We need the target's exact geometry for the spotlight
                rect: rect
            });
        }
    }, [step]);

    if (step === 0 || !pos) return null;

    // --- SPOTLIGHT STYLE ---
    // This creates a transparent hole over the target and shadows everything else
    const spotlightStyle: React.CSSProperties = {
        position: 'fixed',
        top: pos.rect?.top,
        left: pos.rect?.left,
        width: pos.rect?.width,
        height: pos.rect?.height,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.85)', // THE DARK OVERLAY
        borderRadius: '4px',
        zIndex: 9998, // Behind tooltip, above content
        pointerEvents: 'none', // Allow clicking the button through the hole
        transition: 'all 0.3s ease'
    };

    // --- TOOLTIP BOX STYLE ---
    const boxStyle: React.CSSProperties = {
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        backgroundColor: '#FF0000',
        color: 'white',
        padding: '20px',
        borderRadius: '2px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)',
        zIndex: 9999, // Above spotlight
        width: '300px',
        fontSize: '13px',
        fontWeight: 500,
        letterSpacing: '0.5px',
        lineHeight: '1.5',
        animation: 'fadeIn 0.3s ease-out',
        transition: 'all 0.3s ease'
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

    // Triangle Pointer (Pointing UP)
    const arrowStyle: React.CSSProperties = {
        position: 'absolute', width: 0, height: 0, borderStyle: 'solid',
        top: '-8px', right: '20px',
        borderWidth: '0 8px 8px 8px',
        borderColor: 'transparent transparent #FF0000 transparent'
    };

    return (
        <>
            {/* 3. RENDER THE SPOTLIGHT */}
            <div style={spotlightStyle} />

            <div style={boxStyle}>
                <div style={arrowStyle} />

                <div style={headerStyle}>
                    <span>{step === 1 ? "SYSTEM CREDITS" : "START CREATING"}</span>
                    <X size={14} style={{ cursor: 'pointer', opacity: 0.8 }} onClick={step === 1 ? onNext : onComplete} />
                </div>

                <p style={{ opacity: 0.9 }}>
                    {step === 1
                        ? "This is your production fuel. Every AI generation consumes credits. Keep an eye on this meter."
                        : "Ready to direct? Click here to initialize a new Series and start generating your script."}
                </p>

                <button style={btnStyle} onClick={step === 1 ? onNext : onComplete}>
                    {step === 1 ? "NEXT" : "LET'S BEGIN"}
                </button>
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </>
    );
};