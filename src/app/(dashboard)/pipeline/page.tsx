'use client';

import { useEffect, useState } from 'react';
import { getLeads } from '@/lib/queries';
import { LEAD_STATUS_CONFIG, type LeadStatus, type Lead } from '@/types/database';

const PIPELINE_ORDER: LeadStatus[] = ['prospectado', 'em_contato', 'reuniao', 'proposta', 'fechado'];

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => { getLeads().then(setLeads).catch(console.error); }, []);

  if (leads.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando pipeline...</div>;

  const grouped = PIPELINE_ORDER.map(status => ({
    status, config: LEAD_STATUS_CONFIG[status],
    leads: leads.filter(l => l.status === status),
  }));

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {grouped.map(col => (
        <div key={col.status} className="min-w-[180px] flex-1 bg-[#1e293b] rounded-[10px] p-3" style={{ borderTop: `3px solid ${col.config.color}` }}>
          <div className="text-[11px] font-bold mb-2 flex items-center gap-1" style={{ color: col.config.color }}>{col.config.icon} {col.config.label}</div>
          <div className="text-2xl font-extrabold text-[#e2e8f0] mb-3">{col.leads.length}</div>
          <div className="space-y-1.5">
            {col.leads.map(lead => (
              <div key={lead.id} className="bg-[#0f172a] rounded-md p-2">
                <div className="text-[11px] font-semibold text-[#e2e8f0]">{lead.name}</div>
                <div className="text-[9px] text-[#64748b] mt-0.5">{lead.role}</div>
                {lead.source && <div className="text-[9px] mt-1 text-[#475569]">via {lead.source}{Number(lead.source_cost) > 0 && ` · R$${Number(lead.source_cost).toFixed(2)}`}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
