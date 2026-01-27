import React, { ReactNode } from 'react';

export const StudioLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        // Changed:
        // 1. h-screen + overflow-hidden: Locks the app to the window size (No body scroll).
        // 2. pt-16: Reduced top padding to pull content up closer to the header.
        // 3. pb-4: Minimal bottom padding to maximize vertical space.
        <main className="h-screen bg-motion-bg bg-studio-gradient text-motion-text font-sans flex justify-center items-start pt-16 pb-4 px-4 lg:px-8 overflow-hidden">
            <div className="w-full max-w-[1600px] h-full relative flex flex-col">
                {children}
            </div>
        </main>
    );
};