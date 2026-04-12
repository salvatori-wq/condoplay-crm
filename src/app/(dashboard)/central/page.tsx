'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { getDashboardKpis } from '@/lib/queries';
import { AGENTS, type AgentLog } from '@/types/database';
import { formatCurrencyShort } from '@/lib/utils';

export default function CentralPage() {
  const [kpis, setKpis] = useState<{ mrr: number; activeCondos: number; conversations: number; totalLeads: number; totalSearchCost: number; alertas: number; agentLogs: AgentLog[] } | null>(null);

  useEffect(() => {
    getDashboardKpis().then(setKpis).catch(console.error);
  }, []);

  if (!kpis) return <div className="text-[#475569] text-sm animate-pulse">Carregando TIBIA...</div>;

  const kpiCards = [
    { label: 'MRR', value: formatCurrencyShort(kpis.mrr), color: '#4ade80' },
    { label: 'Condos Ativos', value: kpis.activeCondos, color: '#22d3ee' },
    { label: 'Conversas', value: kpis.conversations, color: '#a78bfa' },
    { label: 'Leads Hoje', value: kpis.totalLeads, color: '#fbbf24' },
    { label: 'Custo Buscas', value: `R$${kpis.totalSearchCost.toFixed(2).replace('.', ',')}`, color: '#f472b6' },
    { label: 'Alertas', value: kpis.alertas, color: '#fb923c' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {kpiCards.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <Card>
        <div className="text-xs font-bold mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse inline-block"></span>
          Feed TIBIA — Tempo Real
        </div>
        <div className="space-y-0">
          {kpis.agentLogs.map((log) => {
            const agent = AGENTS[log.agent_type];
            const time = new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={log.id} className="flex gap-2 py-1.5 border-b border-[#0f172a] text-[11px] items-start">
                <span className="text-[#475569] w-9 shrink-0">{time}</span>
                <span className="text-[13px] w-5 shrink-0">{agent.icon}</span>
                <span className="font-bold w-[60px] shrink-0" style={{ color: agent.color }}>{agent.name}</span>
                <span className="text-[#94a3b8] flex-1">{log.action}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
