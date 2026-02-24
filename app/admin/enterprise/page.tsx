"use client";

import { useState } from "react";
import { Building, ArrowRight, Activity, Info, CheckCircle, Copy, Mail, RotateCcw } from "lucide-react";
import { toast } from "react-hot-toast";
import { auth } from "@/lib/firebase";

// --- Types ---
interface EnterpriseOnboardResponse {
    organization_name: string;
    organization_id: string;
    tenant_id: string;
    slug: string;
    allowed_domains: string[];
}

// --- Email Template Generator ---
function generateEmailBody(orgName: string): string {
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "motionx-studio.firebaseapp.com";

    return `Hi IT Team,

We are setting up the enterprise workspace for ${orgName} and need to configure your Single Sign-On (SSO) integration. We natively support Microsoft Entra ID, Okta, and Google Workspace (SAML 2.0 or OIDC).

To register MotionX Studio in your identity provider, please use our Service Provider details:
• Redirect URI / ACS URL: https://${authDomain}/__/auth/handler
• SP Entity ID: https://${authDomain}

Please reply with your Identity Provider credentials (SAML metadata or OIDC Issuer/Client ID).`;
}

function generateEmailSubject(orgName: string): string {
    return `MotionX Studio Enterprise SSO Provisioning - ${orgName}`;
}

export default function EnterprisePage() {
    const [orgName, setOrgName] = useState("");
    const [slug, setSlug] = useState("");
    const [domains, setDomains] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [provisionedData, setProvisionedData] = useState<EnterpriseOnboardResponse | null>(null);

    // Auto-format slug: lowercase, replace spaces with hyphens, strip invalid chars
    const handleSlugChange = (value: string) => {
        setSlug(
            value
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "")
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // --- Client-side validation ---
        if (!orgName.trim()) {
            toast.error("Organization name is required");
            return;
        }

        if (!slug.trim() || slug.length < 3) {
            toast.error("Workspace slug must be at least 3 characters");
            return;
        }

        if (!/^[a-z0-9-]+$/.test(slug)) {
            toast.error("Workspace slug can only contain lowercase letters, numbers, and hyphens");
            return;
        }

        const domainList = domains
            .split(",")
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean);

        if (domainList.length === 0) {
            toast.error("Please enter at least one allowed domain");
            return;
        }

        const invalidDomains = domainList.filter(
            (d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)
        );
        if (invalidDomains.length > 0) {
            toast.error(`Invalid domain format: ${invalidDomains.join(", ")}`);
            return;
        }

        if (adminEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
            toast.error("Invalid admin email format");
            return;
        }

        setIsLoading(true);

        try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/admin/onboard-enterprise`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify({
                    organization_name: orgName.trim(),
                    workspace_slug: slug.trim(),
                    allowed_domains: domainList,
                    ...(adminEmail.trim() && { admin_email: adminEmail.trim() }),
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                const message = Array.isArray(errData?.detail)
                    ? errData.detail.map((e: any) => e.msg).join(", ")
                    : typeof errData?.detail === "string"
                        ? errData.detail
                        : "Provisioning failed. Please try again.";
                toast.error(message);
            } else {
                const data = await res.json();
                setProvisionedData({
                    ...data,
                    organization_name: orgName.trim(),
                    slug: slug.trim(),
                    allowed_domains: domainList,
                });
                toast.success("Workspace provisioned successfully!");
            }
        } catch (error) {
            console.error("Enterprise provisioning failed:", error);
            toast.error("Network error. Please check your connection.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setProvisionedData(null);
        setOrgName("");
        setSlug("");
        setDomains("");
        setAdminEmail("");
    };

    const handleCopyEmail = async () => {
        if (!provisionedData) return;
        const fullEmail = `Subject: ${generateEmailSubject(provisionedData.organization_name)}\n\n${generateEmailBody(provisionedData.organization_name)}`;
        await navigator.clipboard.writeText(fullEmail);
        toast.success("Email copied to clipboard");
    };

    const handleMailto = () => {
        if (!provisionedData) return;
        const subject = encodeURIComponent(generateEmailSubject(provisionedData.organization_name));
        const body = encodeURIComponent(generateEmailBody(provisionedData.organization_name));
        window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">

            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-[#222] pb-6">
                <div>
                    <div className="flex items-center gap-2 text-[#E50914] mb-2">
                        <Building size={18} />
                        <span className="text-[10px] font-mono tracking-widest uppercase">Enterprise Management</span>
                    </div>
                    <h1 className="font-anton text-5xl text-white uppercase tracking-tighter leading-none">
                        Enterprise<br />Workspaces
                    </h1>
                </div>
                <span className="text-[10px] font-mono text-[#444]">GCIP TENANT PROVISIONING</span>
            </div>

            {provisionedData ? (
                /* ===== SUCCESS STATE ===== */
                <div className="space-y-6">

                    {/* Success Card */}
                    <div className="bg-[#080808] border border-[#222] p-6">
                        <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                            <CheckCircle className="text-green-500" size={16} />
                            <h3 className="font-anton text-xl text-white uppercase tracking-wide">Workspace Provisioned Successfully</h3>
                        </div>

                        {/* Provisioned Details Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4">
                                <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Organization Name</span>
                                <span className="text-sm font-mono text-white">{provisionedData.organization_name}</span>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4">
                                <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Workspace Slug</span>
                                <span className="text-sm font-mono text-white">{provisionedData.slug}</span>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4">
                                <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Tenant ID</span>
                                <span className="text-xs font-mono text-[#AAA] break-all">{provisionedData.tenant_id}</span>
                            </div>
                            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-4">
                                <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Organization ID</span>
                                <span className="text-xs font-mono text-[#AAA] break-all">{provisionedData.organization_id}</span>
                            </div>
                        </div>

                        {/* Domain Badges */}
                        <div className="mb-2">
                            <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-2">Allowed Domains</span>
                            <div className="flex flex-wrap gap-2">
                                {provisionedData.allowed_domains.map((d) => (
                                    <span key={d} className="text-[10px] font-mono text-green-400 bg-green-900/20 border border-green-900/30 px-2 py-1">{d}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* IT Email Generator Card */}
                    <div className="bg-[#080808] border border-[#222] p-6">
                        <div className="flex items-center justify-between mb-6 border-b border-[#222] pb-4">
                            <div className="flex items-center gap-3">
                                <Mail className="text-[#E50914]" size={16} />
                                <h3 className="font-anton text-xl text-white uppercase tracking-wide">IT Onboarding Email</h3>
                            </div>
                            <span className="text-[9px] font-mono text-[#555]">READY TO SEND</span>
                        </div>

                        {/* Subject Line */}
                        <div className="mb-4">
                            <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Subject</span>
                            <div className="bg-[#0A0A0A] border border-[#1A1A1A] p-3 text-xs font-mono text-[#CCC]">
                                {generateEmailSubject(provisionedData.organization_name)}
                            </div>
                        </div>

                        {/* Email Body */}
                        <div className="mb-6">
                            <span className="text-[9px] font-mono uppercase text-[#666] tracking-widest block mb-1">Body</span>
                            <pre className="bg-[#0A0A0A] border border-[#1A1A1A] p-4 text-xs font-mono text-[#CCC] leading-relaxed whitespace-pre-wrap overflow-x-auto">
                                {generateEmailBody(provisionedData.organization_name)}
                            </pre>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-3 pt-4 border-t border-[#222]">
                            <button
                                onClick={handleCopyEmail}
                                className="flex items-center gap-2 bg-white text-black hover:bg-red-600 hover:text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                                <Copy size={13} />
                                Copy Email
                            </button>
                            <button
                                onClick={handleMailto}
                                className="flex items-center gap-2 bg-[#111] text-[#AAA] border border-[#333] hover:border-red-600 hover:text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all"
                            >
                                <Mail size={13} />
                                Open in Mail Client
                            </button>
                            <div className="flex-1" />
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-2 text-[#666] hover:text-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors"
                            >
                                <RotateCcw size={13} />
                                Provision Another
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* ===== ONBOARDING FORM ===== */
                <div className="bg-[#080808] border border-[#222] p-6 relative overflow-hidden group">
                    <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                        <Building className="text-[#E50914]" size={16} />
                        <h3 className="font-anton text-xl text-white uppercase tracking-wide">Provision New Workspace</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Organization Name */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">
                                Organization Name
                            </label>
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="Pocket FM"
                                className="w-full bg-[#111] border border-[#333] text-white p-3 font-anton text-lg tracking-wide focus:border-red-600 outline-none transition-colors"
                            />
                        </div>

                        {/* Workspace Slug */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">
                                Workspace Slug
                            </label>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => handleSlugChange(e.target.value)}
                                placeholder="pocketfm"
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-red-600 outline-none transition-colors"
                            />
                            {slug && (
                                <p className="text-[9px] text-[#555] font-mono pt-1">
                                    Users can login with: <span className="text-[#888]">{slug}</span>
                                </p>
                            )}
                        </div>

                        {/* Allowed Email Domains */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">
                                Allowed Email Domains
                            </label>
                            <input
                                type="text"
                                value={domains}
                                onChange={(e) => setDomains(e.target.value)}
                                placeholder="pocketfm.com, pocketfm.studio"
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-red-600 outline-none transition-colors"
                            />
                            <p className="text-[8px] text-[#444] pt-1 flex items-center gap-1">
                                <Info size={10} className="shrink-0" />
                                Separate multiple domains with a comma. Users with matching email domains will be routed to this workspace.
                            </p>
                        </div>

                        {/* Initial Admin Email */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-mono uppercase text-[#666] tracking-widest">
                                Initial Admin Email <span className="text-[#444]">(Optional)</span>
                            </label>
                            <input
                                type="email"
                                value={adminEmail}
                                onChange={(e) => setAdminEmail(e.target.value)}
                                placeholder="admin@pocketfm.com"
                                className="w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-red-600 outline-none transition-colors"
                            />
                            <p className="text-[8px] text-[#444] pt-1 flex items-center gap-1">
                                <Info size={10} className="shrink-0" />
                                This user will be seeded as the first Org Admin and can manage team settings.
                            </p>
                        </div>

                        {/* Submit */}
                        <div className="flex justify-end pt-4 border-t border-[#222]">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex items-center gap-2 bg-white text-black hover:bg-red-600 hover:text-white px-6 py-3 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Activity size={14} className="animate-spin" />
                                        Provisioning...
                                    </>
                                ) : (
                                    <>
                                        Provision Enterprise Workspace
                                        <ArrowRight size={14} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
