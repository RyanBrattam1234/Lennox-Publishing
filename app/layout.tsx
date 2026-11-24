import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lennox Publishing – Galaxie Verlag",
  description: "Bücher, Geschichten und Neuigkeiten von Lennox Publishing.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
