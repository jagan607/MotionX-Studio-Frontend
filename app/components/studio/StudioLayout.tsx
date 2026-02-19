"use client";

import React, { ReactNode } from "react";

interface StudioLayoutProps {
    children: ReactNode;
    className?: string;
}

export const StudioLayout: React.FC<StudioLayoutProps> = ({
    children,
    className = ""
}) => {
    return (
        <div className={`fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col studio-grain studio-vignette ${className}`}>

            {/* --- GLOBAL STUDIO STYLES --- */}
            <style jsx global>{`
                /* 1. Scene Card Overrides */
                .scene-card-wrapper > div {
                    transition: all 0.3s ease;
                }
                .scene-card-wrapper > div:hover {
                    border-color: rgba(255,255,255,0.12) !important;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04) !important;
                }

                /* 2. Custom Scrollbar (Dark/Minimal) */
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #444; }

                /* 3. Font Smoothing */
                body {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    background-color: #050505;
                }

                /* 4. Film Grain Texture */
                .studio-grain::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    opacity: 0.025;
                    pointer-events: none;
                    z-index: 9999;
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
                    background-size: 128px 128px;
                }

                /* 5. Warm Vignette */
                .studio-vignette::after {
                    content: '';
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 9998;
                    background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%);
                }
            `}</style>

            {children}
        </div>
    );
};