"use client";

import { Check, X, Loader2 } from "lucide-react";

interface PricingCardProps {
    title: string;
    price: string;
    description: string;
    credits: string;
    features: string[];
    notIncluded?: string[];
    isPopular?: boolean;
    isLoading?: boolean;
    onClick: () => void;
    buttonText?: string;
    isActive?: boolean; // <--- NEW PROP
}

export default function PricingCard({
    title,
    price,
    description,
    credits,
    features,
    notIncluded = [],
    isPopular = false,
    isLoading = false,
    onClick,
    buttonText = "SUBSCRIBE",
    isActive = false // <--- NEW DEFAULT
}: PricingCardProps) {
    return (
        <div
            className={`
                relative flex flex-col p-6 h-full transition-all duration-300
                border bg-[#0A0A0A] group rounded-lg
                ${isActive
                    ? 'border-[#00FF41] shadow-[0_0_20px_rgba(0,255,65,0.08)]'
                    : isPopular
                        ? 'border-[#E50914] shadow-[0_0_30px_rgba(229,9,20,0.12)] hover:scale-[1.02]'
                        : 'border-[#222] hover:border-[#333] hover:bg-[#0F0F0F]'
                }
            `}
        >
            {/* ACTIVE BADGE */}
            {isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#00FF41] text-black px-4 py-1 text-[10px] font-bold tracking-[2px] uppercase rounded-full">
                    CURRENT PLAN
                </div>
            )}

            {/* POPULAR BADGE (Only show if not active) */}
            {isPopular && !isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E50914] text-white px-3 py-1 text-[9px] font-bold tracking-[2px] uppercase rounded-full">
                    RECOMMENDED
                </div>
            )}

            <div className="mb-6">
                <h3 className="font-anton text-2xl uppercase tracking-wide text-white mb-1">{title}</h3>
                <p className="text-[#666] text-xs font-mono uppercase tracking-wider mb-4">{description}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white tracking-tight">{price}</span>
                    <span className="text-[#444] text-[10px] font-bold uppercase">/ month</span>
                </div>
            </div>

            <div className="mb-6 p-3 bg-[#111] border border-[#222] text-center rounded-md">
                <span className="text-[#EDEDED] text-xs font-bold tracking-[1px] uppercase">{credits}</span>
            </div>

            <div className="flex-1 space-y-3 mb-8">
                {features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-[#CCC] font-medium leading-relaxed">
                        <Check size={14} className={`mt-0.5 shrink-0 ${isActive ? 'text-[#00FF41]' : 'text-[#E50914]'}`} />
                        <span>{feature}</span>
                    </div>
                ))}
                {notIncluded.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-[#444] font-medium leading-relaxed line-through decoration-[#333]">
                        <X size={14} className="mt-0.5 shrink-0 text-[#333]" />
                        <span>{feature}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={onClick}
                disabled={isLoading || isActive} // Disable if loading OR active
                className={`
                    w-full py-3 text-[10px] font-bold tracking-[3px] uppercase transition-all rounded-md
                    flex items-center justify-center gap-2
                    ${isActive
                        ? 'bg-[#111] text-[#00FF41] border border-[#00FF41]/30 cursor-default opacity-100'
                        : isPopular
                            ? 'bg-[#E50914] text-white border border-[#E50914] hover:bg-[#B91C1C]'
                            : 'bg-transparent text-[#EDEDED] border border-[#333] hover:border-[#EDEDED] hover:bg-[#EDEDED] hover:text-black'
                    }
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                {isLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : isActive ? (
                    "CURRENT PLAN"
                ) : (
                    buttonText
                )}
            </button>
        </div>
    );
}