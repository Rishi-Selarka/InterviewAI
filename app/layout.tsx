import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IntelliInterview",
  description: "Live technical interviews with a smart coding room.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the theme from a cookie SERVER-SIDE so React owns the data-theme
  // attribute. This is what makes the choice survive full reloads and OAuth
  // redirects (the previous localStorage-only approach could revert). Default is
  // LIGHT — only an explicit cookie of 'dark' switches to dark.
  const cookieTheme = (await cookies()).get('intelli_theme')?.value;
  const theme = cookieTheme === 'dark' ? 'dark' : 'light';

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Legacy migration: if there's no theme cookie yet but an older
            localStorage preference exists, honour it and write the cookie so the
            server agrees on the next render. Runs before paint, so no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!/(?:^|; )intelli_theme=/.test(document.cookie)){var ls=localStorage.getItem('intelli_theme');if(ls==='light'||ls==='dark'){document.documentElement.setAttribute('data-theme',ls);document.cookie='intelli_theme='+ls+'; path=/; max-age=31536000; samesite=lax';}}}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
