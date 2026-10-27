import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { LogoMark, PlusIcon } from "@/components/Icons";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Discomplete", template: "%s · Discomplete" },
  description: "A music diary. Log what you listen to, remember how it felt, find what to play next.",
};

export const viewport: Viewport = { themeColor: "#131314" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getUser();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand" aria-label="Discomplete, go to your diary">
              <LogoMark />
              <span className="wordmark"><span>Disc</span>omplete</span>
            </Link>
            {user ? (
              <>
                <Nav />
                <Link href="/log" className="btn btn-primary">
                  <PlusIcon /> Log a listen
                </Link>
              </>
            ) : null}
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p>Discomplete · record data and artwork from Deezer</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
