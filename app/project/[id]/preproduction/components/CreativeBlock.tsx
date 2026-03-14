import React, { ReactNode } from "react";
import { Edit2, Sparkles, Trash2, ImagePlus, User, MapPin, Palette } from "lucide-react";

export type BlockType = "SCRIPT" | "CHARACTER" | "LOCATION" | "MOODBOARD" | "PRODUCT";

interface CreativeBlockProps {
    type: BlockType;
    title: string;
    subtitle?: string;
    imageUrl?: string | null;
    imagePlaceholderIcon?: "user" | "location" | "product";
    onImageClick?: () => void;

    // Actions
    onGenerate?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onUploadReference?: () => void;

    // Status
    isGenerating?: boolean;

    // Custom content area (e.g. for text or swatches)
    children?: ReactNode;

    // Layout
    className?: string;
}

export function CreativeBlock({
    type,
    title,
    subtitle,
    imageUrl,
    imagePlaceholderIcon,
    onImageClick,
    onGenerate,
    onEdit,
    onDelete,
    onUploadReference,
    isGenerating,
    children,
    className = ""
}: CreativeBlockProps) {

    const getTypeConfig = (t: BlockType) => {
        switch (t) {
            case "SCRIPT": return { color: "#FFFFFF", bg: "bg-white/10" };
            case "CHARACTER": return { color: "#D4A843", bg: "bg-[#D4A843]/10" };
            case "LOCATION": return { color: "#4A90E2", bg: "bg-[#4A90E2]/10" };
            case "MOODBOARD": return { color: "#E50914", bg: "bg-[#E50914]/10" };
            case "PRODUCT": return { color: "#10B981", bg: "bg-[#10B981]/10" };
        }
    };

    const config = getTypeConfig(type);

    return (
        <div className={`
            group relative w-[240px] flex flex-col bg-[#080808] border border-white/[0.08] rounded-xl overflow-hidden
            transition-all duration-300 hover:border-white/[0.15] hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]
            ${className}
        `}>
            {/* Film Strip Borders (Left & Right) */}
            <div className="absolute inset-y-0 left-1 w-1 flex flex-col justify-around py-2 pointer-events-none opacity-20">
                {[...Array(12)].map((_, i) => <div key={i} className="w-1 h-1.5 bg-white rounded-[1px]" />)}
            </div>
            <div className="absolute inset-y-0 right-1 w-1 flex flex-col justify-around py-2 pointer-events-none opacity-20">
                {[...Array(12)].map((_, i) => <div key={i} className="w-1 h-1.5 bg-white rounded-[1px]" />)}
            </div>

            <div className="px-4 py-3 pb-4">
                {/* Header Badge */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full`} style={{ backgroundColor: config.color }} />
                        <span className="text-[8px] font-bold tracking-[2px] text-white/50 uppercase">{type}</span>
                    </div>

                    {/* Hover Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        {onEdit && (
                            <button onClick={onEdit} className="p-1 text-white/30 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded">
                                <Edit2 size={10} />
                            </button>
                        )}
                        {onDelete && (
                            <button onClick={onDelete} className="p-1 text-white/30 hover:text-red-500 transition-colors bg-white/5 hover:bg-white/10 rounded">
                                <Trash2 size={10} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Optional Image Area */}
                {(imageUrl !== undefined || imagePlaceholderIcon || type === "MOODBOARD") && type !== "SCRIPT" && (
                    <div
                        className={`relative w-full aspect-square bg-[#111] rounded-lg mb-3 overflow-hidden border border-white/[0.04] ${onImageClick ? 'cursor-pointer hover:border-white/[0.1] transition-colors group/img' : ''}`}
                        onClick={onImageClick}
                    >
                        {imageUrl ? (
                            <img src={imageUrl} alt={title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {imagePlaceholderIcon === "user" && <User size={32} className="text-white/10" />}
                                {imagePlaceholderIcon === "location" && <MapPin size={32} className="text-white/10" />}
                                {imagePlaceholderIcon === "product" && <div className="text-white/10 text-[32px] font-thin">P</div>}
                                {type === "MOODBOARD" && <Palette size={32} className="text-[#E50914]/20" />}
                            </div>
                        )}

                        {/* Image Generate/Upload Overlay */}
                        {!imageUrl && (onGenerate || onUploadReference || isGenerating) && (
                            <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 ${isGenerating ? 'opacity-100' : 'group-hover/img:opacity-100'} transition-opacity`}>
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-[#E50914] border-t-transparent rounded-full animate-spin" />
                                        <span className="text-[8px] font-mono text-[#E50914] tracking-widest uppercase animate-pulse">Generating</span>
                                    </>
                                ) : (
                                    <>
                                        {onGenerate && (
                                            <button onClick={(e) => { e.stopPropagation(); onGenerate(); }} className="px-3 py-1.5 bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30 hover:bg-[#E50914] hover:text-white hover:border-[#E50914] transition-all rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                <Sparkles size={10} /> Generate
                                            </button>
                                        )}
                                        {onUploadReference && (
                                            <button onClick={(e) => { e.stopPropagation(); onUploadReference(); }} className="px-3 py-1.5 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10 transition-all rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                <ImagePlus size={10} /> Upload Ref
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Content Area */}
                {(title || subtitle) && type !== "SCRIPT" && (
                    <div className="mb-2">
                        <h3 className="text-base font-bold text-white leading-tight uppercase tracking-wide truncate">{title}</h3>
                        {subtitle && <p className="text-[10px] text-white/40 mt-1 truncate">{subtitle}</p>}
                    </div>
                )}

                {/* Custom Children (e.g. Script text) */}
                {children && <div className="mt-2">{children}</div>}
            </div>

            {/* Bottom Accent */}
            <div className="h-[2px] w-full" style={{ backgroundColor: config.color, opacity: 0.3 }} />
        </div>
    );
}
