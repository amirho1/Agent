import type {Metadata} from 'next';
import { Inter, Space_Grotesk, Geist } from 'next/font/google';
import './globals.css';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'AI Operations Agent',
  description: 'AI-powered operations panel for business management',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("dark", spaceGrotesk.variable, "font-sans", geist.variable)}>
      <body className="antialiased bg-[#020617] text-slate-200 font-sans selection:bg-cyan-900 selection:text-white min-h-screen flex flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
