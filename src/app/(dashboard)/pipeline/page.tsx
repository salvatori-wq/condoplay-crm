'use client';

import { useEffect, useState, useCallback } from 'react';
import { LEAD_STATUS_CONFIG, type LeadStatus, type Lead } from '@/types/database';

// ═══ TYPES ═══
type ModalMode = 'closed' | 'detail' | 'create';

interface CreateForm {
  name: string;
  phone: string;
  condoName: string;
  units: string;
  city: string;
  source: string;
}

const EMPTY_FORM: CreateForm = { name: '', phone: '', condoName: '', units: '', city: '', source: '' };

const PIPELINE_ORDER: LeadStatus[] = ['prospectado', 'em_contato', 'reuniao', 'proposta', 'fechado', 'perdido'];

// ═══ MAIN PAGE ═══
export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Inline editing state
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ═══ API HELPERS ═══
  const createLead = async () => {
    if (!createForm.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        setModalMode('closed');
        setCreateForm(EMPTY_FORM);
        await fetchLeads();
      }
    } catch (err) {
      console.error('Erro ao criar lead:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateLead = async (id: string, updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads(prev => prev.map(l => (l.id === id ? updated : l)));
        setSelectedLead(updated);
      }
    } catch (err) {
      console.error('Erro ao atualizar lead:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== id));
        setModalMode('closed');
        setSelectedLead(null);
        setConfirmDelete(false);
      }
    } catch (err) {
      console.error('Erro ao deletar lead:', err);
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsApp = async (phone: string) => {
    try {
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
    } catch (err) {
      console.error('Erro ao enviar WhatsApp:', err);
    }
  };

  // ═══ INLINE EDIT HELPERS ═══
  const startEdit = (field: string, value: string) => {
    setEditField(field);
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!selectedLead || !editField) return;

    // Handle metadata fields
    if (['condoName', 'units', 'city'].includes(editField)) {
      const newMeta = { ...(selectedLead.metadata || {}) };
      newMeta[editField] = editField === 'units' ? Number(editValue) || 0 : editValue;
      await updateLead(selectedLead.id, { metadata: newMeta });
    } else {
      await updateLead(selectedLead.id, { [editField]: editValue });
    }
    setEditField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditField(null);
    setEditValue('');
  };

  // ═══ FILTER LEADS CLIENT-SIDE for metadata search ═══
  const filteredLeads = search
    ? leads.filter(l => {
        const q = search.toLowerCase();
        const meta = l.metadata || {};
        return (
          l.name.toLowerCase().includes(q) ||
          (l.phone && l.phone.toLowerCase().includes(q)) ||
          (meta.condoName && String(meta.condoName).toLowerCase().includes(q))
        );
      })
    : leads;

  const grouped = PIPELINE_ORDER.map(status => ({
    status,
    config: LEAD_STATUS_CONFIG[status],
    leads: filteredLeads.filter(l => l.status === status),
  }));

  // ═══ RENDER ═══
  return (
    <div className="space-y-4">
      {/* HEADER BAR */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por nome, condominio, telefone..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-4 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#6366f1] transition-colors"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(''); setSearch(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#e2e8f0] text-xs"
            >
              X
            </button>
          )}
        </div>
        <button
          onClick={() => { setModalMode('create'); setCreateForm(EMPTY_FORM); }}
          className="bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          + Novo Lead
        </button>
      </div>

      {/* LOADING */}
      {loading && (
        <div className="text-[#475569] text-sm animate-pulse">Carregando pipeline...</div>
      )}

      {/* KANBAN COLUMNS */}
      {!loading && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {grouped.map(col => (
            <div
              key={col.status}
              className="min-w-[200px] flex-1 bg-[#1e293b] rounded-[10px] p-3"
              style={{ borderTop: `3px solid ${col.config.color}` }}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-[11px] font-bold flex items-center gap-1"
                  style={{ color: col.config.color }}
                >
                  {col.config.icon} {col.config.label}
                </div>
                <span
                  className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: col.config.color + '22', color: col.config.color }}
                >
                  {col.leads.length}
                </span>
              </div>

              {/* Lead Cards */}
              <div className="space-y-1.5">
                {col.leads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => { setSelectedLead(lead); setModalMode('detail'); setConfirmDelete(false); setEditField(null); }}
                    className="w-full text-left bg-[#0f172a] hover:bg-[#162033] rounded-md p-2.5 transition-colors cursor-pointer border border-transparent hover:border-[#334155]"
                  >
                    <div className="text-[11px] font-semibold text-[#e2e8f0] truncate">{lead.name}</div>
                    {lead.metadata?.condoName ? (
                      <div className="text-[9px] text-[#94a3b8] mt-0.5 truncate">
                        {String(lead.metadata.condoName)}
                      </div>
                    ) : null}
                    {lead.phone && (
                      <div className="text-[9px] text-[#64748b] mt-0.5">{lead.phone}</div>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      <span
                        className="text-[8px] font-semibold rounded px-1.5 py-0.5"
                        style={{ backgroundColor: col.config.color + '22', color: col.config.color }}
                      >
                        {col.config.label}
                      </span>
                      {lead.source && (
                        <span className="text-[8px] text-[#475569]">via {lead.source}</span>
                      )}
                    </div>
                  </button>
                ))}
                {col.leads.length === 0 && (
                  <div className="text-[10px] text-[#334155] text-center py-4">Nenhum lead</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MODAL OVERLAY ═══ */}
      {modalMode !== 'closed' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setModalMode('closed'); setEditField(null); setConfirmDelete(false); }}
        >
          <div
            className="bg-[#0f172a] border border-[#1e293b] rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* ═══ CREATE MODAL ═══ */}
            {modalMode === 'create' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#e2e8f0]">Novo Lead</h2>
                  <button
                    onClick={() => setModalMode('closed')}
                    className="text-[#475569] hover:text-[#e2e8f0] text-lg"
                  >
                    X
                  </button>
                </div>

                <div className="space-y-3">
                  <FormField label="Nome *" value={createForm.name} onChange={v => setCreateForm(f => ({ ...f, name: v }))} placeholder="Nome do contato" />
                  <FormField label="Telefone" value={createForm.phone} onChange={v => setCreateForm(f => ({ ...f, phone: v }))} placeholder="(11) 99999-9999" />
                  <FormField label="Condominio" value={createForm.condoName} onChange={v => setCreateForm(f => ({ ...f, condoName: v }))} placeholder="Nome do condominio" />
                  <FormField label="Unidades" value={createForm.units} onChange={v => setCreateForm(f => ({ ...f, units: v }))} placeholder="Ex: 200" type="number" />
                  <FormField label="Cidade" value={createForm.city} onChange={v => setCreateForm(f => ({ ...f, city: v }))} placeholder="Sao Paulo" />
                  <FormField label="Fonte" value={createForm.source} onChange={v => setCreateForm(f => ({ ...f, source: v }))} placeholder="Instagram, indicacao, etc." />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setModalMode('closed')}
                    className="flex-1 bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={createLead}
                    disabled={saving || !createForm.name.trim()}
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] disabled:bg-[#334155] disabled:text-[#475569] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                  >
                    {saving ? 'Salvando...' : 'Criar Lead'}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ DETAIL MODAL ═══ */}
            {modalMode === 'detail' && selectedLead && (
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#e2e8f0]">Detalhes do Lead</h2>
                  <button
                    onClick={() => { setModalMode('closed'); setEditField(null); setConfirmDelete(false); }}
                    className="text-[#475569] hover:text-[#e2e8f0] text-lg"
                  >
                    X
                  </button>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#64748b] uppercase tracking-wide">Status:</span>
                  <span
                    className="text-xs font-bold rounded-full px-2.5 py-1"
                    style={{
                      backgroundColor: LEAD_STATUS_CONFIG[selectedLead.status].color + '22',
                      color: LEAD_STATUS_CONFIG[selectedLead.status].color,
                    }}
                  >
                    {LEAD_STATUS_CONFIG[selectedLead.status].icon} {LEAD_STATUS_CONFIG[selectedLead.status].label}
                  </span>
                </div>

                {/* Editable Fields */}
                <div className="space-y-3">
                  <EditableRow field="name" label="Nome" value={selectedLead.name} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                  <EditableRow field="phone" label="Telefone" value={selectedLead.phone || ''} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                  <EditableRow field="email" label="Email" value={selectedLead.email || ''} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                  <EditableRow field="condoName" label="Condominio" value={String(selectedLead.metadata?.condoName || '')} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                  <EditableRow field="units" label="Unidades" value={String(selectedLead.metadata?.units || '')} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} type="number" />
                  <EditableRow field="city" label="Cidade" value={String(selectedLead.metadata?.city || '')} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} />
                  <EditableRow field="notes" label="Notas" value={selectedLead.notes || ''} editField={editField} editValue={editValue} onStart={startEdit} onChange={setEditValue} onSave={saveEdit} onCancel={cancelEdit} saving={saving} multiline />
                </div>

                {/* Source & Dates */}
                <div className="text-[10px] text-[#475569] space-y-1 border-t border-[#1e293b] pt-3">
                  {selectedLead.source && <div>Fonte: {selectedLead.source}{Number(selectedLead.source_cost) > 0 && ` | Custo: R$${Number(selectedLead.source_cost).toFixed(2)}`}</div>}
                  <div>Criado em: {new Date(selectedLead.created_at).toLocaleString('pt-BR')}</div>
                  <div>Atualizado em: {new Date(selectedLead.updated_at).toLocaleString('pt-BR')}</div>
                </div>

                {/* Status Move Buttons */}
                <div className="space-y-2 border-t border-[#1e293b] pt-3">
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wide">Mover para:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PIPELINE_ORDER.filter(s => s !== selectedLead.status).map(s => {
                      const cfg = LEAD_STATUS_CONFIG[s];
                      return (
                        <button
                          key={s}
                          onClick={() => updateLead(selectedLead.id, { status: s })}
                          disabled={saving}
                          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-50"
                          style={{
                            borderColor: cfg.color + '44',
                            color: cfg.color,
                            backgroundColor: cfg.color + '11',
                          }}
                        >
                          {cfg.icon} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 border-t border-[#1e293b] pt-3">
                  {selectedLead.phone && (
                    <button
                      onClick={() => sendWhatsApp(selectedLead.phone!)}
                      className="flex-1 bg-[#16a34a] hover:bg-[#15803d] text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      Enviar WhatsApp
                    </button>
                  )}

                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="bg-[#1e293b] hover:bg-[#7f1d1d] text-[#ef4444] hover:text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Excluir
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => deleteLead(selectedLead.id)}
                        disabled={saving}
                        className="bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors"
                      >
                        {saving ? '...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="bg-[#1e293b] text-[#94a3b8] text-sm px-3 py-2 rounded-lg"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ COMPONENTS ═══

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] text-[#64748b] uppercase tracking-wide mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#6366f1] transition-colors"
      />
    </div>
  );
}

function EditableRow({
  field,
  label,
  value,
  editField,
  editValue,
  onStart,
  onChange,
  onSave,
  onCancel,
  saving,
  multiline = false,
  type = 'text',
}: {
  field: string;
  label: string;
  value: string;
  editField: string | null;
  editValue: string;
  onStart: (field: string, value: string) => void;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  multiline?: boolean;
  type?: string;
}) {
  const isEditing = editField === field;

  return (
    <div className="flex items-start gap-2">
      <div className="text-[10px] text-[#64748b] uppercase tracking-wide w-20 pt-1.5 shrink-0">{label}</div>
      {isEditing ? (
        <div className="flex-1 flex gap-1.5">
          {multiline ? (
            <textarea
              value={editValue}
              onChange={e => onChange(e.target.value)}
              rows={3}
              className="flex-1 bg-[#1e293b] border border-[#6366f1] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none resize-none"
              autoFocus
            />
          ) : (
            <input
              type={type}
              value={editValue}
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
              className="flex-1 bg-[#1e293b] border border-[#6366f1] rounded px-2 py-1 text-sm text-[#e2e8f0] focus:outline-none"
              autoFocus
            />
          )}
          <button onClick={onSave} disabled={saving} className="text-[10px] text-[#4ade80] hover:text-[#22c55e] px-1">
            {saving ? '...' : 'OK'}
          </button>
          <button onClick={onCancel} className="text-[10px] text-[#64748b] hover:text-[#e2e8f0] px-1">
            X
          </button>
        </div>
      ) : (
        <button
          onClick={() => onStart(field, value)}
          className="flex-1 text-left text-sm text-[#e2e8f0] hover:bg-[#1e293b] rounded px-2 py-1 transition-colors min-h-[28px]"
          title="Clique para editar"
        >
          {value || <span className="text-[#334155] italic">vazio</span>}
        </button>
      )}
    </div>
  );
}
