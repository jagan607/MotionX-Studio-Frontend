import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase-admin';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

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
        // Skip revocation check in dev (avoids 25s network timeout to Google)
        const checkRevocation = process.env.NODE_ENV === 'production';

        const verifyPromise = adminAuth.verifySessionCookie(sessionCookie, checkRevocation);

        // Fail fast with a 5-second timeout instead of hanging for 30s
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Session verification timeout (5s)")), 5000)
        );

        const decodedClaims = await Promise.race([verifyPromise, timeoutPromise]);

        console.log("------------------------------------------------");
        console.log("🔍 Admin Access Attempt:");
        console.log("📧 Email Detected:", decodedClaims.email);
        console.log("✅ Is Allowed?", ALLOWED_ADMINS.includes(decodedClaims.email || ''));
        console.log("------------------------------------------------");

        if (!decodedClaims.email || !ALLOWED_ADMINS.includes(decodedClaims.email)) {
            throw new Error("Unauthorized Access");
        }
    } catch (error) {
        console.log("⛔ Admin Access Denied — session cookie invalid or expired. Redirecting to /login.", error);
        redirect('/login');
    }

    // 3. Render Brutalist Admin Interface
    return (
        <div className="min-h-screen bg-[#050505] text-[#EDEDED] font-sans flex selection:bg-red-500 selection:text-white">

            {/* SIDEBAR — Client component with active route detection */}
            <AdminSidebar />

            {/* MAIN CONTENT */}
            <main className="flex-1 ml-72">
                <div className="p-12 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}