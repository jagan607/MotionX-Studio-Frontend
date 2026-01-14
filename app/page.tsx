"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Film, Tv, ChevronRight, Loader2, LogOut, User, Trash2, AlertTriangle } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

export default function Dashboard() {
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch Data
  useEffect(() => {
    async function fetchUserScopedSeries() {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        const seriesRef = collection(db, "series");
        const q = query(seriesRef, where("owner_id", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        setSeriesList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Fetch failed:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchUserScopedSeries();
  }, [auth.currentUser]);

  // Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  // Handle Delete
  const handleDelete = async (e: React.MouseEvent, seriesId: string) => {
    e.preventDefault();
    e.stopPropagation(); // Stop click from opening the card

    if (!confirm("WARNING: DELETE THIS PRODUCTION? THIS ACTION CANNOT BE UNDONE.")) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();

      // Call Backend to delete
      const res = await fetch(`${API_BASE_URL}/api/v1/script/series/${seriesId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${idToken}` }
      });

      if (res.ok) {
        // Remove from UI immediately
        setSeriesList(prev => prev.filter(s => s.id !== seriesId));
      } else {
        alert("DELETE FAILED");
      }
    } catch (err) {
      console.error(err);
      alert("CONNECTION ERROR");
    }
  };

  // --- CYBER-BRUTALIST STYLES ---
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#030303',
      color: '#EDEDED',
      fontFamily: 'Inter, sans-serif',
      padding: '60px 80px',
      backgroundImage: 'radial-gradient(circle at 50% 50%, #111 0%, #030303 80%)', // Subtle lighting
    },
    header: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      borderBottom: '1px solid #333', paddingBottom: '30px', marginBottom: '50px'
    },
    logo: { fontSize: '42px', fontFamily: 'Anton, sans-serif', textTransform: 'uppercase' as const, lineHeight: '1', letterSpacing: '1px' },
    subLogo: { fontSize: '10px', color: '#FF0000', letterSpacing: '4px', fontWeight: 'bold' as const, marginTop: '10px', textTransform: 'uppercase' as const },

    // Header Buttons
    logoutBtn: { backgroundColor: 'transparent', color: '#666', border: '1px solid #333', padding: '12px 20px', fontSize: '10px', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' as const },
    createButton: { backgroundColor: '#FF0000', color: 'black', border: 'none', padding: '16px 32px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase' as const, boxShadow: '0 0 20px rgba(255, 0, 0, 0.2)' },

    // Grid
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px' },

    // The Card (CSS Group needed for hover)
    card: {
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid #222',
      padding: '30px',
      cursor: 'pointer',
      position: 'relative' as const,
      height: '100%',
      transition: 'all 0.3s ease',
      overflow: 'hidden'
    },

    // Typography
    cardTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '15px', color: '#FFF' },
    metaText: { fontFamily: 'monospace', fontSize: '10px', color: '#888', textTransform: 'uppercase' as const, display: 'flex', gap: '10px' },

    // Badges & Icons
    badge: { position: 'absolute' as const, top: '20px', right: '20px', fontSize: '9px', fontWeight: 'bold' as const, color: '#000', backgroundColor: '#FFF', padding: '2px 6px', textTransform: 'uppercase' as const },
    deleteBtn: {
      position: 'absolute' as const, bottom: '20px', right: '20px',
      background: 'transparent', border: 'none', color: '#444',
      cursor: 'pointer', zIndex: 10, transition: 'color 0.2s'
    }
  };

  return (
    <main style={styles.container}>
      {/* GLOBAL HOVER CSS */}
      <style>{`
        .series-card:hover { border-color: #FF0000 !important; transform: translateY(-5px); background-color: #0A0A0A !important; }
        .series-card:hover .open-link { color: #FF0000 !important; }
        .series-card:hover .delete-btn { color: #666 !important; }
        .delete-btn:hover { color: #FF0000 !important; }
      `}</style>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.logo}>Motion X <span style={{ color: '#FF0000' }}>Studio</span></h1>
          <p style={styles.subLogo}>/// PRODUCTION_TERMINAL_V1</p>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid #333', paddingRight: '20px' }}>
            <div style={{ width: '8px', height: '8px', backgroundColor: '#00FF41', borderRadius: '50%', boxShadow: '0 0 10px #00FF41' }}></div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '9px', color: '#666', fontFamily: 'monospace' }}>OPERATOR</p>
              <p style={{ fontSize: '11px', color: '#FFF', fontWeight: 'bold' }}>{auth.currentUser?.displayName || 'UNKNOWN'}</p>
            </div>
          </div>

          <button onClick={handleLogout} style={styles.logoutBtn}> <LogOut size={14} /> EXIT</button>
          <Link href="/series/new" style={{ textDecoration: 'none' }}>
            <button style={styles.createButton}> <Plus size={16} strokeWidth={3} /> INITIALIZE SERIES</button>
          </Link>
        </div>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div style={{ height: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
          <Loader2 className="animate-spin mb-4" />
          <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>ACCESSING MAINFRAME...</p>
        </div>
      ) : seriesList.length === 0 ? (
        <div style={{ border: '1px dashed #333', padding: '100px', textAlign: 'center', color: '#444' }}>
          <Film size={48} style={{ marginBottom: '20px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '24px', fontFamily: 'Anton', textTransform: 'uppercase' }}>No Active Data</h3>
          <p style={{ fontSize: '12px', marginTop: '10px' }}>INITIALIZE A NEW SERIES TO BEGIN</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {seriesList.map((series) => (
            <Link key={series.id} href={`/series/${series.id}`} style={{ textDecoration: 'none' }}>
              <div style={styles.card} className="series-card">
                <div style={styles.badge}>{series.style}</div>

                <Tv size={28} style={{ color: '#333', marginBottom: '40px' }} />

                <h2 style={styles.cardTitle}>{series.title}</h2>
                <div style={styles.metaText}>
                  <span>{series.genre}</span>
                  <span>//</span>
                  <span>{series.created_at ? new Date(series.created_at.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                </div>

                <div className="open-link" style={{ marginTop: '30px', fontSize: '10px', fontWeight: 'bold', color: '#444', display: 'flex', alignItems: 'center', gap: '5px', transition: 'color 0.2s' }}>
                  ACCESS DATA <ChevronRight size={10} />
                </div>

                {/* DELETE BUTTON */}
                <button
                  className="delete-btn"
                  onClick={(e) => handleDelete(e, series.id)}
                  style={styles.deleteBtn}
                  title="DELETE SERIES"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}