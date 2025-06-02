import Link from 'next/link';
import { LogoIcon } from '@/components/icons/LogoIcon';

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2 ml-4">
          <LogoIcon className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block text-lg">
            Article Library
          </span>
        </Link>
        {/* Future navigation items can go here */}
      </div>
    </header>
  );
}
