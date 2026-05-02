'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tag } from '@/components/ui/tag';
import { getSearchLogs } from '@/lib/queries';
import type { SearchLog } from '@/types/database';

const CITIES = [
  'São Paulo',
  'Rio de Janeiro',
  'Belo Horizonte',
  'Curitiba',
  'Porto Alegre',
  'Campinas',
  'Salvador',
  'Goiânia',
  'Brasília',
  'Florianópolis',
];

export default function BuscasPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search trigger state
  const [city, setCity] = useState(CITIES[0]);
  const [minUnits, setMinUnits] = useState(80);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getSearchLogs()
      .then(setLogs)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.error('Error loading search logs:', msg);
        setLoadError(msg);
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Clear feedback after 8 seconds
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 8000);
    return () => clearTimeout(t);
  }, [feedback]);

  const handleRunHawkeye = async () => {
    setRunning(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/agents/hawkeye/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, minUnits }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        const r = data.results;
        if (r.newLeads === 0 && r.searched === 0) {
          setFeedback({
            type: 'error',
            message: `HAWKEYE rodou mas nenhum contato encontrado. Scrapers podem estar fora do ar. Erros: ${(r.errors || []).join('; ') || 'nenhum'}`,
          });
        } else {
          setFeedback({
            type: 'success',
            message: `HAWKEYE concluido: ${r.newLeads} novos leads, ${r.lokiQueued} agendados para LOKI. (${r.searched} contatos encontrados)`,
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: data.error || data.warning || 'Erro desconhecido ao rodar HAWKEYE.',
        });
      }

      // Refresh logs after search completes
      fetchLogs();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha de conexao com o servidor.',
      });
    } finally {
      setRunning(false);
    }
  };

  // Last search timestamp
  const lastSearchAt = logs.length > 0
    ? new Date(logs[0].created_at).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  if (loading && logs.length === 0 && !loadError) {
    return <div className="text-[#475569] text-sm animate-pulse">Carregando buscas...</div>;
  }

  const totalCost = logs.reduce((s, h) => s + Number(h.cost), 0);
  const totalResults = logs.reduce((s, h) => s + h.results_count, 0);
  const totalQualified = logs.reduce((s, h) => s + h.qualified_count, 0);

  const kpis = [
    { label: 'Buscas', value: logs.length, color: '#22d3ee' },
    { label: 'Resultados', value: totalResults, color: '#a78bfa' },
    { label: 'Qualificados', value: totalQualified, color: '#4ade80' },
    { label: 'Custo Total', value: `R$${totalCost.toFixed(2).replace('.', ',')}`, color: '#f472b6' },
    { label: 'Custo/Lead', value: totalQualified > 0 ? `R$${(totalCost / totalQualified).toFixed(2).replace('.', ',')}` : 'R$0,00', color: '#fbbf24' },
  ];

  return (
    <div>
      {/* ═══ SEARCH TRIGGER ═══ */}
      <Card className="mb-4 border border-[#334155]">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Cidade / Regiao</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              disabled={running}
              className="bg-[#0a0a14] text-[#e2e8f0] text-sm border border-[#334155] rounded-lg px-3 py-2 focus:outline-none focus:border-[#22d3ee] transition-colors"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">Min. Unidades</label>
            <input
              type="number"
              value={minUnits}
              onChange={(e) => setMinUnits(Number(e.target.value) || 0)}
              disabled={running}
              min={0}
              className="bg-[#0a0a14] text-[#e2e8f0] text-sm border border-[#334155] rounded-lg px-3 py-2 w-24 focus:outline-none focus:border-[#22d3ee] transition-colors"
            />
          </div>

          <button
            onClick={handleRunHawkeye}
            disabled={running}
            className={
              'px-5 py-2 rounded-lg text-sm font-bold transition-all ' +
              (running
                ? 'bg-[#334155] text-[#475569] cursor-wait'
                : 'bg-[#22c55e] hover:bg-[#16a34a] text-white cursor-pointer shadow-lg shadow-[#22c55e33]')
            }
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-[#475569] border-t-[#94a3b8] rounded-full animate-spin" />
                Buscando...
              </span>
            ) : (
              'Rodar HAWKEYE'
            )}
          </button>

          {lastSearchAt && (
            <div className="text-[10px] text-[#475569] sm:ml-auto self-center">
              Ultima busca: {lastSearchAt}
            </div>
          )}
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={
              'mt-3 px-3 py-2 rounded-lg text-xs font-medium ' +
              (feedback.type === 'success'
                ? 'bg-[#22c55e18] text-[#4ade80] border border-[#22c55e33]'
                : 'bg-[#ef444418] text-[#f87171] border border-[#ef444433]')
            }
          >
            {feedback.message}
          </div>
        )}
      </Card>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* ═══ SEARCH LOGS ═══ */}
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
