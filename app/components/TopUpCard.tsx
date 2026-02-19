"use client";

import { Sparkles, Zap } from "lucide-react";

interface TopUpCardProps {
    id: string;
    title: string;
    credits: number;
    bonus: number;
    price: string;
    label?: string;
    onClick: () => void;
    isLoading: boolean;
    isBestValue?: boolean;
}

export const TopUpCard = ({ id, title, credits, bonus, price, label, onClick, isLoading, isBestValue }: TopUpCardProps) => {
    return (
        <div
            onClick={!isLoading ? onClick : undefined}
            className={`
                relative p-5 border cursor-pointer transition-all duration-300 group flex flex-col justify-between h-full
                ${isBestValue
                    ? 'border-[#E50914] bg-[#0A0000] hover:bg-[#1A0505]'
                    : 'border-[#222] bg-[#0A0A0A] hover:border-[#444] hover:bg-[#111]'
                }
                ${isLoading ? 'opacity-70' : ''}
            `}
        >
            {/* Label Badge */}
            {label && (
                <div className={`
                    absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[9px] font-bold tracking-[2px] uppercase z-10
                    ${isBestValue ? 'bg-[#E50914] text-white' : 'bg-[#333] text-[#CCC]'}
                `}>
                    {label}
                </div>
            )}

            {/* Content */}
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-anton text-lg uppercase tracking-wider">{title}</h3>
                    <p className="text-xl font-bold text-white font-mono">{price}</p>
                </div>

                <div className="flex items-end gap-2 mb-4">
                    <span className="text-3xl font-bold text-white font-mono leading-none">{credits + bonus}</span>
                    <span className="text-[10px] text-[#666] font-bold uppercase tracking-wider mb-1">Credits</span>
                </div>

                {/* Bonus Pill */}
                {bonus > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#00FF41] font-mono mb-4 bg-[rgba(0,255,65,0.05)] py-1.5 px-2 border border-[rgba(0,255,65,0.2)] w-fit">
                        <Sparkles size={10} />
                        <span>+{bonus} BONUS INCLUDED</span>
                    </div>
                )}
            </div>

            {/* Action Button */}
            <button
                disabled={isLoading}
                className={`
                    w-full py-3 text-[10px] font-bold tracking-[2px] uppercase transition-all flex items-center justify-center gap-2 mt-auto
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isBestValue
                        ? 'bg-[#E50914] text-white hover:bg-[#CC0000]'
                        : 'bg-[#1A1A1A] text-[#CCC] border border-[#333] group-hover:border-[#666] group-hover:text-white'
                    }
                `}
            >
                {isLoading ? (
                    <span className="animate-pulse">INITIALIZING...</span>
                ) : (
                    <>
                        <Zap size={12} fill="currentColor" /> PURCHASE
                    </>
                )}
            </button>
        </div>
    );
};