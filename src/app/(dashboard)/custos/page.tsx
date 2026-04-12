'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { getSearchLogs } from '@/lib/queries';
import type { SearchLog } from '@/types/database';

export default function CustosPage() {
  const [logs, setLogs] = useState<SearchLog[]>([]);

  useEffect(() => {
    getSearchLogs().then(setLogs).catch(console.error);
  }, []);

  if (logs.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando custos...</div>;

  const totalCost = logs.reduce((s, h) => s + Number(h.cost), 0);
  const totalQualified = logs.reduce((s, h) => s + h.qualified_count, 0);

  // Group by source
  const bySource = logs.reduce<Record<string, { cost: number; results: number; qualified: number; searches: number }>>((acc, h) => {
    if (!acc[h.source]) acc[h.source] = { cost: 0, results: 0, qualified: 0, searches: 0 };
    acc[h.source].cost += Number(h.cost);
    acc[h.source].results += h.results_count;
    acc[h.source].qualified += h.qualified_count;
    acc[h.source].searches += 1;
    return acc;
  }, {});

  const sources = Object.entries(bySource).sort((a, b) => b[1].qualified - a[1].qualified);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <KpiCard label="Custo Total" value={`R$${totalCost.toFixed(2).replace('.', ',')}`} color="#f472b6" />
        <KpiCard label="Leads Qualificados" value={totalQualified} color="#4ade80" />
        <KpiCard label="Custo/Lead" value={`R$${(totalQualified > 0 ? totalCost / totalQualified : 0).toFixed(2).replace('.', ',')}`} color="#fbbf24" />
        <KpiCard label="Fontes Usadas" value={sources.length} color="#22d3ee" />
      </div>

      <div className="text-xs font-bold text-[#22d3ee] mb-2">📊 Breakdown por Fonte</div>
      <div className="space-y-2">
        {sources.map(([source, data]) => {
          const costPerLead = data.qualified > 0 ? data.cost / data.qualified : 0;
          const convRate = data.results > 0 ? ((data.qualified / data.results) * 100).toFixed(0) : '0';
          const barWidth = totalQualified > 0 ? (data.qualified / totalQualified) * 100 : 0;

          return (
            <Card key={source} className="p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="text-xs font-bold text-[#e2e8f0]">{source}</div>
                <div className="text-[10px] text-[#64748b]">{data.searches} buscas</div>
              </div>

              {/* Bar */}
              <div className="w-full h-2 bg-[#0f172a] rounded-full mb-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#4ade80]"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <div className="text-[9px] text-[#475569]">Resultados</div>
                  <div className="text-xs font-bold text-[#a78bfa]">{data.results}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569]">Qualificados</div>
                  <div className="text-xs font-bold text-[#4ade80]">{data.qualified}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569]">Custo</div>
                  <div className="text-xs font-bold" style={{ color: data.cost === 0 ? '#4ade80' : '#fbbf24' }}>
                    R${data.cost.toFixed(2).replace('.', ',')}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-[#475569]">Custo/Lead</div>
                  <div className="text-xs font-bold" style={{ color: costPerLead === 0 ? '#4ade80' : '#f472b6' }}>
                    R${costPerLead.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              </div>

              <div className="mt-1 text-[9px] text-[#475569]">
                Taxa conversao: <span className="text-[#22d3ee] font-bold">{convRate}%</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
