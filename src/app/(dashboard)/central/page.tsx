'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { getDashboardKpis } from '@/lib/queries';
import { AGENTS, type AgentLog } from '@/types/database';
import { formatCurrencyShort } from '@/lib/utils';

const AUTO_REFRESH_MS = 30_000;

export default function CentralPage() {
  const [kpis, setKpis] = useState<{ mrr: number; activeCondos: number; conversations: number; totalLeads: number; totalSearchCost: number; alertas: number; agentLogs: AgentLog[] } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      const data = await getDashboardKpis();
      setKpis(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, AUTO_REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  if (loading) return <div className="text-[#475569] text-sm animate-pulse">Carregando TIBIA...</div>;

  if (loadError && !kpis) return (
    <div className="text-center py-10">
      <div className="text-[#ef4444] text-sm mb-2">Erro ao carregar dashboard</div>
      <div className="text-[#64748b] text-[11px] mb-3">{loadError}</div>
      <button onClick={refresh} className="px-4 py-2 bg-[#1e293b] text-[#94a3b8] text-[11px] rounded-lg hover:bg-[#334155]">
        Tentar novamente
      </button>
    </div>
  );

  if (!kpis) return (
    <div className="text-center py-10">
      <div className="text-[#94a3b8] text-sm mb-2">Nenhum dado disponivel</div>
      <button onClick={refresh} className="px-4 py-2 bg-[#1e293b] text-[#94a3b8] text-[11px] rounded-lg hover:bg-[#334155]">
        Atualizar
      </button>
    </div>
  );

  const kpiCards = [
    { label: 'MRR', value: formatCurrencyShort(kpis.mrr), color: '#4ade80' },
    { label: 'Condos Ativos', value: kpis.activeCondos, color: '#22d3ee' },
    { label: 'Conversas', value: kpis.conversations, color: '#a78bfa' },
    { label: 'Leads Hoje', value: kpis.totalLeads, color: '#fbbf24' },
    { label: 'Custo Buscas', value: `R$${kpis.totalSearchCost.toFixed(2).replace('.', ',')}`, color: '#f472b6' },
    { label: 'Alertas', value: kpis.alertas, color: '#fb923c' },
  ];

  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div>
      {/* Header with refresh controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-ping inline-block" />
          )}
          <span className="text-[10px] text-[#475569]">
            Ultima atualizacao: {timeStr}
          </span>
        </div>
        <button
          onClick={refresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155] hover:text-[#e2e8f0] transition-colors disabled:opacity-50 border border-[#1e293b]"
        >
          <span className={isRefreshing ? 'animate-spin inline-block' : 'inline-block'}>&#x21bb;</span>
          Atualizar
        </button>
      </div>

      <div className={`transition-opacity duration-500 ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}>
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
    </div>
  );
}
