'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tag } from '@/components/ui/tag';
import { getCondos } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { Condo } from '@/types/database';

export default function CondosPage() {
  const [condos, setCondos] = useState<Condo[]>([]);
  const [condoStats, setCondoStats] = useState<Record<string, { jogos: number; fora: number; taxas: number }>>({});

  useEffect(() => {
    getCondos().then(async (c) => {
      setCondos(c);
      // Get condo_games and checkouts stats
      const stats: Record<string, { jogos: number; fora: number; taxas: number }> = {};
      for (const condo of c) {
        const { count: jogos } = await supabase.from('condo_games').select('*', { count: 'exact', head: true }).eq('condo_id', condo.id);
        const { count: fora } = await supabase.from('condo_games').select('*', { count: 'exact', head: true }).eq('condo_id', condo.id).eq('status', 'emprestado');
        const { data: ckData } = await supabase.from('checkouts').select('fee_charged').eq('condo_id', condo.id).is('checked_in_at', null);
        const taxas = (ckData || []).reduce((s, ck) => s + Number(ck.fee_charged), 0);
        stats[condo.id] = { jogos: jogos || 0, fora: fora || 0, taxas };
      }
      setCondoStats(stats);
    }).catch(console.error);
  }, []);

  if (condos.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando condominios...</div>;

  const mrr = condos.filter(c => c.status === 'ativo').reduce((s, c) => s + Number(c.monthly_plan), 0);
  const totalTaxas = Object.values(condoStats).reduce((s, d) => s + d.taxas, 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <KpiCard label="MRR Mensalidades" value={`R$${(mrr / 1000).toFixed(1)}k`} color="#4ade80" />
        <KpiCard label="Taxas extras mes" value={`R$${totalTaxas}`} color="#fbbf24" />
        <KpiCard label="Receita Total" value={`R$${((mrr + totalTaxas) / 1000).toFixed(1)}k`} color="#22d3ee" />
      </div>
      <Card>
        <table className="w-full border-collapse text-[11px]">
          <thead><tr>{['Condominio', 'Plano/mes', 'Status', 'Acervo', 'Fora', 'Taxas'].map(h => (
            <th key={h} className="p-2 text-left text-[#475569] text-[10px] border-b border-[#334155] font-semibold">{h}</th>
          ))}</tr></thead>
          <tbody>
            {condos.map(c => {
              const stat = condoStats[c.id] || { jogos: 0, fora: 0, taxas: 0 };
              return (
                <tr key={c.id} className="border-b border-[#0f172a22]">
                  <td className="p-2 font-semibold">{c.name}</td>
                  <td className="p-2 text-[#4ade80] font-bold">R${Number(c.monthly_plan).toLocaleString()}</td>
                  <td className="p-2"><Tag color={c.status === 'ativo' ? '#4ade80' : '#fbbf24'}>{c.status}</Tag></td>
                  <td className="p-2 text-[#94a3b8]">{stat.jogos}</td>
                  <td className="p-2" style={{ color: stat.fora > 0 ? '#fbbf24' : '#4ade80' }}>{stat.fora}</td>
                  <td className="p-2" style={{ color: stat.taxas === 0 ? '#4ade80' : '#f472b6' }}>R${stat.taxas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Card className="border-l-[3px] border-l-[#4ade80] p-3">
          <div className="text-[11px] font-bold text-[#4ade80] mb-1">Modelo de Receita</div>
          <div className="text-[11px] text-[#94a3b8] leading-relaxed">Mensalidade: R$1.500 a R$3.000/mes<br />+ Taxas extras: R$30/dia apos 24h<br />= Receita recorrente + variavel</div>
        </Card>
        <Card className="border-l-[3px] border-l-[#fbbf24] p-3">
          <div className="text-[11px] font-bold text-[#fbbf24] mb-1">Ciclo de Acervo</div>
          <div className="text-[11px] text-[#94a3b8] leading-relaxed">Troca a cada 4 meses<br />Conferencia completa na troca<br />VISION registra tudo</div>
        </Card>
      </div>
    </div>
  );
}
