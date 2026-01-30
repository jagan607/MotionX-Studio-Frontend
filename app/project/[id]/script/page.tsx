"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InputDeck } from "@/components/script/InputDeck";
import { StudioLayout } from "@/components/ui/StudioLayout";
import { FileText, Loader2 } from "lucide-react";
import { fetchProject } from "@/lib/api"; // Ues the helper from api.ts
import { Project } from "@/lib/types";   // Use the shared type

export default function ScriptIngestionPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProjectData = async () => {
            if (!projectId) return;
            try {
                // Use the helper function which handles Auth and URL construction
                const data = await fetchProject(projectId);
                setProject(data);
            } catch (error) {
                console.error("Failed to load project details", error);
                // Optional: router.push('/404') or show error toast
            } finally {
                setLoading(false);
            }
        };

        loadProjectData();
    }, [projectId]);

    return (
        <StudioLayout>
            <div className="flex flex-col items-center justify-center h-full w-full py-8">
                <div className="w-full max-w-4xl">
                    {/* HEADER */}
                    <div className="flex items-center justify-between mb-6 px-1">
                        <div>
                            <h1 className="text-2xl font-display uppercase text-white leading-none tracking-wide">
                                Script Ingestion
                            </h1>
                        </div>

                        <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-motion-text-muted border border-neutral-800 px-3 py-1 rounded-full bg-neutral-900/50">
                            <FileText size={12} /> WAITING FOR DATA
                        </div>
                    </div>

                    {/* DECK CONTAINER */}
                    {loading ? (
                        <div className="w-full h-[400px] flex items-center justify-center border border-neutral-800 rounded-xl bg-neutral-900/30">
                            <Loader2 className="animate-spin text-motion-red" size={24} />
                        </div>
                    ) : (
                        <InputDeck
                            projectId={projectId}
                            // Fallback to empty string/micro_drama if data is missing for some reason
                            projectTitle={project?.title || ""}
                            projectType={project?.type || "micro_drama"}
                            isModal={false}
                            className="w-full"
                            onCancel={() => router.push("/dashboard")}
                            onSuccess={(url) => router.push(url)}
                        />
                    )}
                </div>
            </div>
        </StudioLayout>
    );
}