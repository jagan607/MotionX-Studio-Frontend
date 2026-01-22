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
}

export default function PricingCard({
    title, price, description, credits, features, notIncluded = [], isPopular, isLoading, onClick, buttonText
}: PricingCardProps) {

    return (
        <div className={`
      relative flex flex-col p-6 md:p-8
      bg-[#0A0A0A] border transition-all duration-300 group
      ${isPopular
                ? "border-[#FF0000] shadow-[0_0_20px_rgba(255,0,0,0.15)] z-10 md:scale-[1.05] transform-gpu"
                : "border-[#1F1F1F] hover:border-[#333] hover:bg-[#0F0F0F]"
            }
    `}>

            {/* POPULAR BADGE */}
            {isPopular && (
                <div className="absolute -top-3 left-0 w-full flex justify-center z-20">
                    <span className="bg-[#FF0000] text-black text-[10px] font-bold px-4 py-1 uppercase tracking-widest shadow-md">
                        Recommended
                    </span>
                </div>
            )}

            {/* HEADER */}
            <div className="mb-8 text-center border-b border-[#1F1F1F] pb-8 pt-2">
                {/* Title uses h3 to inherit global Anton font */}
                <h3 className="text-3xl text-white uppercase tracking-wide mb-2">
                    {title}
                </h3>
                <p className="text-[#666] text-[10px] uppercase tracking-[2px] mb-5 font-sans">
                    {description}
                </p>

                <div className="flex items-baseline justify-center gap-1 font-sans">
                    <span className="text-5xl font-bold text-white tracking-tighter">{price}</span>
                    <span className="text-[#444] text-[10px] font-bold uppercase tracking-wider">/ MO</span>
                </div>

                {/* Credits Pill */}
                <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-[#222] rounded-sm">
                    <div className={`w-1.5 h-1.5 rounded-full ${isPopular ? "bg-[#FF0000] animate-pulse" : "bg-[#666]"}`} />
                    <span className="text-[#CCC] text-[10px] font-bold uppercase tracking-widest font-sans">
                        {credits}
                    </span>
                </div>
            </div>

            {/* FEATURES LIST */}
            <div className="flex-1 space-y-4 mb-8 font-sans">
                {features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <Check className="w-4 h-4 text-[#FF0000] mt-0.5 shrink-0" />
                        <span className="text-[#DDD] text-xs font-medium uppercase tracking-wide leading-relaxed">{feat}</span>
                    </div>
                ))}
                {notIncluded.map((feat, i) => (
                    <div key={i} className="flex items-start gap-3 opacity-30">
                        <X className="w-4 h-4 text-[#666] mt-0.5 shrink-0" />
                        <span className="text-[#666] text-xs font-medium uppercase tracking-wide leading-relaxed decoration-slice line-through decoration-[#444]">{feat}</span>
                    </div>
                ))}
            </div>

            {/* ACTION BUTTON */}
            <button
                onClick={onClick}
                disabled={isLoading}
                className={`
          w-full py-4 text-[11px] font-bold uppercase tracking-[2px] transition-all flex justify-center items-center gap-2 font-sans
          border
          ${isPopular
                        ? "bg-[#FF0000] text-black border-[#FF0000] hover:bg-white hover:border-white"
                        : "bg-transparent text-white border-[#333] hover:border-white hover:bg-[#111]"}
          ${isLoading ? "opacity-70 cursor-not-allowed" : ""}
        `}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        PROCESSING...
                    </>
                ) : (
                    "INITIALIZE PLAN"
                )}
            </button>

        </div>
    );
}