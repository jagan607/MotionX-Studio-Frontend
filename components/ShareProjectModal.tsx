"use client";

import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect } from "react";
import { Globe, Users, Loader2, X, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { auth } from "@/lib/firebase";
import { toastSuccess, toastError } from "@/lib/toast";

interface Team {
    id: string;
    name: string;
    members: string[];
}

interface ShareProjectModalProps {
    projectId: string;
    projectTitle: string;
    currentTeamIds: string[];
    currentIsGlobal: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ShareProjectModal({
    projectId,
    projectTitle,
    currentTeamIds,
    currentIsGlobal,
    onClose,
    onSuccess,
}: ShareProjectModalProps) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [isGlobal, setIsGlobal] = useState(currentIsGlobal);
    const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set(currentTeamIds));
    const [submitting, setSubmitting] = useState(false);

    // Fetch available teams
    useEffect(() => {
        (async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                const res = await fetch(`${API_BASE_URL}/api/organization/teams`, {
                    headers: { "Authorization": `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setTeams(data.teams || []);
                }
            } catch {
                toastError("Failed to load teams");
            } finally {
                setTeamsLoading(false);
            }
        })();
    }, []);

    const toggleTeam = (teamId: string) => {
        setSelectedTeamIds((prev) => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/v1/project/${projectId}/share`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    team_ids: Array.from(selectedTeamIds),
                    is_global: isGlobal,
                }),
            });

            if (res.ok) {
                toastSuccess(isGlobal ? "Project is now visible to entire organization" : "Project sharing updated");
                onSuccess();
                onClose();
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || "Failed to update sharing");
            }
        } catch {
            toastError("Network error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 w-full max-w-lg bg-[#080808] border border-[#222] shadow-2xl rounded-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#222]">
                    <div className="flex items-center gap-3">
                        <Globe size={18} className="text-[#E50914]" />
                        <div>
                            <h3 className="font-anton text-xl text-white uppercase tracking-wide">Share Project</h3>
                            <p className="text-[9px] font-mono text-[#555] mt-0.5 truncate max-w-[280px]">{projectTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Global Toggle */}
                    <div className="space-y-1">
                        <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">Visibility</label>
                        <button
                            type="button"
                            onClick={() => setIsGlobal(!isGlobal)}
                            className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all ${isGlobal
                                ? "border-blue-500/40 bg-blue-500/5"
                                : "border-[#222] bg-transparent hover:border-[#333]"
                                }`}
                        >
                            {isGlobal ? (
                                <ToggleRight size={24} className="text-blue-400 shrink-0" />
                            ) : (
                                <ToggleLeft size={24} className="text-[#555] shrink-0" />
                            )}
                            <div className="text-left flex-1">
                                <span className="text-xs text-white font-bold block">
                                    🌍 Make Global
                                </span>
                                <span className="text-[9px] text-[#666] block mt-0.5">
                                    Visible to every member in your organization
                                </span>
                            </div>
                        </button>
                    </div>

                    {/* Team Selection — only if not global */}
                    {!isGlobal && (
                        <div className="space-y-2">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">
                                Share with Teams
                                <span className="text-[#555] ml-2">({selectedTeamIds.size} selected)</span>
                            </label>

                            {teamsLoading ? (
                                <div className="flex items-center justify-center py-8 gap-3 text-[#555]">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span className="text-[10px] font-mono uppercase tracking-widest">Loading teams...</span>
                                </div>
                            ) : teams.length === 0 ? (
                                <div className="text-center py-6 text-[#444]">
                                    <Users size={24} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-[10px] font-mono uppercase tracking-widest">No teams created yet</p>
                                    <p className="text-[9px] text-[#555] mt-1">Create teams in your Organization settings first.</p>
                                </div>
                            ) : (
                                <div className="max-h-52 overflow-y-auto border border-[#222] rounded-lg divide-y divide-[#151515]">
                                    {teams.map((team) => {
                                        const isSelected = selectedTeamIds.has(team.id);
                                        return (
                                            <button
                                                key={team.id}
                                                type="button"
                                                onClick={() => toggleTeam(team.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected
                                                    ? "bg-purple-500/5"
                                                    : "bg-transparent hover:bg-[#111]"
                                                    }`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected
                                                    ? "bg-purple-500 border-purple-500"
                                                    : "border-[#444] bg-transparent"
                                                    }`}>
                                                    {isSelected && <Check size={10} className="text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-xs text-white font-bold block">{team.name}</span>
                                                </div>
                                                <span className="text-[8px] font-mono text-[#555] bg-[#111] border border-[#222] px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">
                                                    {team.members?.length || 0} members
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-[#222]">
                        <button
                            onClick={onClose}
                            className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 bg-white text-black hover:bg-[#E50914] hover:text-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 rounded-lg"
                        >
                            {submitting ? (
                                <><Loader2 size={13} className="animate-spin" /> Saving...</>
                            ) : (
                                <><Globe size={13} /> Save Sharing</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
