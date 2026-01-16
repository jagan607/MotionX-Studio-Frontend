// app/series/[id]/episode/[episodeId]/hooks/useAssetManager.ts

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import { API_BASE_URL } from "@/lib/config";

// --- 1. SANITIZATION HELPER ---
const sanitizeId = (name: string) => {
    // Converts "INT. CAGE" -> "int_cage"
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
};

export const useAssetManager = (seriesId: string) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
    const [assetType, setAssetType] = useState<'character' | 'location'>('character');
    const [modalMode, setModalMode] = useState<'upload' | 'generate'>('upload');
    const [genPrompt, setGenPrompt] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const openAssetModal = (name: string, type: 'character' | 'location') => {
        setSelectedAsset(name);
        setAssetType(type);
        setModalOpen(true);
        setModalMode('upload');
        setGenPrompt(type === 'character' ? `Cinematic portrait of ${name}...` : `Wide shot of ${name}...`);
    };

    // --- 2. UPLOAD (Client-side control ensures correct ID) ---
    const handleAssetUpload = async (file: File, onSuccess: (url: string) => void) => {
        if (!selectedAsset) return;
        setIsProcessing(true);

        try {
            const dbDocId = sanitizeId(selectedAsset);
            const collectionName = assetType === 'location' ? 'locations' : 'characters';

            // Upload to Storage
            // Path: series/{id}/{type}s/{sanitized_id}_{timestamp}
            const storageRef = ref(storage, `series/${seriesId}/${assetType}s/${dbDocId}_${Date.now()}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Write to correct Firestore ID
            const docRef = doc(db, "series", seriesId, collectionName, dbDocId);
            await setDoc(docRef, {
                name: selectedAsset, // Store original display name
                image_url: downloadURL,
                source: "upload",
                status: "active",
                updated_at: new Date().toISOString()
            }, { merge: true });

            onSuccess(downloadURL);
            setModalOpen(false);

        } catch (e) {
            console.error("Upload failed", e);
            alert("Upload failed. Check console.");
        } finally {
            setIsProcessing(false);
        }
    };

    // --- 3. GENERATE (THE FIX IS HERE) ---
    const handleAssetGenerate = async (onSuccess: (url: string) => void) => {
        if (!genPrompt || !selectedAsset) return alert("Describe the asset");
        setIsProcessing(true);

        try {
            const idToken = await auth.currentUser?.getIdToken();
            const formData = new FormData();
            formData.append("series_id", seriesId);
            formData.append("prompt", genPrompt);

            // --- CRITICAL FIX: Send SANITIZED ID to API ---
            // This ensures the backend writes to the lowercase ID (int_cage)
            // instead of creating a new doc with the raw name (INT. CAGE).
            const sanitizedName = sanitizeId(selectedAsset);

            if (assetType === 'character') formData.append("character_name", sanitizedName);
            else formData.append("location_name", sanitizedName);
            // ---------------------------------------------

            const endpoint = assetType === 'character'
                ? `${API_BASE_URL}/api/v1/assets/character/generate`
                : `${API_BASE_URL}/api/v1/assets/location/generate`;

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Authorization": `Bearer ${idToken}` },
                body: formData
            });

            const data = await res.json();

            if (res.ok && data.image_url) {
                // Double safety: Force update the local sanitized ID doc
                const dbDocId = sanitizeId(selectedAsset);
                const collectionName = assetType === 'location' ? 'locations' : 'characters';

                const docRef = doc(db, "series", seriesId, collectionName, dbDocId);
                await setDoc(docRef, {
                    name: selectedAsset, // Save original name for display purposes
                    image_url: data.image_url,
                    base_prompt: genPrompt,
                    source: "ai_gen",
                    updated_at: new Date().toISOString()
                }, { merge: true });

                onSuccess(data.image_url);
                setModalOpen(false);
            } else {
                alert("Error: " + (data.detail || "Generation failed"));
            }
        } catch (e) {
            console.error(e);
            alert("Generation connection failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        modalOpen, setModalOpen, selectedAsset, assetType, modalMode, setModalMode,
        genPrompt, setGenPrompt, isProcessing, openAssetModal, handleAssetUpload, handleAssetGenerate
    };
};