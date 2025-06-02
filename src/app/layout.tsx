
import type {Metadata} from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Toaster } from "@/components/ui/toaster";
import { ClientSideBackgroundUpdater } from '@/components/layout/ClientSideBackgroundUpdater';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Article Library',
  description: 'View, search, and summarize your documents.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const serverBackgroundImageUrl = process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_URL || 'https://c4.wallpaperflare.com/wallpaper/526/8/1002/library-interior-interior-design-books-wallpaper-preview.jpg';

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} font-sans antialiased bg-cover bg-center bg-fixed`}
        style={{ backgroundImage: `url('${serverBackgroundImageUrl}')` }}
        data-ai-hint="library books classic study"
      >
        <ClientSideBackgroundUpdater />
        <div className="relative flex min-h-screen flex-col bg-background/80 text-foreground supports-[backdrop-filter]:bg-background/60 backdrop-blur-sm">
          <Header />
          <main className="flex-1">{children}</main>
          <footer
            className="w-full h-32 bg-no-repeat bg-cover"
            style={{
              backgroundImage: "url('https://placehold.co/1920x200.png/000000/DAA520?text=Ornamental+Footer+Border')",
              backgroundPosition: 'center top', // This helps to show the top part of your image
            }}
            data-ai-hint="ornate gold black border"
            aria-label="Decorative page footer"
          >
            {/* This footer is purely decorative. Content can be added if needed. */}
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
