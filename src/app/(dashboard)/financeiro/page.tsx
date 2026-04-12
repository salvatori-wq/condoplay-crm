'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tag } from '@/components/ui/tag';
import { getInvoices, getCondos, getSearchLogs } from '@/lib/queries';
import type { Invoice, Condo, SearchLog } from '@/types/database';

export default function FinanceiroPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [condos, setCondos] = useState<Condo[]>([]);
  const [searchLogs, setSearchLogs] = useState<SearchLog[]>([]);

  useEffect(() => {
    Promise.all([getInvoices(), getCondos(), getSearchLogs()])
      .then(([inv, c, sl]) => { setInvoices(inv); setCondos(c); setSearchLogs(sl); })
      .catch(console.error);
  }, []);

  if (invoices.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando financeiro...</div>;

  const mrr = condos.filter(c => c.status === 'ativo').reduce((s, c) => s + Number(c.monthly_plan), 0);
  const currentInvoices = invoices.filter(i => i.month === '2026-04');
  const totalTaxas = currentInvoices.reduce((s, i) => s + Number(i.extra_fees), 0);
  const totalCostProsp = searchLogs.reduce((s, h) => s + Number(h.cost), 0);

  const kpis = [
    { label: 'MRR', value: `R$${(mrr / 1000).toFixed(1)}k`, color: '#4ade80' },
    { label: 'Taxas Extras', value: `R$${totalTaxas}`, color: '#fbbf24' },
    { label: 'Custo Prospecao', value: `R$${totalCostProsp.toFixed(2).replace('.', ',')}`, color: '#f472b6' },
    { label: 'Lucro Bruto', value: `R$${((mrr + totalTaxas - totalCostProsp) / 1000).toFixed(1)}k`, color: '#22d3ee' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      <Card>
        <div className="text-xs font-bold mb-3 text-[#4ade80]">💎 STARK — Fechamento Mensal (Abr/26)</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {['Condominio', 'Mensalidade', 'Taxas', 'Total', 'Status'].map(h => (
                <th key={h} className="p-2 text-left text-[#475569] text-[10px] border-b border-[#334155]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentInvoices.map(inv => {
              const condo = condos.find(c => c.id === inv.condo_id);
              return (
                <tr key={inv.id}>
                  <td className="p-2 font-semibold">{condo?.name}</td>
                  <td className="p-2 text-[#4ade80]">R${Number(inv.plan_amount).toLocaleString()}</td>
                  <td className="p-2" style={{ color: Number(inv.extra_fees) > 0 ? '#fbbf24' : '#4ade80' }}>R${Number(inv.extra_fees)}</td>
                  <td className="p-2 text-[#22d3ee] font-bold">R${Number(inv.total).toLocaleString()}</td>
                  <td className="p-2"><Tag color={inv.status === 'pago' ? '#4ade80' : '#fbbf24'}>{inv.status === 'pago' ? 'Pago ✅' : inv.status}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* History */}
      <Card className="mt-3">
        <div className="text-xs font-bold mb-3 text-[#a78bfa]">📊 Historico</div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {['Mes', 'Condominio', 'Total', 'Status'].map(h => (
                <th key={h} className="p-2 text-left text-[#475569] text-[10px] border-b border-[#334155]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.filter(i => i.month !== '2026-04').map(inv => {
              const condo = condos.find(c => c.id === inv.condo_id);
              return (
                <tr key={inv.id}>
                  <td className="p-2 text-[#94a3b8]">{inv.month}</td>
                  <td className="p-2 font-semibold">{condo?.name}</td>
                  <td className="p-2 text-[#22d3ee] font-bold">R${Number(inv.total).toLocaleString()}</td>
                  <td className="p-2"><Tag color="#4ade80">{inv.status}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
