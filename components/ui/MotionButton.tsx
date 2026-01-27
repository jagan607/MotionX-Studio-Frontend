import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface MotionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    variant?: 'primary' | 'outline';
}

export const MotionButton: React.FC<MotionButtonProps> = ({
    children,
    loading,
    variant = 'primary',
    className,
    disabled,
    ...props
}) => {
    const baseStyles = `
        w-full py-4 text-xs font-bold tracking-[2px] uppercase 
        transition-all duration-300 ease-out
        flex items-center justify-center gap-2
        rounded-md
    `;

    const variants = {
        primary: `
            bg-gradient-to-r from-motion-red to-red-600
            text-white 
            hover:from-red-600 hover:to-motion-red
            hover:shadow-[0_0_40px_rgba(255,0,0,0.4)]
            shadow-[0_0_20px_rgba(255,0,0,0.2)]
            border border-red-500/30
            hover:scale-[1.01]
            active:scale-[0.99]
        `,
        outline: `
            bg-transparent 
            border border-neutral-700 
            text-motion-text-muted 
            hover:border-motion-red hover:text-white
            hover:shadow-[0_0_20px_rgba(255,0,0,0.1)]
        `
    };

    return (
        <button
            disabled={loading || disabled}
            className={`${baseStyles} ${variants[variant]} ${loading || disabled ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''} ${className || ""}`}
            {...props}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
};