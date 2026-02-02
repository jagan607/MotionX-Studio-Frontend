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
        <div className={`fixed inset-0 z-50 bg-[#050505] text-[#EEE] font-sans overflow-hidden flex flex-col ${className}`}>

            {/* --- GLOBAL STUDIO STYLES --- */}
            <style jsx global>{`
                /* 1. Brutalist Reset: Force sharp corners */
                div[class*="rounded-"], div[class*="rounded"], button, input, select {
                    border-radius: 0px !important;
                }
                
                /* 2. Scene Card Overrides */
                .scene-card-wrapper > div {
                    background-color: #0A0A0A !important;
                    border: 1px solid #222 !important;
                    box-shadow: none !important;
                    transition: all 0.2s ease;
                }
                .scene-card-wrapper > div:hover {
                    border-color: #555 !important;
                    background-color: #0F0F0F !important;
                }

                /* 3. Custom Scrollbar (Dark/Minimal) */
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: #333; border: 1px solid #050505; }
                ::-webkit-scrollbar-thumb:hover { background: #555; }

                /* 4. Font Smoothing */
                body {
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    background-color: #050505;
                }
            `}</style>

            {children}
        </div>
    );
};