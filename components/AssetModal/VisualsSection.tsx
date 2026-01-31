import React from 'react';
import { Upload, Sparkles, RefreshCw, Terminal, Loader2, Image as ImageIcon } from 'lucide-react';

interface VisualsSectionProps {
    displayImage?: string;
    refImage?: string | null;
    isProcessing: boolean;
    genPrompt: string;
    setGenPrompt: (val: string) => void;
    onGenerate: () => void;

    // Split the upload handlers
    onUploadRef: (file: File) => void;
    onUploadMain: (file: File) => void;

    // Optional fallback to keep TS happy if parent isn't updated instantly
    onUpload?: (e: any) => void;
}

export const VisualsSection: React.FC<VisualsSectionProps> = ({
    displayImage,
    refImage,
    isProcessing,
    genPrompt,
    setGenPrompt,
    onGenerate,
    onUploadRef,
    onUploadMain
}) => {

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, handler: (f: File) => void) => {
        if (e.target.files && e.target.files[0]) {
            handler(e.target.files[0]);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 delay-100">
            {/* HEADER: TITLE + ACTIONS */}
            <div className="flex justify-between items-center mb-3">
                <div className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                    Visual Representation
                </div>
                <div className="flex gap-2">
                    {/* 1. UPLOAD MAIN/FINAL IMAGE */}
                    <label className="cursor-pointer flex items-center gap-1.5 text-[10px] text-neutral-400 hover:text-white px-2 py-1 border border-neutral-800 hover:border-neutral-600 rounded bg-neutral-900 transition-all" title="Upload Final Visual">
                        <ImageIcon size={10} />
                        UPLOAD FINAL
                        <input type="file" hidden onChange={(e) => handleFileChange(e, onUploadMain)} accept="image/*" />
                    </label>

                    {/* 2. UPLOAD REFERENCE (For AI) */}
                    <label className={`
                        cursor-pointer flex items-center gap-1.5 text-[10px] px-2 py-1 border rounded transition-all
                        ${refImage
                            ? "border-green-900 bg-green-900/10 text-green-400 hover:bg-green-900/20 hover:text-green-300"
                            : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-600"}
                    `} title="Upload Reference for AI">
                        <Upload size={10} />
                        {refImage ? "REF LINKED" : "UPLOAD REF"}
                        <input type="file" hidden onChange={(e) => handleFileChange(e, onUploadRef)} accept="image/*" />
                    </label>

                    {/* 3. GENERATE AI */}
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

            {/* ... Terminal & Image Preview remain same ... */}
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

            {/* MAIN IMAGE PREVIEW AREA */}
            <div className="w-full h-[220px] bg-[#050505] border border-dashed border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center relative group">

                {/* LOADING OVERLAY */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 animate-in fade-in duration-300">
                        <Loader2 className="animate-spin text-motion-red mb-3" size={32} />
                        <span className="text-[10px] font-mono text-motion-red animate-pulse tracking-widest">
                            GENERATING VISUAL...
                        </span>
                    </div>
                )}

                {/* MAIN RESULT IMAGE */}
                {displayImage ? (
                    <img src={displayImage} alt="Asset Result" className="w-full h-full object-contain z-0" />
                ) : (
                    <div className="text-center text-neutral-700">
                        <Sparkles size={32} className="mx-auto mb-2 opacity-20" />
                        <div className="text-[10px] font-mono">NO VISUAL GENERATED</div>
                    </div>
                )}

                {/* REFERENCE IMAGE PREVIEW (PIP Mode) */}
                {refImage && (
                    <div className="absolute bottom-2 left-2 z-10 w-16 h-16 rounded border border-white/20 overflow-hidden shadow-lg bg-black group/ref hover:scale-150 hover:w-32 hover:h-32 transition-all duration-300 origin-bottom-left">
                        <div className="absolute top-0 left-0 bg-black/60 text-[8px] font-bold text-white px-1 py-0.5 backdrop-blur-md">REF</div>
                        <img src={refImage} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>
        </div>
    );
};