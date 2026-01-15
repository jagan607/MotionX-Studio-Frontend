import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader"; // <--- 1. Import it

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MotionX Studio | Direct AI Cinema",
  description: "The first AI-native operating system for filmmakers. Turn scripts into consistent characters, storyboards, and 4K video assets.",
  metadataBase: new URL('https://studio.motionx.in'), // Base URL
  openGraph: {
    title: "MotionX Studio",
    description: "Turn scripts into cinema.",
    url: 'https://studio.motionx.in',
    siteName: 'MotionX Studio',
    images: [
      {
        url: 'https://studio.motionx.in/og-share-image.png', // <--- FORCE ABSOLUTE URL
        width: 1200,
        height: 630,
        alt: 'MotionX Studio Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "MotionX Studio",
    description: "AI Filmmaking Terminal",
    images: ['https://studio.motionx.in/og-share-image.png'], // <--- FORCE ABSOLUTE URL
  },
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