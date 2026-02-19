"use client";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface DeleteConfirmModalProps {
    title: string;
    message: string;
    isDeleting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const DeleteConfirmModal = ({ title, message, isDeleting, onConfirm, onCancel }: DeleteConfirmModalProps) => {
    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: '400px', backgroundColor: '#0A0A0A', border: '1px solid rgba(255,255,255,0.08)',
                padding: '30px', position: 'relative', boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6), 0 0 40px rgba(229, 9, 20, 0.1)',
                borderRadius: '12px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h2 style={{ fontFamily: 'Anton, sans-serif', fontSize: '24px', color: '#E50914', margin: 0, textTransform: 'uppercase' }}>
                        {title}
                    </h2>
                    <X size={20} color="#666" style={{ cursor: 'pointer' }} onClick={onCancel} />
                </div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'start', marginBottom: '25px' }}>
                    <AlertTriangle color="#E50914" size={24} style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', color: '#CCC', lineHeight: '1.5', margin: 0 }}>
                        {message}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        style={{
                            flex: 1, padding: '12px', backgroundColor: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)', color: '#888',
                            fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                            borderRadius: '6px', transition: 'all 0.2s ease'
                        }}
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        style={{
                            flex: 1, padding: '12px', backgroundColor: '#E50914',
                            border: 'none', color: 'white',
                            fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            borderRadius: '6px', transition: 'all 0.2s ease'
                        }}
                    >
                        {isDeleting ? <Loader2 className="spin-loader" size={14} /> : <Trash2 size={14} />}
                        {isDeleting ? "ERASING..." : "CONFIRM DELETE"}
                    </button>
                </div>
            </div>
            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin-loader { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};