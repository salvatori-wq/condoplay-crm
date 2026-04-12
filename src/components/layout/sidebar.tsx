'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/central',    label: 'Central',     icon: '🧠' },
  { href: '/conversas',  label: 'Conversas',   icon: '💬' },
  { href: '/buscas',     label: 'Buscas',      icon: '🏹' },
  { href: '/pipeline',   label: 'Pipeline',    icon: '🔱' },
  { href: '/condos',     label: 'Condominios', icon: '🏢' },
  { href: '/checkout',   label: 'Checkout',    icon: '🎲' },
  { href: '/financeiro', label: 'Financeiro',  icon: '💎' },
  { href: '/instagram',  label: 'Instagram',   icon: '⚡' },
  { href: '/custos',     label: 'Custos',      icon: '📊' },
  { href: '/config',     label: 'Config',      icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] bg-[#0c0c18] border-r border-[#1e293b] flex flex-col h-screen fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="p-4 border-b border-[#1e293b]">
        <Link href="/central" className="flex items-center gap-2.5">
          <span className="text-2xl">🎮</span>
          <div>
            <div className="text-[17px] font-extrabold tracking-[2px] text-[#22d3ee]">CONDO PLAY</div>
            <div className="text-[9px] text-[#475569] tracking-[3px]">TIBIA ENGINE v4</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-[12px] font-semibold transition-colors',
                active
                  ? 'bg-[#1e293b] text-[#22d3ee] border-r-2 border-[#22d3ee]'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#0f172a]'
              )}
            >
              <span className="text-[14px] w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#1e293b] text-[9px] text-[#334155]">
        7 agentes ativos
      </div>
    </aside>
  );
}
