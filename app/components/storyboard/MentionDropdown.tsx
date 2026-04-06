"use client";

import React from 'react';
import { Video, Music, Lock, ImageIcon } from 'lucide-react';
import type { MentionItem } from '@/app/hooks/usePromptMention';

interface MentionDropdownProps {
    items: MentionItem[];
    activeIndex: number;
    position: { top: number; left: number };
    onSelect: (tag: string) => void;
    onHover: (index: number) => void;
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
    items,
    activeIndex,
    position,
    onSelect,
    onHover,
}) => {
    if (items.length === 0) return null;

    return (
        <div
            role="listbox"
            aria-label="Reference media tags"
            className="absolute z-[100] min-w-[220px] max-h-48 overflow-y-auto rounded-lg
                bg-neutral-900/95 backdrop-blur-md border border-white/[0.12] shadow-2xl
                py-1 animate-in fade-in slide-in-from-top-1 duration-150"
            style={{
                top: `${position.top}px`,
                left: `${Math.max(0, position.left)}px`,
            }}
            onMouseDown={(e) => e.preventDefault()} // prevent blur on click
        >
            {items.map((item, i) => (
                <button
                    key={item.tag}
                    role="option"
                    aria-selected={i === activeIndex}
                    id={`mention-option-${i}`}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors
                        ${i === activeIndex
                            ? 'bg-white/[0.1] text-white'
                            : 'text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200'
                        }`}
                    onClick={() => onSelect(item.tag)}
                    onMouseEnter={() => onHover(i)}
                >
                    {/* Thumbnail */}
                    <div className={`w-5 h-5 rounded flex-shrink-0 overflow-hidden flex items-center justify-center
                        ${item.type === 'image'
                            ? 'bg-neutral-800'
                            : item.type === 'video'
                                ? 'bg-purple-950/60'
                                : 'bg-cyan-950/60'
                        }`}
                    >
                        {item.type === 'image' && item.url ? (
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                        ) : item.type === 'video' ? (
                            <Video size={10} className="text-purple-400" />
                        ) : item.type === 'audio' ? (
                            <Music size={10} className="text-cyan-400" />
                        ) : (
                            <ImageIcon size={10} className="text-neutral-500" />
                        )}
                    </div>

                    {/* Tag name */}
                    <span className={`text-[11px] font-mono font-semibold flex-shrink-0
                        ${item.type === 'video'
                            ? 'text-purple-300'
                            : item.type === 'audio'
                                ? 'text-cyan-300'
                                : 'text-amber-200'
                        }`}
                    >
                        {item.tag}
                    </span>

                    {/* File name */}
                    <span className="text-[10px] text-neutral-500 truncate flex-1 min-w-0">
                        {item.name}
                    </span>

                    {/* Lock indicator */}
                    {item.locked && (
                        <Lock size={8} className="text-amber-500/60 flex-shrink-0" />
                    )}
                </button>
            ))}
        </div>
    );
};
