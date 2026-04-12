'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tag } from '@/components/ui/tag';
import { getSearchLogs } from '@/lib/queries';
import type { SearchLog } from '@/types/database';

export default function BuscasPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SearchLog[]>([]);

  useEffect(() => { getSearchLogs().then(setLogs).catch(console.error); }, []);

  if (logs.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando buscas...</div>;

  const totalCost = logs.reduce((s, h) => s + Number(h.cost), 0);
  const totalResults = logs.reduce((s, h) => s + h.results_count, 0);
  const totalQualified = logs.reduce((s, h) => s + h.qualified_count, 0);

  const kpis = [
    { label: 'Buscas', value: logs.length, color: '#22d3ee' },
    { label: 'Resultados', value: totalResults, color: '#a78bfa' },
    { label: 'Qualificados', value: totalQualified, color: '#4ade80' },
    { label: 'Custo Total', value: `R$${totalCost.toFixed(2).replace('.', ',')}`, color: '#f472b6' },
    { label: 'Custo/Lead', value: `R$${(totalCost / totalQualified).toFixed(2).replace('.', ',')}`, color: '#fbbf24' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>
      <div className="space-y-2">
        {logs.map(h => {
          const time = new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const cost = Number(h.cost);
          const leads = Array.isArray(h.leads_found) ? h.leads_found : JSON.parse(h.leads_found as unknown as string || '[]');
          return (
            <Card key={h.id} className="border-l-[3px] border-l-[#22d3ee] cursor-pointer p-3" onClick={() => setOpenId(openId === h.id ? null : h.id)}>
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex gap-2 items-center">
                  <span className="text-[#475569] text-[10px]">{time}</span>
                  <Tag color="#22d3ee">{h.source}</Tag>
                  <span className="text-[11px] text-[#94a3b8]">{h.query}</span>
                </div>
                <div className="flex gap-3">
                  <span className="text-[11px] text-[#4ade80] font-bold">{h.qualified_count} qualif.</span>
                  <span className={`text-[11px] font-bold ${cost === 0 ? 'text-[#4ade80]' : 'text-[#fbbf24]'}`}>R${cost.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
              {openId === h.id && (
                <div className="mt-2 pt-2 border-t border-[#334155]">
                  {leads.map((l: string, i: number) => (
                    <div key={i} className="text-[11px] text-[#e2e8f0] py-0.5 pl-2 border-l-2 border-[#22d3ee44]">→ {l}</div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
