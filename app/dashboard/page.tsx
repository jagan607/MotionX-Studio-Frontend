"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tv, ChevronRight, Loader2, Film, Trash2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { DashboardTour } from "@/components/DashboardTour";
import { useDashboardTour } from "@/hooks/useDashboardTour";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { toastError } from "@/lib/toast";

export default function Dashboard() {
    const [seriesList, setSeriesList] = useState<any[]>([]);
    const [authLoading, setAuthLoading] = useState(true); // Default to TRUE to block render
    const router = useRouter();

    // TOUR HOOK
    const { tourStep, nextStep, completeTour } = useDashboardTour();

    // DELETE STATE
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // --- AUTH & DATA FETCH ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // 1. User is confirmed. Fetch Data.
                try {
                    const seriesRef = collection(db, "series");
                    const q = query(seriesRef, where("owner_id", "==", user.uid));
                    const querySnapshot = await getDocs(q);
                    setSeriesList(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } catch (e) {
                    console.error("Fetch failed:", e);
                } finally {
                    // 2. Only NOW do we reveal the dashboard
                    setAuthLoading(false);
                }
            } else {
                // 3. No User. Redirect.
                // CRITICAL: We DO NOT setAuthLoading(false). 
                // We keep the loader on screen until the page fully unmounts.
                router.replace("/login");
            }
        });

        return () => unsubscribe();
    }, [router]);

    // DELETE LOGIC
    const confirmDeleteRequest = (e: React.MouseEvent, seriesId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteId(seriesId);
    };

    const performDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/script/series/${deleteId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${idToken}` }
            });

            if (res.ok) {
                setSeriesList(prev => prev.filter(s => s.id !== deleteId));
                setDeleteId(null);
            } else {
                const data = await res.json();
                toastError("DELETE FAILED: " + (data.detail || "Server error"));
            }
        } catch (err) {
            console.error(err);
            toastError("CONNECTION ERROR");
        } finally {
            setIsDeleting(false);
        }
    };

    // STYLES
    const styles = {
        container: {
            minHeight: '100vh',
            backgroundColor: '#030303',
            color: '#EDEDED',
            fontFamily: 'Inter, sans-serif',
            padding: '40px 80px',
            backgroundImage: 'radial-gradient(circle at 50% 50%, #111 0%, #030303 80%)',
        },
        grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '30px', marginTop: '40px' },
        card: {
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid #222', padding: '30px', cursor: 'pointer',
            position: 'relative' as const, height: '100%', transition: 'all 0.3s ease', overflow: 'hidden'
        },
        cardTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '15px', color: '#FFF' },
        metaText: { fontFamily: 'monospace', fontSize: '10px', color: '#888', textTransform: 'uppercase' as const, display: 'flex', gap: '10px' },
        badge: { position: 'absolute' as const, top: '20px', right: '20px', fontSize: '9px', fontWeight: 'bold' as const, color: '#000', backgroundColor: '#FFF', padding: '2px 6px', textTransform: 'uppercase' as const },
        deleteBtn: { position: 'absolute' as const, bottom: '20px', right: '20px', background: 'transparent', border: 'none', color: '#444', cursor: 'pointer', zIndex: 10, transition: 'color 0.2s' }
    };

    // --- STRICT AUTH GUARD ---
    // This ensures NO dashboard content is rendered until auth is 100% confirmed.
    if (authLoading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: '#030303', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', flexDirection: 'column', gap: '15px' }}>
                <Loader2 className="animate-spin" size={40} />
                <p style={{ fontFamily: 'monospace', fontSize: '12px', letterSpacing: '2px' }}>AUTHENTICATING...</p>
            </div>
        );
    }

    return (
        <main style={styles.container}>
            <style>{`
                .series-card:hover { border-color: #FF0000 !important; transform: translateY(-5px); background-color: #0A0A0A !important; }
                .series-card:hover .open-link { color: #FF0000 !important; }
                .series-card:hover .delete-btn { color: #666 !important; }
                .delete-btn:hover { color: #FF0000 !important; }
            `}</style>

            {seriesList.length === 0 ? (
                <div style={{ border: '1px dashed #333', padding: '100px', textAlign: 'center', color: '#444', marginTop: '50px' }}>
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

                                <button
                                    className="delete-btn"
                                    onClick={(e) => confirmDeleteRequest(e, series.id)}
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

            <DashboardTour
                step={tourStep}
                onNext={nextStep}
                onComplete={completeTour}
            />

            {deleteId && (
                <DeleteConfirmModal
                    title="DELETE SERIES?"
                    message="This will permanently destroy the entire production, including all episodes, scripts, and generated assets. This action is irreversible."
                    isDeleting={isDeleting}
                    onConfirm={performDelete}
                    onCancel={() => setDeleteId(null)}
                />
            )}
        </main>
    );
}