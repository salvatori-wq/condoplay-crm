'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tag } from '@/components/ui/tag';
import { supabase } from '@/lib/supabase';
import type { Condo, CondoStatus } from '@/types/database';

const STATUS_OPTIONS: { value: CondoStatus; label: string; color: string }[] = [
  { value: 'ativo', label: 'Ativo', color: '#4ade80' },
  { value: 'implantacao', label: 'Implantacao', color: '#fbbf24' },
  { value: 'pausado', label: 'Pausado', color: '#94a3b8' },
  { value: 'cancelado', label: 'Cancelado', color: '#f87171' },
];

function statusColor(s: CondoStatus) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.color ?? '#94a3b8';
}

// ═══ MODAL COMPONENT ═══
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#1e293b] rounded-xl p-6 w-full max-w-lg mx-4 border border-[#334155] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ═══ FORM FIELDS ═══
interface CondoForm {
  name: string;
  units: string;
  monthly_plan: string;
  status: CondoStatus;
  address: string;
}

const emptyForm: CondoForm = { name: '', units: '', monthly_plan: '', status: 'implantacao', address: '' };

function condoToForm(c: Condo): CondoForm {
  return {
    name: c.name,
    units: c.units?.toString() ?? '',
    monthly_plan: c.monthly_plan?.toString() ?? '0',
    status: c.status,
    address: c.address ?? '',
  };
}

function FormFields({ form, onChange }: { form: CondoForm; onChange: (f: CondoForm) => void }) {
  const set = (key: keyof CondoForm, val: string) => onChange({ ...form, [key]: val });
  const inputClass =
    'w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] focus:outline-none focus:border-[#4ade80] transition-colors';
  const labelClass = 'block text-[11px] font-semibold text-[#94a3b8] mb-1';

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>Nome do Condominio *</label>
        <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Residencial das Flores" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Unidades</label>
          <input className={inputClass} type="number" value={form.units} onChange={(e) => set('units', e.target.value)} placeholder="150" />
        </div>
        <div>
          <label className={labelClass}>Plano Mensal (R$)</label>
          <input className={inputClass} type="number" value={form.monthly_plan} onChange={(e) => set('monthly_plan', e.target.value)} placeholder="2000" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value as CondoStatus)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Endereco</label>
        <input className={inputClass} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rua..." />
      </div>
    </div>
  );
}

// ═══ MAIN PAGE ═══
export default function CondosPage() {
  const [condos, setCondos] = useState<Condo[]>([]);
  const [condoStats, setCondoStats] = useState<Record<string, { jogos: number; fora: number; taxas: number }>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editCondo, setEditCondo] = useState<Condo | null>(null);
  const [form, setForm] = useState<CondoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchCondos = useCallback(async () => {
    try {
      const res = await fetch('/api/condos');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCondos(data);
        // Fetch stats
        const stats: Record<string, { jogos: number; fora: number; taxas: number }> = {};
        for (const condo of data as Condo[]) {
          const { count: jogos } = await supabase.from('condo_games').select('*', { count: 'exact', head: true }).eq('condo_id', condo.id);
          const { count: fora } = await supabase.from('condo_games').select('*', { count: 'exact', head: true }).eq('condo_id', condo.id).eq('status', 'emprestado');
          const { data: ckData } = await supabase.from('checkouts').select('fee_charged').eq('condo_id', condo.id).is('checked_in_at', null);
          const taxas = (ckData || []).reduce((s, ck) => s + Number(ck.fee_charged), 0);
          stats[condo.id] = { jogos: jogos || 0, fora: fora || 0, taxas };
        }
        setCondoStats(stats);
      }
    } catch (err) {
      console.error('Failed to fetch condos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCondos();
  }, [fetchCondos]);

  // ═══ CRUD handlers ═══
  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/condos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          units: form.units ? Number(form.units) : null,
          monthly_plan: form.monthly_plan ? Number(form.monthly_plan) : 0,
          status: form.status,
          address: form.address.trim() || null,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setForm(emptyForm);
        await fetchCondos();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editCondo || !form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/condos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editCondo.id,
          name: form.name.trim(),
          units: form.units ? Number(form.units) : null,
          monthly_plan: form.monthly_plan ? Number(form.monthly_plan) : 0,
          status: form.status,
          address: form.address.trim() || null,
        }),
      });
      if (res.ok) {
        setEditCondo(null);
        setForm(emptyForm);
        await fetchCondos();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editCondo) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/condos?id=${editCondo.id}`, { method: 'DELETE' });
      if (res.ok) {
        setEditCondo(null);
        setConfirmDelete(false);
        setForm(emptyForm);
        await fetchCondos();
      }
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (c: Condo) => {
    setEditCondo(c);
    setForm(condoToForm(c));
    setConfirmDelete(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setShowCreate(true);
  };

  // ═══ RENDER ═══
  if (loading) return <div className="text-[#475569] text-sm animate-pulse">Carregando condominios...</div>;

  const mrr = condos.filter((c) => c.status === 'ativo').reduce((s, c) => s + Number(c.monthly_plan), 0);
  const totalTaxas = Object.values(condoStats).reduce((s, d) => s + d.taxas, 0);

  const btnPrimary =
    'px-4 py-2 rounded-lg text-sm font-semibold bg-[#4ade80] text-[#0f172a] hover:bg-[#22c55e] transition-colors disabled:opacity-50';
  const btnSecondary =
    'px-4 py-2 rounded-lg text-sm font-semibold bg-[#334155] text-[#e2e8f0] hover:bg-[#475569] transition-colors';
  const btnDanger =
    'px-4 py-2 rounded-lg text-sm font-semibold bg-[#dc2626] text-white hover:bg-[#b91c1c] transition-colors disabled:opacity-50';

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <KpiCard label="MRR Mensalidades" value={`R$${(mrr / 1000).toFixed(1)}k`} color="#4ade80" />
        <KpiCard label="Taxas extras mes" value={`R$${totalTaxas}`} color="#fbbf24" />
        <KpiCard label="Receita Total" value={`R$${((mrr + totalTaxas) / 1000).toFixed(1)}k`} color="#22d3ee" />
      </div>

      {/* Header + Add button */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-[#475569] font-semibold">{condos.length} condominios</div>
        <button className={btnPrimary} onClick={openCreate}>+ Novo Condominio</button>
      </div>

      {/* Table */}
      <Card>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {['Condominio', 'Plano/mes', 'Status', 'Acervo', 'Fora', 'Taxas'].map((h) => (
                <th key={h} className="p-2 text-left text-[#475569] text-[10px] border-b border-[#334155] font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {condos.map((c) => {
              const stat = condoStats[c.id] || { jogos: 0, fora: 0, taxas: 0 };
              return (
                <tr
                  key={c.id}
                  className="border-b border-[#0f172a22] cursor-pointer hover:bg-[#334155]/40 transition-colors"
                  onClick={() => openEdit(c)}
                >
                  <td className="p-2 font-semibold">{c.name}</td>
                  <td className="p-2 text-[#4ade80] font-bold">R${Number(c.monthly_plan).toLocaleString()}</td>
                  <td className="p-2"><Tag color={statusColor(c.status)}>{c.status}</Tag></td>
                  <td className="p-2 text-[#94a3b8]">{stat.jogos}</td>
                  <td className="p-2" style={{ color: stat.fora > 0 ? '#fbbf24' : '#4ade80' }}>{stat.fora}</td>
                  <td className="p-2" style={{ color: stat.taxas === 0 ? '#4ade80' : '#f472b6' }}>R${stat.taxas}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Info cards */}
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

      {/* CREATE MODAL */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <h2 className="text-lg font-bold text-[#e2e8f0] mb-4">Novo Condominio</h2>
        <FormFields form={form} onChange={setForm} />
        <div className="flex gap-2 mt-5 justify-end">
          <button className={btnSecondary} onClick={() => setShowCreate(false)}>Cancelar</button>
          <button className={btnPrimary} onClick={handleCreate} disabled={saving || !form.name.trim()}>
            {saving ? 'Salvando...' : 'Criar'}
          </button>
        </div>
      </Modal>

      {/* EDIT / DETAIL MODAL */}
      <Modal open={!!editCondo} onClose={() => { setEditCondo(null); setConfirmDelete(false); }}>
        <h2 className="text-lg font-bold text-[#e2e8f0] mb-4">Editar Condominio</h2>
        <FormFields form={form} onChange={setForm} />

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="mt-4 p-3 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg">
            <p className="text-sm text-[#f87171] mb-2">Tem certeza que deseja excluir este condominio? Esta acao nao pode ser desfeita.</p>
            <div className="flex gap-2">
              <button className={btnDanger} onClick={handleDelete} disabled={saving}>
                {saving ? 'Excluindo...' : 'Confirmar exclusao'}
              </button>
              <button className={btnSecondary} onClick={() => setConfirmDelete(false)}>Cancelar</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-5 justify-between">
          <button className={btnDanger} onClick={() => setConfirmDelete(true)} disabled={saving || confirmDelete}>
            Excluir
          </button>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => { setEditCondo(null); setConfirmDelete(false); }}>Cancelar</button>
            <button className={btnPrimary} onClick={handleUpdate} disabled={saving || !form.name.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
