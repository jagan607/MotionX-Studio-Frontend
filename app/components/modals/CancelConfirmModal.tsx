"use client";

import { AlertTriangle, X, Loader2 } from "lucide-react";

interface CancelConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isProcessing: boolean;
    expiryDate?: string;
}

export default function CancelConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    isProcessing,
    expiryDate
}: CancelConfirmModalProps) {

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity"
                onClick={!isProcessing ? onClose : undefined}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-[#050505] border border-[#330000] shadow-[0_0_50px_rgba(229,9,20,0.1)] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b border-[#220000] bg-[#0A0000]">
                    <div className="flex gap-3">
                        <div className="p-2 bg-[rgba(229,9,20,0.1)] border border-[rgba(229,9,20,0.2)]">
                            <AlertTriangle className="text-[#E50914]" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-anton uppercase text-white tracking-wide">
                                Terminate Renewal?
                            </h2>
                            <p className="text-[10px] text-[#FF4444] font-mono mt-1 uppercase tracking-wider">
                                Irreversible Action
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="text-[#666] hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <p className="text-sm text-[#CCC] font-mono leading-relaxed">
                        Are you sure you want to cancel your subscription?
                    </p>

                    <div className="bg-[#111] border border-[#222] p-4 text-xs font-mono text-[#888]">
                        <p className="mb-2">
                            <span className="text-white font-bold">• ACCESS RETAINED:</span> You will keep your plan benefits until the end of the current billing cycle.
                        </p>
                        {expiryDate && (
                            <p className="mb-2">
                                <span className="text-white font-bold">• EXPIRATION:</span> Your plan will revert to Free Tier on <span className="text-[#FFC107]">{expiryDate}</span>.
                            </p>
                        )}
                        <p>
                            <span className="text-white font-bold">• DATA:</span> No data will be deleted immediately, but storage limits will apply upon expiration.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#1F1F1F] bg-[#080808] flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-3 text-[10px] font-bold tracking-[2px] uppercase border border-[#333] text-[#CCC] hover:bg-[#111] hover:text-white transition-all"
                    >
                        Abort
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="flex-1 py-3 text-[10px] font-bold tracking-[2px] uppercase bg-[#E50914] text-white border border-[#E50914] hover:bg-[#CC0000] transition-all flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={12} className="animate-spin" /> PROCESSING
                            </>
                        ) : (
                            "Confirm Termination"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}