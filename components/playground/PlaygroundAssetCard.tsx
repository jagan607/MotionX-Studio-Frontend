"use client";

/**
 * PlaygroundAssetCard — Individual asset card for the asset drawer.
 *
 * Shows: thumbnail, name, type badge, and status indicator.
 * Supports click-to-expand for details.
 */

import { User, MapPin, Package, Image as ImageIcon } from "lucide-react";
import type { PlaygroundAsset } from "@/lib/playgroundApi";

interface PlaygroundAssetCardProps {
    asset: PlaygroundAsset;
    isActive?: boolean;
    onClick?: () => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof User; color: string; bg: string }> = {
    character: { icon: User, color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
    location:  { icon: MapPin, color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
    product:   { icon: Package, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
};

export default function PlaygroundAssetCard({ asset, isActive, onClick }: PlaygroundAssetCardProps) {
    const config = TYPE_CONFIG[asset.type] || TYPE_CONFIG.character;
    const TypeIcon = config.icon;

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-150 text-left cursor-pointer group ${
                isActive
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
            }`}
        >
            {/* Thumbnail */}
            <div className="w-10 h-10 rounded-lg bg-[#111] border border-[#222] overflow-hidden shrink-0 flex items-center justify-center relative">
                {asset.image_url ? (
                    <img
                        src={asset.image_url}
                        alt={asset.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <ImageIcon size={14} className="text-[#333]" />
                )}
                {/* Status dot */}
                <div className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                    asset.status === "active" ? "bg-green-500" : "bg-[#555]"
                }`} />
            </div>

            {/* Name + Type */}
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-white/90 truncate group-hover:text-white transition-colors">
                    {asset.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <TypeIcon size={8} style={{ color: config.color }} />
                    <span
                        className="text-[7px] font-bold uppercase tracking-[1.5px]"
                        style={{ color: config.color }}
                    >
                        {asset.type}
                    </span>
                </div>
            </div>

            {/* @ tag indicator */}
            <span className="text-[9px] font-mono text-[#333] group-hover:text-[#555] transition-colors shrink-0">
                @{asset.name.replace(/\s+/g, "")}
            </span>
        </button>
    );
}
