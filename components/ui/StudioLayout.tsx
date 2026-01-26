import React, { ReactNode } from 'react';

export const StudioLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <main className="min-h-screen bg-motion-bg bg-studio-gradient text-motion-text font-sans flex justify-center items-start pt-[60px] pb-[60px] px-8 overflow-y-auto">
            <div className="w-full max-w-[800px] mt-5">
                {children}
            </div>
        </main>
    );
};