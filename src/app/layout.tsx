import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { HeaderLogButton, Nav, SettingsLink, TabBar } from "@/components/Nav";
import { LogSheet } from "@/components/LogSheet";
import { LogoMark, PlusIcon } from "@/components/Icons";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
// Typefaces are bundled with the app (no request to Google, nothing blocks the first paint).
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.discomplete.com"),
  title: { default: "Discomplete", template: "%s · Discomplete" },
  description: "A music diary. Log what you listen to, remember how it felt, find what to play next.",
  applicationName: "Discomplete",
  appleWebApp: { capable: true, title: "Discomplete", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#131314",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getUser();
  return (
    <html lang="en">
      <head>
      </head>
      <body className={user ? "signed-in" : undefined}>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand" aria-label="Discomplete, go to your diary">
              <LogoMark />
              <span className="wordmark"><span>Disc</span>omplete</span>
            </Link>
            {user ? (
              <>
                <Nav />
                <HeaderLogButton>
                  <PlusIcon /> Log a listen
                </HeaderLogButton>
                <SettingsLink />
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
        {user ? <TabBar /> : null}
        {user ? <LogSheet /> : null}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
