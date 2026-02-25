"use client";

import { useState, useEffect } from "react";
import { Building, Users, Copy, Shield, RefreshCw, Loader2, UserPlus, X, Info, Trash2, ChevronDown } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { toastSuccess, toastError } from "@/lib/toast";

interface OrgData {
    organization_name: string;
    slug: string;
    tenant_id: string;
    credits_balance: number;
    admins: string[];
    allowed_domains: string[];
}

interface Member {
    uid: string;
    email: string;
    displayName: string;
    role: string;
    status?: string;
}

const ROLES = ["admin", "editor", "viewer"] as const;
type Role = typeof ROLES[number];

export default function OrganizationTab() {
    const [orgData, setOrgData] = useState<OrgData | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    // Add Member Modal
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<Role>("editor");
    const [inviting, setInviting] = useState(false);

    // Role change tracking
    const [changingRoleUid, setChangingRoleUid] = useState<string | null>(null);
    const [removingUid, setRemovingUid] = useState<string | null>(null);

    const user = auth.currentUser;
    const tenantId = user?.tenantId;
    const isOrgAdmin = orgData?.admins?.includes(user?.email || "");
    const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    // Listen to org document
    useEffect(() => {
        if (!tenantId) { setLoading(false); return; }

        const orgQuery = query(
            collection(db, "organizations"),
            where("tenant_id", "==", tenantId),
            limit(1)
        );

        const unsubscribe = onSnapshot(orgQuery, (snapshot) => {
            if (!snapshot.empty) {
                setOrgData(snapshot.docs[0].data() as OrgData);
            }
            setLoading(false);
        }, (error) => {
            console.error("[OrganizationTab] Firestore listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [tenantId]);

    // Fetch members
    const fetchMembers = async () => {
        if (!isOrgAdmin) return;
        setMembersLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/organization/members`, {
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members || []);
            } else {
                toastError("Failed to load team roster");
            }
        } catch {
            toastError("Network error loading members");
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        if (isOrgAdmin && orgData) fetchMembers();
    }, [isOrgAdmin, orgData]);

    // Invite member handler
    const handleInvite = async () => {
        const email = inviteEmail.trim().toLowerCase();
        if (!email) { toastError("Please enter an email"); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toastError("Invalid email format"); return; }

        // Check domain
        const emailDomain = email.split("@")[1];
        if (!orgData?.allowed_domains?.includes(emailDomain)) {
            toastError(`Domain @${emailDomain} is not in the allowed list`);
            return;
        }

        setInviting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/organization/members/invite`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ email, role: inviteRole }),
            });

            if (res.ok) {
                toastSuccess(`Invited ${email} as ${inviteRole}`);
                setShowInviteModal(false);
                setInviteEmail("");
                setInviteRole("editor");
                fetchMembers();
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || "Invite failed");
            }
        } catch {
            toastError("Network error");
        } finally {
            setInviting(false);
        }
    };

    // Change role handler
    const handleRoleChange = async (memberUid: string, memberEmail: string, newRole: string) => {
        setChangingRoleUid(memberUid);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/organization/members/role`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ email: memberEmail, new_role: newRole }),
            });

            if (res.ok) {
                toastSuccess(`${memberEmail} updated to ${newRole}`);
                fetchMembers();
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || "Role update failed");
            }
        } catch {
            toastError("Network error");
        } finally {
            setChangingRoleUid(null);
        }
    };

    const handleCopyInvite = () => {
        const text = `Join our MotionX Studio workspace!\n\nLog in here with your work email to access the team workspace:\nhttps://studio.motionx.in/login`;
        navigator.clipboard.writeText(text);
        toastSuccess("Invite link copied to clipboard!");
    };

    // Remove member handler
    const handleRemove = async (memberUid: string, memberEmail: string) => {
        if (!confirm(`Are you sure you want to remove ${memberEmail} from the organization?`)) return;
        setRemovingUid(memberUid);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/organization/members/remove`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ email: memberEmail }),
            });
            if (res.ok) {
                toastSuccess(`${memberEmail} removed from organization`);
                fetchMembers();
            } else {
                const errData = await res.json().catch(() => null);
                toastError(errData?.detail || "Remove failed");
            }
        } catch {
            toastError("Network error");
        } finally {
            setRemovingUid(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 gap-3 text-[#555]">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-[11px] font-mono uppercase tracking-widest">Loading organization...</span>
            </div>
        );
    }

    if (!orgData) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#333]">
                <Building size={40} className="opacity-30" />
                <p className="text-[11px] uppercase tracking-widest font-semibold">No organization found</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300 mt-8">

            {/* Org Info Card */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-5">
                    <Building size={16} className="text-[#E50914]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">{orgData.organization_name}</h3>
                    <span className="text-[9px] font-mono text-[#555] bg-[#111] border border-[#222] px-2 py-0.5 rounded">{orgData.slug}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Role */}
                    <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4 rounded-lg">
                        <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Your Role</span>
                        <div className="flex items-center gap-2">
                            <Shield size={13} className={isOrgAdmin ? "text-[#E50914]" : "text-[#555]"} />
                            <span className="text-sm font-bold text-white">{isOrgAdmin ? "Admin" : "Member"}</span>
                        </div>
                    </div>

                    {/* Shared Credits */}
                    <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4 rounded-lg">
                        <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Shared Credits</span>
                        <span className="text-2xl font-bold font-mono text-white">{orgData.credits_balance ?? 0}</span>
                    </div>

                    {/* Domains */}
                    <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4 rounded-lg col-span-2 md:col-span-1">
                        <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-2">Domains</span>
                        <div className="flex flex-wrap gap-1.5">
                            {orgData.allowed_domains?.map((d) => (
                                <span key={d} className="text-[9px] font-mono text-green-400 bg-green-900/10 border border-green-900/30 px-2 py-0.5 rounded">{d}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin-only sections */}
            {isOrgAdmin && (
                <>
                    {/* Actions Bar */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="flex items-center gap-2 bg-white text-black hover:bg-[#E50914] hover:text-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-lg"
                        >
                            <UserPlus size={13} /> Add Member
                        </button>
                        <button
                            onClick={handleCopyInvite}
                            className="flex items-center gap-2 bg-[#111] border border-[#222] text-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:border-[#444] transition-colors rounded-lg"
                        >
                            <Copy size={13} /> Copy Invite Link
                        </button>
                        <button
                            onClick={fetchMembers}
                            disabled={membersLoading}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={membersLoading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>

                    {/* Team Roster */}
                    <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden">
                        <div className="flex items-center gap-3 p-5 border-b border-[#1a1a1a]">
                            <Users size={16} className="text-[#E50914]" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Team Roster</h3>
                            <span className="text-[9px] font-mono text-[#555] ml-auto">{members.length} member{members.length !== 1 ? "s" : ""}</span>
                        </div>

                        {membersLoading ? (
                            <div className="flex items-center justify-center py-12 gap-3 text-[#555]">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-[10px] font-mono uppercase tracking-widest">Loading roster...</span>
                            </div>
                        ) : members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#333]">
                                <Users size={30} className="opacity-30" />
                                <p className="text-[10px] uppercase tracking-widest font-semibold">No members yet</p>
                                <p className="text-[9px] text-[#444]">Share the invite link or add members above.</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[#1a1a1a] bg-[#0A0A0A]">
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Email</th>
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Name</th>
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Status</th>
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Role</th>
                                        <th className="text-right p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map((m) => {
                                        const isSelf = m.email === user?.email;
                                        const memberStatus = m.status || "active";
                                        const memberId = m.uid || m.email; // Fallback to email if uid is missing (invited users)

                                        return (
                                            <tr key={memberId} className="border-b border-[#111] hover:bg-[#0D0D0D] transition-colors">
                                                <td className="p-4 text-xs text-white font-mono">
                                                    {m.email}
                                                    {isSelf && <span className="text-[8px] text-[#E50914] ml-2 font-bold">(you)</span>}
                                                </td>
                                                <td className="p-4 text-xs text-[#AAA]">{m.displayName || "—"}</td>
                                                <td className="p-4">
                                                    {memberStatus === "active" ? (
                                                        <span className="text-[9px] text-green-400 bg-green-900/10 border border-green-900/30 px-2 py-0.5 uppercase tracking-widest font-bold rounded">Active</span>
                                                    ) : (
                                                        <span className="text-[9px] text-yellow-400 bg-yellow-900/10 border border-yellow-900/30 px-2 py-0.5 uppercase tracking-widest font-bold rounded animate-pulse">Invited</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {isSelf ? (
                                                        <span className="text-[9px] text-[#E50914] bg-[#E50914]/10 border border-[#E50914]/20 px-2.5 py-1 uppercase tracking-widest font-bold rounded">
                                                            {m.role || "admin"}
                                                        </span>
                                                    ) : (
                                                        <div className="relative inline-block w-28">
                                                            <select
                                                                value={m.role || "viewer"}
                                                                disabled={changingRoleUid === memberId}
                                                                onChange={(e) => handleRoleChange(memberId, m.email, e.target.value)}
                                                                className="w-full appearance-none bg-[#111] border border-[#333] text-[10px] text-white pl-3 py-2 pr-8 uppercase tracking-widest font-bold rounded-md cursor-pointer focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] outline-none transition-colors disabled:opacity-50"
                                                            >
                                                                {ROLES.map((r) => (
                                                                    <option key={r} value={r} className="bg-[#111] text-white">{r}</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                                {changingRoleUid === memberId ? (
                                                                    <Loader2 size={12} className="animate-spin text-[#E50914]" />
                                                                ) : (
                                                                    <ChevronDown size={14} className="text-[#666]" />
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {!isSelf && (
                                                        <button
                                                            onClick={() => handleRemove(memberId, m.email)}
                                                            disabled={removingUid === memberId}
                                                            title={`Remove ${m.email}`}
                                                            className="p-2 text-[#666] hover:text-[#E50914] hover:bg-[#E50914]/10 rounded-md transition-all disabled:opacity-50 inline-flex items-center justify-center"
                                                        >
                                                            {removingUid === memberId ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={14} />
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </>
            )}

            {/* ═══ ADD MEMBER MODAL ═══ */}
            {showInviteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowInviteModal(false)} />

                    <div className="relative z-10 w-full max-w-md bg-[#080808] border border-[#222] shadow-2xl rounded-xl">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-[#222]">
                            <div className="flex items-center gap-3">
                                <UserPlus size={18} className="text-[#E50914]" />
                                <h3 className="font-anton text-xl text-white uppercase tracking-wide">Add Member</h3>
                            </div>
                            <button onClick={() => setShowInviteModal(false)} className="text-[#666] hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Email */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">Email Address</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full bg-[#111] border border-[#333] text-white p-3 text-xs font-mono focus:border-[#E50914] outline-none transition-colors rounded-lg"
                                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                                />
                                <p className="text-[8px] text-[#444] pt-1 flex items-center gap-1">
                                    <Info size={10} className="shrink-0" />
                                    Must end with: {orgData.allowed_domains?.map((d) => `@${d}`).join(", ")}
                                </p>
                            </div>

                            {/* Role */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest block">Role</label>
                                <div className="flex w-full border border-[#333] rounded-lg overflow-hidden">
                                    {ROLES.map((r) => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setInviteRole(r)}
                                            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${inviteRole === r
                                                ? "bg-[#E50914] text-white"
                                                : "bg-transparent text-[#666] hover:text-white"
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-3 pt-2 border-t border-[#222]">
                                <button
                                    onClick={() => setShowInviteModal(false)}
                                    className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleInvite}
                                    disabled={inviting}
                                    className="flex items-center gap-2 bg-white text-black hover:bg-[#E50914] hover:text-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 rounded-lg"
                                >
                                    {inviting ? (
                                        <><Loader2 size={13} className="animate-spin" /> Sending...</>
                                    ) : (
                                        <><UserPlus size={13} /> Send Invite</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
