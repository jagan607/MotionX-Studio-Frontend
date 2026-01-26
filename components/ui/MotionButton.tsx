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
    const baseStyles = "w-full py-6 text-xs font-bold tracking-[2px] uppercase transition-all flex items-center justify-center gap-2";

    const variants = {
        primary: "bg-motion-red text-white hover:bg-motion-redHover shadow-[0_0_30px_rgba(255,0,0,0.2)] border border-transparent",
        outline: "bg-transparent border border-motion-border text-motion-text-muted hover:border-motion-text hover:text-motion-text"
    };

    return (
        <button
            disabled={loading || disabled}
            className={`${baseStyles} ${variants[variant]} ${loading || disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className || ""}`}
            {...props}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
};