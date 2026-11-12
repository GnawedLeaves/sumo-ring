import type { Metadata } from "next";
import { Fraunces, Inter, Noto_Sans_JP } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
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
  title: "Sumo Hub",
  description: "Live streams, basho results, rikishi stats and sumo news.",
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
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
