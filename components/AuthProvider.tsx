"use client";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // 1. Define pages that guests are allowed to see
      const publicPaths = ["/", "/login", "/pricing"];

      // 2. LOGIC: If no user AND we are trying to visit a protected page -> Kick to Home
      if (!user && !publicPaths.includes(pathname)) {
        router.push("/");
      }

      // 3. LOGIC: If user is logged in but tries to access login -> Send to Dashboard
      else if (user && pathname === "/login") {
        router.push("/dashboard");
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

  if (loading) {
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
        <Loader2 className="spin-loader" size={48} color="#FF0000" />
      </div>
    );
  }

  return <>{children}</>;
}