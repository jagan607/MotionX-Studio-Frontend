"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Building, RefreshCw, Activity, X, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { auth } from "@/lib/firebase";

interface Organization {
    organization_name: string;
    slug: string;
    allowed_domains: string[];
    tenant_id: string;
    provider_id: string;
    is_active: boolean;
}

type Protocol = "OIDC" | "SAML" | "GOOGLE";

export default function ConfigurePage() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    // Modal state
    const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
    const [protocol, setProtocol] = useState<Protocol>("OIDC");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // OIDC fields
    const [providerName, setProviderName] = useState("");
    const [issuerUrl, setIssuerUrl] = useState("");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");

    // SAML fields
    const [samlProviderName, setSamlProviderName] = useState("");
    const [idpEntityId, setIdpEntityId] = useState("");
    const [ssoUrl, setSsoUrl] = useState("");
    const [x509Cert, setX509Cert] = useState("");

    // Google Workspace fields (reuse clientId/clientSecret)
    const [googleClientId, setGoogleClientId] = useState("");
    const [googleClientSecret, setGoogleClientSecret] = useState("");

    const resetModalFields = () => {
        setProviderName(""); setIssuerUrl(""); setClientId(""); setClientSecret("");
        setSamlProviderName(""); setIdpEntityId(""); setSsoUrl(""); setX509Cert("");
        setGoogleClientId(""); setGoogleClientSecret("");
    };

    const openModal = (org: Organization) => {
        resetModalFields();
        setProtocol("OIDC");
        setSelectedOrg(org);
    };

    const closeModal = () => {
        setSelectedOrg(null);
        resetModalFields();
        setProtocol("OIDC");
    };

    // ─── Fetch organizations ───
    const fetchOrganizations = async () => {
        setIsLoading(true);
        setError("");
        try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/admin/organizations`, {
                headers: { "Authorization": `Bearer ${token}` },
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(typeof errData?.detail === "string" ? errData.detail : "Failed to load organizations.");
            }

            const data = await res.json();
            setOrganizations(data.organizations || []);
        } catch (err: any) {
            console.error("Failed to fetch organizations:", err);
            setError(err.message || "Failed to load organizations.");
            toast.error(err.message || "Failed to load organizations.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchOrganizations(); }, []);

    // ─── Submit IdP configuration ───
    const handleConfigureSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrg) return;

        let payload: Record<string, string>;

        if (protocol === "OIDC") {
            if (!providerName.trim()) { toast.error("Provider name is required"); return; }
            if (!issuerUrl.trim()) { toast.error("Issuer URL is required"); return; }
            if (!clientId.trim()) { toast.error("Client ID is required"); return; }
            if (!clientSecret.trim()) { toast.error("Client Secret is required"); return; }
            payload = {
                workspace_slug: selectedOrg.slug,
                protocol: "OIDC",
                provider_name: providerName.trim().toLowerCase(),
                issuer: issuerUrl.trim(),
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
            };
        } else if (protocol === "SAML") {
            if (!samlProviderName.trim()) { toast.error("Provider name is required"); return; }
            if (!idpEntityId.trim()) { toast.error("IdP Entity ID is required"); return; }
            if (!ssoUrl.trim()) { toast.error("SSO Login URL is required"); return; }
            if (!x509Cert.trim()) { toast.error("X.509 Certificate is required"); return; }
            payload = {
                workspace_slug: selectedOrg.slug,
                protocol: "SAML",
                provider_name: samlProviderName.trim().toLowerCase(),
                idp_entity_id: idpEntityId.trim(),
                sso_url: ssoUrl.trim(),
                x509_certificate: x509Cert.trim(),
            };
        } else {
            // GOOGLE
            if (!googleClientId.trim()) { toast.error("Client ID is required"); return; }
            if (!googleClientSecret.trim()) { toast.error("Client Secret is required"); return; }
            payload = {
                workspace_slug: selectedOrg.slug,
                protocol: "GOOGLE",
                provider_name: "google.com",
                client_id: googleClientId.trim(),
                client_secret: googleClientSecret.trim(),
            };
        }

        setIsSubmitting(true);
        try {
            const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`${BACKEND_URL}/api/admin/configure-idp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                const message = Array.isArray(errData?.detail)
                    ? errData.detail.map((e: any) => e.msg).join(", ")
                    : typeof errData?.detail === "string"
                        ? errData.detail
                        : "Configuration failed. Please try again.";
                toast.error(message);
            } else {
                toast.success("Identity Provider configured successfully!");
                closeModal();
                fetchOrganizations();
            }
        } catch (err) {
            console.error("IdP configuration failed:", err);
            toast.error("Network error. Please check your connection.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputClass = "w-full bg-[#111] border border-[#333] text-[#AAA] p-3 text-xs font-mono focus:border-red-600 outline-none transition-colors";
    const labelClass = "text-[9px] font-mono uppercase text-[#666] tracking-widest";

    return (
        <div className="space-y-10 animate-in fade-in duration-500 pb-20">

            {/* HEADER */}
            <div className="flex justify-between items-end border-b border-[#222] pb-6">
                <div>
                    <div className="flex items-center gap-2 text-[#E50914] mb-2">
                        <ShieldCheck size={18} />
                        <span className="text-[10px] font-mono tracking-widest uppercase">SSO Management</span>
                    </div>
                    <h1 className="font-anton text-5xl text-white uppercase tracking-tighter leading-none">
                        Workspace<br />Directory
                    </h1>
                </div>
                <button
                    onClick={fetchOrganizations}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#666] hover:text-white transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* TABLE CARD */}
            <div className="bg-[#080808] border border-[#222] overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 gap-3 text-[#555]">
                        <Activity size={18} className="animate-spin" />
                        <span className="text-[11px] font-mono uppercase tracking-widest">Loading workspaces...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#555]">
                        <span className="text-[11px] font-mono uppercase tracking-widest text-red-500">{error}</span>
                        <button onClick={fetchOrganizations} className="text-[10px] text-[#AAA] hover:text-white font-bold uppercase tracking-widest transition-colors mt-2">Retry</button>
                    </div>
                ) : organizations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-[#333]">
                        <Building size={40} className="opacity-30" />
                        <p className="text-[11px] uppercase tracking-widest font-semibold">No enterprise workspaces found</p>
                        <p className="text-[9px] text-[#444]">Provision a new workspace first.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[#222] bg-[#0A0A0A]">
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Organization</th>
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Slug</th>
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Domains</th>
                                <th className="text-left p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Status</th>
                                <th className="text-right p-4 text-[9px] font-mono uppercase text-[#666] tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {organizations.map((org) => (
                                <tr key={org.slug} className="border-b border-[#1A1A1A] hover:bg-[#111] transition-colors group">
                                    <td className="p-4 text-sm text-white font-mono">{org.organization_name}</td>
                                    <td className="p-4 text-xs text-[#AAA] font-mono">{org.slug}</td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {org.allowed_domains.map((d) => (
                                                <span key={d} className="text-[9px] font-mono text-[#888] bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-0.5">{d}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        {org.provider_id ? (
                                            <span className="text-[10px] text-green-400 bg-green-900/20 border border-green-900/30 px-2 py-1 uppercase tracking-widest font-bold">Active</span>
                                        ) : (
                                            <span className="text-[10px] text-yellow-400 bg-yellow-900/20 border border-yellow-900/30 px-2 py-1 uppercase tracking-widest font-bold animate-pulse">Pending IT Config</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => openModal(org)}
                                            className={`text-[10px] px-4 py-2 font-bold uppercase tracking-widest transition-all ${org.provider_id
                                                ? "bg-transparent text-[#666] border border-[#333] hover:border-[#555] hover:text-white"
                                                : "bg-white text-black hover:bg-red-600 hover:text-white"
                                                }`}
                                        >
                                            {org.provider_id ? "Edit" : "Configure SSO"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ═══ SSO CONFIGURATION MODAL ═══ */}
            {selectedOrg && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />

                    {/* Modal */}
                    <div className="relative z-10 w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-[#080808] border border-[#222] shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 bg-[#080808] z-20 flex items-center justify-between p-6 border-b border-[#222]">
                            <div>
                                <div className="flex items-center gap-2 text-[#E50914] mb-1">
                                    <ShieldCheck size={14} />
                                    <span className="text-[9px] font-mono tracking-widest uppercase">IdP Injection</span>
                                </div>
                                <h3 className="font-anton text-xl text-white uppercase tracking-wide">{selectedOrg.organization_name}</h3>
                                <span className="text-[9px] font-mono text-[#555]">slug: {selectedOrg.slug} • tenant: {selectedOrg.tenant_id}</span>
                            </div>
                            <button onClick={closeModal} className="p-2 text-[#666] hover:text-white transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleConfigureSubmit} className="p-6 space-y-5">
                            {/* Protocol Toggle */}
                            <div className="space-y-1">
                                <label className={labelClass}>Protocol Type</label>
                                <div className="flex w-full border border-[#333]">
                                    <button
                                        type="button"
                                        onClick={() => { setProtocol("OIDC"); resetModalFields(); }}
                                        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${protocol === "OIDC"
                                            ? "bg-[#E50914] text-white"
                                            : "bg-transparent text-[#666] hover:text-white"
                                            }`}
                                    >
                                        OIDC
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setProtocol("SAML"); resetModalFields(); }}
                                        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-l border-[#333] transition-colors ${protocol === "SAML"
                                            ? "bg-[#E50914] text-white"
                                            : "bg-transparent text-[#666] hover:text-white"
                                            }`}
                                    >
                                        SAML
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setProtocol("GOOGLE"); resetModalFields(); }}
                                        className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-l border-[#333] transition-colors ${protocol === "GOOGLE"
                                            ? "bg-[#E50914] text-white"
                                            : "bg-transparent text-[#666] hover:text-white"
                                            }`}
                                    >
                                        Google
                                    </button>
                                </div>
                            </div>

                            {/* Dynamic Fields */}
                            {protocol === "OIDC" ? (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="space-y-1">
                                        <label className={labelClass}>Provider Name</label>
                                        <input type="text" value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="okta, microsoft-entra" className={inputClass} />
                                        <p className="text-[8px] text-[#444] pt-1">Registers as: <span className="text-[#888] font-mono">oidc.{providerName.toLowerCase().replace(/\s+/g, "-") || "provider"}-{selectedOrg.slug}</span></p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>Issuer URL</label>
                                        <input type="text" value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} placeholder="https://pocketfm.okta.com" className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>Client ID</label>
                                        <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="0oa1b2c3d4e5f6g7h8" className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>Client Secret</label>
                                        <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••••••••••" className={inputClass} />
                                    </div>
                                </div>
                            ) : protocol === "SAML" ? (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="space-y-1">
                                        <label className={labelClass}>Provider Name</label>
                                        <input type="text" value={samlProviderName} onChange={(e) => setSamlProviderName(e.target.value)} placeholder="azure, ping" className={inputClass} />
                                        <p className="text-[8px] text-[#444] pt-1">Registers as: <span className="text-[#888] font-mono">saml.{samlProviderName.toLowerCase().replace(/\s+/g, "-") || "provider"}-{selectedOrg.slug}</span></p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>IdP Entity ID / Issuer</label>
                                        <input type="text" value={idpEntityId} onChange={(e) => setIdpEntityId(e.target.value)} placeholder="https://sts.windows.net/{tenant-id}/" className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>SSO Login URL</label>
                                        <input type="text" value={ssoUrl} onChange={(e) => setSsoUrl(e.target.value)} placeholder="https://login.microsoftonline.com/{tenant-id}/saml2" className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>X.509 Certificate</label>
                                        <textarea
                                            value={x509Cert} onChange={(e) => setX509Cert(e.target.value)}
                                            placeholder={"-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAX...\n-----END CERTIFICATE-----"}
                                            rows={7} className={`${inputClass} resize-y min-h-[100px]`}
                                        />
                                        <p className="text-[8px] text-[#444] pt-1 flex items-center gap-1">
                                            <Info size={10} className="shrink-0" />
                                            Paste the full PEM-encoded certificate including BEGIN/END markers.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="space-y-1">
                                        <label className={labelClass}>Client ID</label>
                                        <input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="123456789-abc.apps.googleusercontent.com" className={inputClass} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={labelClass}>Client Secret</label>
                                        <input type="password" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder="••••••••••••••••" className={inputClass} />
                                    </div>
                                    <p className="text-[8px] text-[#555] pt-1 flex items-center gap-1">
                                        <Info size={10} className="shrink-0 text-[#E50914]" />
                                        Note: You can reuse your master MotionX Google OAuth Client credentials here.
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#222]">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="text-[10px] text-[#666] hover:text-white font-bold uppercase tracking-widest transition-colors px-4 py-2.5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 bg-white text-black hover:bg-red-600 hover:text-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <><Activity size={14} className="animate-spin" /> Injecting...</>
                                    ) : (
                                        "Inject Identity Provider"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
