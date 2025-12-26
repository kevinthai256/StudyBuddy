import type { Metadata } from "next";
import { Jua } from "next/font/google";
import "./globals.css";
import AppShell from './components/AppShell';

const jua = Jua({
  variable: "--font-jua",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Study Buddy",
  description: "Study Buddy - Your Personal Study Companion",
  themeColor: '#0f172a',
  icons: {
    icon: '/web-app-manifest-192x192.png',
    shortcut: '/web-app-manifest-192x192.png',
    apple: '/web-app-manifest-192x192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${jua.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
