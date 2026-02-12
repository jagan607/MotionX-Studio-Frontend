"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function ProjectGatekeeper() {
    const router = useRouter();
    const params = useParams();
    const projectId = params.id as string;

    useEffect(() => {
        async function checkStatus() {
            if (!projectId) return;

            try {
                const docRef = doc(db, "projects", projectId);
                const snap = await getDoc(docRef);

                if (!snap.exists()) {
                    router.push("/dashboard");
                    return;
                }

                const data = snap.data();
                const status = data.script_status || "empty";
                const type = data.type || "movie";
                const defaultEpisodeId = data.default_episode_id;

                // --- 1. HANDLE COMPLETED PROJECTS ---
                // If assets are pending or done, go to the studio/assets page regardless of type
                if (status === "assets_pending") {
                    router.push(`/project/${projectId}/assets`);
                    return;
                } else if (status === "production_ready" || status === "ready") {
                    router.push(`/project/${projectId}/studio`);
                    return;
                }

                // --- 2. HANDLE NEW/DRAFT PROJECTS (The Routing Logic) ---

                // CASE A: Single Unit (Movie or Ad)
                // We want to jump STRAIGHT to the specific script container we created
                if ((type === 'movie' || type === 'ad') && defaultEpisodeId) {
                    // Redirect to the specific Episode/Script ID
                    // This assumes your editor route is: /project/[id]/episode/[epId]/script
                    router.push(`/project/${projectId}/episode/${defaultEpisodeId}/editor`);
                    return;
                }

                // CASE B: Series (Micro-Drama)
                // Series usually need to land on an "Episode List" or "Series Overview" first.
                // If you don't have a specific series overview page, you might want to keep the 
                // generic '/script' or redirect to a '/series' route.
                if (type === 'micro_drama') {
                    // Assuming you have a route that lists episodes
                    // If not, change this to where your series management lives
                    router.push(`/series/${projectId}`);
                    return;
                }

                // CASE C: Fallback (Legacy or Error)
                // If for some reason default_episode_id is missing, fallback to generic script page
                router.push(`/project/${projectId}/script`);

            } catch (e) {
                console.error("Gatekeeper Error", e);
                router.push("/dashboard");
            }
        }

        checkStatus();
    }, [projectId, router]);

    return (
        <div className="h-screen w-full bg-[#050505] flex flex-col items-center justify-center text-[#EEE]">
            <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
            <div className="text-xs font-mono tracking-widest text-[#666]">INITIALIZING PROJECT PROTOCOL...</div>
        </div>
    );
}