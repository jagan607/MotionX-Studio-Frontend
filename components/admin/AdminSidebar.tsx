"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    Megaphone,
    Mail,
    Building,
    ShieldCheck,
    CreditCard,
    ListChecks,
    ShieldAlert,
    Film,
    Sparkles,
    Video,
} from "lucide-react";

const NAV_ITEMS = [
    { href: "/admin", icon: LayoutDashboard, label: "Command Center", exact: true },
    { href: "/admin/users", icon: Users, label: "User Database" },
    { href: "/admin/announcements", icon: Megaphone, label: "Announcements" },
    { href: "/admin/announcements#email-blast", icon: Mail, label: "Email Blast" },
    { href: "/admin/templates", icon: Film, label: "Templates" },
    { href: "/admin/playground-templates", icon: Sparkles, label: "PG Templates" },
    { href: "/admin/kling-templates", icon: Video, label: "Kling Templates" },
    { href: "/admin/enterprise", icon: Building, label: "Enterprise Setup", exact: true },
    { href: "/admin/enterprise/configure", icon: ShieldCheck, label: "SSO Configuration" },
    { href: "/admin/finance", icon: CreditCard, label: "Revenue Stream" },
    { href: "/admin/tasks", icon: ListChecks, label: "System Tasks" },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-72 border-r-2 border-[#222] flex flex-col fixed h-full bg-[#080808] z-50">
            {/* Header */}
            <div className="p-8 border-b-2 border-[#222]">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                    <ShieldAlert size={20} />
                    <span className="text-[10px] font-mono tracking-widest">RESTRICTED AREA</span>
                </div>
                <h1 className="font-anton text-3xl tracking-tighter text-white uppercase leading-none">
                    Admin<br /><span className="text-red-600">Terminal</span>
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-6 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const hrefPath = item.href.split("#")[0]; // Strip hash for comparison
                    const isActive = item.exact
                        ? pathname === hrefPath
                        : pathname.startsWith(hrefPath);

                    return (
                        <AdminNavLink
                            key={item.href}
                            href={item.href}
                            icon={item.icon}
                            label={item.label}
                            isActive={isActive}
                        />
                    );
                })}
            </nav>

            {/* Footer Status */}
            <div className="p-6 border-t-2 border-[#222] bg-[#0A0A0A]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#666] tracking-widest uppercase">System Status</span>
                        <span className="text-xs font-mono text-white">ONLINE // SECURE</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

function AdminNavLink({
    href,
    icon: Icon,
    label,
    isActive,
}: {
    href: string;
    icon: any;
    label: string;
    isActive: boolean;
}) {
    return (
        <Link
            href={href}
            className={`
                flex items-center gap-4 px-4 py-3.5 transition-all group rounded-sm relative
                ${isActive
                    ? "border border-red-900/50 bg-[#150505]"
                    : "border border-transparent hover:border-red-900/50 hover:bg-[#150505]"
                }
            `}
        >
            {/* Active left indicator bar */}
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-red-600 rounded-r" />
            )}
            <Icon
                size={18}
                className={`transition-colors ${isActive ? "text-red-500" : "text-[#666] group-hover:text-red-500"}`}
            />
            <span
                className={`text-xs uppercase tracking-[0.15em] font-bold font-mono transition-colors ${isActive ? "text-white" : "text-[#888] group-hover:text-white"
                    }`}
            >
                {label}
            </span>
        </Link>
    );
}
