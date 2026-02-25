"use client";

import { API_BASE_URL } from "@/lib/config";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Plus, Pencil, Trash2, X, Users, FolderKanban, Check, ChevronDown, ChevronRight, Globe, Film } from "lucide-react";
import { auth } from "@/lib/firebase";
import { toastSuccess, toastError } from "@/lib/toast";
import Link from "next/link";

interface Member {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    status?: string;
}

interface Team {
    id: string;
    name: string;
    members: string[];
}

interface OrgProject {
    id: string;
    title: string;
    type?: string;
    is_global?: boolean;
    team_ids?: string[];
    tenant_id?: string | null;
}

interface WorkspaceTeamsProps {
    members: Member[];
    projects: OrgProject[];
    refreshProjects: () => void;
}

export default function WorkspaceTeams({ members, projects, refreshProjects }: WorkspaceTeamsProps) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(false);
    const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
    const [addDropdownTeamId, setAddDropdownTeamId] = useState<string | null>(null);
    const [updatingProjectId, setUpdatingProjectId] = useState<string | null>(null);

    // Modal state
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [teamName, setTeamName] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    // Delete tracking
    const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);

    // ─── Memoized project grouping ───
    const teamProjectMap = useMemo(() => {
        const map: Record<string, OrgProject[]> = {};
        for (const p of projects) {
            if (p.team_ids) {
                for (const tid of p.team_ids) {
                    if (!map[tid]) map[tid] = [];
                    map[tid].push(p);
                }
            }
        }
        return map;
    }, [projects]);

    const globalProjects = useMemo(() =>
        projects.filter(p => p.is_global === true),
        [projects]);

    // ─── Fetch Teams ───
    const fetchTeams = async () => {
        setTeamsLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/organization/teams`, {
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setTeams(data.teams || []);
            } else {
                toastError("Failed to load teams");
            }
        } catch {
            toastError("Network error loading teams");
        } finally {
            setTeamsLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    // ─── Open Modal ───
    const openCreateModal = () => {
        setEditingTeam(null);
        setTeamName("");
        setSelectedMembers(new Set());
        setShowTeamModal(true);
    };

    const openEditModal = (team: Team) => {
        setEditingTeam(team);
        setTeamName(team.name);
        setSelectedMembers(new Set(team.members));
        setShowTeamModal(true);
    };

    const closeModal = () => {
        setShowTeamModal(false);
        setEditingTeam(null);
        setTeamName("");
        setSelectedMembers(new Set());
    };

    // ─── Toggle Member ───
    const toggleMember = (email: string) => {
        setSelectedMembers((prev) => {
            const next = new Set(prev);
            if (next.has(email)) next.delete(email);
            else next.add(email);
            return next;
        });
    };

    // ─── Create or Edit Handler ───
    const handleSubmit = async () => {
        const name = teamName.trim();
        if (!name) { toastError("Team name is required"); return; }

        setSubmitting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const payload = { name, members: Array.from(selectedMembers) };

            const isEdit = !!editingTeam;
            const url = isEdit
                ? `${API_BASE_URL}/api/organization/teams/${editingTeam!.id}`
                : `${API_BASE_URL}/api/organization/teams`;

            const res = await fetch(url, {
                method: isEdit ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                toastSuccess(isEdit ? `"${name}" updated` : `"${name}" created`);
                closeModal();
                fetchTeams();
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || (isEdit ? "Update failed" : "Create failed"));
            }
        } catch {
            toastError("Network error");
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Delete Team Handler ───
    const handleDelete = async (team: Team) => {
        if (!confirm(`Are you sure you want to delete "${team.name}"?\n\nProjects assigned to this team will remain safe.`)) return;

        setDeletingTeamId(team.id);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/organization/teams/${team.id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (res.ok) {
                toastSuccess(`"${team.name}" deleted`);
                fetchTeams();
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || "Delete failed");
            }
        } catch {
            toastError("Network error");
        } finally {
            setDeletingTeamId(null);
        }
    };

    // ─── Add / Remove Project from Team ───
    const handleUpdateProjectTeams = async (project: OrgProject, teamId: string, action: "add" | "remove") => {
        setUpdatingProjectId(project.id);
        try {
            const token = await auth.currentUser?.getIdToken();
            const currentTeams = project.team_ids || [];
            const newTeams = action === "add"
                ? [...currentTeams, teamId]
                : currentTeams.filter(id => id !== teamId);

            const res = await fetch(`${API_BASE_URL}/api/v1/project/${project.id}/share`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    team_ids: newTeams,
                    is_global: project.is_global || false,
                }),
            });

            if (res.ok) {
                toastSuccess(action === "add"
                    ? `"${project.title}" added to team`
                    : `"${project.title}" removed from team`
                );
                refreshProjects();
                if (action === "add") setAddDropdownTeamId(null);
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || "Failed to update project");
            }
        } catch {
            toastError("Network error");
        } finally {
            setUpdatingProjectId(null);
        }
    };

    // ─── Render ───
    return (
        <>
            {/* ═══ WORKSPACE TEAMS SECTION ═══ */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-[#1a1a1a]">
                    <FolderKanban size={16} className="text-[#E50914]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">Workspace Teams</h3>
                    <span className="text-[9px] font-mono text-[#555] ml-auto mr-3">
                        {teams.length} team{teams.length !== 1 ? "s" : ""}
                    </span>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-1.5 bg-white text-black hover:bg-[#E50914] hover:text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded-md"
                    >
                        <Plus size={12} /> Create Team
                    </button>
                </div>

                {/* Content */}
                {teamsLoading ? (
                    <div className="flex items-center justify-center py-12 gap-3 text-[#555]">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-[10px] font-mono uppercase tracking-widest">Loading teams...</span>
                    </div>
                ) : teams.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#333]">
                        <FolderKanban size={30} className="opacity-30" />
                        <p className="text-[10px] uppercase tracking-widest font-semibold">No teams yet</p>
                        <p className="text-[9px] text-[#444]">Create a team to group workspace members.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#1a1a1a] bg-[#0A0A0A]">
                                <th className="w-8 p-4"></th>
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Team Name</th>
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Members</th>
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Projects</th>
                                <th className="text-right p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teams.map((team) => {
                                const teamProjects = teamProjectMap[team.id] || [];
                                const isExpanded = expandedTeamId === team.id;
                                const showAddDropdown = addDropdownTeamId === team.id;
                                const unassignedProjects = projects.filter(
                                    p => !p.team_ids?.includes(team.id) && !p.is_global
                                );

                                return (
                                    <>
                                        <tr key={team.id} className="border-b border-[#111] hover:bg-[#0D0D0D] transition-colors">
                                            {/* Expand chevron */}
                                            <td className="p-4">
                                                <button
                                                    onClick={() => {
                                                        setExpandedTeamId(isExpanded ? null : team.id);
                                                        if (isExpanded) setAddDropdownTeamId(null);
                                                    }}
                                                    className="text-[#555] hover:text-white transition-colors"
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-xs text-white font-bold">{team.name}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[9px] font-mono text-[#888] bg-[#111] border border-[#222] px-2 py-0.5 rounded">
                                                        <Users size={10} className="inline mr-1 -mt-px" />
                                                        {team.members?.length || 0}
                                                    </span>
                                                    {team.members?.slice(0, 3).map((email) => (
                                                        <span key={email} className="text-[9px] font-mono text-[#666] bg-[#0A0A0A] border border-[#1a1a1a] px-2 py-0.5 rounded truncate max-w-[140px]">
                                                            {email}
                                                        </span>
                                                    ))}
                                                    {(team.members?.length || 0) > 3 && (
                                                        <span className="text-[9px] font-mono text-[#555]">
                                                            +{team.members.length - 3} more
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {/* Projects count */}
                                            <td className="p-4">
                                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${teamProjects.length > 0
                                                    ? "text-purple-400 bg-purple-900/10 border-purple-900/30"
                                                    : "text-[#555] bg-[#111] border-[#222]"
                                                    }`}>
                                                    <Film size={10} className="inline mr-1 -mt-px" />
                                                    {teamProjects.length} project{teamProjects.length !== 1 ? "s" : ""}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => openEditModal(team)}
                                                        title="Edit team"
                                                        className="p-2 text-[#666] hover:text-white hover:bg-[#222] rounded-md transition-all inline-flex items-center justify-center"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(team)}
                                                        disabled={deletingTeamId === team.id}
                                                        title="Delete team"
                                                        className="p-2 text-[#666] hover:text-[#E50914] hover:bg-[#E50914]/10 rounded-md transition-all disabled:opacity-50 inline-flex items-center justify-center"
                                                    >
                                                        {deletingTeamId === team.id ? (
                                                            <Loader2 size={13} className="animate-spin" />
                                                        ) : (
                                                            <Trash2 size={13} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* ═══ Expanded: team project management ═══ */}
                                        {isExpanded && (
                                            <tr key={`${team.id}-projects`} className="bg-[#060606]">
                                                <td colSpan={5} className="px-6 py-4">
                                                    {/* Assigned projects */}
                                                    {teamProjects.length > 0 ? (
                                                        <div className="space-y-2">
                                                            <span className="text-[8px] font-mono uppercase tracking-widest text-[#555]">Assigned Projects</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {teamProjects.map((p) => (
                                                                    <div
                                                                        key={p.id}
                                                                        className="flex items-center gap-1.5 text-[9px] font-mono text-[#aaa] bg-[#111] border border-[#222] pl-2.5 pr-1 py-1 rounded-md group/pill"
                                                                    >
                                                                        <Film size={10} className="text-purple-400 shrink-0" />
                                                                        <Link
                                                                            href={`/project/${p.id}/studio`}
                                                                            className="truncate max-w-[160px] hover:text-white transition-colors"
                                                                        >
                                                                            {p.title}
                                                                        </Link>
                                                                        <span className="text-[7px] text-[#555] uppercase mr-1">
                                                                            {p.type === 'movie' ? 'MOV' : 'SER'}
                                                                        </span>
                                                                        {/* Remove button */}
                                                                        <button
                                                                            onClick={() => handleUpdateProjectTeams(p, team.id, "remove")}
                                                                            disabled={updatingProjectId === p.id}
                                                                            className="p-1 text-[#555] hover:text-[#E50914] hover:bg-[#E50914]/10 rounded transition-all opacity-0 group-hover/pill:opacity-100 disabled:opacity-50"
                                                                            title="Remove from team"
                                                                        >
                                                                            {updatingProjectId === p.id ? (
                                                                                <Loader2 size={10} className="animate-spin" />
                                                                            ) : (
                                                                                <X size={10} />
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[9px] text-[#444] font-mono">No projects assigned to this team yet.</p>
                                                    )}

                                                    {/* Add project button / dropdown */}
                                                    <div className="mt-3 relative">
                                                        <button
                                                            onClick={() => setAddDropdownTeamId(showAddDropdown ? null : team.id)}
                                                            className="flex items-center gap-1.5 text-[9px] font-mono text-[#666] hover:text-white border border-dashed border-[#333] hover:border-[#555] px-2.5 py-1.5 rounded-md transition-all"
                                                        >
                                                            <Plus size={10} /> Add Project to Team
                                                        </button>

                                                        {/* Dropdown */}
                                                        {showAddDropdown && (() => {
                                                            console.log("[WorkspaceTeams] Add dropdown for team:", team.id, "| total projects:", projects.length, "| unassigned:", unassignedProjects.length, unassignedProjects);
                                                            return (
                                                                <div className="absolute top-full left-0 mt-1 z-30 w-80 bg-[#0d0d0d] border border-[#333] rounded-lg shadow-xl overflow-hidden">
                                                                    <div className="p-2 border-b border-[#222]">
                                                                        <span className="text-[8px] font-mono uppercase tracking-widest text-[#666]">Available Projects</span>
                                                                    </div>
                                                                    <div className="max-h-48 overflow-y-auto">
                                                                        {unassignedProjects.length === 0 ? (
                                                                            <p className="text-[9px] text-[#555] font-mono p-3 text-center">All projects are already assigned to this team.</p>
                                                                        ) : (
                                                                            unassignedProjects.map((p) => (
                                                                                <button
                                                                                    key={p.id}
                                                                                    onClick={() => handleUpdateProjectTeams(p, team.id, "add")}
                                                                                    disabled={updatingProjectId === p.id}
                                                                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[9px] font-mono text-[#aaa] hover:bg-[#151515] hover:text-white transition-colors disabled:opacity-50"
                                                                                >
                                                                                    {updatingProjectId === p.id ? (
                                                                                        <Loader2 size={10} className="animate-spin text-purple-400 shrink-0" />
                                                                                    ) : (
                                                                                        <Plus size={10} className="text-purple-400 shrink-0" />
                                                                                    )}
                                                                                    <span className="truncate flex-1">{p.title}</span>
                                                                                    <span className="text-[7px] text-[#555] uppercase shrink-0">
                                                                                        {p.type === 'movie' ? 'MOV' : 'SER'}
                                                                                    </span>
                                                                                </button>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ═══ GLOBAL PROJECTS SECTION ═══ */}
            {globalProjects.length > 0 && (
                <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 p-5 border-b border-[#1a1a1a]">
                        <Globe size={16} className="text-blue-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Global Workspace Projects</h3>
                        <span className="text-[9px] font-mono text-[#555] ml-auto">
                            {globalProjects.length} project{globalProjects.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                    <div className="p-4">
                        <div className="flex flex-wrap gap-2">
                            {globalProjects.map((p) => (
                                <Link
                                    key={p.id}
                                    href={`/project/${p.id}/studio`}
                                    className="flex items-center gap-2 text-[10px] font-mono text-white bg-[#111] border border-[#222] px-3 py-2 rounded-lg hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
                                >
                                    <Globe size={11} className="text-blue-400 shrink-0" />
                                    <span className="truncate max-w-[200px]">{p.title}</span>
                                    <span className="text-[7px] text-[#555] uppercase bg-[#0a0a0a] px-1.5 py-0.5 rounded">
                                        {p.type === 'movie' ? 'Feature Film' : 'Series'}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ CREATE / EDIT TEAM MODAL ═══ */}
            {showTeamModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />

                    <div className="relative z-10 w-full max-w-lg bg-[#080808] border border-[#222] shadow-2xl rounded-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[#222]">
                            <div className="flex items-center gap-3">
                                <FolderKanban size={18} className="text-[#E50914]" />
                                <h3 className="font-anton text-xl text-white uppercase tracking-wide">
                                    {editingTeam ? "Edit Team" : "Create Team"}
                                </h3>
                            </div>
                            <button onClick={closeModal} className="text-[#666] hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Team Name */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">Team Name</label>
                                <input
                                    type="text"
                                    value={teamName}
                                    onChange={(e) => setTeamName(e.target.value)}
                                    placeholder="e.g. Design, Engineering, Marketing"
                                    className="w-full bg-[#111] border border-[#333] text-white p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors rounded-lg"
                                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                />
                            </div>

                            {/* Member Selection */}
                            <div className="space-y-2">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">
                                    Members
                                    <span className="text-[#555] ml-2">({selectedMembers.size} selected)</span>
                                </label>
                                <div className="max-h-52 overflow-y-auto border border-[#222] rounded-lg divide-y divide-[#151515]">
                                    {members.length === 0 ? (
                                        <div className="p-4 text-center text-[10px] text-[#555] font-mono uppercase tracking-widest">
                                            No workspace members available
                                        </div>
                                    ) : (
                                        members.map((m) => {
                                            const isSelected = selectedMembers.has(m.email);
                                            return (
                                                <button
                                                    key={m.uid || m.email}
                                                    type="button"
                                                    onClick={() => toggleMember(m.email)}
                                                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected
                                                        ? "bg-[#E50914]/5"
                                                        : "bg-transparent hover:bg-[#111]"
                                                        }`}
                                                >
                                                    {/* Checkbox */}
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected
                                                        ? "bg-[#E50914] border-[#E50914]"
                                                        : "border-[#444] bg-transparent"
                                                        }`}>
                                                        {isSelected && <Check size={10} className="text-white" />}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs text-white font-mono block truncate">{m.email}</span>
                                                        {m.displayName && (
                                                            <span className="text-[9px] text-[#555] block truncate">{m.displayName}</span>
                                                        )}
                                                    </div>

                                                    {/* Role badge */}
                                                    <span className="text-[8px] font-mono text-[#555] bg-[#111] border border-[#222] px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">
                                                        {m.role || "member"}
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-[#222]">
                                <button
                                    onClick={closeModal}
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
                                    ) : editingTeam ? (
                                        <><Pencil size={13} /> Update Team</>
                                    ) : (
                                        <><Plus size={13} /> Create Team</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
