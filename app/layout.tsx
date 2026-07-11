import type { Metadata } from "next";
import { Geist, Space_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Agent",
  description: "AI hotel operations agent for Lamasoo rate-plan price updates",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn("dark", spaceGrotesk.variable, "font-sans", geist.variable)}
    >
      <body
        className="min-h-screen bg-[#020617] font-sans text-slate-200 antialiased selection:bg-cyan-900 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
