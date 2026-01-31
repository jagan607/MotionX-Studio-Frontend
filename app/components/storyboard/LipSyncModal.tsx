"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { X, Loader2, Mic, Upload, Volume2, Wand2, Play, Pause, Search, ChevronDown } from "lucide-react";
import { toastError } from "@/lib/toast";
import { API_BASE_URL } from "@/lib/config";
import { auth } from "@/lib/firebase";

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
                // If API returns explicit cursor, use it. 
                // If not, fallback to using the ID of the last item in the list.
                const explicitCursor = data.last_sort_id;
                const fallbackCursor = newVoices.length > 0 ? newVoices[newVoices.length - 1].voice_id : null;
                const resolvedCursor = explicitCursor || fallbackCursor;

                console.log(`Setting Next Cursor: ${resolvedCursor}`);
                setNextCursor(resolvedCursor);

                // If we got fewer items than requested (30), we've likely hit the end.
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

    const handleExecuteSync = async () => {
        if (mode === 'tts' && !generatedAudioUrl) return toastError("Generate audio first");
        if (mode === 'upload' && !uploadedFile) return toastError("Upload audio first");

        setIsSyncing(true);
        await onStartSync(mode === 'tts' ? generatedAudioUrl : null, mode === 'upload' ? uploadedFile : null);
        setIsSyncing(false);
        onClose();
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
                        <button onClick={() => setMode('tts')} style={{ flex: 1, padding: '15px', backgroundColor: mode === 'tts' ? '#111' : 'transparent', color: mode === 'tts' ? 'white' : '#666', borderBottom: mode === 'tts' ? '2px solid #FF0000' : 'none', fontSize: '10px', fontWeight: 'bold' }}>TEXT TO SPEECH</button>
                        <button onClick={() => setMode('upload')} style={{ flex: 1, padding: '15px', backgroundColor: mode === 'upload' ? '#111' : 'transparent', color: mode === 'upload' ? 'white' : '#666', borderBottom: mode === 'upload' ? '2px solid #FF0000' : 'none', fontSize: '10px', fontWeight: 'bold' }}>UPLOAD AUDIO</button>
                    </div>

                    <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
                        {mode === 'tts' ? (
                            <>
                                <div>
                                    <label style={{ fontSize: '9px', color: '#666', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}>EMOTION</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {EMOTIONS.map(emo => (
                                            <button key={emo} onClick={() => setSelectedEmotion(emo)} style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '4px', border: selectedEmotion === emo ? '1px solid #FF0000' : '1px solid #333', backgroundColor: selectedEmotion === emo ? 'rgba(255,0,0,0.1)' : 'transparent', color: selectedEmotion === emo ? '#FFF' : '#888' }}>{emo}</button>
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
                                                        <button onClick={(e) => { e.stopPropagation(); toggleVoicePreview(voice); }} style={{ background: 'none', border: 'none', color: previewingVoiceId === voice.voice_id ? '#FF0000' : '#444', cursor: 'pointer' }}>
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
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div onClick={() => fileInputRef.current?.click()} style={{ flex: 1, minHeight: '200px', border: '1px dashed #333', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444', cursor: 'pointer' }}>
                                <Upload size={32} />
                                <span style={{ fontSize: '10px', marginTop: '10px' }}>UPLOAD AUDIO FILE</span>
                                <input type="file" ref={fileInputRef} accept="audio/*" onChange={(e) => { if (e.target.files?.[0]) { setUploadedFile(e.target.files[0]); setGeneratedAudioUrl(null); } }} style={{ display: 'none' }} />
                                {uploadedFile && <div style={{ marginTop: '10px', color: '#FFF', fontSize: '11px' }}>{uploadedFile.name}</div>}
                            </div>
                        )}

                        {generatedAudioUrl && mode === 'tts' && (
                            <div style={{ padding: '10px', backgroundColor: '#111', border: '1px solid #333' }}>
                                <audio ref={audioRef} src={generatedAudioUrl} controls style={{ width: '100%', height: '30px' }} />
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '20px', borderTop: '1px solid #222', backgroundColor: '#080808' }}>
                        <button onClick={handleExecuteSync} disabled={isSyncing || (mode === 'tts' && !generatedAudioUrl) || (mode === 'upload' && !uploadedFile)} style={{ width: '100%', padding: '15px', backgroundColor: '#FF0000', border: 'none', color: 'white', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', display: 'flex', justifyContent: 'center', gap: '10px', opacity: (isSyncing || (!generatedAudioUrl && !uploadedFile)) ? 0.5 : 1 }}>
                            {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} EXECUTE SYNC
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};