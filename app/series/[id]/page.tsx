"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Loader2, X, Upload, Trash2, FileText
} from "lucide-react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";
import { checkJobStatus } from "@/lib/api";
import { toastError } from "@/lib/toast";

import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { SeriesTour } from "@/components/SeriesTour";
import { useSeriesTour } from "@/hooks/useSeriesTour";

export default function SeriesDetail() {
  const params = useParams();
  const seriesId = params.id as string;

  // --- TOUR & DATA STATE ---
  const { tourStep, completeTour } = useSeriesTour();
  const [seriesData, setSeriesData] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- UPLOAD STATE ---
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- DELETE STATE ---
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. FETCH DATA
  useEffect(() => {
    async function fetchData() {
      if (!seriesId) return;
      try {
        const docRef = doc(db, "series", seriesId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setSeriesData(docSnap.data());

        const epRef = collection(db, "series", seriesId, "episodes");
        const epSnap = await getDocs(epRef);
        const sortedEps = epSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEpisodes(sortedEps);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [seriesId]);

  // 2. CREATE EPISODE
  const handleCreateEpisode = async () => {
    if (!newEpTitle || !selectedFile) return toastError("REQ: TITLE & FILE");
    setIsUploading(true);
    setUploadStatus("Starting upload...");

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append("series_id", seriesId);
      formData.append("episode_title", newEpTitle);
      formData.append("file", selectedFile);

      const res = await fetch(`${API_BASE_URL}/api/v1/script/upload-episode`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");

      const jobId = data.job_id;
      setUploadStatus("Queued...");

      const pollInterval = setInterval(async () => {
        const jobData = await checkJobStatus(jobId);
        if (jobData.progress) setUploadStatus(jobData.progress);

        if (jobData.status === "completed") {
          clearInterval(pollInterval);
          setIsUploading(false);
          setUploadStatus("Complete!");
          setIsUploadModalOpen(false);
          window.location.reload();
        } else if (jobData.status === "failed") {
          clearInterval(pollInterval);
          setIsUploading(false);
          toastError(`Error: ${jobData.error}`);
        }
      }, 2000);

    } catch (error: any) {
      console.error(error);
      setIsUploading(false);
      toastError(error.message || "Upload failed");
    }
  };

  // 3. DELETE EPISODE
  const performDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/script/episode/${seriesId}/${deleteId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${idToken}` }
      });

      if (res.ok) {
        setEpisodes(prev => prev.filter(ep => ep.id !== deleteId));
        setDeleteId(null);
      } else {
        toastError("FAILED TO DELETE EPISODE");
      }
    } catch (err) {
      console.error(err);
      toastError("Network Error");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- UPDATED STYLES ---
  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#030303', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '40px 80px' },
    backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '10px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none', marginBottom: '30px' },
    header: { borderBottom: '1px solid #333', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
    title: { fontFamily: 'Anton, sans-serif', fontSize: '80px', lineHeight: '0.9', textTransform: 'uppercase' as const, color: '#FFF', marginBottom: '10px' },
    metaRow: { display: 'flex', gap: '30px', fontSize: '11px', color: '#FF0000', fontFamily: 'monospace', textTransform: 'uppercase' as const },
    addButton: { backgroundColor: '#EDEDED', color: '#050505', border: 'none', padding: '15px 30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const, boxShadow: '0 0 20px rgba(255,255,255,0.1)' },
    sectionTitle: { fontSize: '12px', color: '#666', fontWeight: 'bold' as const, letterSpacing: '4px', marginBottom: '20px', textTransform: 'uppercase' as const, paddingLeft: '2px' },
    episodeGrid: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    episodeCard: {
      backgroundColor: '#080808', border: '1px solid #1A1A1A', padding: '20px 40px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const
    },
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
    modal: { width: '500px', backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '40px' },
    modalTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '30px', color: 'white' },
    label: { fontSize: '10px', fontWeight: 'bold' as const, color: '#FF0000', letterSpacing: '2px', marginBottom: '10px', display: 'block' },
    input: { width: '100%', backgroundColor: '#111', border: 'none', padding: '15px', color: 'white', fontSize: '16px', marginBottom: '30px', outline: 'none' },
    fileBox: { border: '1px dashed #333', padding: '40px', textAlign: 'center' as const, color: '#666', cursor: 'pointer', marginBottom: '30px' },
    confirmBtn: { width: '100%', padding: '20px', backgroundColor: '#FF0000', border: 'none', color: 'white', fontWeight: 'bold' as const, cursor: 'pointer', letterSpacing: '1px', display: 'flex', justifyContent: 'center', alignItems: 'center' },
    statusText: { textAlign: 'center' as const, color: '#666', fontSize: '12px', marginTop: '15px', fontFamily: 'monospace', animation: 'pulse 1.5s infinite' }
  };

  if (loading) return <div style={styles.container}>ACCESSING DATABASE...</div>;
  if (!seriesData) return <div style={styles.container}>DATA CORRUPTED</div>;

  return (
    <main style={styles.container}>
      <style>{`
        .ep-card:hover { border-color: #FF0000 !important; background-color: #0E0E0E !important; transform: translateY(-2px); }
        .delete-icon { color: #444 !important; opacity: 1 !important; transition: color 0.2s ease !important; }
        .delete-icon:hover { color: #FF0000 !important; }
        
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
      `}</style>

      {/* --- BREADCRUMB --- */}
      <Link href="/dashboard" style={styles.backLink}> <ArrowLeft size={14} /> TERMINAL ROOT </Link>

      {/* --- HEADER --- */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{seriesData.title}</h1>
          <div style={styles.metaRow}>
            <span>ID: {seriesData?.style?.toUpperCase() || 'UNK'}</span>
            <span>TYPE: {seriesData?.genre?.toUpperCase() || 'UNK'}</span>
          </div>
        </div>

        <button
          id="tour-series-new-ep"
          style={styles.addButton}
          onClick={() => setIsUploadModalOpen(true)}
        >
          <Plus size={20} strokeWidth={3} /> NEW EPISODE
        </button>
      </div>

      <div style={styles.sectionTitle}>// EPISODE_SEQUENCE</div>

      {/* --- EPISODE LIST --- */}
      <div style={styles.episodeGrid}>
        {episodes.length === 0 ? (
          <div style={{ padding: '40px', border: '1px dashed #222', textAlign: 'center', color: '#444' }}>
            NO EPISODES FOUND.
          </div>
        ) : (
          episodes.map((ep, i) => (
            <Link key={ep.id} href={`/series/${seriesId}/episode/${ep.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={styles.episodeCard} className="ep-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                  <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#333' }}>{(i + 1).toString().padStart(2, '0')}</div>
                  <div>
                    <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {ep.title}
                    </h3>
                    <p style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace', marginTop: '5px' }}>
                      SCENES: {ep.scene_count || 0} // STATUS: {ep.status?.toUpperCase() || 'READY'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <FileText size={18} color="#333" />
                  <button
                    className="delete-icon"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteId(ep.id);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                    title="Delete Episode"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* --- MODALS --- */}
      {isUploadModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={styles.modalTitle}>Injest Protocol</h2>
              {!isUploading && <X size={24} style={{ cursor: 'pointer', color: '#666' }} onClick={() => setIsUploadModalOpen(false)} />}
            </div>
            <label style={styles.label}>EPISODE_ID</label>
            <input style={styles.input} placeholder="ENTER TITLE" value={newEpTitle} onChange={(e) => setNewEpTitle(e.target.value)} autoFocus disabled={isUploading} />
            <label style={styles.label}>SOURCE_FILE</label>
            <div style={{ ...styles.fileBox, opacity: isUploading ? 0.5 : 1 }} onClick={() => !isUploading && fileInputRef.current?.click()}>
              {selectedFile ? <div style={{ color: '#FFF' }}>{selectedFile.name}</div> : <> <Upload size={24} style={{ marginBottom: '15px' }} /> <div>UPLOAD SCRIPT (.PDF/.TXT)</div> </>}
            </div>
            <input type="file" ref={fileInputRef} hidden accept=".pdf,.docx,.txt" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />

            {/* FIX: Use the global "force-spin" class from globals.css */}
            <button style={{ ...styles.confirmBtn, opacity: isUploading ? 0.7 : 1 }} onClick={handleCreateEpisode} disabled={isUploading}>
              {isUploading ? <Loader2 className="force-spin" size={24} /> : "EXECUTE"}
            </button>

            {isUploading && <div style={styles.statusText}>{uploadStatus}</div>}
          </div>
        </div>
      )}
      {deleteId && <DeleteConfirmModal title="DELETE EPISODE?" message="This will permanently delete this episode and all script data." isDeleting={isDeleting} onConfirm={performDelete} onCancel={() => setDeleteId(null)} />}
      <SeriesTour step={tourStep} onComplete={completeTour} />
    </main>
  );
}