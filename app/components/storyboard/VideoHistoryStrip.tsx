"use client";

import React, { useState, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { VideoHistoryEntry } from '@/lib/types';

interface VideoHistoryStripProps {
    history: VideoHistoryEntry[];
    activeVideoUrl?: string;
    onPreview: (entry: VideoHistoryEntry) => void;
    onRestore: (entry: VideoHistoryEntry) => void;
}

/** Short provider labels for badges */
const providerLabel = (provider: string): string => {
    const map: Record<string, string> = {
        'kling-v3': 'K v3',
        'kling': 'K',
        'seedance-2': 'S 2.0',
        'seedance': 'S',
        'seedance-1.5': 'S 1.5',
    };
    return map[provider] || provider;
};

/** Format Firestore timestamp or ISO string to readable date */
const formatDate = (ts: any): string => {
    try {
        const date = ts?.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' · ' +
            date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

export const VideoHistoryStrip: React.FC<VideoHistoryStripProps> = ({
    history,
    activeVideoUrl,
    onPreview,
    onRestore,
}) => {
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Hide if no meaningful history
    if (!history || history.length <= 1) return null;

    // Sort descending by created_at (newest first)
    const sorted = [...history].sort((a, b) => {
        const getTime = (ts: any) => {
            try { return ts?.toDate ? ts.toDate().getTime() : new Date(ts).getTime(); }
            catch { return 0; }
        };
        return getTime(b.created_at) - getTime(a.created_at);
    });

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                    History · {sorted.length}
                </span>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                style={{ scrollbarWidth: 'thin' }}
            >
                {sorted.map((entry, idx) => {
                    const isActive = entry.url === activeVideoUrl;
                    return (
                        <div
                            key={entry.task_id || idx}
                            className="relative flex-shrink-0 group cursor-pointer"
                            style={{ width: 80, height: 80 }}
                            onClick={() => onPreview(entry)}
                            onMouseEnter={() => setHoveredIdx(idx)}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            {/* Thumbnail */}
                            <video
                                src={`${entry.url}#t=0.5`}
                                muted
                                preload="metadata"
                                className="w-full h-full object-cover rounded-md"
                                style={{
                                    border: isActive
                                        ? '2px solid #E50914'
                                        : '2px solid rgba(255,255,255,0.08)',
                                    transition: 'border-color 0.2s',
                                }}
                            />

                            {/* Provider Badge */}
                            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded-b-md">
                                <span className="text-[8px] font-bold text-neutral-300 uppercase tracking-wide">
                                    {providerLabel(entry.provider)}
                                </span>
                            </div>

                            {/* Active Indicator Dot */}
                            {isActive && (
                                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E50914] shadow-[0_0_6px_rgba(229,9,20,0.6)]" />
                            )}

                            {/* Tooltip */}
                            {hoveredIdx === idx && (
                                <div
                                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-[#1a1a1a] border border-white/[0.12] rounded-lg shadow-2xl z-50 pointer-events-none"
                                    style={{ animation: 'fadeIn 0.15s ease' }}
                                >
                                    <p className="text-[10px] text-neutral-300 leading-relaxed line-clamp-3 mb-1.5">
                                        {entry.prompt || 'No prompt'}
                                    </p>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] text-neutral-500">
                                            {formatDate(entry.created_at)}
                                        </span>
                                        <span className="text-[9px] text-neutral-600">
                                            {entry.duration}s · {entry.aspect_ratio}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Restore overlay on hover (non-active only) */}
                            {!isActive && hoveredIdx === idx && (
                                <div
                                    className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRestore(entry);
                                    }}
                                >
                                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/[0.12] border border-white/[0.15]">
                                        <RotateCcw size={10} className="text-white" />
                                        <span className="text-[8px] font-bold text-white uppercase">Restore</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Inline keyframes */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
};
