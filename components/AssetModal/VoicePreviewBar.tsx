import React from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';

interface VoicePreviewBarProps {
    voiceName?: string;
    suggestion?: string;
    isPlaying: boolean;
    isLoading: boolean;
    onPlay: () => void;
    onChange: () => void;
}

export const VoicePreviewBar: React.FC<VoicePreviewBarProps> = ({
    voiceName,
    suggestion,
    isPlaying,
    isLoading,
    onPlay,
    onChange
}) => {
    return (
        <div className="animate-in fade-in duration-500 delay-200">
            <div className="text-[10px] font-bold text-neutral-500 mb-3 tracking-widest uppercase">
                Voice Configuration
            </div>
            <div className="p-3 bg-[#0a0a0a] border border-neutral-800 rounded-lg flex items-center justify-between hover:border-neutral-700 transition-colors">
                <div className="flex items-center gap-3">
                    <div
                        onClick={(e) => { e.stopPropagation(); onPlay(); }}
                        className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all ${isPlaying ? "bg-motion-red text-white" : "bg-neutral-800 text-neutral-400 hover:text-white"
                            }`}
                    >
                        {isLoading ? (
                            <Loader2 className="animate-spin" size={12} />
                        ) : isPlaying ? (
                            <Pause size={12} />
                        ) : (
                            <Play size={12} fill="currentColor" />
                        )}
                    </div>
                    <div>
                        <div className="text-white text-xs font-medium">
                            {voiceName || "No Voice Linked"}
                        </div>
                        <div className="text-neutral-500 text-[10px]">
                            {suggestion || "Default Neutral Tone"}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onChange}
                    className="text-[9px] font-bold text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-600 px-2 py-1 rounded bg-neutral-900 transition-colors tracking-widest"
                >
                    CHANGE
                </button>
            </div>
        </div>
    );
};