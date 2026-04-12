'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getContentCalendar } from '@/lib/queries';
import type { ContentCalendar } from '@/types/database';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const THEMES: Record<string, string> = {
  'Automacao': '#22d3ee',
  'Jogo da Semana': '#fbbf24',
  'Historia Condo Play': '#f472b6',
};
const TYPE_ICONS: Record<string, string> = {
  carrossel: '🎠',
  post: '📝',
  reels: '🎬',
  story: '📱',
};

export default function InstagramPage() {
  const [calendar, setCalendar] = useState<ContentCalendar[]>([]);

  useEffect(() => {
    getContentCalendar().then(setCalendar).catch(console.error);
  }, []);

  if (calendar.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando calendario...</div>;

  const upcoming = calendar.filter(c => !c.published);
  const published = calendar.filter(c => c.published);

  return (
    <div>
      <Card className="mb-4 border-l-[3px] border-l-[#fb923c]">
        <div className="text-xs font-bold text-[#fb923c] mb-1">⚡ STORM — Calendario Instagram</div>
        <div className="text-[10px] text-[#64748b]">
          Seg: Automacao · Qua: Jogo da Semana · Sex: Historia Condo Play
        </div>
      </Card>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[9px] text-[#475569] font-bold py-1">{d}</div>
        ))}
        {Array.from({ length: 30 }, (_, i) => {
          const day = i + 1;
          const date = new Date(2026, 3, day);
          const dow = date.getDay();
          const items = calendar.filter(c => {
            if (!c.scheduled_at) return false;
            const d = new Date(c.scheduled_at);
            return d.getDate() === day && d.getMonth() === 3;
          });

          return (
            <div
              key={day}
              className={`rounded-md p-1.5 min-h-[60px] text-[9px] ${
                items.length > 0 ? 'bg-[#1e293b]' : 'bg-[#0c0c18]'
              } ${dow === 0 || dow === 6 ? 'opacity-50' : ''}`}
              style={i === 0 ? { gridColumnStart: dow + 1 } : undefined}
            >
              <div className="text-[#475569] font-bold mb-0.5">{day}</div>
              {items.map(item => (
                <div key={item.id} className="mb-0.5">
                  <span className="mr-0.5">{TYPE_ICONS[item.content_type || ''] || ''}</span>
                  <span style={{ color: THEMES[item.theme || ''] || '#94a3b8' }}>
                    {item.published ? '✅' : '⏳'}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Upcoming */}
      <div className="text-xs font-bold text-[#fbbf24] mb-2">Proximos Posts</div>
      <div className="space-y-2 mb-4">
        {upcoming.map(item => (
          <Card key={item.id} className="p-3 border-l-[3px]" style={{ borderLeftColor: THEMES[item.theme || ''] || '#64748b' }}>
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[11px] font-bold flex items-center gap-1.5">
                  {TYPE_ICONS[item.content_type || '']} {item.theme}
                  <Tag color={THEMES[item.theme || ''] || '#64748b'}>{item.content_type || ''}</Tag>
                </div>
                <div className="text-[11px] text-[#94a3b8] mt-1">{item.content}</div>
              </div>
              <div className="text-[10px] text-[#475569] shrink-0 ml-3">
                {item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                {' '}
                {item.scheduled_at ? new Date(item.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Published */}
      <div className="text-xs font-bold text-[#4ade80] mb-2">Publicados ✅</div>
      <div className="space-y-2">
        {published.map(item => (
          <Card key={item.id} className="p-3 opacity-70">
            <div className="text-[11px] flex items-center gap-2">
              {TYPE_ICONS[item.content_type || '']}
              <span className="text-[#94a3b8]">{item.content}</span>
              <Tag color="#4ade80">Publicado</Tag>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
