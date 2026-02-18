"use client";

import React from "react";
import { X } from "lucide-react";
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
    episodes?: any[];
    onSwitchEpisode?: (id: string) => void;
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
    previousEpisode,
    episodes,
    onSwitchEpisode
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">

            {/* Modal Container */}
            <div className="w-[900px] max-h-[90vh] flex flex-col bg-[#050505] border border-[#222] shadow-2xl shadow-black relative overflow-hidden rounded-lg">

                {/* Header */}
                <div className="h-14 border-b border-[#222] bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">Script Setup</h2>
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
                    {(() => {
                        const isSingleUnit = projectType === 'movie' || projectType === 'ad';
                        const firstEpisode = episodes?.[0];

                        // For single unit projects, always use the existing episode if available
                        const targetEpisodeId = isSingleUnit && firstEpisode
                            ? firstEpisode.id
                            : (mode === 'new' ? "new_placeholder" : episodeId);

                        // Also derive initial data from the episode if we are targeting it
                        const effectiveTitle = (isSingleUnit && firstEpisode) ? firstEpisode.title : initialTitle;
                        const effectiveScript = (isSingleUnit && firstEpisode) ? firstEpisode.script_preview : initialScript;
                        const effectiveRuntime = (isSingleUnit && firstEpisode) ? firstEpisode.runtime : initialRuntime;

                        return (
                            <InputDeck
                                projectId={projectId}
                                projectTitle={projectTitle}
                                projectType={projectType}
                                episodeId={targetEpisodeId}
                                episodes={episodes}
                                onSwitchEpisode={onSwitchEpisode}
                                initialTitle={effectiveTitle}
                                initialScript={effectiveScript}
                                initialRuntime={effectiveRuntime}
                                previousEpisode={previousEpisode}
                                onSuccess={onSuccess}
                                onCancel={onClose}
                                isModal={true}

                                // Pass Context props
                                contextReferences={contextReferences}
                                onOpenContextModal={onOpenContextModal}

                                className="border-none shadow-none bg-transparent"
                            />
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};
