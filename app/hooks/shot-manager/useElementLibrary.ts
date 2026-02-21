import { useState, useCallback } from 'react';
import { api } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toast";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

import { fetchProjectAssets } from "@/lib/api"; // Import fetchProjectAssets

export interface KlingElement {
    id: string; // Kling ID (if available) or Local ID (if pending)
    name: string;
    description?: string;
    image_url: string; // The main reference image
    type: 'image_refer' | 'video_refer';
    source?: 'user' | 'project'; // To distinguish source

    // Auto-Registration Support
    local_id?: string;          // The underlying Asset ID
    asset_type?: 'character' | 'product' | 'location';
    needs_registration?: boolean; // True if no Kling ID exists yet

    // Pending Registration Tracking
    kling_task_id?: string;     // Task ID if registration was submitted but not completed
    registration_status?: 'none' | 'pending' | 'complete';
}

export const useElementLibrary = (projectId: string) => {
    const [elements, setElements] = useState<KlingElement[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchElements = useCallback(async () => {
        setIsLoading(true);
        console.log(`[useElementLibrary] Fetching elements for project: ${projectId}`);

        let projectElements: KlingElement[] = [];
        let userElements: KlingElement[] = [];

        try {
            // 1. Fetch Standalone Elements (User's library)
            try {
                const resElements = await api.get("/api/v1/production/elements");
                userElements = (resElements.data.elements || []).map((e: any) => ({ ...e, source: 'user' }));
                console.log(`[useElementLibrary] Fetched ${userElements.length} user elements`);
            } catch (err) {
                console.warn("[useElementLibrary] Failed to fetch user elements", err);
            }

            // 2. Fetch Project Assets (Characters & Products)
            try {
                const assetsData = await fetchProjectAssets(projectId);
                console.log(`[useElementLibrary] Fetched project assets:`, assetsData);

                // Process Characters
                if (assetsData.characters) {
                    assetsData.characters.forEach((c: any) => {
                        // ALWAYS include if image exists, even if not registered
                        if (c.image_url) {
                            const hasKlingId = !!c.kling_element_id;
                            const hasPendingTask = !hasKlingId && !!c.kling_element_data?.task_id;

                            let regStatus: 'none' | 'pending' | 'complete' = 'none';
                            if (hasKlingId) regStatus = 'complete';
                            else if (hasPendingTask) regStatus = 'pending';

                            projectElements.push({
                                id: hasKlingId ? String(c.kling_element_id) : c.id,
                                name: c.name,
                                description: c.visual_traits?.vibe || "Character",
                                image_url: c.image_url,
                                type: 'image_refer',
                                source: 'project',

                                local_id: c.id,
                                asset_type: 'character',
                                needs_registration: !hasKlingId,
                                kling_task_id: c.kling_element_data?.task_id,
                                registration_status: regStatus
                            });
                        }
                    });
                }

                // Process Products
                if (assetsData.products) {
                    assetsData.products.forEach((p: any) => {
                        if (p.image_url) {
                            const hasKlingId = !!p.kling_element_id;
                            const hasPendingTask = !hasKlingId && !!p.kling_element_data?.task_id;

                            let regStatus: 'none' | 'pending' | 'complete' = 'none';
                            if (hasKlingId) regStatus = 'complete';
                            else if (hasPendingTask) regStatus = 'pending';

                            projectElements.push({
                                id: hasKlingId ? String(p.kling_element_id) : p.id,
                                name: p.name,
                                description: "Product",
                                image_url: p.image_url,
                                type: 'image_refer',
                                source: 'project',

                                local_id: p.id,
                                asset_type: 'product',
                                needs_registration: !hasKlingId,
                                kling_task_id: p.kling_element_data?.task_id,
                                registration_status: regStatus
                            });
                        }
                    });
                }

                // Process Locations
                if (assetsData.locations) {
                    assetsData.locations.forEach((l: any) => {
                        if (l.image_url) {
                            const hasKlingId = !!l.kling_element_id;
                            const hasPendingTask = !hasKlingId && !!l.kling_element_data?.task_id;

                            let regStatus: 'none' | 'pending' | 'complete' = 'none';
                            if (hasKlingId) regStatus = 'complete';
                            else if (hasPendingTask) regStatus = 'pending';

                            projectElements.push({
                                id: hasKlingId ? String(l.kling_element_id) : l.id,
                                name: l.name,
                                description: "Location",
                                image_url: l.image_url,
                                type: 'image_refer',
                                source: 'project',

                                local_id: l.id,
                                asset_type: 'location',
                                needs_registration: !hasKlingId,
                                kling_task_id: l.kling_element_data?.task_id,
                                registration_status: regStatus
                            });
                        }
                    });
                }
                console.log(`[useElementLibrary] Processed ${projectElements.length} project elements`);

            } catch (err) {
                console.warn("[useElementLibrary] Failed to fetch project assets", err);
            }

            // Merge with smart preservation of local "Registered" state
            // If the server sends an element as "needs_registration" (using local ID),
            // but we locally know it's already registered (has Kling ID), keep our local version.

            setElements(prev => {
                // Map by local_id (preferred) or id
                const prevMap = new Map(prev.map(e => [String(e.local_id || e.id), e]));

                const merged = [...projectElements, ...userElements].map(incoming => {
                    const lookupKey = String(incoming.local_id || incoming.id);
                    const existing = prevMap.get(lookupKey);

                    // If incoming says needs reg, but existing says IDK, and existing has a Kling ID...
                    // Keep existing.
                    if (incoming.needs_registration && existing && !existing.needs_registration) {
                        // Ensure we aren't just matching by accident, though local_id should be unique
                        return existing;
                    }
                    return incoming;
                });

                console.log(`[useElementLibrary] Final merged elements count: ${merged.length}`);
                return merged;
            });

        } catch (e: any) {
            console.error("[useElementLibrary] Critical error in fetchElements", e);
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    const uploadImage = async (file: File): Promise<string | null> => {
        try {
            const path = `projects/${projectId}/elements/${Date.now()}_${file.name}`;
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            return await getDownloadURL(storageRef);
        } catch (e) {
            console.error(e);
            toastError("Failed to upload image");
            return null;
        }
    };

    const createElement = async (
        name: string,
        description: string,
        frontalImageUrl: string,
        referImageUrls: string[] = []
    ) => {
        setIsLoading(true);
        try {
            const payload = {
                name,
                description,
                refer_type: "image_refer",
                frontal_image_url: frontalImageUrl,
                refer_image_urls: referImageUrls
            };

            const res = await api.post("/api/v1/production/elements/create", payload);

            if (res.data.status === 'success' && res.data.element) {
                setElements(prev => [res.data.element, ...prev]);
                toastSuccess("Character created successfully");
                return res.data.element;
            }
        } catch (e: any) {
            console.error(e);
            toastError(e.response?.data?.detail || "Failed to create character");
        } finally {
            setIsLoading(false);
        }
    };

    const deleteElement = async (id: string) => {
        try {
            await api.delete(`/api/v1/elements/${id}`);
            setElements(prev => prev.filter(e => e.id !== id));
            toastSuccess("Character deleted");
        } catch (e: any) {
            console.error(e);
            toastError("Failed to delete character");
        }
    };

    const registerKlingAsset = async (assetType: 'character' | 'product' | 'location', assetId: string) => {
        // Check if this element is already registered — if so, use force=true to re-register
        const existing = elements.find(
            el => String(el.local_id) === String(assetId) || String(el.id) === String(assetId)
        );
        const isReRegistration = existing && !existing.needs_registration && existing.registration_status === 'complete';

        setIsLoading(true);
        try {
            // Mark as pending immediately in UI
            setElements(prev => prev.map(el => {
                const match = String(el.local_id) === String(assetId) || String(el.id) === String(assetId);
                if (match) {
                    return { ...el, registration_status: 'pending' as const };
                }
                return el;
            }));

            // Recursive poll — backend is idempotent, same POST handles create + status check
            const poll = async (attempt: number = 1, maxAttempts: number = 20): Promise<string | undefined> => {
                console.log(`[registerKlingAsset] Poll attempt ${attempt}/${maxAttempts} for ${assetId}`);
                const forceParam = isReRegistration ? '?force=true' : '';
                const res = await api.post(`/api/v1/assets/${projectId}/${assetType}/${assetId}/register_kling${forceParam}`);
                const data = res.data;
                console.log(`[registerKlingAsset] Response:`, data);

                // Error — stop polling
                if (data.status === 'error') {
                    throw new Error(data.message || 'Kling element registration failed');
                }

                // Complete — got the element ID
                if (data.kling_element_id) {
                    return String(data.kling_element_id);
                }

                // Still processing — wait and retry
                if (attempt >= maxAttempts) {
                    return undefined; // Give up after max attempts
                }

                await new Promise(resolve => setTimeout(resolve, 3000));
                return poll(attempt + 1, maxAttempts);
            };

            const klingId = await poll();

            if (klingId) {
                updateElementState(assetId, klingId);
                toastSuccess("Asset enabled for video generation");
                return klingId;
            } else {
                toastError("Registration is still processing. Please try again in a moment.");
                return undefined;
            }
        } catch (e: any) {
            console.error("[registerKlingAsset] Error:", e);
            // Reset from pending back to needs_registration
            setElements(prev => prev.map(el => {
                const match = String(el.local_id) === String(assetId) || String(el.id) === String(assetId);
                if (match) {
                    return { ...el, registration_status: 'none' as const };
                }
                return el;
            }));
            toastError(e.message || "Failed to enable asset");
            return undefined;
        } finally {
            setIsLoading(false);
        }
    };

    // Helper: update element state when a Kling ID is obtained
    const updateElementState = (assetId: string, newKlingId: string) => {
        setElements(prev => {
            console.log(`[registerKlingAsset] Updating state for ${assetId} → ${newKlingId}`);
            return prev.map(el => {
                const match = String(el.local_id) === String(assetId) || String(el.id) === String(assetId);
                if (match) {
                    return {
                        ...el,
                        id: newKlingId,
                        needs_registration: false,
                        kling_task_id: undefined,
                        registration_status: 'complete' as const
                    };
                }
                return el;
            });
        });
    };

    return {
        elements,
        isLoading,
        fetchElements,
        createElement,
        uploadImage,
        deleteElement,
        registerKlingAsset
    };
};
