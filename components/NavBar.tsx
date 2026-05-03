import Link from 'next/link';
import { Mountain } from 'lucide-react';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/hikes', label: 'All Hikes' },
  { href: '/trails', label: 'Trails' },
  { href: '/map', label: 'Map' },
  { href: '/import', label: 'Import' },
];

export default function NavBar() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-green-700 text-lg mr-4">
          <Mountain className="w-5 h-5" />
          TrailTracker
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm font-medium text-gray-600 hover:text-green-700 transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
