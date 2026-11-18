import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Noto_Sans_JP } from "next/font/google";
import { AuthProvider } from "@/components/account/auth-provider";
import { ServiceWorker } from "@/components/service-worker";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/site-nav";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  weight: ["400", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Sumo Ring",
  description: "Live streams, basho results, rikishi stats and sumo news.",
  applicationName: "Sumo Ring",
  appleWebApp: { capable: true, title: "Sumo Ring", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets the bottom nav sit above the iPhone home indicator via safe-area insets
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2ebe6" },
    { media: "(prefers-color-scheme: dark)", color: "#100d1c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${notoJp.variable} h-full antialiased`}
      // The inline script below may set data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Inline script, run before first paint: applies the saved theme (see lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Shared browser-side sign-in state (header avatar, comments, profile). Display only — the server re-checks. */}
        <AuthProvider>
          <SiteHeader />
          {/* Bottom padding keeps content clear of the fixed mobile tab bar. */}
          <main className="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
          <MobileNav />
        </AuthProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
