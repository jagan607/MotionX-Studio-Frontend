"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, MapPin, X, Users, LayoutTemplate, Camera, Upload, Sparkles, Loader2, Image as ImageIcon, Film, Plus, Wand2, Maximize2, Download } from "lucide-react";
import Link from "next/link";

export default function EpisodeBoard() {
  const params = useParams();
  const seriesId = params?.id as string;
  const episodeId = params?.episodeId as string;

  const [scenes, setScenes] = useState<any[]>([]);
  const [episodeData, setEpisodeData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('scenes');
  
  // Assets
  const [uniqueChars, setUniqueChars] = useState<string[]>([]);
  const [uniqueLocs, setUniqueLocs] = useState<string[]>([]);
  const [characterImages, setCharacterImages] = useState<Record<string, string>>({}); 
  const [locationImages, setLocationImages] = useState<Record<string, string>>({});

  // Storyboard State
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [shots, setShots] = useState<any[]>([]);
  
  // Loading States
  const [renderingShotId, setRenderingShotId] = useState<string | null>(null);
  const [isAutoDirecting, setIsAutoDirecting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("INITIALIZING AI..."); // For Brutalist Loader
  const [aspectRatio, setAspectRatio] = useState("16:9");

  // Zoom / Modal State
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [assetType, setAssetType] = useState<'character' | 'location'>('character');
  const [modalMode, setModalMode] = useState<'upload' | 'generate'>('upload');
  const [genPrompt, setGenPrompt] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (seriesId && episodeId) fetchData(); }, [seriesId, episodeId]);

  useEffect(() => {
    if (!activeSceneId) return;
    const q = collection(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots");
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const shotData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        shotData.sort((a, b) => a.id.localeCompare(b.id)); 
        setShots(shotData);
    });
    return () => unsubscribe();
  }, [activeSceneId]);

  async function fetchData() {
    try {
      const epDoc = await getDoc(doc(db, "series", seriesId, "episodes", episodeId));
      if (epDoc.exists()) setEpisodeData(epDoc.data());

      const querySnapshot = await getDocs(collection(db, "series", seriesId, "episodes", episodeId, "scenes"));
      const scenesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      scenesData.sort((a: any, b: any) => a.scene_number - b.scene_number);
      setScenes(scenesData);

      const chars = new Set<string>();
      const locs = new Set<string>();
      scenesData.forEach((s: any) => {
          s.characters?.forEach((c: string) => chars.add(c));
          if (s.location) locs.add(s.location);
      });
      setUniqueChars(Array.from(chars));
      setUniqueLocs(Array.from(locs));

      const charSnapshot = await getDocs(collection(db, "series", seriesId, "characters"));
      const charMap: Record<string, string> = {};
      charSnapshot.forEach(doc => charMap[doc.id] = doc.data().image_url);
      setCharacterImages(charMap);

      const locSnapshot = await getDocs(collection(db, "series", seriesId, "locations"));
      const locMap: Record<string, string> = {};
      locSnapshot.forEach(doc => locMap[doc.id] = doc.data().image_url);
      setLocationImages(locMap);
    } catch (e) { console.error(e); }
  }

  // --- HANDLERS ---

  const handleOpenStoryboard = (sceneId: string) => {
      setActiveSceneId(sceneId);
      setShots([]);
  };

  const handleAutoDirect = async () => {
      if (!activeSceneId) return;
      setIsAutoDirecting(true);
      setLoadingMessage("READING SCRIPT...");

      const currentScene = scenes.find(s => s.id === activeSceneId);
      const formData = new FormData();
      formData.append("scene_action", currentScene.visual_action || "");
      formData.append("characters", (currentScene.characters || []).join(", "));
      formData.append("location", currentScene.location || "Unknown");

      try {
          // 1. Get Text Suggestions
          setTimeout(() => setLoadingMessage("COMPUTING ANGLES..."), 800);
          
          const res = await fetch("http://127.0.0.1:8000/api/v1/shot/suggest_shots", { method: "POST", body: formData });
          const data = await res.json();
          
          if (data.status === "success" && data.shots) {
              setLoadingMessage("GENERATING SHOT LIST...");
              const batch = writeBatch(db);
              const newShots: any[] = [];

              data.shots.forEach((shot: any, index: number) => {
                  const newShotId = `shot_${String(index + 1).padStart(2, '0')}`;
                  const docRef = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId);
                  
                  const shotPayload = {
                      id: newShotId, // Store ID locally for immediate rendering
                      type: shot.type,
                      prompt: shot.description,
                      characters: shot.characters || [],
                      location: shot.location || currentScene.location || "",
                      status: "draft"
                  };
                  
                  batch.set(docRef, shotPayload);
                  newShots.push(shotPayload);
              });
              await batch.commit();

              // 2. AUTO-TRIGGER IMAGE GENERATION (The Magic)
              setLoadingMessage("RENDERING VISUALS...");
              // We don't await this so the UI unblocks immediately
              generateAllShots(newShots);
          }
      } catch (e) { alert("Auto-Direct Failed"); } 
      finally { 
          // Keep loader for a split second longer for effect
          setTimeout(() => setIsAutoDirecting(false), 500); 
      }
  };

  const generateAllShots = async (shotList: any[]) => {
      // Loop through and trigger render for each
      for (const shot of shotList) {
          handleRenderShot(shot);
      }
  };

  const handleRenderShot = async (shot: any) => {
      setRenderingShotId(shot.id);
      const currentScene = scenes.find(s => s.id === activeSceneId);
      const formData = new FormData();
      formData.append("series_id", seriesId || "");
      formData.append("episode_id", episodeId || "");
      formData.append("scene_id", activeSceneId || "");
      formData.append("shot_id", shot.id || "");
      formData.append("shot_prompt", shot.prompt || "Cinematic shot");
      formData.append("shot_type", shot.type || "Wide Shot");
      formData.append("characters", Array.isArray(shot.characters) ? shot.characters.join(",") : "");
      formData.append("location", shot.location || currentScene?.location || "");
      formData.append("aspect_ratio", aspectRatio || "16:9");

      try {
          await fetch("http://127.0.0.1:8000/api/v1/shot/generate_shot", { method: "POST", body: formData });
      } catch (e) { console.error(e); } 
      finally { setRenderingShotId(null); }
  };

  const handleDownload = async (url: string, filename: string) => {
      try {
          const response = await fetch(url);
          const blob = await response.blob();
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (error) { alert("Download failed"); }
  };

  const handleAddShot = async () => {
      if (!activeSceneId) return;
      const newShotId = `shot_${String(shots.length + 1).padStart(2, '0')}`;
      const currentScene = scenes.find(s => s.id === activeSceneId);
      await setDoc(doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId, "shots", newShotId), {
          type: "Wide Shot",
          prompt: currentScene?.visual_action || "Describe action...",
          characters: [],
          location: currentScene?.location || "",
          status: "draft"
      });
  };

  const updateShot = async (shotId: string, field: string, value: any) => {
      const ref = doc(db, "series", seriesId, "episodes", episodeId, "scenes", activeSceneId!, "shots", shotId);
      await setDoc(ref, { [field]: value }, { merge: true });
  };
  
  // Asset Handlers (Keep same)
  const openAssetModal = (name: string, type: 'character' | 'location') => {
      setSelectedAsset(name); setAssetType(type); setModalOpen(true);
      setGenPrompt(type === 'character' ? `Cinematic portrait of ${name}...` : `Wide shot of ${name}...`);
  };
  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { /* ... existing ... */ };
  const handleAssetGenerate = async () => { /* ... existing ... */ };

  // --- STYLES ---
  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#050505', color: '#EDEDED', fontFamily: 'Inter, sans-serif', padding: '40px' },
    topNav: { display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'center' },
    backLink: { display: 'flex', alignItems: 'center', gap: '8px', color: '#666', fontSize: '11px', fontWeight: 'bold' as const, letterSpacing: '2px', textDecoration: 'none' },
    header: { marginBottom: '40px', borderBottom: '1px solid #222', paddingBottom: '0px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
    titleBlock: { paddingBottom: '30px' },
    title: { fontFamily: 'Anton, sans-serif', fontSize: '48px', textTransform: 'uppercase' as const, color: '#FFF' },
    subtitle: { fontSize: '12px', color: '#888', letterSpacing: '2px', textTransform: 'uppercase' as const, marginTop: '10px' },
    tabRow: { display: 'flex', gap: '40px' },
    tabBtn: (isActive: boolean) => ({ paddingBottom: '30px', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '2px', cursor: 'pointer', color: isActive ? '#FF0000' : '#666', borderBottom: isActive ? '3px solid #FF0000' : '3px solid transparent', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: '8px' }),
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '30px' },
    card: { backgroundColor: '#0A0A0A', border: '1px solid #1F1F1F', padding: '30px', position: 'relative' as const },
    activeCard: { border: '1px solid #FF0000', backgroundColor: '#111' },
    
    // Asset Cards
    assetCard: { backgroundColor: '#0A0A0A', border: '1px solid #222', padding: '0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', overflow: 'hidden' },
    assetImage: { width: '100%', height: '300px', objectFit: 'cover' as const, backgroundColor: '#111' },
    assetPlaceholder: { width: '100%', height: '300px', backgroundColor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' },
    assetName: { padding: '20px', fontFamily: 'Anton, sans-serif', fontSize: '24px', color: '#FFF', textAlign: 'center' as const, width: '100%', textTransform: 'uppercase' as const },
    genBtn: { width: '100%', padding: '15px', backgroundColor: '#222', color: '#FFF', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', fontSize: '11px', letterSpacing: '2px', borderTop: '1px solid #333' },
    
    // Storyboard
    sbOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#050505', zIndex: 100, padding: '40px', overflowY: 'auto' as const },
    sbHeader: { display: 'flex', alignItems: 'center', gap: '20px', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '40px' },
    sbGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
    shotCard: { backgroundColor: '#0E0E0E', border: '1px solid #222', padding: '20px' },
    
    // UPDATED SHOT IMAGE (With Overlay Support)
    shotImageContainer: { position: 'relative' as const, width: '100%', height: '180px', marginBottom: '15px', border: '1px solid #222' },
    shotImage: { width: '100%', height: '100%', objectFit: 'cover' as const, backgroundColor: '#000' },
    shotTools: { position: 'absolute' as const, top: '5px', right: '5px', display: 'flex', gap: '5px' },
    toolBtn: { backgroundColor: 'rgba(0,0,0,0.7)', border: '1px solid #333', color: 'white', padding: '5px', cursor: 'pointer', borderRadius: '4px' },
    
    label: { fontSize: '10px', fontWeight: 'bold' as const, color: '#666', marginBottom: '5px', display: 'block', letterSpacing: '1px' },
    select: { width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', marginBottom: '15px', outline: 'none' },
    textArea: { width: '100%', backgroundColor: '#111', border: '1px solid #333', color: 'white', padding: '10px', fontSize: '12px', marginBottom: '15px', minHeight: '80px', resize: 'none' as const },
    renderBtn: { width: '100%', backgroundColor: '#FF0000', color: 'white', border: 'none', padding: '12px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    renderBtnLoading: { width: '100%', backgroundColor: '#FFF', color: 'black', border: 'none', padding: '12px', fontSize: '11px', fontWeight: 'bold' as const, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    charToggle: (active: boolean) => ({ fontSize: '10px', padding: '6px 12px', border: '1px solid #333', backgroundColor: active ? '#FF0000' : 'transparent', color: active ? 'white' : '#666', cursor: 'pointer', marginRight: '5px', marginBottom: '5px' }),
    
    // Brutalist Loader Overlay
    brutalistLoader: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 5, 5, 0.95)', zIndex: 999, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', color: '#FF0000' },
    loaderText: { fontFamily: 'Anton, sans-serif', fontSize: '64px', textTransform: 'uppercase' as const, letterSpacing: '5px', marginBottom: '20px' },
    loaderSub: { fontSize: '14px', letterSpacing: '3px', color: '#FFF' },
    
    // Zoom Modal
    zoomOverlay: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
    zoomImg: { maxWidth: '90%', maxHeight: '90%', border: '1px solid #333', boxShadow: '0 0 50px rgba(0,0,0,0.8)' },
    
    // Helpers
    sceneHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' },
    sceneTitle: { color: '#FF0000', fontWeight: 'bold' as const, fontSize: '14px', letterSpacing: '1px' },
    metaTag: { fontSize: '10px', backgroundColor: '#222', padding: '2px 6px', borderRadius: '4px', color: '#888' },
    locRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' as const, marginBottom: '15px', color: '#FFF' },
    actionText: { fontSize: '14px', lineHeight: '1.6', color: '#CCC', marginBottom: '20px', minHeight: '80px' },
    modal: { width: '600px', backgroundColor: '#0A0A0A', border: '1px solid #333', padding: '40px' },
    modalTitle: { fontFamily: 'Anton, sans-serif', fontSize: '32px', textTransform: 'uppercase' as const, marginBottom: '10px', color: 'white' },
    modalSub: { fontSize: '12px', color: '#666', marginBottom: '30px' },
    toggleRow: { display: 'flex', marginBottom: '30px', borderBottom: '1px solid #222' },
    toggleBtn: (active: boolean) => ({ flex: 1, padding: '15px', textAlign: 'center' as const, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' as const, letterSpacing: '1px', color: active ? 'white' : '#444', borderBottom: active ? '2px solid #FF0000' : 'none' }),
    uploadBox: { border: '1px dashed #333', padding: '50px', textAlign: 'center' as const, color: '#666', cursor: 'pointer', marginBottom: '20px' },
    textareaInput: { width: '100%', backgroundColor: '#111', border: '1px solid #333', padding: '15px', color: '#EEE', fontSize: '14px', marginBottom: '20px', resize: 'none' as const },
    primaryBtn: { width: '100%', padding: '20px', backgroundColor: '#FF0000', color: 'white', border: 'none', fontWeight: 'bold' as const, cursor: 'pointer', letterSpacing: '2px', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }
  };


  return (
    <main style={styles.container}>
      {/* ... (Header, Tabs, Scenes, Casting, Locations - SAME AS BEFORE) ... */}
      <div style={styles.topNav}>
        <Link href={`/series/${seriesId}`} style={styles.backLink}><ArrowLeft size={14} /> BACK TO EPISODES</Link>
        <div style={{ fontSize: '12px', color: '#444' }}>MOTION X STUDIO</div>
      </div>
      <div style={styles.header}>
        <div style={styles.titleBlock}><h1 style={styles.title}>{episodeData?.title || 'UNTITLED'}</h1><p style={styles.subtitle}>PHASE 2: ASSET LAB</p></div>
        <div style={styles.tabRow}>
            <div style={styles.tabBtn(activeTab === 'scenes')} onClick={() => setActiveTab('scenes')}><LayoutTemplate size={16} /> SCENES</div>
            <div style={styles.tabBtn(activeTab === 'casting')} onClick={() => setActiveTab('casting')}><Users size={16} /> CASTING ({uniqueChars.length})</div>
            <div style={styles.tabBtn(activeTab === 'locations')} onClick={() => setActiveTab('locations')}><MapPin size={16} /> LOCATIONS ({uniqueLocs.length})</div>
        </div>
      </div>

      {activeTab === 'scenes' && (
          <div style={styles.grid}>
             {scenes.map(scene => (
                 <div key={scene.id} style={styles.card}>
                    <div style={styles.sceneHeader}><span style={styles.sceneTitle}>SCENE {scene.scene_number}</span><span style={styles.metaTag}>{scene.time_of_day}</span></div>
                    <div style={styles.locRow}><MapPin size={16} color="#666" /> {scene.location}</div>
                    <p style={styles.actionText}>{scene.visual_action}</p>
                    <button onClick={() => handleOpenStoryboard(scene.id)} style={{width: '100%', padding: '15px', backgroundColor: '#222', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '12px', letterSpacing: '1px'}}>
                        <Film size={16} /> OPEN STORYBOARD
                    </button>
                 </div>
             ))}
          </div>
      )}
      {activeTab === 'casting' && (
          <div style={styles.grid}>
              {uniqueChars.map((char, index) => {
                  const imageUrl = characterImages[char];
                  return (
                    <div key={index} style={styles.assetCard}>
                        {imageUrl ? <img src={imageUrl} alt={char} style={styles.assetImage} /> : <div style={styles.assetPlaceholder}><Camera size={40} /></div>}
                        <div style={styles.assetName}>{char}</div>
                        <button style={{...styles.genBtn, backgroundColor: imageUrl ? '#222' : '#FF0000'}} onClick={() => openAssetModal(char, 'character')}>{imageUrl ? "REGENERATE" : "GENERATE CHARACTER"}</button>
                    </div>
                  );
              })}
          </div>
      )}
      {activeTab === 'locations' && (
          <div style={styles.grid}>
              {uniqueLocs.map((loc, index) => {
                  const imageUrl = locationImages[loc];
                  return (
                    <div key={index} style={styles.assetCard}>
                        {imageUrl ? <img src={imageUrl} alt={loc} style={styles.assetImage} /> : <div style={styles.assetPlaceholder}><ImageIcon size={40} /></div>}
                        <div style={styles.assetName}>{loc}</div>
                        <button style={{...styles.genBtn, backgroundColor: imageUrl ? '#222' : '#FF0000'}} onClick={() => openAssetModal(loc, 'location')}>{imageUrl ? "REGENERATE SET" : "BUILD SET"}</button>
                    </div>
                  );
              })}
          </div>
      )}

      {/* --- STORYBOARD OVERLAY --- */}
      {activeSceneId && (
        <div style={styles.sbOverlay}>
            <div style={styles.sbHeader}>
                <button onClick={() => setActiveSceneId(null)} style={{background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 'bold'}}>
                    <ArrowLeft size={20} /> CLOSE BOARD
                </button>
                <div style={{fontFamily: 'Anton, sans-serif', fontSize: '32px'}}>SCENE STORYBOARD</div>
                
                <div style={{marginLeft: '40px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span style={{fontSize: '10px', fontWeight: 'bold', color: '#666'}}>ASPECT:</span>
                    <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} style={{backgroundColor: '#111', color: 'white', border: '1px solid #333', padding: '8px', fontSize: '12px', fontWeight: 'bold'}}>
                        <option value="16:9">16:9 (Cinema)</option>
                        <option value="21:9">21:9 (Wide)</option>
                        <option value="9:16">9:16 (Vertical)</option>
                    </select>
                </div>

                <div style={{marginLeft: 'auto', display: 'flex', gap: '10px'}}>
                    <button 
                        onClick={handleAutoDirect}
                        disabled={isAutoDirecting}
                        style={{padding: '12px 24px', backgroundColor: '#222', color: '#FFF', fontWeight: 'bold', border: '1px solid #333', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px'}}
                    >
                        <Wand2 size={16} /> AUTO-DIRECT
                    </button>
                    <button onClick={handleAddShot} style={{padding: '12px 24px', backgroundColor: '#FFF', color: 'black', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', letterSpacing: '1px'}}>
                        <Plus size={16} /> ADD SHOT
                    </button>
                </div>
            </div>

            <div style={styles.sbGrid}>
                {shots.map((shot, index) => {
                    const isThisShotLoading = renderingShotId === shot.id;
                    return (
                        <div key={shot.id} style={styles.shotCard}>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                                <span style={{color: '#FF0000', fontWeight: 'bold', fontSize: '12px'}}>SHOT {index + 1}</span>
                                <span style={{fontSize: '10px', color: '#666'}}>{shot.status}</span>
                            </div>

                            {/* --- IMAGE CONTAINER WITH TOOLS --- */}
                            <div style={styles.shotImageContainer}>
                                {shot.image_url ? (
                                    <>
                                        <img src={shot.image_url} style={styles.shotImage} />
                                        {/* TOOLS OVERLAY */}
                                        <div style={styles.shotTools}>
                                            <button style={styles.toolBtn} onClick={() => setZoomImage(shot.image_url)} title="Maximize">
                                                <Maximize2 size={12} />
                                            </button>
                                            <button style={styles.toolBtn} onClick={() => handleDownload(shot.image_url, `${shot.id}.png`)} title="Download">
                                                <Download size={12} />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{...styles.shotImage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333'}}>
                                        {isThisShotLoading ? <Loader2 className="animate-spin" size={32} color="#444"/> : <Film size={32} />}
                                    </div>
                                )}
                            </div>

                            <label style={styles.label}>SHOT TYPE</label>
                            <select style={styles.select} value={shot.type} onChange={(e) => updateShot(shot.id, "type", e.target.value)}>
                                <option>Wide Shot</option>
                                <option>Medium Shot</option>
                                <option>Close Up</option>
                                <option>Over the Shoulder</option>
                                <option>Low Angle</option>
                            </select>

                            <label style={styles.label}>CASTING</label>
                            <div style={{display: 'flex', flexWrap: 'wrap', marginBottom: '15px'}}>
                                {uniqueChars.map(char => {
                                    const isSelected = shot.characters?.includes(char);
                                    return (
                                        <button key={char} onClick={() => { const current = shot.characters || []; const updated = isSelected ? current.filter((c:string) => c !== char) : [...current, char]; updateShot(shot.id, "characters", updated); }} style={styles.charToggle(isSelected)}>{char}</button>
                                    )
                                })}
                            </div>
                            
                            <label style={styles.label}>VISUAL ACTION</label>
                            <textarea style={styles.textArea} value={shot.prompt} onChange={(e) => updateShot(shot.id, "prompt", e.target.value)} />

                            <button style={isThisShotLoading ? styles.renderBtnLoading : styles.renderBtn} onClick={() => handleRenderShot(shot)} disabled={isThisShotLoading}>
                                {isThisShotLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 
                                {isThisShotLoading ? "GENERATING..." : (shot.image_url ? "REGENERATE SHOT" : "RENDER SHOT")}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* --- BRUTALIST LOADER (AUTO-DIRECT) --- */}
      {isAutoDirecting && (
          <div style={styles.brutalistLoader}>
              <Loader2 size={80} className="animate-spin" style={{marginBottom: '30px'}} />
              <div style={styles.loaderText}>AI DIRECTOR</div>
              <div style={styles.loaderSub}>{loadingMessage}</div>
          </div>
      )}

      {/* --- ZOOM MODAL --- */}
      {zoomImage && (
          <div style={styles.zoomOverlay} onClick={() => setZoomImage(null)}>
              <img src={zoomImage} style={styles.zoomImg} onClick={(e) => e.stopPropagation()} />
              <X size={30} style={{position: 'absolute', top: 30, right: 30, color: 'white', cursor: 'pointer'}} onClick={() => setZoomImage(null)} />
          </div>
      )}

      {/* Asset Modal (Hidden for brevity - keep existing) */}
      {modalOpen && (
         <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
           <div style={styles.modal}>
               <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                   <h2 style={styles.modalTitle}>{selectedAsset}</h2>
                   <X size={24} style={{cursor: 'pointer', color: 'white'}} onClick={() => setModalOpen(false)} />
               </div>
               <p style={styles.modalSub}>ASSET GENERATION</p>
               <div style={styles.toggleRow}>
                   <div style={styles.toggleBtn(modalMode === 'upload')} onClick={() => setModalMode('upload')}>UPLOAD REF</div>
                   <div style={styles.toggleBtn(modalMode === 'generate')} onClick={() => setModalMode('generate')}>AI GENERATION</div>
               </div>
               {modalMode === 'upload' && (
                   <>
                       <div style={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                           <Upload size={32} style={{marginBottom: '15px'}} />
                           <p>CLICK TO UPLOAD REF</p>
                       </div>
                       <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAssetUpload} />
                       {isProcessing && <div style={{textAlign: 'center', color: '#FF0000'}}>UPLOADING...</div>}
                   </>
               )}
               {modalMode === 'generate' && (
                   <>
                       <textarea style={styles.textareaInput} value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="Describe details..." />
                       <button style={styles.primaryBtn} onClick={handleAssetGenerate} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />} {isProcessing ? "DREAMING..." : "GENERATE"}</button>
                   </>
               )}
           </div>
        </div>
      )}
    </main>
  );
}