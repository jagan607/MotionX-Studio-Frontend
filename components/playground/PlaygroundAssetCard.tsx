"use client";

/**
 * PlaygroundAssetCard — Individual asset card for the asset drawer.
 *
 * Shows: thumbnail, name, type badge, and status indicator.
 * Thumbnail click → opens full-screen MediaViewer.
 * On hover: reveals Edit and Delete action buttons.
 */

import { useState } from "react";
import { User, MapPin, Package, Image as ImageIcon, Pencil, Trash2, Loader2, ZoomIn } from "lucide-react";
import type { PlaygroundAsset } from "@/lib/playgroundApi";
import { usePlayground } from "@/app/context/PlaygroundContext";
import { useMediaViewer } from "@/app/context/MediaViewerContext";
import toast from "react-hot-toast";

interface PlaygroundAssetCardProps {
    asset: PlaygroundAsset;
    isActive?: boolean;
    onEdit?: (asset: PlaygroundAsset) => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof User; color: string; bg: string }> = {
    character: { icon: User, color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
    location:  { icon: MapPin, color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
    product:   { icon: Package, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
};

// Map singular type back to plural collection name
const TYPE_TO_COLLECTION: Record<string, "characters" | "locations" | "products"> = {
    character: "characters",
    location: "locations",
    product: "products",
};

export default function PlaygroundAssetCard({ asset, isActive, onEdit }: PlaygroundAssetCardProps) {
    const config = TYPE_CONFIG[asset.type] || TYPE_CONFIG.character;
    const TypeIcon = config.icon;
    const { deleteAssetById } = usePlayground();
    const { openViewer } = useMediaViewer();
    const [isDeleting, setIsDeleting] = useState(false);

    const collectionName = TYPE_TO_COLLECTION[asset.type] || "characters";

    const handleThumbnailClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!asset.image_url) return;

        openViewer([{
            id: asset.id,
            type: "image",
            imageUrl: asset.image_url,
            title: asset.name,
            description: `${asset.type} asset`,
        }]);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDeleting) return;

        if (!window.confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;

        setIsDeleting(true);
        try {
            await deleteAssetById(collectionName, asset.id);
            toast.success(`"${asset.name}" deleted`);
        } catch (err: any) {
            console.error("[AssetCard] Delete failed:", err);
            toast.error("Failed to delete asset");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit?.(asset);
    };

    return (
        <div
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-150 text-left cursor-default group relative ${
                isActive
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]"
            }`}
        >
            {/* Thumbnail — clickable for full-screen view */}
            <button
                onClick={handleThumbnailClick}
                disabled={!asset.image_url}
                className={`w-10 h-10 rounded-lg bg-[#111] border border-[#222] overflow-hidden shrink-0 flex items-center justify-center relative ${
                    asset.image_url
                        ? "cursor-zoom-in hover:ring-1 hover:ring-white/20 transition-all"
                        : "cursor-default"
                }`}
            >
                {asset.image_url ? (
                    <>
                        <img
                            src={asset.image_url}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                        {/* Magnifying glass overlay on hover */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn size={12} className="text-white" />
                        </div>
                    </>
                ) : (
                    <ImageIcon size={14} className="text-[#333]" />
                )}
                {/* Status dot */}
                <div className={`absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                    asset.status === "active" ? "bg-green-500" : "bg-[#555]"
                }`} />
            </button>

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

            {/* @ tag indicator — hidden when hover actions are visible */}
            <span className="text-[9px] font-mono text-[#333] group-hover:hidden transition-colors shrink-0">
                @{asset.name.replace(/\s+/g, "")}
            </span>

            {/* ── HOVER ACTIONS ── */}
            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                <button
                    onClick={handleEdit}
                    className="p-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[#888] hover:text-white transition-all cursor-pointer"
                    title="Edit"
                >
                    <Pencil size={10} />
                </button>
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-1.5 rounded-md bg-white/[0.06] hover:bg-red-500/20 text-[#888] hover:text-red-400 transition-all cursor-pointer disabled:opacity-50"
                    title="Delete"
                >
                    {isDeleting ? (
                        <Loader2 size={10} className="animate-spin" />
                    ) : (
                        <Trash2 size={10} />
                    )}
                </button>
            </div>
        </div>
    );
}
