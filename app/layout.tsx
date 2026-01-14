import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader"; // <--- 1. Import it

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MotionX Studio",
  description: "AI Film Production",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} style={{ backgroundColor: '#030303', color: 'white' }}>
        <AuthProvider>

          {/* 2. PLACE HEADER HERE */}
          <GlobalHeader />

          {/* 3. MAIN CONTENT */}
          {children}

        </AuthProvider>
      </body>
    </html>
  );
}