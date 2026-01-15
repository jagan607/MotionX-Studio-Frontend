"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface TourProps {
    step: number;
    onNext: () => void;
    onComplete: () => void;
}

export const DashboardTour = ({ step, onNext, onComplete }: TourProps) => {
    const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

    useEffect(() => {
        if (step === 0) return;

        // TARGETS: We will add these IDs to your GlobalHeader next
        const targetId = step === 1 ? "tour-credits-target" : "tour-new-series-target";
        const el = document.getElementById(targetId);

        if (el) {
            const rect = el.getBoundingClientRect();

            // Logic: Place box BELOW the element, aligned roughly to the RIGHT
            setPos({
                top: rect.bottom + 20,
                left: rect.right - 300 // Shift left to keep box on screen
            });
        }
    }, [step]);

    if (step === 0 || !pos) return null;

    // STYLES
    const boxStyle: React.CSSProperties = {
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        backgroundColor: '#FF0000',
        color: 'white',
        padding: '20px',
        borderRadius: '2px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.9)',
        zIndex: 9999,
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
            <div style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 9998, pointerEvents: 'none' }} />

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