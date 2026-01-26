import React, { InputHTMLAttributes } from 'react';

interface MotionInputProps extends InputHTMLAttributes<HTMLInputElement> {
    // We can extend this with error states later
}

export const MotionInput: React.FC<MotionInputProps> = (props) => {
    return (
        <input
            {...props}
            className={`
        w-full bg-transparent border-b border-motion-border 
        text-motion-text text-2xl font-display py-2 mb-10 rounded-none
        placeholder:text-motion-text-muted focus:outline-none focus:border-motion-red transition-colors
        ${props.className || ""}
      `}
        />
    );
};