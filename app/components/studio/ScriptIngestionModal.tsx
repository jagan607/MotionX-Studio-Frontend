"use client";

import React from "react";
import { X, Sparkles, FileText, Upload } from "lucide-react";
import { InputDeck } from "@/components/script/InputDeck";
import { ContextReference } from "@/app/components/script/ContextSelectorModal";

interface ScriptIngestionModalProps {
    isOpen: boolean;
    onClose: () => void;

    // Project Info
    projectId: string;
    projectTitle: string;
    projectType: "movie" | "micro_drama" | "ad";

    // Mode Info
    mode: 'new' | 'edit';
    episodeId?: string; // If edit mode
    initialTitle?: string;
    initialScript?: string;
    initialRuntime?: string | number;

    // Callbacks
    onSuccess: (redirectUrl?: string) => void;

    // Context
    contextReferences?: ContextReference[];
    onOpenContextModal?: () => void;

    previousEpisode?: any;
}

export const ScriptIngestionModal: React.FC<ScriptIngestionModalProps> = ({
    isOpen,
    onClose,
    projectId,
    projectTitle,
    projectType,
    mode,
    episodeId,
    initialTitle = "",
    initialScript = "",
    initialRuntime = "",
    onSuccess,
    contextReferences,
    onOpenContextModal,
    previousEpisode
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">

            {/* Modal Container */}
            <div className="w-[900px] max-h-[90vh] flex flex-col bg-[#050505] border border-[#222] shadow-2xl shadow-black relative overflow-hidden rounded-lg">

                {/* Header */}
                <div className="h-14 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-3">
                        {mode === 'new' ? <Sparkles size={16} className="text-red-500" /> : <FileText size={16} className="text-blue-500" />}
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest leading-none">
                                {mode === 'new' ? "New Sequence" : "Edit Script"}
                            </h2>
                            <span className="text-[10px] text-[#555] font-mono">
                                {mode === 'new' ? "INITIALIZE NEW NARRATIVE STREAM" : "MODIFY EXISTING SCREENPLAY DATA"}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center hover:bg-[#151515] text-[#666] hover:text-white transition-colors rounded-full"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#000]">
                    <InputDeck
                        projectId={projectId}
                        projectTitle={projectTitle}
                        projectType={projectType}
                        episodeId={mode === 'new' ? "new_placeholder" : episodeId} // [Critical] Use placeholder for new
                        initialTitle={initialTitle}
                        initialScript={initialScript}
                        initialRuntime={initialRuntime}
                        previousEpisode={previousEpisode}
                        onSuccess={onSuccess}
                        onCancel={onClose}
                        isModal={true}

                        // Pass Context props
                        contextReferences={contextReferences}
                        onOpenContextModal={onOpenContextModal}

                        className="border-none shadow-none bg-transparent"
                    />
                </div>
            </div>
        </div>
    );
};
