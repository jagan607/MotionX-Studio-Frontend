// src/app/project/[id]/page.tsx
"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams } from "next/navigation"; // New import
import { ArrowLeft, Clapperboard, MapPin, Save, Pencil, X } from "lucide-react";
import Link from "next/link";
import { toastError } from "@/lib/toast";
import { Toaster } from "react-hot-toast";

interface Scene {
  id: string;
  scene_number: number;
  location: string;
  time_of_day: string;
  visual_action: string;
  characters: string[];
}

export default function ProjectBoard() {
  const params = useParams();
  const projectId = params.id as string; // Get ID from URL

  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Scene>>({});

  useEffect(() => {
    if (projectId) fetchScenes();
  }, [projectId]);

  async function fetchScenes() {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "projects", projectId, "scenes"));
      const scenesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Scene[];
      scenesData.sort((a, b) => a.scene_number - b.scene_number);
      setScenes(scenesData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ... (Keep the exact same saveScene / startEditing logic from before) ...
  const startEditing = (scene: Scene) => {
    setEditingId(scene.id);
    setEditForm(scene);
  };

  const saveScene = async () => {
    if (!editingId || !editForm) return;
    try {
      setScenes(scenes.map(s => s.id === editingId ? { ...s, ...editForm } as Scene : s));
      const sceneRef = doc(db, "projects", projectId, "scenes", editingId);
      await updateDoc(sceneRef, {
        location: editForm.location,
        time_of_day: editForm.time_of_day,
        visual_action: editForm.visual_action
      });
      setEditingId(null);
    } catch (error) {
      toastError("Failed to save.");
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-200 p-8 font-sans">
      <Toaster position="bottom-right" reverseOrder={false} />
      <header className="mb-10 flex items-center justify-between border-b border-neutral-800 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-neutral-400" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Project: {projectId}</h1>
            <p className="text-sm text-neutral-500">Scene Breakdown</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="text-center py-20 animate-pulse text-neutral-500">Loading your masterpiece...</div>
      ) : scenes.length === 0 ? (
        <div className="text-center py-20 text-neutral-500">
          No scenes found. <br /> <Link href="/dashboard" className="text-blue-500 underline">Create a new project?</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* ... Paste the EXACT same grid mapping code from the previous step here ... */}
          {scenes.map((scene) => (
            <div key={scene.id} className={`relative p-6 rounded-xl border transition-all ${editingId === scene.id ? 'bg-neutral-900 border-blue-500 ring-1 ring-blue-500' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'}`}>
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <span className="text-blue-500 font-mono text-sm font-bold tracking-wider">SCENE {scene.scene_number}</span>
                {editingId === scene.id ? (
                  <input
                    className="bg-neutral-800 text-xs text-white px-2 py-1 rounded border border-neutral-700 focus:outline-none focus:border-blue-500"
                    value={editForm.time_of_day}
                    onChange={e => setEditForm({ ...editForm, time_of_day: e.target.value })}
                  />
                ) : (
                  <span className="text-xs text-neutral-400 bg-black/50 px-2 py-1 rounded border border-white/10">{scene.time_of_day}</span>
                )}
              </div>

              {/* Location */}
              <div className="mb-2">
                {editingId === scene.id ? (
                  <input
                    className="w-full bg-neutral-800 text-white p-2 rounded border border-neutral-700 font-semibold focus:outline-none focus:border-blue-500"
                    value={editForm.location}
                    onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                  />
                ) : (
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-white"><MapPin size={16} className="text-neutral-500" />{scene.location}</h3>
                )}
              </div>

              {/* Action */}
              <div className="mb-6">
                {editingId === scene.id ? (
                  <textarea
                    className="w-full h-24 bg-neutral-800 text-white p-2 rounded border border-neutral-700 text-sm focus:outline-none focus:border-blue-500"
                    value={editForm.visual_action}
                    onChange={e => setEditForm({ ...editForm, visual_action: e.target.value })}
                  />
                ) : (
                  <p className="text-neutral-400 text-sm leading-relaxed">{scene.visual_action}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-neutral-800">
                {editingId === scene.id ? (
                  <>
                    <button onClick={() => setEditingId(null)} className="p-2 text-neutral-400 hover:text-white transition-colors"><X size={18} /></button>
                    <button onClick={saveScene} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"><Save size={16} /> Save</button>
                  </>
                ) : (
                  <button onClick={() => startEditing(scene)} className="flex items-center gap-2 text-neutral-500 hover:text-white px-3 py-1.5 rounded text-sm hover:bg-neutral-800 transition-colors"><Pencil size={14} /> Edit</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}