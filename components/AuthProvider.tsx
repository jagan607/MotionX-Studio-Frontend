"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

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

      // JIT provisioning: sync tenant UID to Firestore on every login
      if (currentUser) {
        (async () => {
          try {
            const userRef = doc(db, "users", currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
              // 🛡️ FIRST TIME LOGIN: Document doesn't exist yet
              // Pull true creation time from Google Auth metadata
              const authCreationTime = currentUser.metadata.creationTime
                ? new Date(currentUser.metadata.creationTime)
                : serverTimestamp();

              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || "",
                photoURL: currentUser.photoURL || "",
                tenant_id: currentUser.tenantId || null,
                plan: "free",
                credits: 10,
                createdAt: authCreationTime,
                lastActiveAt: serverTimestamp(),
              });
            } else {
              // 🔄 ROUTINE LOGIN: Document already exists.
              // Strictly update ONLY the last active timestamp.
              await setDoc(userRef, {
                lastActiveAt: serverTimestamp(),
              }, { merge: true });
            }

            console.log("✅ FIRESTORE SYNC SUCCESS | UID:", currentUser.uid);
          } catch (error: any) {
            console.error("❌ FIRESTORE SYNC FAILED:", error);
            toast.error(`Database Sync Error: ${error?.message || error}`, { duration: 10000 });
          }
        })();
      }
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