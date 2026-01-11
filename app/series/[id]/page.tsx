"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Plus, Play, Calendar, Film, Loader2, X, Upload } from "lucide-react";
import Link from "next/link";

export default function SeriesDetail() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;

  const [seriesData, setSeriesData] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- MODAL STATE ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Data
  useEffect(() => {
    async function fetchData() {
      try {
        const docRef = doc(db, "series", seriesId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setSeriesData(docSnap.data());

        const epRef = collection(db, "series", seriesId, "episodes");
        const epSnap = await getDocs(epRef);
        setEpisodes(epSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (seriesId) fetchData();
  }, [seriesId]);

  // Handle Create Episode
  const handleCreateEpisode = async () => {
    if (!newEpTitle || !selectedFile) {
      alert("PLEASE ENTER TITLE AND UPLOAD SCRIPT");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("series_id", seriesId);
    formData.append("episode_title", newEpTitle);
    formData.append("file", selectedFile);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/script/upload-episode", {
        method: "POST", body: formData,
      });
      const data = await res.json();
      
      if (res.ok && data.status === "success") {
        // Success: Redirect to the new board
        router.push(`/series/${seriesId}/episode/${data.episode_id}`);
      } else {
        alert("UPLOAD ERROR: " + (data.detail || "Unknown Error"));
      }
    } catch (err) {
      alert("CONNECTION ERROR. IS BACKEND RUNNING?");
    } finally {
      setIsUploading(false);
    }
  };

  // --- STYLES ---
  const styles = {
    // ... (Existing Styles - kept same) ...
    container: { minHeight: '100vh', backgroundColor: '#050505', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '60px 80px' },
    backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '11px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none', marginBottom: '60px' },
    header: { borderBottom: '1px solid #222', paddingBottom: '40px', marginBottom: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
    title: { fontFamily: 'Anton, sans-serif', fontSize: '80px', lineHeight: '0.9', textTransform: 'uppercase' as const, color: '#FFF', marginBottom: '20px' },
    metaRow: { display: 'flex', gap: '30px', fontSize: '12px', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '1px', fontWeight: 'bold' as const },
    addButton: { backgroundColor: '#EDEDED', color: '#050505', border: 'none', padding: '20px 40px', fontSize: '14px', fontWeight: 'bold' as const, letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const },
    sectionTitle: { fontSize: '14px', color: '#FF0000', fontWeight: 'bold' as const, letterSpacing: '2px', marginBottom: '30px', textTransform: 'uppercase' as const, borderLeft: '3px solid #FF0000', paddingLeft: '15px' },
    episodeGrid: { display: 'grid', gap: '20px' },
    episodeCard: { backgroundColor: '#0A0A0A', border: '1px solid #1F1F1F', padding: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'border 0.2s' },

    // --- NEW MODAL STYLES ---
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
    modal: { width: '500px', backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' },
    modalTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '30px', color: 'white' },
    label: { fontSize: '11px', fontWeight: 'bold' as const, color: '#FF0000', letterSpacing: '1.5px', marginBottom: '10px', display: 'block' },
    input: { width: '100%', backgroundColor: '#111', border: 'none', padding: '15px', color: 'white', fontSize: '16px', marginBottom: '30px', outline: 'none', fontFamily: 'Inter, sans-serif' },
    fileBox: { border: '1px dashed #333', padding: '30px', textAlign: 'center' as const, color: '#666', cursor: 'pointer', marginBottom: '30px', transition: 'all 0.2s' },
    btnRow: { display: 'flex', gap: '10px' },
    cancelBtn: { flex: 1, padding: '20px', backgroundColor: 'transparent', border: '1px solid #333', color: '#666', fontWeight: 'bold' as const, cursor: 'pointer' },
    confirmBtn: { flex: 2, padding: '20px', backgroundColor: '#FF0000', border: 'none', color: 'white', fontWeight: 'bold' as const, cursor: 'pointer' }
  };

  if (loading) return <div style={styles.container}>LOADING PRODUCTION...</div>;
  if (!seriesData) return <div style={styles.container}>SERIES NOT FOUND</div>;

  return (
    <main style={styles.container}>
      
      {/* 1. TOP NAV */}
      <Link href="/" style={styles.backLink}>
        <ArrowLeft size={14} /> BACK TO DASHBOARD
      </Link>

      {/* 2. HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{seriesData.title}</h1>
          <div style={styles.metaRow}>
            <span>/// {seriesData.style} PRODUCTION</span>
            <span>/// {seriesData.genre}</span>
          </div>
        </div>
        <button style={styles.addButton} onClick={() => setIsModalOpen(true)}>
          <Plus size={20} strokeWidth={3} /> NEW EPISODE
        </button>
      </div>

      {/* 3. EPISODE LIST */}
      <div style={styles.sectionTitle}>Production Timeline</div>
      <div style={styles.episodeGrid}>
          {episodes.map((ep) => (
            <Link key={ep.id} href={`/series/${seriesId}/episode/${ep.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={styles.episodeCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div style={{ width: '50px', height: '50px', backgroundColor: '#111', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Play size={20} fill="white" /></div>
                    <div>
                        <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '24px', textTransform: 'uppercase' }}>{ep.title}</h3>
                        <p style={{ fontSize: '11px', color: '#666' }}>{ep.scene_count} SCENES • READY</p>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#FF0000' }}>OPEN BOARD &rarr;</div>
              </div>
            </Link>
          ))}
      </div>

      {/* 4. CREATE EPISODE MODAL */}
      {isModalOpen && (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={styles.modalTitle}>New Episode</h2>
                    <X size={24} style={{ cursor: 'pointer', color: '#666' }} onClick={() => setIsModalOpen(false)} />
                </div>

                <label style={styles.label}>01 // EPISODE TITLE</label>
                <input 
                    style={styles.input} 
                    placeholder="EX: THE PILOT" 
                    value={newEpTitle}
                    onChange={(e) => setNewEpTitle(e.target.value)}
                    autoFocus
                />

                <label style={styles.label}>02 // SCRIPT FILE</label>
                <div 
                    style={{...styles.fileBox, borderColor: selectedFile ? '#FFF' : '#333', color: selectedFile ? '#FFF' : '#666'}} 
                    onClick={() => fileInputRef.current?.click()}
                >
                    {selectedFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                            <Film size={20} /> {selectedFile.name}
                        </div>
                    ) : (
                        <>
                            <Upload size={24} style={{ marginBottom: '10px' }} />
                            <div>CLICK TO UPLOAD .PDF / .TXT</div>
                        </>
                    )}
                </div>
                <input type="file" ref={fileInputRef} hidden accept=".pdf,.docx,.txt" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />

                <div style={styles.btnRow}>
                    <button style={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>CANCEL</button>
                    <button style={styles.confirmBtn} onClick={handleCreateEpisode} disabled={isUploading}>
                        {isUploading ? "PROCESSING..." : "INITIALIZE EPISODE"}
                    </button>
                </div>
            </div>
        </div>
      )}

    </main>
  );
}