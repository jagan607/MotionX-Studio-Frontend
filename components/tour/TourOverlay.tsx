"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { TourStep } from "@/lib/tourConfigs";

interface TourOverlayProps {
    step: number;           // Current step (1-indexed). 0 = hidden.
    steps: TourStep[];      // Declarative step config array
    onNext: () => void;
    onComplete: () => void;
}

interface TargetRect {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
    right: number;
}

export const TourOverlay = ({ step, steps, onNext, onComplete }: TourOverlayProps) => {
    const [mounted, setMounted] = useState(false);
    const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Portal requires document to be available
    useEffect(() => { setMounted(true); }, []);

    // Step 1: Find the target element and store its rect
    useEffect(() => {
        if (step === 0 || step > steps.length) {
            setTargetRect(null);
            setTooltipPos(null);
            return;
        }
        setTooltipPos(null); // hide tooltip while repositioning

        const currentStep = steps[step - 1];

        const tryFind = (attempts = 0) => {
            const el = document.getElementById(currentStep.targetId);
            if (!el && attempts < 10) {
                setTimeout(() => tryFind(attempts + 1), 100);
                return;
            }
            if (!el) return;

            const rect = el.getBoundingClientRect();
            setTargetRect({
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            });
        };

        tryFind();
    }, [step, steps]);

    // Step 2: After tooltip renders, measure its actual height and compute final position
    useLayoutEffect(() => {
        if (!targetRect || !tooltipRef.current) return;

        const currentStep = steps[step - 1];
        const tooltipEl = tooltipRef.current;
        const tooltipWidth = tooltipEl.offsetWidth || 300;
        const tooltipHeight = tooltipEl.offsetHeight || 200;
        const GAP = 14;

        let top = 0;
        let left = 0;

        switch (currentStep.placement) {
            case "bottom":
                top = targetRect.bottom + GAP;
                left = currentStep.arrowSide === "right"
                    ? targetRect.right - tooltipWidth
                    : targetRect.left;
                break;
            case "top":
                top = targetRect.top - tooltipHeight - GAP;
                left = currentStep.arrowSide === "right"
                    ? targetRect.right - tooltipWidth
                    : targetRect.left;
                break;
            case "left":
                top = targetRect.top;
                left = targetRect.left - tooltipWidth - GAP;
                break;
            case "right":
                top = targetRect.top;
                left = targetRect.right + GAP;
                break;
        }

        // Clamp to viewport
        left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));

        setTooltipPos({ top, left });
    }, [targetRect, step, steps]);

    if (!mounted || step === 0 || step > steps.length) return null;

    const currentStep = steps[step - 1];
    const isLastStep = step === steps.length;
    const handleAction = isLastStep ? onComplete : onNext;
    const handleClose = isLastStep ? onComplete : onNext;

    // Arrow direction based on placement
    const getArrowStyle = (): React.CSSProperties => {
        const base: React.CSSProperties = {
            position: "absolute",
            width: 0,
            height: 0,
            borderStyle: "solid",
        };
        switch (currentStep.placement) {
            case "bottom":
                return {
                    ...base,
                    top: "-8px",
                    right: currentStep.arrowSide === "right" ? "20px" : "auto",
                    left: currentStep.arrowSide !== "right" ? "20px" : "auto",
                    borderWidth: "0 8px 8px 8px",
                    borderColor: "transparent transparent #E50914 transparent",
                };
            case "top":
                return {
                    ...base,
                    bottom: "-8px",
                    right: currentStep.arrowSide === "right" ? "20px" : "auto",
                    left: currentStep.arrowSide !== "right" ? "20px" : "auto",
                    borderWidth: "8px 8px 0 8px",
                    borderColor: "#E50914 transparent transparent transparent",
                };
            case "left":
                return {
                    ...base,
                    right: "-8px",
                    top: "20px",
                    borderWidth: "8px 0 8px 8px",
                    borderColor: "transparent transparent transparent #E50914",
                };
            case "right":
                return {
                    ...base,
                    left: "-8px",
                    top: "20px",
                    borderWidth: "8px 8px 8px 0",
                    borderColor: "transparent #E50914 transparent transparent",
                };
        }
    };

    const overlay = (
        <>
            {/* SPOTLIGHT — transparent hole over target, dark overlay everywhere else */}
            {targetRect && (
                <div
                    style={{
                        position: "fixed",
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.85)",
                        borderRadius: "4px",
                        zIndex: 9998,
                        pointerEvents: "none",
                        transition: "all 0.3s ease",
                    }}
                />
            )}

            {/* TOOLTIP BOX — always rendered (for measurement), invisible until positioned */}
            <div
                ref={tooltipRef}
                style={{
                    position: "fixed",
                    top: tooltipPos?.top ?? -9999,
                    left: tooltipPos?.left ?? -9999,
                    width: "300px",
                    backgroundColor: "#E50914",
                    color: "white",
                    padding: "20px",
                    borderRadius: "2px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.9)",
                    zIndex: 9999,
                    fontSize: "13px",
                    fontWeight: 500,
                    letterSpacing: "0.5px",
                    lineHeight: "1.5",
                    opacity: tooltipPos ? 1 : 0,
                    animation: tooltipPos ? "tourFadeIn 0.3s ease-out" : "none",
                    transition: "top 0.25s ease, left 0.25s ease",
                    fontFamily: "Inter, sans-serif",
                }}
            >
                {/* Arrow */}
                <div style={getArrowStyle()} />

                {/* Header */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "10px",
                        borderBottom: "1px solid rgba(255,255,255,0.3)",
                        paddingBottom: "8px",
                        fontWeight: "bold",
                        fontSize: "11px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                    }}
                >
                    <span>{currentStep.title}</span>
                    <X
                        size={14}
                        style={{ cursor: "pointer", opacity: 0.8 }}
                        onClick={handleClose}
                    />
                </div>

                {/* Body */}
                <p style={{ opacity: 0.9, margin: 0 }}>{currentStep.body}</p>

                {/* Step indicator */}
                {steps.length > 1 && (
                    <div style={{ display: "flex", gap: "4px", marginTop: "12px" }}>
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                style={{
                                    width: "20px",
                                    height: "2px",
                                    backgroundColor: i + 1 === step ? "white" : "rgba(255,255,255,0.3)",
                                    borderRadius: "1px",
                                    transition: "background-color 0.2s",
                                }}
                            />
                        ))}
                    </div>
                )}

                {/* Action Button */}
                <button
                    style={{
                        marginTop: "15px",
                        backgroundColor: "white",
                        color: "#E50914",
                        border: "none",
                        padding: "8px 16px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        fontSize: "10px",
                        letterSpacing: "1px",
                        width: "100%",
                        borderRadius: "2px",
                        textTransform: "uppercase",
                    }}
                    onClick={handleAction}
                >
                    {isLastStep ? "GOT IT" : "NEXT"}
                </button>
            </div>

            <style>{`
                @keyframes tourFadeIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );

    // Portal → renders into document.body, works inside modals too
    return createPortal(overlay, document.body);
};
