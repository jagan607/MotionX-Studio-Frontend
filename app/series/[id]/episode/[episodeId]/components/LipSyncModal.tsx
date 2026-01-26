"use client";

import { useState, useRef } from "react";
import { X, Loader2, Mic, Upload, Play, Check, Volume2, Sparkles, Wand2 } from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast";

interface LipSyncModalProps {
    videoUrl: string;
    onClose: () => void;
    onGenerateVoice: (text: string, voiceId: string) => Promise<string | null>;
    onStartSync: (audioUrl: string | null, audioFile: File | null) => Promise<void>;
    credits: number;
}

const VOICES = [
    { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (American, Calm)" },
    { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi (American, Strong)" },
    { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella (American, Soft)" },
    { id: "ErXwobaYiN019PkySvjV", name: "Antoni (American, Deep)" },
    { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli (American, Young)" },
    { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh (American, Deep)" },
];

export const LipSyncModal = ({ videoUrl, onClose, onGenerateVoice, onStartSync, credits }: LipSyncModalProps) => {
    const [mode, setMode] = useState<'tts' | 'upload'>('tts');
    const [text, setText] = useState("");
    const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    // Processing States
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const audioRef = useRef<HTMLAudioElement>(null);

    const handleSynthesize = async () => {
        if (!text) return toastError("Please enter dialogue text");
        setIsSynthesizing(true);
        const url = await onGenerateVoice(text, selectedVoice);
        if (url) {
            setGeneratedAudioUrl(url);
            // Auto play for preview
            setTimeout(() => audioRef.current?.play(), 100);
        }
        setIsSynthesizing(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadedFile(e.target.files[0]);
            setGeneratedAudioUrl(null); // Clear TTS if upload happens
        }
    };

    const handleExecuteSync = async () => {
        if (mode === 'tts' && !generatedAudioUrl) return toastError("Generate voice audio first");
        if (mode === 'upload' && !uploadedFile) return toastError("Upload an audio file first");

        setIsSyncing(true);
        await onStartSync(mode === 'tts' ? generatedAudioUrl : null, mode === 'upload' ? uploadedFile : null);
        setIsSyncing(false);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: '900px', height: '600px',
                backgroundColor: '#0A0A0A', border: '1px solid #333',
                display: 'grid', gridTemplateColumns: '1fr 350px',
                boxShadow: '0 0 50px rgba(0,0,0,0.8)'
            }}>

                {/* --- LEFT: VISUAL MONITOR --- */}
                <div style={{ borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: '10px', letterSpacing: '2px' }}>
                        <span>VISUAL_INPUT_MONITOR</span>
                        <span>SRC: KLING_V1</span>
                    </div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                        <video src={videoUrl} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        {/* Audio Waveform Visualization Placeholder */}
                        <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20, height: '40px', display: 'flex', alignItems: 'end', gap: '2px', opacity: 0.5 }}>
                            {Array.from({ length: 40 }).map((_, i) => (
                                <div key={i} style={{
                                    flex: 1, backgroundColor: '#FF0000',
                                    height: `${Math.random() * 100}%`,
                                    animation: 'pulse 0.5s infinite',
                                    animationDelay: `${i * 0.05}s`
                                }} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- RIGHT: AUDIO CONTROL DECK --- */}
                <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#080808' }}>

                    {/* Header */}
                    <div style={{ height: '60px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Volume2 size={16} className="text-red-500" />
                            <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', color: '#FFF' }}>ADR TERMINAL</span>
                        </div>
                        <X size={20} onClick={onClose} className="cursor-pointer text-gray-500 hover:text-white" />
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
                        <button
                            onClick={() => setMode('tts')}
                            style={{ flex: 1, padding: '15px', backgroundColor: mode === 'tts' ? '#111' : 'transparent', color: mode === 'tts' ? 'white' : '#666', border: 'none', borderBottom: mode === 'tts' ? '2px solid #FF0000' : 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}
                        >
                            TEXT TO SPEECH
                        </button>
                        <button
                            onClick={() => setMode('upload')}
                            style={{ flex: 1, padding: '15px', backgroundColor: mode === 'upload' ? '#111' : 'transparent', color: mode === 'upload' ? 'white' : '#666', border: 'none', borderBottom: mode === 'upload' ? '2px solid #FF0000' : 'none', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}
                        >
                            UPLOAD AUDIO
                        </button>
                    </div>

                    {/* Content Area */}
                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {mode === 'tts' ? (
                            <>
                                <div>
                                    <label style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>SELECT VOICE MODEL</label>
                                    <select
                                        value={selectedVoice}
                                        onChange={(e) => setSelectedVoice(e.target.value)}
                                        style={{ width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', outline: 'none' }}
                                    >
                                        {VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>DIALOGUE SCRIPT</label>
                                    <textarea
                                        value={text}
                                        onChange={(e) => setText(e.target.value)}
                                        placeholder="Enter the dialogue for lip synchronization..."
                                        style={{ width: '100%', height: '120px', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '15px', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'monospace' }}
                                    />
                                </div>
                                <button
                                    onClick={handleSynthesize}
                                    disabled={isSynthesizing}
                                    style={{ width: '100%', padding: '12px', backgroundColor: '#222', border: '1px solid #333', color: 'white', fontSize: '10px', fontWeight: 'bold', cursor: isSynthesizing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {isSynthesizing ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                                    {isSynthesizing ? "SYNTHESIZING..." : "GENERATE VOICEOVER"}
                                </button>
                            </>
                        ) : (
                            <div style={{ flex: 1, border: '1px dashed #333', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                                <Upload size={32} style={{ marginBottom: '15px' }} />
                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>DRAG AUDIO FILE HERE</span>
                                <span style={{ fontSize: '9px', marginTop: '5px' }}>MP3, WAV (MAX 10MB)</span>
                                <input type="file" accept="audio/*" onChange={handleFileUpload} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                                {uploadedFile && (
                                    <div style={{ marginTop: '20px', backgroundColor: '#111', padding: '10px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px', color: '#FFF' }}>
                                        <Volume2 size={14} className="text-green-500" />
                                        <span style={{ fontSize: '11px' }}>{uploadedFile.name}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Audio Preview Player */}
                        {generatedAudioUrl && mode === 'tts' && (
                            <div style={{ padding: '10px', backgroundColor: '#111', border: '1px solid #333', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <audio ref={audioRef} src={generatedAudioUrl} controls style={{ width: '100%', height: '30px' }} />
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div style={{ padding: '20px', borderTop: '1px solid #222' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', fontSize: '10px', color: '#666' }}>
                            <span>ESTIMATED COST</span>
                            <span style={{ color: '#FF0000', fontWeight: 'bold' }}>4 TOKENS</span>
                        </div>
                        <button
                            onClick={handleExecuteSync}
                            disabled={isSyncing || (mode === 'tts' && !generatedAudioUrl) || (mode === 'upload' && !uploadedFile)}
                            style={{
                                width: '100%', padding: '15px', backgroundColor: '#FF0000', border: 'none', color: 'white',
                                fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                opacity: (isSyncing || (mode === 'tts' && !generatedAudioUrl) || (mode === 'upload' && !uploadedFile)) ? 0.5 : 1
                            }}
                        >
                            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            {isSyncing ? "INITIALIZING SYNC..." : "EXECUTE LIP SYNC"}
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes pulse { 0%, 100% { height: 20%; } 50% { height: 80%; } }
            `}</style>
        </div>
    );
};