"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight, Activity, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { auth } from "@/lib/firebase";

type Protocol = "OIDC" | "SAML";

export default function ConfigureIdpPage() {
    const [workspaceSlug, setWorkspaceSlug] = useState("");
    const [protocol, setProtocol] = useState<Protocol>("OIDC");
    const [isLoading, setIsLoading] = useState(false);

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

    const resetFields = () => {
        setProviderName("");
        setIssuerUrl("");
        setClientId("");
        setClientSecret("");
        setSamlProviderName("");
        setIdpEntityId("");
        setSsoUrl("");
        setX509Cert("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!workspaceSlug.trim()) {
            toast.error("Workspace slug is required");
            return;
        }

        let payload: Record<string, string>;

        if (protocol === "OIDC") {
            if (!providerName.trim()) { toast.error("Provider name is required"); return; }
            if (!issuerUrl.trim()) { toast.error("Issuer URL is required"); return; }
            if (!clientId.trim()) { toast.error("Client ID is required"); return; }
            if (!clientSecret.trim()) { toast.error("Client Secret is required"); return; }

            payload = {
                workspace_slug: workspaceSlug.trim(),
                protocol: "OIDC",
                provider_name: providerName.trim().toLowerCase(),
                issuer: issuerUrl.trim(),
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
            };
        } else {
            if (!samlProviderName.trim()) { toast.error("Provider name is required"); return; }
            if (!idpEntityId.trim()) { toast.error("IdP Entity ID is required"); return; }
            if (!ssoUrl.trim()) { toast.error("SSO Login URL is required"); return; }
            if (!x509Cert.trim()) { toast.error("X.509 Certificate is required"); return; }

            payload = {
                workspace_slug: workspaceSlug.trim(),
                protocol: "SAML",
                provider_name: samlProviderName.trim().toLowerCase(),
                idp_entity_id: idpEntityId.trim(),
                sso_url: ssoUrl.trim(),
                x509_certificate: x509Cert.trim(),
            };
        }

        setIsLoading(true);

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
                const data = await res.json();
                toast.success(data.message || "Identity Provider configured successfully!");
                resetFields();
                setWorkspaceSlug("");
            }
        } catch (error) {
            console.error("IdP configuration failed:", error);
            toast.error("Network error. Please check your connection.");
        } finally {
            setIsLoading(false);
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
                        <span className="text-[10px] font-mono tracking-widest uppercase">Identity Provider Setup</span>
                    </div>
                    <h1 className="font-anton text-5xl text-white uppercase tracking-tighter leading-none">
                        Configure<br />SSO Provider
                    </h1>
                </div>
                <span className="text-[10px] font-mono text-[#444]">GCIP IDP INJECTION</span>
            </div>

            {/* FORM CARD */}
            <div className="bg-[#080808] border border-[#222] p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6 border-b border-[#222] pb-4">
                    <ShieldCheck className="text-[#E50914]" size={16} />
                    <h3 className="font-anton text-xl text-white uppercase tracking-wide">Inject Identity Provider</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Workspace Slug */}
                    <div className="space-y-1">
                        <label className={labelClass}>Workspace Slug</label>
                        <input
                            type="text"
                            value={workspaceSlug}
                            onChange={(e) => setWorkspaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            placeholder="pocketfm"
                            className={inputClass}
                        />
                        <p className="text-[8px] text-[#444] pt-1 flex items-center gap-1">
                            <Info size={10} className="shrink-0" />
                            The slug of the workspace you provisioned earlier.
                        </p>
                    </div>

                    {/* Protocol Toggle */}
                    <div className="space-y-1">
                        <label className={labelClass}>Protocol Type</label>
                        <div className="flex gap-0">
                            <button
                                type="button"
                                onClick={() => { setProtocol("OIDC"); resetFields(); }}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border ${protocol === "OIDC"
                                        ? "bg-[#E50914] text-white border-[#E50914]"
                                        : "bg-[#111] text-[#666] border-[#333] hover:text-white hover:border-[#555]"
                                    }`}
                            >
                                OIDC
                            </button>
                            <button
                                type="button"
                                onClick={() => { setProtocol("SAML"); resetFields(); }}
                                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border ${protocol === "SAML"
                                        ? "bg-[#E50914] text-white border-[#E50914]"
                                        : "bg-[#111] text-[#666] border-[#333] hover:text-white hover:border-[#555]"
                                    }`}
                            >
                                SAML
                            </button>
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    {protocol === "OIDC" ? (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="space-y-1">
                                <label className={labelClass}>Provider Name</label>
                                <input
                                    type="text"
                                    value={providerName}
                                    onChange={(e) => setProviderName(e.target.value)}
                                    placeholder="okta, microsoft-entra"
                                    className={inputClass}
                                />
                                <p className="text-[8px] text-[#444] pt-1">
                                    Backend will register as: <span className="text-[#888] font-mono">oidc.{providerName.toLowerCase().replace(/\s+/g, "-") || "provider"}-{workspaceSlug || "slug"}</span>
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Issuer URL</label>
                                <input
                                    type="text"
                                    value={issuerUrl}
                                    onChange={(e) => setIssuerUrl(e.target.value)}
                                    placeholder="https://pocketfm.okta.com"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Client ID</label>
                                <input
                                    type="text"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder="0oa1b2c3d4e5f6g7h8"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>Client Secret</label>
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={(e) => setClientSecret(e.target.value)}
                                    placeholder="••••••••••••••••"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="space-y-1">
                                <label className={labelClass}>Provider Name</label>
                                <input
                                    type="text"
                                    value={samlProviderName}
                                    onChange={(e) => setSamlProviderName(e.target.value)}
                                    placeholder="azure, ping"
                                    className={inputClass}
                                />
                                <p className="text-[8px] text-[#444] pt-1">
                                    Backend will register as: <span className="text-[#888] font-mono">saml.{samlProviderName.toLowerCase().replace(/\s+/g, "-") || "provider"}-{workspaceSlug || "slug"}</span>
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>IdP Entity ID / Issuer</label>
                                <input
                                    type="text"
                                    value={idpEntityId}
                                    onChange={(e) => setIdpEntityId(e.target.value)}
                                    placeholder="https://sts.windows.net/{tenant-id}/"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>SSO Login URL</label>
                                <input
                                    type="text"
                                    value={ssoUrl}
                                    onChange={(e) => setSsoUrl(e.target.value)}
                                    placeholder="https://login.microsoftonline.com/{tenant-id}/saml2"
                                    className={inputClass}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className={labelClass}>X.509 Certificate</label>
                                <textarea
                                    value={x509Cert}
                                    onChange={(e) => setX509Cert(e.target.value)}
                                    placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDpDCCAoygAwIBAgIGAX...&#10;-----END CERTIFICATE-----"
                                    rows={8}
                                    className={`${inputClass} resize-y min-h-[120px]`}
                                />
                                <p className="text-[8px] text-[#444] pt-1 flex items-center gap-1">
                                    <Info size={10} className="shrink-0" />
                                    Paste the full PEM-encoded certificate including BEGIN/END markers.
                                </p>
                            </div>
                        </div>
                    )}

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
                                    Injecting...
                                </>
                            ) : (
                                <>
                                    Inject Identity Provider
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
