"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { ArrowLeft, Film, Zap } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/config";

export default function CreateSeries() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [style, setStyle] = useState<"realistic" | "animation">("realistic");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  const handleCreate = async () => {
    if (!title || !genre) return alert("ENTER ALL DETAILS.");
    if (!userId) return alert("NOT AUTHENTICATED. PLEASE LOG IN.");
    setLoading(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Failed to get ID token");

      const formData = new FormData();
      formData.append("title", title); // Changed key to 'title'
      formData.append("genre", genre);
      formData.append("style", style);

      // FIX URL: Pointing to 'script' router where the code lives
      const res = await fetch(`${API_BASE_URL}/api/v1/create-series`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.series_id) {
        router.push(`/series/${data.series_id}`);
      } else {
        alert("CREATION FAILED: " + (data.detail || JSON.stringify(data)));
      }
    } catch (e) {
      console.error(e);
      alert("CREATION FAILED");
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#050505',
      color: '#EDEDED',
      fontFamily: 'Inter, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
    },
    box: {
      width: '100%',
      maxWidth: '600px',
    },
    label: {
      display: 'block',
      fontSize: '11px',
      color: '#FF0000',
      marginBottom: '10px',
      fontWeight: 'bold' as const,
      letterSpacing: '1.5px',
      textTransform: 'uppercase' as const,
    },
    input: {
      width: '100%',
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '1px solid #333',
      color: 'white',
      fontSize: '24px',
      padding: '10px 0',
      marginBottom: '40px',
      borderRadius: 0,
      fontFamily: 'Anton, sans-serif',
      outline: 'none',
    },
    optionBtn: (isActive: boolean) => ({
      flex: 1,
      padding: '30px',
      border: isActive ? '1px solid #FFF' : '1px solid #222',
      backgroundColor: isActive ? '#111' : 'transparent',
      color: isActive ? '#FFF' : '#666',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      gap: '10px',
      transition: 'all 0.2s',
    }),
    submitBtn: {
      width: '100%',
      backgroundColor: '#FF0000',
      color: 'white',
      border: 'none',
      padding: '24px',
      fontSize: '14px',
      fontWeight: 'bold' as const,
      letterSpacing: '2px',
      marginTop: '40px',
      cursor: 'pointer',
      textTransform: 'uppercase' as const,
    }
  };

  return (
    <main style={styles.container}>
      <div style={styles.box}>
        <Link href="/dashboard" style={{ textDecoration: 'none', color: '#666', fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '40px' }}>
          <ArrowLeft size={14} /> BACK TO DASHBOARD
        </Link>

        <h1 style={{ fontFamily: 'Anton, sans-serif', fontSize: '48px', lineHeight: 1, marginBottom: '10px', textTransform: 'uppercase' }}>New Production</h1>
        <p style={{ color: '#666', marginBottom: '50px' }}>Initialize parameters for your new series.</p>

        {/* INPUTS */}
        <label style={styles.label}>01 // SERIES TITLE</label>
        <input
          style={styles.input}
          placeholder="EX: BLADE RUNNER 2049"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <label style={styles.label}>02 // GENRE & LOGLINE</label>
        <input
          style={styles.input}
          placeholder="EX: CYBERPUNK NOIR THRILLER"
          value={genre}
          onChange={e => setGenre(e.target.value)}
        />

        <label style={styles.label}>03 // VISUAL STYLE</label>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={styles.optionBtn(style === 'realistic')} onClick={() => setStyle('realistic')}>
            <Film size={24} />
            <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>REALISTIC</span>
          </div>
          <div style={styles.optionBtn(style === 'animation')} onClick={() => setStyle('animation')}>
            <Zap size={24} />
            <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>ANIMATION</span>
          </div>
        </div>

        <button style={styles.submitBtn} onClick={handleCreate} disabled={loading}>
          {loading ? "INITIALIZING..." : "CREATE SERIES"}
        </button>
      </div>
    </main>
  );
}