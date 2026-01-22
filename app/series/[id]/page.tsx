"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Toaster } from "react-hot-toast";
import {
  ArrowLeft, Plus, Loader2, X, Upload, Trash2, FileText,
  Terminal, Sparkles, Disc, Cpu, FileEdit, FileCode
} from "lucide-react";
import { doc, getDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { checkJobStatus } from "@/lib/api";
import { toastError } from "@/lib/toast";

import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { SeriesTour } from "@/components/SeriesTour";
import { useSeriesTour } from "@/hooks/useSeriesTour";

type InputMethod = 'upload' | 'paste' | 'synopsis';

export default function SeriesDetail() {
  const params = useParams();
  const seriesId = params.id as string;
  const { tourStep, completeTour } = useSeriesTour();

  // Data State
  const [seriesData, setSeriesData] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Ingest State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");
  const [inputMethod, setInputMethod] = useState<InputMethod>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedScript, setPastedScript] = useState("");
  const [synopsisText, setSynopsisText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'episode' | 'draft' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. FETCH DATA (Episodes AND Drafts)
  useEffect(() => {
    async function fetchData() {
      if (!seriesId) return;
      try {
        // Series Info
        const docRef = doc(db, "series", seriesId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setSeriesData(docSnap.data());

        // Fetch Episodes
        const epRef = collection(db, "series", seriesId, "episodes");
        const epSnap = await getDocs(epRef);
        // FIX: Cast to 'any' so TS knows 'title' exists for sorting
        const sortedEps = epSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setEpisodes(sortedEps.sort((a, b) => (a.title > b.title ? 1 : -1)));

        // Fetch Drafts
        const draftRef = collection(db, "series", seriesId, "drafts");
        const draftSnap = await getDocs(draftRef);
        // FIX: Cast to 'any' here as well for consistency
        const sortedDrafts = draftSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setDrafts(sortedDrafts);

      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [seriesId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
  };

  // 3. EXECUTE PROTOCOL
  const handleExecuteProtocol = async () => {
    if (!newEpTitle) return toastError("PROTOCOL ERROR: MISSING IDENTIFIER");

    const formData = new FormData();
    formData.append("series_id", seriesId);
    formData.append("episode_title", newEpTitle);

    if (inputMethod === 'upload') {
      if (!selectedFile) return toastError("PROTOCOL ERROR: NO SOURCE FILE");
      formData.append("file", selectedFile);
    }
    else if (inputMethod === 'paste') {
      if (!pastedScript.trim()) return toastError("PROTOCOL ERROR: EMPTY BUFFER");
      const blob = new Blob([pastedScript], { type: "text/plain" });
      const file = new File([blob], "terminal_paste.txt", { type: "text/plain" });
      formData.append("file", file);
    }
    else if (inputMethod === 'synopsis') {
      if (!synopsisText.trim()) return toastError("PROTOCOL ERROR: EMPTY SYNOPSIS");
      const content = `[TYPE: SYNOPSIS/TREATMENT]\n\n${synopsisText}`;
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], "synopsis.txt", { type: "text/plain" });
      formData.append("file", file);
    }

    setIsUploading(true);
    setUploadStatus("INITIALIZING UPLINK...");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/script/upload-episode`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Ingest failed");

      const jobId = data.job_id;
      setUploadStatus(inputMethod === 'synopsis' ? "AI GENERATING SCRIPT..." : "PARSING DATA STREAM...");

      const pollInterval = setInterval(async () => {
        const jobData = await checkJobStatus(jobId);

        if (jobData.progress) {
          if (jobData.status !== "completed") setUploadStatus(jobData.progress.toUpperCase());
        }

        if (jobData.status === "completed") {
          clearInterval(pollInterval);

          if (jobData.redirect_url) {
            window.location.href = jobData.redirect_url;
          } else {
            toastError("SYSTEM ERROR: Missing Redirect Coordinates");
            setIsUploading(false);
          }
        } else if (jobData.status === "failed") {
          clearInterval(pollInterval);
          setIsUploading(false);
          toastError(`ERROR: ${jobData.error}`);
        }
      }, 2000);

    } catch (error: any) {
      clearTimeout(timeoutId);
      setIsUploading(false);
      toastError(error.message || "Execution Failed");
    }
  };

  // --- DELETE HANDLER ---
  const performDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      if (deleteType === 'draft') {
        await deleteDoc(doc(db, "series", seriesId, "drafts", deleteId));
        setDrafts(prev => prev.filter(d => d.id !== deleteId));
        toastError("DRAFT TERMINATED");
      } else {
        const idToken = await auth.currentUser?.getIdToken();
        await fetch(`${API_BASE_URL}/api/v1/script/episode/${seriesId}/${deleteId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${idToken}` }
        });
        setEpisodes(prev => prev.filter(ep => ep.id !== deleteId));
      }
      setDeleteId(null);
      setDeleteType(null);
    } catch (err) {
      toastError("Network Error");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- STYLES ---
  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#030303', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '40px 80px' },
    backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '10px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none', marginBottom: '30px' },
    header: { borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
    title: { fontFamily: 'Anton, sans-serif', fontSize: '80px', lineHeight: '0.9', textTransform: 'uppercase' as const, color: '#FFF', marginBottom: '10px' },
    metaRow: { display: 'flex', gap: '30px', fontSize: '11px', color: '#FF0000', fontFamily: 'monospace', textTransform: 'uppercase' as const },
    addButton: { backgroundColor: '#EDEDED', color: '#050505', border: 'none', padding: '15px 30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const, boxShadow: '0 0 20px rgba(255,255,255,0.1)' },
    sectionTitle: { fontSize: '12px', color: '#666', fontWeight: 'bold' as const, letterSpacing: '4px', marginBottom: '20px', textTransform: 'uppercase' as const, paddingLeft: '2px', marginTop: '40px' },
    episodeGrid: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },

    // --- UPDATED DRAFT CARD (CYAN THEME) ---
    draftCard: {
      backgroundColor: 'rgba(6, 182, 212, 0.05)',
      border: '1px dashed #06B6D4',
      padding: '20px 40px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      cursor: 'pointer', transition: 'all 0.2s',
      marginBottom: '10px'
    },

    episodeCard: { backgroundColor: '#080808', border: '1px solid #1A1A1A', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const },
    overlay: { position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
    deck: { width: '900px', height: '600px', backgroundColor: '#050505', border: '1px solid #333', display: 'flex', boxShadow: '0 0 100px rgba(0,0,0,0.8)', position: 'relative' as const, overflow: 'hidden' },
    deckSidebar: { width: '260px', borderRight: '1px solid #222', padding: '30px', display: 'flex', flexDirection: 'column' as const, justifyContent: 'space-between', backgroundColor: '#080808', zIndex: 20 },
    deckContent: { flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' as const, position: 'relative' as const, zIndex: 20, backgroundColor: 'rgba(5,5,5,0.95)' },
    menuItem: (active: boolean) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px', marginBottom: '8px', backgroundColor: active ? '#111' : 'transparent', border: active ? '1px solid #333' : '1px solid transparent', color: active ? '#FFF' : '#666', fontSize: '11px', fontWeight: 'bold' as const, letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s', borderLeft: active ? '2px solid #FF0000' : '2px solid transparent' }),
    input: { width: '100%', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid #333', padding: '15px 0', color: 'white', fontSize: '24px', fontFamily: 'Anton', outline: 'none', marginBottom: '30px', textTransform: 'uppercase' as const },
    textAreaTerm: { width: '100%', flex: 1, backgroundColor: '#090909', border: '1px solid #222', color: '#00FF41', fontFamily: 'monospace', fontSize: '12px', padding: '20px', outline: 'none', resize: 'none' as const, lineHeight: '1.6' },
    textAreaSyn: { width: '100%', flex: 1, backgroundColor: '#090909', border: '1px solid #333', color: '#DDD', fontFamily: 'Inter, sans-serif', fontSize: '14px', padding: '20px', outline: 'none', resize: 'none' as const, lineHeight: '1.6' },
    uploadBox: { flex: 1, border: '1px dashed #333', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '20px', color: '#444', cursor: 'pointer', backgroundColor: '#090909', transition: 'all 0.2s' },
    executeBtn: { marginTop: '20px', width: '100%', padding: '20px', backgroundColor: '#FF0000', color: 'white', border: 'none', fontWeight: 'bold' as const, letterSpacing: '2px', fontSize: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }
  };

  if (loading) return <div style={styles.container}>INITIALIZING...</div>;

  return (
    <main style={styles.container}>
      <Toaster position="bottom-right" reverseOrder={false} />
      <style>{`
        .ep-card:hover { border-color: #FF0000 !important; background-color: #0E0E0E !important; transform: translateY(-2px); }
        /* Cyan Hover Effect for Drafts */
        .draft-card:hover { border-color: #06B6D4 !important; background-color: rgba(6, 182, 212, 0.1) !important; transform: translateY(-2px); }
        .menu-hover:hover { color: #FFF !important; background-color: #0c0c0c !important; }
        .upload-hover:hover { border-color: #666 !important; background-color: #111 !important; }
        .animate-scanline { background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(255,0,0,0.1) 50%, rgba(255,0,0,0.1)); background-size: 100% 4px; pointer-events: none; position: absolute; inset: 0; z-index: 10; opacity: 0.15; }
        .glow-text { text-shadow: 0 0 10px rgba(255,0,0,0.5); }
      `}</style>

      <Link href="/dashboard" style={styles.backLink}> <ArrowLeft size={14} /> TERMINAL ROOT </Link>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{seriesData?.title}</h1>
          <div style={styles.metaRow}>
            <span>ID: {seriesData?.style?.toUpperCase() || 'UNK'}</span>
            <span>TYPE: {seriesData?.genre?.toUpperCase() || 'UNK'}</span>
          </div>
        </div>
        <button style={styles.addButton} onClick={() => setIsUploadModalOpen(true)}>
          <Plus size={20} /> NEW EPISODE
        </button>
      </div>

      {/* --- SECTION 1: WORKSPACE DRAFTS (Blue/Cyan) --- */}
      {drafts.length > 0 && (
        <>
          <div style={{ ...styles.sectionTitle, color: '#06B6D4' }}>// WORKSPACE_DRAFTS</div>
          <div style={styles.episodeGrid}>
            {drafts.map((draft) => (
              <Link key={draft.id} href={`/series/${seriesId}/draft/${draft.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={styles.draftCard} className="draft-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#06B6D4', fontWeight: 'bold' }}>WIP</div>
                    <div>
                      <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '20px', color: '#06B6D4', textTransform: 'uppercase' }}>{draft.title}</h3>
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '5px', fontFamily: 'monospace' }}>
                        SCENES: {draft.scenes?.length || 0} // STATUS: STAGING
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <FileCode size={18} color="#06B6D4" />
                    <button className="delete-icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(draft.id); setDeleteType('draft'); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <Trash2 size={18} color="#444" />
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* --- SECTION 2: FINALIZED EPISODES --- */}
      <div style={styles.sectionTitle}>// EPISODE_SEQUENCE</div>
      <div style={styles.episodeGrid}>
        {episodes.map((ep, i) => (
          <Link key={ep.id} href={`/series/${seriesId}/episode/${ep.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={styles.episodeCard} className="ep-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#333' }}>{(i + 1).toString().padStart(2, '0')}</div>
                <div><h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '20px' }}>{ep.title}</h3></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <FileText size={18} color="#333" />
                <button className="delete-icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(ep.id); setDeleteType('episode'); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={18} color="#444" /></button>
              </div>
            </div>
          </Link>
        ))}
        {episodes.length === 0 && <div style={{ padding: '40px', border: '1px dashed #222', textAlign: 'center', color: '#444' }}>NO FINALIZED EPISODES</div>}
      </div>

      {/* --- COMMAND DECK (MODAL) --- */}
      {isUploadModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.deck}>
            <div className="animate-scanline" />

            <div style={styles.deckSidebar}>
              <div>
                <div style={{ fontSize: '9px', color: '#444', fontWeight: 'bold', marginBottom: '20px', letterSpacing: '2px' }}>INPUT PROTOCOL</div>
                <div style={styles.menuItem(inputMethod === 'upload')} onClick={() => setInputMethod('upload')} className="menu-hover"><Upload size={14} /> DATA UPLOAD</div>
                <div style={styles.menuItem(inputMethod === 'paste')} onClick={() => setInputMethod('paste')} className="menu-hover"><Terminal size={14} /> TERMINAL PASTE</div>
                <div style={styles.menuItem(inputMethod === 'synopsis')} onClick={() => setInputMethod('synopsis')} className="menu-hover"><Sparkles size={14} color={inputMethod === 'synopsis' ? '#FF0000' : '#666'} /> AI GENERATION</div>
              </div>
              <div onClick={() => setIsUploadModalOpen(false)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#666', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}><X size={14} /> ABORT SEQUENCE</div>
            </div>

            <div style={styles.deckContent}>
              <input style={styles.input} placeholder="ENTER EPISODE IDENTIFIER..." value={newEpTitle} onChange={(e) => setNewEpTitle(e.target.value)} autoFocus disabled={isUploading} />

              {inputMethod === 'upload' && (
                <div style={styles.uploadBox} className="upload-hover" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} accept=".pdf,.docx,.txt" />
                  {selectedFile ? (
                    <>
                      <Disc size={40} color="#FF0000" className="force-spin" style={{ animationDuration: '3s' }} />
                      <div style={{ textAlign: 'center' }}><div style={{ color: 'white', fontWeight: 'bold', letterSpacing: '1px' }}>{selectedFile.name}</div><div style={{ fontSize: '10px', marginTop: '5px', color: '#666' }}>READY FOR DECRYPTION</div></div>
                    </>
                  ) : (
                    <><Upload size={40} /><div style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>DRAG SCRIPT FILE</div></>
                  )}
                </div>
              )}

              {inputMethod === 'paste' && <textarea style={styles.textAreaTerm} placeholder="// PASTE RAW SCRIPT DATA HERE..." value={pastedScript} onChange={(e) => setPastedScript(e.target.value)} disabled={isUploading} />}

              {inputMethod === 'synopsis' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <textarea style={styles.textAreaSyn} placeholder="Describe the scene sequence... (e.g., A cyberpunk detective chases a rogue android through a neon market...)" value={synopsisText} onChange={(e) => setSynopsisText(e.target.value)} disabled={isUploading} />
                  <div style={{ fontSize: '10px', color: '#FF0000', marginTop: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}><Cpu size={12} /> AI AGENT ACTIVE: STORY_ENGINE_V2</div>
                </div>
              )}

              <div style={{ marginTop: 'auto' }}>
                {isUploading && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'monospace', color: '#FF0000', marginBottom: '10px' }}>
                    <span className="glow-text">STATUS: {uploadStatus}</span><span className="force-spin">///</span>
                  </div>
                )}
                <button style={{ ...styles.executeBtn, opacity: isUploading ? 0.5 : 1 }} onClick={handleExecuteProtocol} disabled={isUploading}>
                  {isUploading ? <Loader2 className="force-spin" size={14} /> : (inputMethod === 'synopsis' ? "GENERATE & INGEST" : "INITIALIZE INGESTION")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && <DeleteConfirmModal title="DELETE?" message="Confirm destruction of data." isDeleting={isDeleting} onConfirm={performDelete} onCancel={() => { setDeleteId(null); setDeleteType(null); }} />}
      <SeriesTour step={tourStep} onComplete={completeTour} />
    </main>
  );
}