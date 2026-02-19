import React from "react";
import { User, MapPin, AlertCircle, CheckCircle2, Package } from "lucide-react";

// --- FIX HERE: Use relative path to step out of 'studio' and into 'ui' ---
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../ui/tooltip";

interface EntityStatusChipProps {
    name: string;
    type: 'character' | 'location' | 'product';
    status: 'linked' | 'missing';
    imageUrl?: string;
    onClick?: () => void;
}

export const EntityStatusChip: React.FC<EntityStatusChipProps> = ({
    name,
    type,
    status,
    imageUrl,
    onClick
}) => {
    const isLinked = status === 'linked';
    const Icon = type === 'character' ? User : type === 'product' ? Package : MapPin;

    const baseStyles = "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[8px] font-bold tracking-wider uppercase border transition-all cursor-pointer select-none";
    const variantStyles = isLinked
        ? "bg-[#E50914]/10 border-[#E50914]/25 text-[#ff6b6b] hover:bg-[#E50914]/15 hover:border-[#E50914]/40"
        : "bg-neutral-800/40 border-neutral-700/50 text-neutral-500 hover:bg-neutral-700/30 hover:border-neutral-600";

    const ChipContent = (
        <div onClick={onClick} className={`${baseStyles} ${variantStyles}`}>
            <Icon size={10} strokeWidth={2.5} />
            <span className="truncate max-w-[80px]">{name}</span>
            {isLinked ? (
                <CheckCircle2 size={10} className="ml-0.5 opacity-50" />
            ) : (
                <AlertCircle size={10} className="ml-0.5 opacity-50" />
            )}
        </div>
    );

    if (isLinked && imageUrl) {
        return (
            <TooltipProvider>
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        {ChipContent}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="p-0 border border-neutral-800 bg-black rounded-lg overflow-hidden shadow-2xl">
                        <div className="relative w-32 h-32">
                            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 w-full p-2 bg-gradient-to-t from-black via-black/80 to-transparent">
                                <p className="text-[9px] text-white font-bold uppercase">{name}</p>
                                <p className="text-[8px] text-neutral-500">Linked</p>
                            </div>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return ChipContent;
};