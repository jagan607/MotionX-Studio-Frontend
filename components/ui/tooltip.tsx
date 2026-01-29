"use client";

import * as React from "react";

// 1. Context to manage hover state
interface TooltipContextType {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

const TooltipContext = React.createContext<TooltipContextType | undefined>(undefined);

// 2. Provider
export const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

// 3. Root Component
export const Tooltip = ({
    children,
    delayDuration = 200
}: {
    children: React.ReactNode,
    delayDuration?: number
}) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // --- FIX HERE: Initialize with null ---
    // We also broaden the type to generic 'ReturnType<typeof setTimeout>' to avoid Node vs Browser type conflicts
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const open = () => {
        timerRef.current = setTimeout(() => setIsOpen(true), delayDuration);
    };

    const close = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsOpen(false);
    };

    return (
        <TooltipContext.Provider value={{ isOpen, open, close }}>
            <div
                className="relative inline-flex"
                onMouseEnter={open}
                onMouseLeave={close}
                onFocus={open}
                onBlur={close}
            >
                {children}
            </div>
        </TooltipContext.Provider>
    );
};

// 4. Trigger
export const TooltipTrigger = ({ children, asChild }: { children: React.ReactNode, asChild?: boolean }) => {
    return <>{children}</>;
};

// 5. Content
export const TooltipContent = ({
    children,
    className = "",
    side = "top"
}: {
    children: React.ReactNode,
    className?: string,
    side?: "top" | "bottom"
}) => {
    const context = React.useContext(TooltipContext);

    if (!context?.isOpen) return null;

    const positions = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2"
    };

    return (
        <div className={`absolute z-50 min-w-max ${positions[side]} ${className}`}>
            <div className="animate-in fade-in zoom-in-95 duration-200">
                {children}
            </div>
        </div>
    );
};