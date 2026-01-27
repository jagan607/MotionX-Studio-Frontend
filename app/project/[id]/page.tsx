"use client";

import { useEffect, useState } from "react";
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
                    router.push("/dashboard"); // Project doesn't exist
                    return;
                }

                const data = snap.data();
                const status = data.script_status || "empty";

                // --- THE ROUTING LOGIC ---
                if (status === "empty") {
                    router.push(`/project/${projectId}/pre-production`);
                } else if (status === "drafting") {
                    // If you track draft IDs in project metadata, you could redirect there
                    // Otherwise, pre-production might handle listing drafts
                    router.push(`/project/${projectId}/pre-production`);
                } else if (status === "assets_pending") {
                    router.push(`/project/${projectId}/assets`);
                } else {
                    // "ready" or anything else
                    router.push(`/project/${projectId}/studio`);
                }

            } catch (e) {
                console.error("Gatekeeper Error", e);
            }
        }

        checkStatus();
    }, [projectId, router]);

    return (
        <div className="h-screen w-full bg-motion-bg flex flex-col items-center justify-center text-motion-text">
            <Loader2 className="w-8 h-8 animate-spin text-motion-red mb-4" />
            <div className="text-xs font-mono tracking-widest text-motion-text-muted">INITIALIZING PROJECT PROTOCOL...</div>
        </div>
    );
}