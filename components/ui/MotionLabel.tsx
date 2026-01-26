import React from 'react';

interface MotionLabelProps {
    number: string;
    label: string;
    className?: string;
}

export const MotionLabel: React.FC<MotionLabelProps> = ({ number, label, className }) => {
    return (
        <label className={`block text-[10px] font-mono tracking-[2px] text-motion-red font-bold uppercase mb-3 ${className || ""}`}>
            {number} // {label}
        </label>
    );
};