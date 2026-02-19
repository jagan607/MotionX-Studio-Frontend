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
        rounded-lg
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50
    `;

    const variants = {
        primary: `
            bg-gradient-to-r from-[#B91C1C] to-[#E50914]
            text-white 
            hover:from-[#DC2626] hover:to-[#EF4444]
            hover:shadow-[0_0_30px_rgba(229,9,20,0.35)]
            shadow-[0_0_15px_rgba(229,9,20,0.15)]
            border border-red-500/20
            hover:scale-[1.01]
            active:scale-[0.99]
        `,
        outline: `
            bg-transparent 
            border border-neutral-700 
            text-gray-400 
            hover:border-red-600 hover:text-white
            hover:shadow-[0_0_20px_rgba(229,9,20,0.1)]
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