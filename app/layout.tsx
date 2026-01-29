import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import GlobalHeader from "@/components/GlobalHeader";
import Script from "next/script";
import { MediaViewerProvider } from "@/app/context/MediaViewerContext"; // Context Logic
import GlobalMediaViewer from "@/app/components/media/GlobalMediaViewer"; // UI Overlay

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MotionX Studio | Direct AI Cinema",
  description: "The first AI-native operating system for filmmakers. Turn scripts into consistent characters, storyboards, and 4K video assets.",
  keywords: ["AI Film Studio", "MotionX", "Generative AI Cinema", "Motion Transfer", "Pre-visualization", "Video Production", "Sora Alternative"],
  authors: [{ name: "MotionX Studios" }],
  metadataBase: new URL('https://studio.motionx.in'),
  openGraph: {
    type: "website",
    url: "https://studio.motionx.in",
    title: "MotionX Studio | Direct AI Cinema",
    description: "Turn raw scripts into production-ready video assets. Features consistent casting, auto-directing, and 4K upscaling.",
    siteName: "MotionX Studio",
    images: [
      {
        url: "https://studio.motionx.in/og-share-image.png",
        width: 1200,
        height: 630,
        alt: "MotionX Studio Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MotionX Studio | Direct AI Cinema",
    description: "The first AI-native operating system for filmmakers.",
    images: ["https://studio.motionx.in/og-share-image.png"],
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
      <body className={inter.className} style={{ backgroundColor: '#030303', color: 'white' }} suppressHydrationWarning={true}>

        {/* --- CRITICAL: RAZORPAY SCRIPT --- */}
        <Script
          id="razorpay-checkout"
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />

        {/* 1. PROVIDER WRAPS EVERYTHING */}
        <MediaViewerProvider>

          {/* 2. VIEWER UI SITS HERE (Sibling to content, not parent) */}
          <GlobalMediaViewer />

          <div className="h-screen w-screen flex flex-col">
            <Script
              id="json-ld"
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <AuthProvider>
              <div className="film-grain" />
              <div className="vignette" />

              {/* 3. GLOBAL HEADER */}
              <GlobalHeader />

              {/* 4. MAIN CONTENT */}
              {children}

            </AuthProvider>
          </div>
        </MediaViewerProvider>
      </body>
    </html>
  );
}