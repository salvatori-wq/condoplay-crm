'use client';

import { useEffect, useState } from 'react';
import { Tag } from '@/components/ui/tag';
import { getCondos } from '@/lib/queries';

export function Header() {
  const [mrr, setMrr] = useState(0);

  useEffect(() => {
    getCondos().then(condos => {
      const total = condos.filter(c => c.status === 'ativo').reduce((s, c) => s + Number(c.monthly_plan), 0);
      setMrr(total);
    }).catch(console.error);
  }, []);

  return (
    <header className="h-[52px] bg-gradient-to-r from-[#0f172a] to-[#1a1040] border-b border-[#1e293b] flex items-center justify-between px-5 fixed top-0 left-[220px] right-0 z-10">
      <div className="text-[11px] text-[#475569]">
        <span className="inline-block w-2 h-2 rounded-full bg-[#4ade80] mr-2 animate-pulse"></span>
        TIBIA Online — {new Date().toLocaleDateString('pt-BR')}
      </div>
      <div className="flex gap-2">
        <Tag color="#4ade80">7 agentes</Tag>
        <Tag color="#22d3ee">MRR R${(mrr / 1000).toFixed(1)}k</Tag>
      </div>
    </header>
  );
}
