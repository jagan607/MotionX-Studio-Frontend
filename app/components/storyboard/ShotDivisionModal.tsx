"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle } from 'lucide-react';
import { doc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { getApiErrorMessage } from '@/lib/apiErrors';

// Helper to match backend CAPS_CAPS format (same as useShotAI)
const simpleSanitize = (text: string) => text.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

interface ShotDivisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    episodeId: string;
    sceneId: string;
    currentScene: any;
}

type ModalState = 'input' | 'processing' | 'error';

export const ShotDivisionModal: React.FC<ShotDivisionModalProps> = ({
    isOpen, onClose, projectId, episodeId, sceneId, currentScene
}) => {
    // --- STATE ---
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [scriptText, setScriptText] = useState('');
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    const [modalState, setModalState] = useState<ModalState>('input');
    const [errorMessage, setErrorMessage] = useState('');
    const [terminalLog, setTerminalLog] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // --- RESET on open ---
    useEffect(() => {
        if (isOpen) {
            setUploadedFile(null);
            setScriptText('');
            setAdditionalInstructions('');
            setModalState('input');
            setErrorMessage('');
            setTerminalLog([]);
        }
    }, [isOpen]);

    // --- TERMINAL LOG: Real-time listener on scene doc ---
    useEffect(() => {
        if (modalState !== 'processing' || !projectId || !episodeId || !sceneId) return;

        const sceneRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId);
        const unsub = onSnapshot(sceneRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data?.ai_logs && Array.isArray(data.ai_logs)) {
                    setTerminalLog(data.ai_logs);
                }
            }
        });

        return () => unsub();
    }, [modalState, projectId, episodeId, sceneId]);

    // --- AUTO-SCROLL terminal log ---
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [terminalLog]);

    // --- FILE HANDLING ---
    const ACCEPTED_TYPES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt';
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
            return 'Unsupported file type. Please upload PDF, DOCX, or TXT.';
        }
        if (file.size > MAX_FILE_SIZE) {
            return 'File is too large. Maximum size is 10MB.';
        }
        return null;
    };

    const handleFileSelect = (file: File) => {
        const error = validateFile(file);
        if (error) {
            setErrorMessage(error);
            return;
        }
        setErrorMessage('');
        setUploadedFile(file);
        setScriptText(''); // clear text when file is selected
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const clearFile = () => {
        setUploadedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // --- DRAG & DROP ---
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, []);

    // --- FORMAT FILE SIZE ---
    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // --- CAN SUBMIT ---
    const canSubmit = (uploadedFile || scriptText.trim().length > 0) && modalState === 'input';

    // --- GENERATE SHOTS ---
    const handleGenerate = async () => {
        if (!canSubmit) return;

        setModalState('processing');
        setTerminalLog(['> INITIALIZING SHOT DIVISION FROM DOCUMENT...']);
        setErrorMessage('');

        // Build FormData
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('episode_id', episodeId);
        formData.append('scene_id', sceneId);

        // Scene context
        const sceneChars = Array.isArray(currentScene?.characters) ? currentScene.characters.join(',') : (currentScene?.characters || '');
        const sceneProducts = Array.isArray(currentScene?.products) ? currentScene.products.join(',') : '';
        const sceneLocation = currentScene?.location_name || currentScene?.location || '';

        formData.append('characters', sceneChars);
        formData.append('products', sceneProducts);
        formData.append('location', sceneLocation);

        // File or text
        if (uploadedFile) {
            formData.append('document', uploadedFile);
        }

        // Build script_text (instructions + pasted text)
        let combinedText = '';
        if (additionalInstructions.trim()) {
            combinedText += `ADDITIONAL INSTRUCTIONS FROM USER: ${additionalInstructions.trim()}\n\n`;
        }
        if (scriptText.trim()) {
            combinedText += scriptText.trim();
        }
        if (combinedText) {
            formData.append('script_text', combinedText);
        }

        try {
            const res = await api.post('/api/v1/shot/suggest_shots_from_document', formData);

            if (res.data && res.data.shots) {
                setTerminalLog(prev => [...prev, '> WRITING SHOT LIST...']);

                const sceneLocationName = currentScene?.location_name || currentScene?.location || 'Unknown';
                const sceneLocationId = currentScene?.location_id || '';
                const sceneProductsArray = currentScene?.products || [];

                const batch = writeBatch(db);

                res.data.shots.forEach((shot: any, index: number) => {
                    const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
                    const shotRef = doc(db, "projects", projectId, "episodes", episodeId, "scenes", sceneId, "shots", newShotId);

                    // Sanitize Character IDs
                    let charArray: string[] = [];
                    if (Array.isArray(shot.characters)) {
                        charArray = shot.characters.map((c: string) => simpleSanitize(c));
                    }

                    // Product Handling
                    let productArray: string[] = [];
                    if (Array.isArray(shot.products)) {
                        productArray = shot.products.map((p: string) => simpleSanitize(p));
                    } else if (sceneProductsArray.length > 0) {
                        productArray = sceneProductsArray.map((p: string) => simpleSanitize(p));
                    }

                    batch.set(shotRef, {
                        id: newShotId,
                        shot_type: shot.shot_type,
                        visual_action: shot.image_prompt || shot.description || "",
                        video_prompt: shot.video_prompt || "",
                        characters: charArray,
                        products: productArray,
                        estimated_duration: shot.estimated_duration || 0,
                        location: shot.location || sceneLocationName,
                        location_id: shot.location ? shot.location.replace(/[\s.]+/g, '_').toUpperCase() : sceneLocationId,
                        status: "draft",
                        order: index,
                        created_at: new Date().toISOString()
                    });
                });

                await batch.commit();
                setTerminalLog(prev => [...prev, `> ${res.data.shots.length} SHOTS GENERATED SUCCESSFULLY.`]);
                toastSuccess(`${res.data.shots.length} shots created from document`);

                // Close modal after short delay so user sees success
                setTimeout(() => onClose(), 1200);
            } else {
                throw new Error('No shots returned from API');
            }
        } catch (e: any) {
            console.error('Shot division failed:', e);
            const status = e.response?.status;
            let errMsg = getApiErrorMessage(e, 'Shot generation failed');

            if (status === 400) errMsg = e.response?.data?.detail || 'Invalid input. Check your file or text.';
            else if (status === 429) errMsg = 'Rate limited. Please wait 30 seconds and retry.';
            else if (status === 503) errMsg = 'AI service is busy. Please retry in a moment.';

            setErrorMessage(errMsg);
            setTerminalLog(prev => [...prev, `> ERROR: ${errMsg.toUpperCase()}`]);
            setModalState('error');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center">
            <div className="bg-[#0A0A0A] border border-[#222] rounded-lg w-[600px] max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
                style={{ fontFamily: 'monospace' }}
            >
                {/* HEADER */}
                <div className="px-5 py-4 border-b border-[#222] flex justify-between items-center bg-[#080808] shrink-0">
                    <div>
                        <h2 className="text-sm font-bold text-white tracking-widest uppercase">Upload Shot Division</h2>
                        <p className="text-[10px] text-neutral-500 mt-0.5 tracking-wider">
                            {currentScene?.slugline || 'SCENE'} — Generate shots from a document
                        </p>
                    </div>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>

                    {/* PROCESSING STATE — Terminal Log Viewer */}
                    {(modalState === 'processing') && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-[10px] text-green-500 tracking-widest uppercase">
                                <Loader2 size={12} className="animate-spin" />
                                PROCESSING DOCUMENT...
                            </div>
                            <div className="bg-[#050505] border border-[#1a1a1a] rounded-md p-4 h-[300px] overflow-y-auto font-mono text-[11px] text-green-400/80 space-y-1">
                                {terminalLog.map((line, i) => (
                                    <div key={i} className={line.includes('ERROR') ? 'text-red-400' : ''}>{line}</div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        </div>
                    )}

                    {/* INPUT / ERROR STATE */}
                    {(modalState === 'input' || modalState === 'error') && (
                        <>
                            {/* ERROR BANNER */}
                            {errorMessage && (
                                <div className="flex items-start gap-2 bg-red-950/30 border border-red-900/40 rounded-md px-4 py-3 text-[11px] text-red-300">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            {/* FILE UPLOAD ZONE */}
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-2">
                                    Upload Document
                                </label>

                                {!uploadedFile ? (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        className={`
                                            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                                            ${isDragging
                                                ? 'border-amber-500/60 bg-amber-950/20'
                                                : 'border-[#2a2a2a] hover:border-[#444] bg-[#060606] hover:bg-[#0a0a0a]'
                                            }
                                        `}
                                    >
                                        <Upload size={28} className="mx-auto mb-3 text-neutral-600" />
                                        <p className="text-[12px] text-neutral-400 mb-1">
                                            Drag & drop or <span className="text-amber-400 underline">click to upload</span>
                                        </p>
                                        <p className="text-[10px] text-neutral-600">PDF, DOCX, or TXT — Max 10MB</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 bg-[#111] border border-[#2a2a2a] rounded-lg px-4 py-3">
                                        <FileText size={20} className="text-amber-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] text-white truncate">{uploadedFile.name}</p>
                                            <p className="text-[10px] text-neutral-500">{formatSize(uploadedFile.size)}</p>
                                        </div>
                                        <button
                                            onClick={clearFile}
                                            className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider font-bold cursor-pointer"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ACCEPTED_EXTENSIONS}
                                    onChange={handleFileInputChange}
                                    hidden
                                />
                            </div>

                            {/* DIVIDER */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-px bg-[#222]" />
                                <span className="text-[10px] text-neutral-600 font-bold tracking-widest">OR</span>
                                <div className="flex-1 h-px bg-[#222]" />
                            </div>

                            {/* PASTE TEXT */}
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-2">
                                    Paste Shot Division Text
                                </label>
                                <textarea
                                    value={scriptText}
                                    onChange={(e) => { setScriptText(e.target.value); if (uploadedFile) clearFile(); }}
                                    disabled={!!uploadedFile}
                                    placeholder="Paste your shot division or script breakdown here..."
                                    className="w-full h-[120px] bg-[#060606] border border-[#2a2a2a] rounded-lg px-4 py-3 text-[12px] text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-[#444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>

                            {/* ADDITIONAL INSTRUCTIONS */}
                            <div>
                                <label className="block text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-2">
                                    Additional Instructions <span className="text-neutral-700">(optional)</span>
                                </label>
                                <textarea
                                    value={additionalInstructions}
                                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                                    placeholder='e.g. "Focus on close-ups for the dialogue section"'
                                    className="w-full h-[70px] bg-[#060606] border border-[#2a2a2a] rounded-lg px-4 py-3 text-[12px] text-white placeholder-neutral-600 resize-none focus:outline-none focus:border-[#444] transition-colors"
                                    style={{ fontFamily: 'monospace' }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* FOOTER */}
                {modalState !== 'processing' && (
                    <div className="px-5 py-4 border-t border-[#222] bg-[#080808] shrink-0 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-[11px] font-bold text-neutral-400 hover:text-white tracking-widest uppercase transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { setModalState('input'); setErrorMessage(''); }}
                            className={`px-5 py-2.5 text-[11px] font-bold tracking-widest uppercase rounded transition-all cursor-pointer ${modalState === 'error' ? '' : 'hidden'} bg-neutral-800 text-white hover:bg-neutral-700`}
                        >
                            Retry
                        </button>
                        <button
                            onClick={handleGenerate}
                            disabled={!canSubmit}
                            className="px-6 py-2.5 bg-white hover:bg-neutral-200 text-black text-[11px] font-bold tracking-widest uppercase rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Generate Shots
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
