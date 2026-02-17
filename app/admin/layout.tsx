import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import Link from 'next/link';
import { LayoutDashboard, Users, CreditCard, Activity, Terminal, ShieldAlert } from 'lucide-react';

// 🔒 SECURITY CONFIGURATION
const ALLOWED_ADMINS = [
    'jagan@motionx.in',
    'rohit@motionx.in',
    'vidyadhar@motionx.in'
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    // 1. Check if session exists
    if (!sessionCookie) {
        redirect('/login');
    }

    try {
        // 2. Verify Session & Email
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

        console.log("------------------------------------------------");
        console.log("🔍 Admin Access Attempt:");
        console.log("📧 Email Detected:", decodedClaims.email);
        console.log("✅ Is Allowed?", ALLOWED_ADMINS.includes(decodedClaims.email || ''));
        console.log("------------------------------------------------");
        // ------------------------------------------------

        if (!decodedClaims.email || !ALLOWED_ADMINS.includes(decodedClaims.email)) {
            throw new Error("Unauthorized Access");
        }
    } catch (error) {
        // If invalid, redirect to home (or show a 403 page)
        console.log("⛔ Access Denied:", error);
        redirect('/');
    }

    // 3. Render Brutalist Admin Interface
    return (
        <div className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans flex selection:bg-red-500 selection:text-white">

            {/* SIDEBAR */}
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
                <nav className="flex-1 p-6 space-y-4">
                    <AdminNavLink href="/admin" icon={LayoutDashboard} label="Command Center" />
                    <AdminNavLink href="/admin/users" icon={Users} label="User Database" />
                    <AdminNavLink href="/admin/finance" icon={CreditCard} label="Revenue Stream" />
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

            {/* MAIN CONTENT */}
            <main className="flex-1 ml-72">
                <div className="p-12 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

// Helper Component for Links
function AdminNavLink({ href, icon: Icon, label }: { href: string, icon: any, label: string }) {
    return (
        <Link href={href} className="flex items-center gap-4 px-4 py-4 border border-transparent hover:border-red-900/50 hover:bg-[#150505] transition-all group rounded-sm">
            <Icon size={18} className="text-[#666] group-hover:text-red-500 transition-colors" />
            <span className="text-xs uppercase tracking-[0.15em] font-bold text-[#888] group-hover:text-white transition-colors font-mono">{label}</span>
        </Link>
    );
}