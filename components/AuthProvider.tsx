"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 1. SYNC AUTH STATE ON MOUNT (RUNS ONCE)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthCheckComplete(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. HANDLE REDIRECTS (SIDE EFFECTS)
  useEffect(() => {
    if (!authCheckComplete) return;

    const publicPaths = ["/", "/login", "/pricing"];
    const isPublicPath = publicPaths.includes(pathname);

    // If no user & trying to access protected route -> Go Home
    if (!user && !isPublicPath) {
      router.push("/");
    }
    // If user is logged in & trying to access Login -> Go Dashboard
    else if (user && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [user, authCheckComplete, pathname, router]);


  // 3. RENDER GUARDS (SYNCHRONOUS)
  // Prevent flashing by returning Loader if we are in a "Redirect Condition"

  // A. Still checking initial auth
  if (!authCheckComplete) {
    return <FullScreenLoader />;
  }

  // B. User is logged in, but on Login Page (Wait for redirect)
  if (user && pathname === "/login") {
    return <FullScreenLoader />;
  }

  // C. User is NOT logged in, but on Protected Page (Wait for redirect)
  const publicPaths = ["/", "/login", "/pricing"];
  if (!user && !publicPaths.includes(pathname)) {
    return <FullScreenLoader />;
  }

  // D. Safe to Render
  return <>{children}</>;
}

function FullScreenLoader() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#050505',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-loader { animation: spin 1s linear infinite; }
      `}</style>
      <Loader2 className="spin-loader" size={48} color="#E50914" />
    </div>
  );
}