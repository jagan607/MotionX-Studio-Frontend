import React from 'react';
import { Upload, Sparkles, RefreshCw, Terminal, Loader2 } from 'lucide-react';

interface VisualsSectionProps {
    displayImage?: string;
    isProcessing: boolean;
    genPrompt: string;
    setGenPrompt: (val: string) => void;
    onGenerate: () => void;
    onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const VisualsSection: React.FC<VisualsSectionProps> = ({
    displayImage,
    isProcessing,
    genPrompt,
    setGenPrompt,
    onGenerate,
    onUpload
}) => {
    return (
        <div className="animate-in fade-in duration-500 delay-100">
            {/* HEADER: TITLE + ACTIONS */}
            <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                    Visual Representation
                </div>
                <div className="flex gap-2">
                    <label className="cursor-pointer flex items-center gap-1.5 text-[10px] text-neutral-400 hover:text-white px-2 py-1 border border-neutral-800 hover:border-neutral-600 rounded bg-neutral-900 transition-all">
                        <Upload size={10} /> UPLOAD REF
                        <input type="file" hidden onChange={onUpload} accept="image/*" />
                    </label>
                    <button
                        onClick={onGenerate}
                        disabled={isProcessing}
                        className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded transition-all ${isProcessing
                                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                                : "bg-motion-red text-white hover:bg-red-600 shadow-sm shadow-red-900/20"
                            }`}
                    >
                        {isProcessing ? <RefreshCw className="animate-spin" size={10} /> : <Sparkles size={10} />}
                        {isProcessing ? "GENERATING..." : "GENERATE AI"}
                    </button>
                </div>
            </div>

            {/* PROMPT TERMINAL */}
            <div className="bg-[#050505] border border-neutral-800 rounded-lg overflow-hidden mb-4 group focus-within:border-neutral-600 transition-colors">
                <div className="bg-[#0a0a0a] px-3 py-2 border-b border-neutral-800 flex items-center gap-2">
                    <Terminal size={10} className="text-green-500" />
                    <span className="text-[9px] font-mono text-green-500/70 tracking-widest uppercase">Prompt Terminal</span>
                </div>
                <textarea
                    value={genPrompt}
                    onChange={(e) => setGenPrompt(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-neutral-300 p-3 outline-none resize-y min-h-[80px] selection:bg-green-900/30 placeholder-neutral-700"
                    placeholder="Describe the visual style, lighting, and camera angle..."
                />
            </div>

            {/* IMAGE PREVIEW */}
            <div className="w-full h-[220px] bg-[#050505] border border-dashed border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center relative group">

                {/* LOADING OVERLAY (Shows when generating) */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-300">
                        <Loader2 className="animate-spin text-motion-red mb-3" size={32} />
                        <span className="text-[10px] font-mono text-motion-red animate-pulse tracking-widest">
                            GENERATING VISUAL...
                        </span>
                    </div>
                )}

                {/* ACTUAL IMAGE */}
                {displayImage ? (
                    <img src={displayImage} alt="Asset" className="w-full h-full object-contain" />
                ) : (
                    <div className="text-center text-neutral-700">
                        <Sparkles size={32} className="mx-auto mb-2 opacity-20" />
                        <div className="text-[10px] font-mono">NO VISUAL GENERATED</div>
                    </div>
                )}
            </div>
        </div>
    );
};