import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface LightboxProps {
    imageUrl: string | null;
    title: string;
    onClose: () => void;
}

export function Lightbox({ imageUrl, title, onClose }: LightboxProps) {
    if (!imageUrl) return null;

    return (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
            <div className="relative w-full max-w-5xl h-full flex flex-col items-center justify-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {/* Header Navbar inside Lightbox */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10 pointer-events-none">
                    <h3 className="text-white font-['Anton'] tracking-wider text-xl uppercase drop-shadow-md">{title}</h3>
                    <div className="flex items-center gap-4 pointer-events-auto">
                        <a href={imageUrl} target="_blank" rel="noreferrer" className="p-2 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full" title="Open Original">
                            <ExternalLink size={18} />
                        </a>
                        <button onClick={onClose} className="p-2 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* The Image */}
                <img
                    src={imageUrl}
                    alt={title}
                    className="max-w-full max-h-full object-contain rounded-sm shadow-2xl"
                />
            </div>
        </div>
    );
}
