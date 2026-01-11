"use client";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { Plus, Film, Tv, ChevronRight, Loader2 } from "lucide-react";

export default function Dashboard() {
  const [seriesList, setSeriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSeries() {
      try {
        const querySnapshot = await getDocs(collection(db, "series"));
        setSeriesList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSeries();
  }, []);

  // --- BRUTALIST STYLES ---
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#050505',
      color: '#EDEDED',
      fontFamily: 'Inter, sans-serif',
      padding: '60px 80px', // More breathing room
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      borderBottom: '1px solid #222',
      paddingBottom: '30px',
      marginBottom: '50px',
    },
    logo: {
      fontSize: '42px',
      fontFamily: 'Anton, sans-serif',
      textTransform: 'uppercase' as const,
      lineHeight: '1',
      letterSpacing: '1px',
    },
    subLogo: {
      fontSize: '12px',
      color: '#666',
      letterSpacing: '3px',
      fontWeight: 'bold' as const,
      marginTop: '10px',
      textTransform: 'uppercase' as const,
    },
    createButton: {
      backgroundColor: '#FF0000',
      color: 'white',
      border: 'none',
      padding: '16px 32px',
      fontSize: '12px',
      fontWeight: 'bold' as const,
      letterSpacing: '2px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      textTransform: 'uppercase' as const,
    },
    emptyState: {
      height: '50vh',
      border: '1px dashed #222',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      color: '#444',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
      gap: '30px',
    },
    card: {
      backgroundColor: '#0A0A0A',
      border: '1px solid #1F1F1F',
      padding: '40px',
      cursor: 'pointer',
      position: 'relative' as const,
      transition: 'all 0.2s',
      height: '100%',
    },
    cardTitle: {
      fontFamily: 'Anton, sans-serif',
      fontSize: '28px',
      textTransform: 'uppercase' as const,
      marginBottom: '10px',
      color: '#FFF',
    },
    badge: {
      position: 'absolute' as const,
      top: '20px',
      right: '20px',
      fontSize: '10px',
      fontWeight: 'bold' as const,
      color: '#666',
      border: '1px solid #333',
      padding: '4px 8px',
      textTransform: 'uppercase' as const,
    }
  };

  return (
    <main style={styles.container}>
      
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.logo}>Motion X <span style={{ color: '#FF0000' }}>Studio</span></h1>
          <p style={styles.subLogo}>Production Dashboard</p>
        </div>
        
        <Link href="/series/new">
          <button style={styles.createButton}>
            <Plus size={16} strokeWidth={3} /> Create New Series
          </button>
        </Link>
      </div>

      {/* CONTENT */}
      {loading ? (
        <div style={styles.emptyState}>
            <Loader2 className="animate-spin mb-4" />
            <p>LOADING STUDIO DATA...</p>
        </div>
      ) : seriesList.length === 0 ? (
        <div style={styles.emptyState}>
          <Film size={48} style={{ marginBottom: '20px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', color: '#666' }}>No Active Productions</h3>
          <p style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>Initialize your first series to begin.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {seriesList.map((series) => (
            <Link key={series.id} href={`/series/${series.id}`} style={{ textDecoration: 'none' }}>
              <div style={styles.card} className="group"> {/* 'group' for hover effects if you add css later */}
                <div style={styles.badge}>{series.style}</div>
                
                <Tv size={32} style={{ color: '#333', marginBottom: '30px' }} />
                
                <h2 style={styles.cardTitle}>{series.title}</h2>
                <p style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {series.genre} • {series.created_at ? new Date(series.created_at.seconds * 1000).toLocaleDateString() : 'Just Now'}
                </p>

                <div style={{ marginTop: '30px', fontSize: '11px', fontWeight: 'bold', color: '#FF0000', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  OPEN PRODUCTION <ChevronRight size={12} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}