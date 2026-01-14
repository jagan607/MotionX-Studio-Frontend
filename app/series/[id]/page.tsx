"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { ArrowLeft, Plus, Play, Loader2, X, Upload, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";

export default function SeriesDetail() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params.id as string;

  const [seriesData, setSeriesData] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      if (!seriesId) return;
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
    fetchData();
  }, [seriesId]);

  const handleDeleteEpisode = async (e: React.MouseEvent, episodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("DELETE THIS EPISODE? SCRIPT DATA WILL BE LOST.")) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/script/episode/${seriesId}/${episodeId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${idToken}` }
      });

      if (res.ok) {
        setEpisodes(prev => prev.filter(ep => ep.id !== episodeId));
      } else {
        alert("FAILED TO DELETE EPISODE");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateEpisode = async () => {
    if (!newEpTitle || !selectedFile) return alert("REQ: TITLE & FILE");
    setIsUploading(true);
    const formData = new FormData();
    formData.append("series_id", seriesId);
    formData.append("episode_title", newEpTitle);
    formData.append("file", selectedFile);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/v1/script/upload-episode`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${idToken}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        router.push(`/series/${seriesId}/episode/${data.episode_id}`);
      } else {
        alert("UPLOAD ERROR: " + (data.detail || "Unknown"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#030303', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '60px 80px' },
    backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '10px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none', marginBottom: '60px' },

    header: { borderBottom: '1px solid #333', paddingBottom: '40px', marginBottom: '60px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
    title: { fontFamily: 'Anton, sans-serif', fontSize: '80px', lineHeight: '0.9', textTransform: 'uppercase' as const, color: '#FFF', marginBottom: '20px' },
    metaRow: { display: 'flex', gap: '30px', fontSize: '11px', color: '#FF0000', fontFamily: 'monospace', textTransform: 'uppercase' as const },

    addButton: { backgroundColor: '#EDEDED', color: '#050505', border: 'none', padding: '20px 40px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const, boxShadow: '0 0 20px rgba(255,255,255,0.1)' },

    sectionTitle: { fontSize: '12px', color: '#666', fontWeight: 'bold' as const, letterSpacing: '4px', marginBottom: '30px', textTransform: 'uppercase' as const, paddingLeft: '2px' },

    episodeGrid: { display: 'flex', flexDirection: 'column' as const, gap: '15px' },

    episodeCard: {
      backgroundColor: '#080808', border: '1px solid #1A1A1A', padding: '25px 40px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      cursor: 'pointer', transition: 'all 0.2s', position: 'relative' as const
    },

    // Modal styles (Reused but slightly tweaked for dark theme)
    overlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
    modal: { width: '500px', backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '40px' },
    modalTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '30px', color: 'white' },
    label: { fontSize: '10px', fontWeight: 'bold' as const, color: '#FF0000', letterSpacing: '2px', marginBottom: '10px', display: 'block' },
    input: { width: '100%', backgroundColor: '#111', border: 'none', padding: '15px', color: 'white', fontSize: '16px', marginBottom: '30px', outline: 'none' },
    fileBox: { border: '1px dashed #333', padding: '40px', textAlign: 'center' as const, color: '#666', cursor: 'pointer', marginBottom: '30px' },
    confirmBtn: { width: '100%', padding: '20px', backgroundColor: '#FF0000', border: 'none', color: 'white', fontWeight: 'bold' as const, cursor: 'pointer', letterSpacing: '1px' }
  };

  if (loading) return <div style={styles.container}>ACCESSING DATABASE...</div>;
  if (!seriesData) return <div style={styles.container}>DATA CORRUPTED</div>;

  return (
    <main style={styles.container}>
      <style>{`
        .ep-card:hover { border-color: #333 !important; background-color: #0E0E0E !important; transform: scale(1.01); }
        .ep-card:hover .play-icon { color: #FF0000; }
        .ep-card:hover .delete-icon { opacity: 1; }
      `}</style>

      <Link href="/" style={styles.backLink}> <ArrowLeft size={14} /> TERMINAL ROOT </Link>

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>{seriesData.title}</h1>
          <div style={styles.metaRow}>
            <span>ID: {seriesData?.style?.toUpperCase()}</span>
            <span>TYPE: {seriesData?.genre?.toUpperCase()}</span>
          </div>
        </div>
        <button style={styles.addButton} onClick={() => setIsModalOpen(true)}>
          <Plus size={20} strokeWidth={3} /> NEW EPISODE
        </button>
      </div>

      <div style={styles.sectionTitle}>// EPISODE_SEQUENCE</div>

      <div style={styles.episodeGrid}>
        {episodes.map((ep, i) => (
          <Link key={ep.id} href={`/series/${seriesId}/episode/${ep.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={styles.episodeCard} className="ep-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#333' }}>{(i + 1).toString().padStart(2, '0')}</div>
                <div>
                  <h3 style={{ fontFamily: 'Anton, sans-serif', fontSize: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>{ep.title}</h3>
                  <p style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace', marginTop: '5px' }}>
                    SCENES: {ep.scene_count} // STATUS: {ep.status?.toUpperCase() || 'READY'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <FileText size={18} color="#333" />
                <button
                  className="delete-icon"
                  onClick={(e) => handleDeleteEpisode(e, ep.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#444', opacity: 0, transition: 'all 0.2s' }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {isModalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={styles.modalTitle}>Injest Protocol</h2>
              <X size={24} style={{ cursor: 'pointer', color: '#666' }} onClick={() => setIsModalOpen(false)} />
            </div>

            <label style={styles.label}>EPISODE_ID</label>
            <input style={styles.input} placeholder="ENTER TITLE" value={newEpTitle} onChange={(e) => setNewEpTitle(e.target.value)} autoFocus />

            <label style={styles.label}>SOURCE_FILE</label>
            <div style={styles.fileBox} onClick={() => fileInputRef.current?.click()}>
              {selectedFile ? (
                <div style={{ color: '#FFF' }}>{selectedFile.name}</div>
              ) : (
                <> <Upload size={24} style={{ marginBottom: '15px' }} /> <div>UPLOAD SCRIPT (.PDF/.TXT)</div> </>
              )}
            </div>
            <input type="file" ref={fileInputRef} hidden accept=".pdf,.docx,.txt" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} />

            <button style={styles.confirmBtn} onClick={handleCreateEpisode} disabled={isUploading}>
              {isUploading ? "ANALYZING..." : "EXECUTE"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}