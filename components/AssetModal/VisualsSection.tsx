import React from 'react';
import { Upload, Terminal, Loader2, Image as ImageIcon, RefreshCw, CheckSquare, Square } from 'lucide-react';

interface VisualsSectionProps {
    displayImage?: string;
    refImage?: string | null;
    isProcessing: boolean;
    genPrompt: string;
    setGenPrompt: (val: string) => void;

    // Split the upload handlers
    onUploadRef: (file: File) => void;
    onUploadMain: (file: File) => void;

    // NEW: Reference Control
    useRef: boolean;
    onToggleUseRef: () => void;

    // Optional fallback (unused now but kept for safety)
    onUpload?: (e: any) => void;
    onGenerate?: () => void; // Kept optional as we moved the trigger out
}

export const VisualsSection: React.FC<VisualsSectionProps> = ({
    displayImage,
    refImage,
    isProcessing,
    genPrompt,
    setGenPrompt,
    onUploadRef,
    onUploadMain,
    useRef,
    onToggleUseRef
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

                    {/* 2. REFERENCE CONTROL (CONDITIONAL) */}
                    {!refImage ? (
                        // CASE A: No Ref -> Simple Upload Button
                        <label className="cursor-pointer flex items-center gap-1.5 text-[10px] text-neutral-400 hover:text-white px-2 py-1 border border-neutral-800 hover:border-neutral-600 rounded bg-neutral-900 transition-all" title="Upload Reference for AI">
                            <Upload size={10} />
                            UPLOAD REF
                            <input type="file" hidden onChange={(e) => handleFileChange(e, onUploadRef)} accept="image/*" />
                        </label>
                    ) : (
                        // CASE B: Ref Exists -> Checkbox + Replace
                        <div className="flex items-center gap-1 bg-green-900/10 border border-green-900/30 rounded px-2 py-1">
                            {/* Checkbox Toggle */}
                            <button
                                onClick={onToggleUseRef}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 hover:text-green-300 mr-2"
                                title="Toggle whether AI uses this reference"
                            >
                                {useRef ? <CheckSquare size={12} /> : <Square size={12} />}
                                USE REF
                            </button>

                            {/* Separator */}
                            <div className="w-[1px] h-3 bg-green-900/30"></div>

                            {/* Replace Action */}
                            <label className="cursor-pointer flex items-center gap-1 text-[9px] text-green-500/70 hover:text-green-400 ml-1 uppercase tracking-wider font-bold">
                                REPLACE
                                <input type="file" hidden onChange={(e) => handleFileChange(e, onUploadRef)} accept="image/*" />
                            </label>
                        </div>
                    )}
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
                        <RefreshCw size={32} className="mx-auto mb-2 opacity-20" />
                        <div className="text-[10px] font-mono">NO VISUAL GENERATED</div>
                    </div>
                )}

                {/* REFERENCE IMAGE PREVIEW (PIP Mode) */}
                {/* Only show PIP if we have a ref image. 
                    If 'useRef' is false, we dim it to indicate it's ignored. */}
                {refImage && (
                    <div className={`
                        absolute bottom-2 left-2 z-10 w-16 h-16 rounded border overflow-hidden shadow-lg bg-black group/ref hover:scale-150 hover:w-32 hover:h-32 transition-all duration-300 origin-bottom-left
                        ${useRef ? "border-green-500/50 opacity-100" : "border-neutral-700 opacity-50 grayscale"}
                    `}>
                        <div className={`
                            absolute top-0 left-0 text-[8px] font-bold px-1 py-0.5 backdrop-blur-md
                            ${useRef ? "bg-green-900/80 text-white" : "bg-neutral-800/80 text-neutral-400"}
                         `}>
                            {useRef ? "ACTIVE REF" : "IGNORED"}
                        </div>
                        <img src={refImage} alt="Reference" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>
        </div>
    );
};