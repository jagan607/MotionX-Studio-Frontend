import React, { ReactNode } from 'react';

export const StudioLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        // Layout constraints:
        // 1. flex-1: Fills remaining space after GlobalHeader (not h-screen, which would overflow)
        // 2. overflow-hidden: Prevents any scrollbars
        // 3. No top padding needed - GlobalHeader is a sibling in root layout
        <main className="flex-1 bg-motion-bg bg-studio-gradient text-motion-text font-sans flex justify-center items-stretch py-2 px-4 lg:px-8 overflow-hidden">
            <div className="w-full max-w-[1600px] h-full relative flex flex-col overflow-hidden">
                {children}
            </div>
        </main>
    );
};