"use client";

import React, { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2, Image as ImageIcon, Upload, Loader2, Search } from 'lucide-react';
import { KlingElement } from '@/app/hooks/shot-manager/useElementLibrary';
import Image from 'next/image';
import { toast } from "react-hot-toast";

interface ElementLibraryModalProps {
    projectId: string; // Kept for reference or derived usage if needed
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (element: KlingElement) => void;

    // [NEW] Lifted State & Methods
    elements: KlingElement[];
    isLoading: boolean;
    onFetch: () => void;
    onCreate: (name: string, desc: string, frontalUrl: string) => Promise<any>;
    onDelete: (id: string) => Promise<void>;
    onUpload: (file: File) => Promise<string | null>;
    onRegister: (type: 'character' | 'product' | 'location', id: string) => Promise<string | undefined>;
}

export const ElementLibraryModal: React.FC<ElementLibraryModalProps> = ({
    projectId,
    isOpen,
    onClose,
    onSelect,
    elements,
    isLoading,
    onFetch,
    onCreate,
    onDelete,
    onUpload,
    onRegister
}) => {
    // INTERNAL HOOK REMOVED - Using props now
    const [view, setView] = useState<'list' | 'create'>('list');
    const [enablingId, setEnablingId] = useState<string | null>(null);

    // ... (rest of state)

    // ... (inside render loop) ...



    // Create Form State
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial fetch
    useEffect(() => {
        if (isOpen) {
            onFetch();
            setView('list');
            resetForm();
        }
    }, [isOpen, onFetch]);

    const resetForm = () => {
        setNewName('');
        setNewDesc('');
        setSelectedFile(null);
        setPreviewUrl(null);
        setIsSubmitting(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmitCreate = async () => {
        if (!selectedFile || !newName) return;
        setIsSubmitting(true);

        // 1. Upload
        const imageUrl = await onUpload(selectedFile);
        if (!imageUrl) {
            setIsSubmitting(false);
            return;
        }

        // 2. Create
        const newElement = await onCreate(newName, newDesc, imageUrl);

        if (newElement) {
            setView('list');
            resetForm();
        } else {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-[#141414] border border-white/[0.1] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="h-14 px-5 border-b border-white/[0.08] flex items-center justify-between bg-[#1a1a1a]">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        {view === 'create' && (
                            <button onClick={() => setView('list')} className="text-neutral-400 hover:text-white mr-1">
                                ←
                            </button>
                        )}
                        {view === 'list' ? 'Element Library' : 'Create New Element'}
                    </h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/[0.1] transition-colors">
                        <X size={16} className="text-neutral-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 relative">
                    {isLoading && view === 'list' && elements.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 size={24} className="animate-spin text-neutral-500" />
                        </div>
                    ) : (
                        <>
                            {/* --- LIST VIEW --- */}
                            {view === 'list' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-2.5 top-2 text-neutral-500" />
                                            <input
                                                placeholder="Search Elements..."
                                                className="bg-black/20 border border-white/[0.08] rounded-full pl-8 pr-4 py-1.5 text-xs text-white outline-none focus:border-white/20 w-48"
                                            />
                                        </div>
                                        {/* <button
                                            onClick={() => setView('create')}
                                            className="px-3 py-1.5 bg-[#E50914] hover:bg-[#b0070f] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                                        >
                                            <Plus size={14} /> Create Custom
                                        </button> */}
                                    </div>

                                    {elements.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-neutral-600 space-y-3 text-center px-6">
                                            <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center">
                                                <ImageIcon size={20} />
                                            </div>
                                            <p className="text-xs font-medium text-neutral-400">No Elements found</p>
                                            <p className="text-[10px] text-neutral-500 max-w-[200px]">
                                                Create a custom Element or add cast members in the Studio.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {elements.map((el) => {
                                                const isSelecting = enablingId === el.local_id || enablingId === el.id;

                                                return (
                                                    <div
                                                        key={el.id}
                                                        className={`group relative aspect-[3/4] bg-neutral-900 rounded-xl overflow-hidden border transition-all cursor-pointer
                                                            ${isSelecting ? 'border-[#E50914] ring-1 ring-[#E50914]' : 'border-white/[0.05] hover:border-white/[0.3]'}
                                                        `}
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (isSelecting) return;

                                                            const trackId = el.local_id || el.id;
                                                            setEnablingId(trackId);

                                                            try {
                                                                if (el.needs_registration && el.local_id && el.asset_type) {
                                                                    const isPending = el.registration_status === 'pending';
                                                                    const toastId = toast.loading(
                                                                        isPending ? `Completing registration for ${el.name}...` : `Registering ${el.name}...`
                                                                    );

                                                                    // Safety timeout: 70s (20 polls × 3s = 60s + buffer)
                                                                    const timeoutPromise = new Promise((_, reject) =>
                                                                        setTimeout(() => reject(new Error("Registration timed out. Please try again.")), 70000)
                                                                    );

                                                                    // Race the API call against the timeout
                                                                    const newKlingId = await Promise.race([
                                                                        onRegister(el.asset_type, el.local_id),
                                                                        timeoutPromise
                                                                    ]) as string | undefined;
                                                                    if (newKlingId && typeof newKlingId === 'string' && newKlingId.length > 0) {
                                                                        toast.dismiss(toastId);
                                                                        toast.success("Ready!");

                                                                        // 4. Select with new ID
                                                                        onSelect?.({ ...el, id: newKlingId, needs_registration: false });
                                                                    } else {
                                                                        console.error("Invalid ID returned:", newKlingId);
                                                                        toast.dismiss(toastId);
                                                                        toast.error("Failed to prepare asset (Invalid ID)");
                                                                    }
                                                                } else {
                                                                    onSelect?.(el);
                                                                }
                                                            } catch (err: any) {
                                                                console.error("Selection error:", err);
                                                                toast.dismiss();
                                                                toast.error(err.message || "Something went wrong");
                                                            } finally {
                                                                setEnablingId(null);
                                                            }
                                                        }}
                                                    >
                                                        {/* Image */}
                                                        <div className="absolute inset-0">
                                                            <Image
                                                                src={el.image_url}
                                                                alt={el.name}
                                                                fill
                                                                className={`object-cover transition-all duration-500
                                                                    ${isSelecting ? 'scale-105 opacity-40 blur-sm' : 'opacity-80 group-hover:opacity-100 group-hover:scale-105'}
                                                                `}
                                                            />
                                                        </div>

                                                        {/* Selection Overlay (Loader) */}
                                                        {isSelecting && (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 animate-in fade-in duration-200">
                                                                <Loader2 size={24} className="text-[#E50914] animate-spin mb-2" />
                                                                <span className="text-[10px] font-bold text-white tracking-wider">SELECTING</span>
                                                            </div>
                                                        )}

                                                        {/* Info Overlay (Hide when selecting) */}
                                                        {!isSelecting && (
                                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 pt-10 flex flex-col justify-end">
                                                                <h3 className="text-sm font-bold text-white leading-tight shadow-black drop-shadow-md">{el.name}</h3>
                                                            </div>
                                                        )}

                                                        {/* Type Badge */}
                                                        {!isSelecting && el.source === 'project' && (
                                                            <div className="absolute top-2 left-2 flex gap-1">
                                                                <span className={`px-1.5 py-0.5 rounded-sm backdrop-blur-md text-[8px] font-bold uppercase tracking-wider border ${el.asset_type === 'product'
                                                                    ? 'bg-purple-500/40 text-purple-200 border-purple-400/30'
                                                                    : 'bg-black/60 text-white/80 border-white/10'
                                                                    }`}>
                                                                    {el.asset_type === 'product' ? 'PRODUCT' : 'CAST'}
                                                                </span>
                                                                {el.registration_status === 'pending' && (
                                                                    <span className="px-1.5 py-0.5 rounded-sm bg-amber-500/60 backdrop-blur-md text-[8px] font-bold text-white uppercase tracking-wider border border-amber-400/30">
                                                                        PENDING
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Delete (User-created only) */}
                                                        {!isSelecting && el.source !== 'project' && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onDelete(el.id); }}
                                                                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-all backdrop-blur-md"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* --- CREATE VIEW --- */}
                            {view === 'create' && (
                                <div className="max-w-md mx-auto space-y-5 py-4">
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-2xl border-2 border-dashed border-white/[0.1] hover:border-white/[0.3] flex flex-col items-center justify-center cursor-pointer bg-white/[0.02] overflow-hidden relative group transition-colors"
                                    >
                                        {previewUrl ? (
                                            <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                    <Upload size={20} className="text-neutral-400" />
                                                </div>
                                                <p className="text-xs text-neutral-400">Click to upload reference image</p>
                                                <p className="text-[10px] text-neutral-600 mt-1">PNG, JPG up to 5MB</p>
                                            </>
                                        )}
                                        <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept="image/*" />
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 block">Element Name</label>
                                            <input
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                placeholder="e.g. Cyberpunk Hero"
                                                className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-white/[0.3]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 block">Description</label>
                                            <textarea
                                                value={newDesc}
                                                onChange={e => setNewDesc(e.target.value)}
                                                placeholder="Describe the Element..."
                                                className="w-full bg-[#1a1a1a] border border-white/[0.1] rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-white/[0.3] resize-none h-20"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSubmitCreate}
                                        disabled={!selectedFile || !newName || isSubmitting}
                                        className="w-full py-3 bg-[#E50914] hover:bg-[#b0070f] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                                        Create Element
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
