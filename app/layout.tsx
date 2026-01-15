import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader"; // <--- 1. Import it
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  // <title>MotionX ...</title>
  title: "MotionX Studio | Direct AI Cinema",

  // <meta name="description" ... />
  description: "The first AI-native operating system for filmmakers. Turn scripts into consistent characters, storyboards, and 4K video assets.",

  // <meta name="keywords" ... />
  keywords: ["AI Film Studio", "MotionX", "Generative AI Cinema", "Motion Transfer", "Pre-visualization", "Video Production", "Sora Alternative"],

  // <meta name="author" ... />
  authors: [{ name: "MotionX Studios" }],

  // Base URL (Crucial for images to work)
  metadataBase: new URL('https://studio.motionx.in'),

  // <meta property="og:..." />
  openGraph: {
    type: "website",
    url: "https://studio.motionx.in",
    title: "MotionX Studio | Direct AI Cinema",
    description: "Turn raw scripts into production-ready video assets. Features consistent casting, auto-directing, and 4K upscaling.",
    siteName: "MotionX Studio",
    images: [
      {
        url: "/og-share-image.png", // Must be in 'public' folder
        width: 1200,
        height: 630,
        alt: "MotionX Studio Preview",
      },
    ],
  },

  // <meta name="twitter:..." />
  twitter: {
    card: "summary_large_image",
    title: "MotionX Studio | Direct AI Cinema",
    description: "The first AI-native operating system for filmmakers.",
    images: ["/og-share-image.png"], // Must be in 'public' folder
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "MotionX Studio",
    "url": "https://studio.motionx.in",
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Web",
    "description": "The first AI-native operating system for filmmakers.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "10 Free Credits on Signup"
    },
    "author": {
      "@type": "Organization",
      "name": "MotionX Studios",
      "url": "https://www.motionx.in"
    }
  };

  return (
    <html lang="en">
      <body className={inter.className} style={{ backgroundColor: '#030303', color: 'white' }}>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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