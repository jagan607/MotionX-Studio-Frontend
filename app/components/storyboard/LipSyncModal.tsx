"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Loader2, Mic, Upload, Volume2, Wand2, Play, Pause, Search, ChevronDown, Scissors, RotateCcw } from "lucide-react";
import { toastError } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/config";
import { auth } from "@/lib/firebase";
import { usePricing } from "@/app/hooks/usePricing";

// WaveSurfer Imports
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface LipSyncModalProps {
    videoUrl: string;
    onClose: () => void;
    onGenerateVoice: (text: string, voiceId: string, emotion: string) => Promise<string | null>;
    onStartSync: (audioUrl: string | null, audioFile: File | null) => Promise<void>;
    credits: number;
}

interface Voice {
    voice_id: string;
    name: string;
    preview_url: string;
    category: string;
    accent?: string;
    gender?: string;
    age?: string;
    use_case?: string;
    descriptive?: string;
    labels?: {
        accent?: string;
        description?: string;
        age?: string;
        gender?: string;
        use_case?: string;
    };
}

const EMOTIONS = [
    "Neutral",
    "Happy", "Excited", "Hopeful", "Romantic",
    "Sad", "Terrified", "Nervous", "Pleading",
    "Angry", "Shouting", "Disgusted", "Sarcastic",
    "Whispering", "Thoughtful", "Confused", "Authoritative", "Mocking"
];
const GENDERS = ["All", "male", "female"];
const ACCENTS = ["All", "american", "british", "australian", "indian"];

export const LipSyncModal = ({ videoUrl, onClose, onGenerateVoice, onStartSync }: LipSyncModalProps) => {
    const [mode, setMode] = useState<'tts' | 'upload'>('tts');
    const [text, setText] = useState("");

    // --- Pricing ---
    const { getVoiceoverCost, getLipSyncCost } = usePricing();
    const voiceoverCost = getVoiceoverCost();

    const [allVoices, setAllVoices] = useState<Voice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [selectedEmotion, setSelectedEmotion] = useState("Neutral");

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMoreVoices, setHasMoreVoices] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [filterGender, setFilterGender] = useState("All");
    const [filterAccent, setFilterAccent] = useState("All");

    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const [page, setPage] = useState(0);

    // --- AUDIO TRIMMING STATE ---
    const waveformContainerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<any>(null); // Regions plugin instance
    const [isPlayingRegion, setIsPlayingRegion] = useState(false);
    const [trimRange, setTrimRange] = useState<{ start: number, end: number } | null>(null);
    const [audioDuration, setAudioDuration] = useState(0);
    const [isTrimming, setIsTrimming] = useState(false); // Toggle view to show trimmer

    const audioRef = useRef<HTMLAudioElement>(null);
    const voicePreviewRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        voicePreviewRef.current = new Audio();
    }, []);

    useEffect(() => {
        fetchVoices();
    }, [page]);

    // --- FETCH VOICES ---
    const fetchVoices = async (cursorOverride?: string | null) => {
        const cursorToUse = cursorOverride !== undefined ? cursorOverride : nextCursor;

        if (!hasMoreVoices && cursorToUse) return;

        if (cursorToUse) setIsLoadingMore(true);
        else setIsLoading(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const params = new URLSearchParams();
            params.append("page_size", "30");

            params.append("page", page.toString());
            if (cursorToUse) params.append("cursor", cursorToUse);

            const url = `${API_BASE_URL}/api/v1/shot/get_voice_library?${params.toString()}`;
            console.log("Fetching Voices URL:", url);

            const res = await fetch(url, { headers: { "Authorization": `Bearer ${idToken}` } });

            if (res.ok) {
                const data = await res.json();
                const newVoices: Voice[] = data.voices || [];

                console.log(`Received ${newVoices.length} voices.`);

                setAllVoices(prev => {
                    const combined = cursorToUse ? [...prev, ...newVoices] : newVoices;
                    const unique = new Map<string, Voice>();
                    combined.forEach(v => unique.set(v.voice_id, v));
                    return Array.from(unique.values());
                });

                // --- CURSOR FALLBACK LOGIC ---
                const explicitCursor = data.last_sort_id;
                const fallbackCursor = newVoices.length > 0 ? newVoices[newVoices.length - 1].voice_id : null;
                const resolvedCursor = explicitCursor || fallbackCursor;

                console.log(`Setting Next Cursor: ${resolvedCursor}`);
                setNextCursor(resolvedCursor);

                const likelyHasMore = newVoices.length >= 30;
                setHasMoreVoices(!!data.has_more && likelyHasMore);

                if (!cursorToUse && newVoices.length > 0 && !selectedVoice) {
                    setSelectedVoice(newVoices[0].voice_id);
                }
            } else {
                console.error("Voice Fetch Failed", await res.text());
            }
        } catch (e) {
            console.error(e);
            toastError("Failed to load voices");
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => { fetchVoices(null); }, []);

    // --- WAVESURFER INIT ---
    useEffect(() => {
        if (!uploadedFile || mode !== 'upload' || !waveformContainerRef.current) return;

        // Cleanup previous instance
        if (wavesurferRef.current) {
            wavesurferRef.current.destroy();
            wavesurferRef.current = null;
        }

        const ws = WaveSurfer.create({
            container: waveformContainerRef.current,
            waveColor: '#444',
            progressColor: '#E50914',
            cursorColor: '#FFF',
            barWidth: 2,
            barGap: 1,
            height: 80,
            url: URL.createObjectURL(uploadedFile),
        });

        // Initialize Regions Plugin
        const wsRegions = ws.registerPlugin(RegionsPlugin.create());
        regionsRef.current = wsRegions;

        ws.on('ready', () => {
            const duration = ws.getDuration();
            setAudioDuration(duration);

            // Add initial region covering entire file
            wsRegions.addRegion({
                start: 0,
                end: duration,
                color: 'rgba(229, 9, 20, 0.2)',
                drag: true,
                resize: true,
            });
            setTrimRange({ start: 0, end: duration });
            setIsTrimming(true);
        });

        wsRegions.on('region-updated', (region: any) => {
            setTrimRange({ start: region.start, end: region.end });
        });

        wsRegions.on('region-clicked', (region: any, e: any) => {
            e.stopPropagation();
            region.play();
            setIsPlayingRegion(true);
        });

        ws.on('finish', () => setIsPlayingRegion(false));
        ws.on('pause', () => setIsPlayingRegion(false));

        wavesurferRef.current = ws;

        return () => {
            ws.destroy();
        };
    }, [uploadedFile, mode]);

    const handlePlayPauseRegion = () => {
        if (!wavesurferRef.current || !regionsRef.current) return;

        const regions = regionsRef.current.getRegions();
        if (regions.length > 0) {
            const region = regions[0];
            if (isPlayingRegion) {
                wavesurferRef.current.pause();
            } else {
                region.play();
                setIsPlayingRegion(true);
            }
        } else {
            wavesurferRef.current.playPause();
            setIsPlayingRegion(!isPlayingRegion);
        }
    };

    const handleResetUpload = () => {
        setUploadedFile(null);
        setTrimRange(null);
        setIsTrimming(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const filteredVoices = useMemo(() => {
        return allVoices.filter(voice => {
            const labels = voice.labels || {};

            const searchLower = searchQuery.toLowerCase();
            const nameMatch = (voice.name || "").toLowerCase().includes(searchLower);
            const catMatch = (voice.category || "").toLowerCase().includes(searchLower);
            const genderMatch = (voice.gender || "").toLowerCase().includes(searchLower);
            const accentMatch = (voice.accent || "").toLowerCase().includes(searchLower);
            const matchesSearch = nameMatch || catMatch || genderMatch || accentMatch;

            const genderVal = (voice.gender || "").toLowerCase();
            const matchesGender = filterGender === "All" || genderVal === filterGender.toLowerCase();

            const accentVal = (voice.accent || "").toLowerCase();
            const matchesAccent = filterAccent === "All" || accentVal.includes(filterAccent.toLowerCase());

            return matchesSearch && matchesGender && matchesAccent;
        });
    }, [allVoices, searchQuery, filterGender, filterAccent]);

    const toggleVoicePreview = (voice: Voice) => {
        const player = voicePreviewRef.current;
        if (!player) return;

        if (previewingVoiceId === voice.voice_id) {
            player.pause();
            setPreviewingVoiceId(null);
        } else {
            player.src = voice.preview_url;
            player.play().catch(e => console.warn("Play Error", e));
            setPreviewingVoiceId(voice.voice_id);
            player.onended = () => setPreviewingVoiceId(null);
        }
    };

    const handleSynthesize = async () => {
        if (!text) return toastError("Please enter text");
        if (!selectedVoice) return toastError("Select a voice");

        console.log("text", text, "selectedVoice", selectedVoice, "selectedEmotion", selectedEmotion);

        setIsSynthesizing(true);
        const url = await onGenerateVoice(text, selectedVoice, selectedEmotion);
        if (url) {
            setGeneratedAudioUrl(url);
            setTimeout(() => audioRef.current?.play(), 100);
        }
        setIsSynthesizing(false);
    };

    // --- AUDIO SLICING LOGIC ---
    const sliceAudio = async (file: File, start: number, end: number): Promise<File> => {
        const arrayBuffer = await file.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const sampleRate = audioBuffer.sampleRate;
        const startSample = Math.floor(start * sampleRate);
        const endSample = Math.floor(end * sampleRate);
        const frameCount = endSample - startSample;

        if (frameCount <= 0) return file; // Should not happen if validation is correct

        const newBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            frameCount,
            sampleRate
        );

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            const newChannelData = newBuffer.getChannelData(i);
            // Copy slice
            for (let j = 0; j < frameCount; j++) {
                newChannelData[j] = channelData[startSample + j];
            }
        }

        // Convert AudioBuffer to WAV Blob
        const wavBlob = await bufferToWave(newBuffer, frameCount);
        return new File([wavBlob], `trimmed_${file.name.replace('.mp3', '')}.wav`, { type: 'audio/wav' });
    };

    // Helper: AudioBuffer to WAV
    const bufferToWave = (abuffer: AudioBuffer, len: number) => {
        let numOfChan = abuffer.numberOfChannels,
            length = len * numOfChan * 2 + 44,
            buffer = new ArrayBuffer(length),
            view = new DataView(buffer),
            channels = [], i, sample,
            offset = 0,
            pos = 0;

        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"

        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit (hardcoded in this example)

        setUint32(0x61746164);                         // "data" - chunk
        setUint32(length - pos - 4);                   // chunk length

        // write interleaved data
        for (i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {             // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true);          // write 16-bit sample
                pos += 2;
            }
            offset++;                                     // next source sample
        }

        return new Blob([buffer], { type: "audio/wav" });

        function setUint16(data: any) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data: any) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    };

    const handleExecuteSync = async () => {
        if (mode === 'tts' && !generatedAudioUrl) return toastError("Generate audio first");
        if (mode === 'upload' && !uploadedFile) return toastError("Upload audio first");

        setIsSyncing(true);

        try {
            let fileToSync = uploadedFile;

            // Apply Trim if needed
            if (mode === 'upload' && uploadedFile && trimRange) {
                // Check if significantly trimmed (> 0.1s difference)
                if (Math.abs(trimRange.end - trimRange.start - audioDuration) > 0.1 || trimRange.start > 0.1) {
                    console.log("Trimming audio...", trimRange);
                    fileToSync = await sliceAudio(uploadedFile, trimRange.start, trimRange.end);
                    console.log("Trimmed file created:", fileToSync.name, fileToSync.size);
                }
            }

            await onStartSync(mode === 'tts' ? generatedAudioUrl : null, mode === 'upload' ? fileToSync : null);
            onClose();
        } catch (error) {
            console.error("Sync failed", error);
            toastError("Failed to start sync");
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(5,5,5,0.95)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 'min(1000px, 95vw)', height: 'min(700px, 90vh)', backgroundColor: '#0A0A0A', border: '1px solid #333', display: 'grid', gridTemplateColumns: '1fr 400px', borderRadius: '8px', overflow: 'hidden' }}>

                <div style={{ borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', backgroundColor: '#000', overflow: 'hidden' }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #222', color: '#666', fontSize: '10px', letterSpacing: '2px' }}>VISUAL_INPUT_MONITOR</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <video src={videoUrl} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#080808', height: '100%', overflow: 'hidden' }}>
                    <div style={{ height: '60px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Volume2 size={16} className="text-red-500" />
                            <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', color: '#FFF' }}>ADR TERMINAL</span>
                        </div>
                        <X size={20} onClick={onClose} className="cursor-pointer text-gray-500 hover:text-white" />
                    </div>

                    <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
                        <button onClick={() => setMode('tts')} style={{ flex: 1, padding: '15px', backgroundColor: mode === 'tts' ? '#111' : 'transparent', color: mode === 'tts' ? 'white' : '#666', borderBottom: mode === 'tts' ? '2px solid #E50914' : 'none', fontSize: '10px', fontWeight: 'bold' }}>TEXT TO SPEECH</button>
                        <button onClick={() => setMode('upload')} style={{ flex: 1, padding: '15px', backgroundColor: mode === 'upload' ? '#111' : 'transparent', color: mode === 'upload' ? 'white' : '#666', borderBottom: mode === 'upload' ? '2px solid #E50914' : 'none', fontSize: '10px', fontWeight: 'bold' }}>UPLOAD AUDIO</button>
                    </div>

                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                        {mode === 'tts' ? (
                            <>
                                <div>
                                    <label style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>EMOTION</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {EMOTIONS.map(emo => (
                                            <button key={emo} onClick={() => setSelectedEmotion(emo)} style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: selectedEmotion === emo ? '1px solid #E50914' : '1px solid #333', backgroundColor: selectedEmotion === emo ? 'rgba(229,9,20,0.1)' : 'transparent', color: selectedEmotion === emo ? '#FFF' : '#888' }}>{emo}</button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '0' }}>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <label style={{ fontSize: '9px', color: '#666', fontWeight: 'bold' }}>
                                            VOICE LIBRARY ({filteredVoices.length} / {allVoices.length})
                                        </label>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{ flex: 2, position: 'relative' }}>
                                            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                                            <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '6px 6px 6px 26px', fontSize: '10px', borderRadius: '4px', outline: 'none' }} />
                                        </div>
                                        <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)} style={{ flex: 1, backgroundColor: '#111', border: '1px solid #333', color: '#AAA', fontSize: '10px', padding: '0 4px', borderRadius: '4px', outline: 'none' }}>
                                            {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                        <select value={filterAccent} onChange={(e) => setFilterAccent(e.target.value)} style={{ flex: 1, backgroundColor: '#111', border: '1px solid #333', color: '#AAA', fontSize: '10px', padding: '0 4px', borderRadius: '4px', outline: 'none' }}>
                                            {ACCENTS.map(a => <option key={a} value={a}>{a}</option>)}
                                        </select>
                                    </div>

                                    {/* Adjust the height, atleast 6 vices should be visible at once */}
                                    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #333', borderRadius: '4px', backgroundColor: '#111' }}>
                                        {isLoading ? (
                                            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin text-red-500" /></div>
                                        ) : (
                                            <>
                                                {filteredVoices.map(voice => (
                                                    <div key={voice.voice_id} onClick={() => setSelectedVoice(voice.voice_id)} style={{ padding: '8px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: selectedVoice === voice.voice_id ? '#222' : 'transparent', cursor: 'pointer' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#888' }}>{voice.name[0]}</div>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontSize: '11px', color: '#FFF', fontWeight: 'bold' }}>{voice.name}</div>
                                                                <div style={{ fontSize: '9px', color: '#666', display: 'flex', gap: '6px' }}>
                                                                    {(voice.gender || voice.labels?.gender) && <span style={{ textTransform: 'capitalize' }}>{voice.gender || voice.labels?.gender}</span>}
                                                                    {(voice.accent || voice.labels?.accent) && <span>• {voice.accent || voice.labels?.accent}</span>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); toggleVoicePreview(voice); }} style={{ background: 'none', border: 'none', color: previewingVoiceId === voice.voice_id ? '#E50914' : '#444', cursor: 'pointer' }}>
                                                            {previewingVoiceId === voice.voice_id ? <Pause size={12} /> : <Play size={12} />}
                                                        </button>
                                                    </div>
                                                ))}

                                                {hasMoreVoices && !searchQuery && (
                                                    <button onClick={() => setPage(page + 1)} disabled={isLoadingMore} style={{ width: '100%', padding: '10px', background: 'transparent', border: 'none', color: '#666', fontSize: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                        {isLoadingMore ? <Loader2 className="animate-spin" size={12} /> : <ChevronDown size={12} />}
                                                        LOAD MORE VOICES
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={`Enter dialogue... (${selectedEmotion} tone)`} style={{ width: '100%', height: '60px', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '11px', resize: 'none' }} />
                                    <button onClick={handleSynthesize} disabled={isSynthesizing} style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#222', border: '1px solid #333', color: 'white', fontSize: '10px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                        {isSynthesizing ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />} SYNTHESIZE
                                        <span style={{ opacity: 0.5, fontSize: '9px', fontWeight: 'normal' }}>· {voiceoverCost} cr</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {uploadedFile ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minHeight: '300px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>{uploadedFile.name}</span>
                                            <button onClick={handleResetUpload} style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}><RotateCcw size={14} /></button>
                                        </div>

                                        <div
                                            ref={waveformContainerRef}
                                            style={{ width: '100%', minHeight: '100px', backgroundColor: '#000', borderRadius: '4px', border: '1px solid #333' }}
                                        />

                                        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px', gap: '10px' }}>
                                            <button onClick={handlePlayPauseRegion} style={{ backgroundColor: '#222', border: '1px solid #444', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                {isPlayingRegion ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
                                            </button>
                                        </div>

                                        <div style={{ textAlign: 'center', color: '#666', fontSize: '10px', marginTop: '-10px' }}>
                                            {trimRange ? (
                                                <span>TRIM: {trimRange.start.toFixed(2)}s - {trimRange.end.toFixed(2)}s (Duration: {(trimRange.end - trimRange.start).toFixed(2)}s)</span>
                                            ) : <span>Drag region handles to trim</span>}
                                        </div>

                                    </div>
                                ) : (
                                    <div onClick={() => fileInputRef.current?.click()} style={{ flex: 1, minHeight: '200px', border: '1px dashed #333', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444', cursor: 'pointer' }}>
                                        <Upload size={32} />
                                        <span style={{ fontSize: '10px', marginTop: '10px' }}>UPLOAD AUDIO FILE</span>
                                        <input type="file" ref={fileInputRef} accept="audio/*" onChange={(e) => { if (e.target.files?.[0]) { setUploadedFile(e.target.files[0]); setGeneratedAudioUrl(null); } }} style={{ display: 'none' }} />
                                    </div>
                                )}
                            </>
                        )}

                        {generatedAudioUrl && mode === 'tts' && (
                            <div style={{ padding: '10px', backgroundColor: '#111', border: '1px solid #333' }}>
                                <audio ref={audioRef} src={generatedAudioUrl} controls style={{ width: '100%', height: '30px' }} />
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '20px', borderTop: '1px solid #222', backgroundColor: '#080808' }}>
                        <button onClick={handleExecuteSync} disabled={isSyncing || (mode === 'tts' && !generatedAudioUrl) || (mode === 'upload' && !uploadedFile)} style={{ width: '100%', padding: '15px', backgroundColor: '#E50914', border: 'none', color: 'white', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', display: 'flex', justifyContent: 'center', gap: '10px', opacity: (isSyncing || (mode === 'tts' && !generatedAudioUrl) || (mode === 'upload' && !uploadedFile)) ? 0.5 : 1 }}>
                            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                            {mode === 'upload' && trimRange && (Math.abs(trimRange.end - trimRange.start - audioDuration) > 0.1) ? 'TRIM & SYNC' : 'EXECUTE SYNC'}
                            <span style={{ opacity: 0.6, fontSize: '10px', fontWeight: 'normal', letterSpacing: '0' }}>· {getLipSyncCost(5)} cr</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};