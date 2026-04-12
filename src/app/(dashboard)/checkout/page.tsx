'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tag } from '@/components/ui/tag';
import { getCheckouts } from '@/lib/queries';
import { hoursElapsed, calculateFee } from '@/lib/utils';
import type { Checkout } from '@/types/database';

function TimerBadge({ checkedOutAt }: { checkedOutAt: string }) {
  const [hours, setHours] = useState(hoursElapsed(checkedOutAt));

  useEffect(() => {
    const interval = setInterval(() => setHours(hoursElapsed(checkedOutAt)), 60000);
    return () => clearInterval(interval);
  }, [checkedOutAt]);

  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const over = hours > 24;
  const warning = hours > 20;

  return (
    <span className={`text-xs font-mono font-bold ${over ? 'text-[#ef4444]' : warning ? 'text-[#fbbf24]' : 'text-[#4ade80]'}`}>
      {h}h{m.toString().padStart(2, '0')}m
      {over && ' ⚠️'}
    </span>
  );
}

export default function CheckoutPage() {
  const [checkouts, setCheckouts] = useState<(Checkout & { condo: { name: string } })[]>([]);

  useEffect(() => {
    getCheckouts().then(setCheckouts).catch(console.error);
  }, []);

  if (checkouts.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando checkouts...</div>;

  const open = checkouts.filter(c => !c.checked_in_at);
  const returned = checkouts.filter(c => c.checked_in_at);
  const totalFees = checkouts.reduce((s, c) => {
    if (!c.checked_in_at) {
      return s + calculateFee(hoursElapsed(c.checked_out_at));
    }
    return s + Number(c.fee_charged);
  }, 0);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <KpiCard label="Emprestados" value={open.length} color="#fbbf24" />
        <KpiCard label="Devolvidos Hoje" value={returned.length} color="#4ade80" />
        <KpiCard label="Taxas Geradas" value={`R$${totalFees}`} color="#f472b6" />
        <KpiCard label="Total Checkouts" value={checkouts.length} color="#22d3ee" />
      </div>

      {/* Open checkouts */}
      <div className="text-xs font-bold text-[#fbbf24] mb-2">🎲 Em Andamento</div>
      <div className="space-y-2 mb-4">
        {open.map(ck => {
          const condoName = ck.condo?.name || 'Condo';
          const hrs = hoursElapsed(ck.checked_out_at);
          const fee = calculateFee(hrs);
          return (
            <Card key={ck.id} className="flex items-center justify-between p-3 border-l-[3px]" style={{ borderLeftColor: hrs > 24 ? '#ef4444' : hrs > 20 ? '#fbbf24' : '#4ade80' }}>
              <div>
                <div className="text-xs font-bold">{ck.resident_name} — Apto {ck.apt}</div>
                <div className="text-[10px] text-[#64748b]">{condoName}</div>
              </div>
              <div className="flex items-center gap-4">
                <TimerBadge checkedOutAt={ck.checked_out_at} />
                {fee > 0 && <Tag color="#ef4444">R${fee}</Tag>}
                <Tag color={hrs > 24 ? '#ef4444' : '#4ade80'}>{hrs > 24 ? 'Atrasado' : 'No prazo'}</Tag>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Returned */}
      <div className="text-xs font-bold text-[#4ade80] mb-2">Devolvidos</div>
      <Card>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr>
              {['Morador', 'Apto', 'Retirada', 'Devolucao', 'Horas', 'Taxa'].map(h => (
                <th key={h} className="p-2 text-left text-[#475569] text-[10px] border-b border-[#334155]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returned.map(ck => (
              <tr key={ck.id}>
                <td className="p-2 font-semibold">{ck.resident_name}</td>
                <td className="p-2 text-[#94a3b8]">{ck.apt}</td>
                <td className="p-2 text-[#94a3b8]">{new Date(ck.checked_out_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td>
                <td className="p-2 text-[#94a3b8]">{ck.checked_in_at ? new Date(ck.checked_in_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}</td>
                <td className="p-2 text-[#94a3b8]">{ck.hours_elapsed ? Number(ck.hours_elapsed).toFixed(1) : '—'}h</td>
                <td className="p-2" style={{ color: Number(ck.fee_charged) > 0 ? '#f472b6' : '#4ade80' }}>
                  R${Number(ck.fee_charged)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
