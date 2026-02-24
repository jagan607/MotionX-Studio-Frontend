"use client";

import { useState, useEffect } from "react";
import { Building, Users, Copy, Shield, RefreshCw, Activity, ChevronUp } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, limit, onSnapshot } from "firebase/firestore";
import { toast } from "react-hot-toast";

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
}

export default function OrganizationTab() {
    const [orgData, setOrgData] = useState<OrgData | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);
    const [promotingUid, setPromotingUid] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const user = auth.currentUser;
    const tenantId = user?.tenantId;
    const isOrgAdmin = orgData?.admins?.includes(user?.email || "");

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

    // Fetch members when admin
    const fetchMembers = async () => {
        if (!isOrgAdmin) return;
        setMembersLoading(true);
        try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/organization/members`, {
                headers: { "Authorization": `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setMembers(data.members || []);
            } else {
                toast.error("Failed to load team roster");
            }
        } catch {
            toast.error("Network error loading members");
        } finally {
            setMembersLoading(false);
        }
    };

    useEffect(() => {
        if (isOrgAdmin && orgData) fetchMembers();
    }, [isOrgAdmin, orgData]);

    // Promote handler
    const handlePromote = async (memberUid: string, memberEmail: string) => {
        setPromotingUid(memberUid);
        try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/organization/promote`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({ user_email: memberEmail }),
            });
            if (res.ok) {
                toast.success(`${memberEmail} promoted to Admin!`);
                fetchMembers();
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.detail || "Promotion failed");
            }
        } catch {
            toast.error("Network error");
        } finally {
            setPromotingUid(null);
        }
    };

    const handleCopyInvite = () => {
        const text = `Join our MotionX Studio workspace!\n\nLog in here with your work email to access the team workspace:\nhttps://studio.motionx.in/login`;
        navigator.clipboard.writeText(text);
        toast.success("Invite link copied to clipboard!");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 gap-3 text-[#555]">
                <Activity size={18} className="animate-spin" />
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
                    {/* Actions */}
                    <div className="flex gap-3">
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
                            <span className="text-[9px] font-mono text-[#555] ml-auto">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                        </div>

                        {membersLoading ? (
                            <div className="flex items-center justify-center py-12 gap-3 text-[#555]">
                                <Activity size={16} className="animate-spin" />
                                <span className="text-[10px] font-mono uppercase tracking-widest">Loading roster...</span>
                            </div>
                        ) : members.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#333]">
                                <Users size={30} className="opacity-30" />
                                <p className="text-[10px] uppercase tracking-widest font-semibold">No members yet</p>
                                <p className="text-[9px] text-[#444]">Share the invite link to onboard your team.</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-[#1a1a1a] bg-[#0A0A0A]">
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Email</th>
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Name</th>
                                        <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Role</th>
                                        <th className="text-right p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {members.map((m) => {
                                        const isMemberAdmin = orgData.admins?.includes(m.email);
                                        return (
                                            <tr key={m.uid} className="border-b border-[#111] hover:bg-[#0D0D0D] transition-colors">
                                                <td className="p-4 text-xs text-white font-mono">{m.email}</td>
                                                <td className="p-4 text-xs text-[#AAA]">{m.displayName || "—"}</td>
                                                <td className="p-4">
                                                    {isMemberAdmin ? (
                                                        <span className="text-[9px] text-[#E50914] bg-[#E50914]/10 border border-[#E50914]/20 px-2 py-0.5 uppercase tracking-widest font-bold rounded">Admin</span>
                                                    ) : (
                                                        <span className="text-[9px] text-[#888] bg-[#1A1A1A] border border-[#222] px-2 py-0.5 uppercase tracking-widest rounded">Member</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    {!isMemberAdmin && (
                                                        <button
                                                            onClick={() => handlePromote(m.uid, m.email)}
                                                            disabled={promotingUid === m.uid}
                                                            className="flex items-center gap-1.5 ml-auto text-[9px] font-bold uppercase tracking-widest text-[#666] hover:text-[#E50914] transition-colors disabled:opacity-50"
                                                        >
                                                            {promotingUid === m.uid ? (
                                                                <Activity size={12} className="animate-spin" />
                                                            ) : (
                                                                <ChevronUp size={12} />
                                                            )}
                                                            Promote
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
        </div>
    );
}
