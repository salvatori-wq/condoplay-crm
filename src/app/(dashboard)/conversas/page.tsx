'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getConversations, getMessages } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { AGENTS, LOSS_REASONS, type AgentType, type Conversation, type Message, type LossReason } from '@/types/database';

// ═══ AGENT TABS ═══
const AGENT_TABS: { key: AgentType | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'loki', label: 'LOKI' },
  { key: 'hawkeye', label: 'HAWKEYE' },
  { key: 'jarvis', label: 'JARVIS' },
  { key: 'fury', label: 'FURY' },
  { key: 'vision', label: 'VISION' },
  { key: 'stark', label: 'STARK' },
  { key: 'storm', label: 'STORM' },
];

const STATUS_COLORS: Record<string, string> = {
  ativo: '#4ade80', aguardando: '#fbbf24', encerrado: '#64748b', alerta: '#f472b6', perdido: '#ef4444',
};

export default function ConversasPage() {
  const [activeTab, setActiveTab] = useState<AgentType | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pausedAgents, setPausedAgents] = useState<Record<string, boolean>>({});
  const [showLossModal, setShowLossModal] = useState<string | null>(null);
  const [lossReason, setLossReason] = useState<LossReason>('sem_resposta');
  const [lossNotes, setLossNotes] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ═══ LOAD CONVERSATIONS ═══
  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations({
        agentType: activeTab === 'all' ? undefined : activeTab,
        archived: showArchived,
      });
      setConvos(data);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  }, [activeTab, showArchived]);

  // ═══ LOAD PAUSE STATUS ═══
  const loadPauseStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/toggle-pause');
      const data = await res.json();
      if (data.ok) setPausedAgents(data.agents || {});
    } catch (err) {
      console.error('Error loading pause status:', err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    loadPauseStatus();

    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadConversations, loadPauseStatus]);

  // ═══ LOAD MESSAGES ═══
  useEffect(() => {
    if (openId) {
      getMessages(openId).then(setMessages).catch(console.error);

      const channel = supabase
        .channel(`messages-${openId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${openId}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [openId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConvo = convos.find(c => c.id === openId);

  // ═══ SEND MESSAGE ═══
  const handleSend = async () => {
    if (!msgInput.trim() || !openConvo || sending) return;
    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');

    try {
      if (openConvo.channel === 'whatsapp') {
        const phone = getPhoneFromConvo(openConvo, messages);
        if (phone) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, text, conversationId: openConvo.id, agentType: openConvo.agent_type }),
          });
        } else {
          await saveMessageToDb(openConvo.id, text);
        }
      } else {
        await saveMessageToDb(openConvo.id, text);
      }
    } catch (err) {
      console.error('Send error:', err);
    }
    setSending(false);
  };

  // ═══ ARCHIVE ═══
  const handleArchive = async (conversationId: string, archive: boolean) => {
    try {
      await fetch('/api/conversations/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds: [conversationId], archived: archive }),
      });
      if (openId === conversationId) setOpenId(null);
      loadConversations();
    } catch (err) {
      console.error('Archive error:', err);
    }
  };

  // ═══ MARK LOST ═══
  const handleMarkLost = async () => {
    if (!showLossModal) return;
    try {
      await fetch('/api/conversations/mark-lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: showLossModal, lossReason: lossReason, lossNotes: lossNotes }),
      });
      setShowLossModal(null);
      setLossReason('sem_resposta');
      setLossNotes('');
      loadConversations();
    } catch (err) {
      console.error('Mark lost error:', err);
    }
  };

  // ═══ TOGGLE PAUSE ═══
  const handleTogglePause = async (agentType: AgentType) => {
    const currentlyPaused = pausedAgents[agentType] || false;
    try {
      await fetch('/api/agents/toggle-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, paused: !currentlyPaused }),
      });
      setPausedAgents(prev => ({ ...prev, [agentType]: !currentlyPaused }));
    } catch (err) {
      console.error('Toggle pause error:', err);
    }
  };

  // ═══ COUNTS PER TAB ═══
  const getCounts = () => {
    const counts: Record<string, number> = { all: convos.length };
    for (const c of convos) {
      counts[c.agent_type] = (counts[c.agent_type] || 0) + 1;
    }
    return counts;
  };
  const counts = getCounts();

  if (convos.length === 0 && !showArchived) {
    return <div className="text-[#475569] text-sm animate-pulse">Carregando conversas...</div>;
  }

  return (
    <div>
      {/* ═══ AGENT TABS ═══ */}
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        {AGENT_TABS.map(tab => {
          const agent = tab.key !== 'all' ? AGENTS[tab.key] : null;
          const isPaused = tab.key !== 'all' && pausedAgents[tab.key];
          const count = counts[tab.key] || 0;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setOpenId(null); }}
              className={`px-3 py-1.5 text-[10px] rounded-xl font-semibold border transition-colors flex items-center gap-1 ${
                activeTab === tab.key
                  ? 'border-[#22d3ee] bg-[#22d3ee18] text-[#22d3ee]'
                  : 'border-[#334155] text-[#64748b] hover:text-[#94a3b8]'
              } ${isPaused ? 'opacity-50' : ''}`}>
              {agent && <span className="text-[10px]">{agent.icon}</span>}
              {tab.label}
              {count > 0 && <span className="text-[9px] opacity-60">({count})</span>}
              {isPaused && <span className="text-[9px] text-[#ef4444]">||</span>}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          {/* Toggle archived */}
          <button
            onClick={() => { setShowArchived(!showArchived); setOpenId(null); }}
            className={`px-3 py-1.5 text-[10px] rounded-xl font-semibold border transition-colors ${
              showArchived
                ? 'border-[#a78bfa] bg-[#a78bfa18] text-[#a78bfa]'
                : 'border-[#334155] text-[#475569] hover:text-[#94a3b8]'
            }`}>
            {showArchived ? 'Arquivadas' : 'Arquivo'}
          </button>

          {/* Pause button (only when specific agent tab is selected) */}
          {activeTab !== 'all' && (
            <button
              onClick={() => handleTogglePause(activeTab)}
              className={`px-3 py-1.5 text-[10px] rounded-xl font-bold border transition-colors ${
                pausedAgents[activeTab]
                  ? 'border-[#4ade80] bg-[#4ade8018] text-[#4ade80]'
                  : 'border-[#ef4444] bg-[#ef444418] text-[#ef4444]'
              }`}>
              {pausedAgents[activeTab] ? 'Retomar Agente' : 'Pausar Agente'}
            </button>
          )}
        </div>
      </div>

      {/* ═══ PAUSE BANNER ═══ */}
      {activeTab !== 'all' && pausedAgents[activeTab] && (
        <div className="mb-3 px-3 py-2 bg-[#ef444418] border border-[#ef4444] rounded-lg text-[11px] text-[#ef4444] flex items-center gap-2">
          <span className="font-bold">|| PAUSADO</span>
          <span className="text-[#fca5a5]">— {AGENTS[activeTab].name} nao esta respondendo automaticamente. Mensagens chegam mas nao sao respondidas pela IA.</span>
        </div>
      )}

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className={`grid gap-3 ${openId ? 'grid-cols-[280px_1fr]' : 'grid-cols-1'}`}>
        {/* ═══ CONVERSATION LIST ═══ */}
        <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
          {convos.length === 0 && (
            <div className="text-[#475569] text-[11px] p-4 text-center">
              {showArchived ? 'Nenhuma conversa arquivada' : 'Nenhuma conversa ativa'}
            </div>
          )}
          {convos.map(c => {
            const agent = AGENTS[c.agent_type];
            const isLost = c.status === 'perdido';
            return (
              <div key={c.id} onClick={() => setOpenId(c.id)}
                className={`rounded-lg p-2.5 cursor-pointer transition-colors border-l-[3px] group relative ${
                  openId === c.id ? 'bg-[#1e293b] border border-opacity-50' : 'bg-[#0f172a] border-transparent hover:bg-[#131a2e]'
                } ${isLost ? 'opacity-60' : ''} ${c.archived ? 'opacity-50' : ''}`}
                style={{ borderLeftColor: isLost ? '#ef4444' : agent.color, borderColor: openId === c.id ? agent.color : undefined }}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs truncate max-w-[140px]">{c.contact_name}</span>
                  <div className="flex gap-1 items-center">
                    {c.channel === 'whatsapp' && <span className="text-[9px]">WA</span>}
                    {c.unread > 0 && <span className="bg-[#f472b6] text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-extrabold">{c.unread}</span>}
                    <Tag color={STATUS_COLORS[c.status] || '#64748b'}>{c.status}</Tag>
                  </div>
                </div>
                <div className="text-[10px] text-[#64748b] mt-1 flex justify-between">
                  <span>{agent.icon} {agent.name} · {c.contact_role}</span>
                  {isLost && c.loss_reason && (
                    <span className="text-[#ef4444] text-[9px]">{LOSS_REASONS[c.loss_reason as LossReason] || c.loss_reason}</span>
                  )}
                </div>

                {/* Quick actions on hover */}
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                  {!c.archived && c.status !== 'perdido' && (
                    <button onClick={(e) => { e.stopPropagation(); setShowLossModal(c.id); }}
                      className="w-5 h-5 rounded bg-[#ef444430] text-[#ef4444] text-[9px] flex items-center justify-center hover:bg-[#ef444450]"
                      title="Marcar como perdida">X</button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleArchive(c.id, !c.archived); }}
                    className="w-5 h-5 rounded bg-[#64748b30] text-[#94a3b8] text-[9px] flex items-center justify-center hover:bg-[#64748b50]"
                    title={c.archived ? 'Desarquivar' : 'Arquivar'}>{c.archived ? '<' : '>'}</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ CHAT PANEL ═══ */}
        {openConvo && (
          <Card className="max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex justify-between mb-2 pb-2 border-b border-[#334155]">
              <div className="flex-1">
                <span className="font-bold text-sm">
                  {openConvo.contact_name}
                  <span className="text-[#475569] font-normal text-[11px] ml-1">{openConvo.contact_role}</span>
                  {openConvo.channel === 'whatsapp' && <span className="ml-1 text-[9px] text-[#25D366]">WA</span>}
                </span>
                {openConvo.status === 'perdido' && openConvo.loss_reason && (
                  <div className="text-[10px] text-[#ef4444] mt-0.5">
                    Perdida: {LOSS_REASONS[openConvo.loss_reason as LossReason] || openConvo.loss_reason}
                    {openConvo.loss_notes && <span className="text-[#fca5a5] ml-1">— {openConvo.loss_notes}</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Tag color={AGENTS[openConvo.agent_type].color}>{AGENTS[openConvo.agent_type].name}</Tag>
                {/* Action buttons */}
                {openConvo.status !== 'perdido' && (
                  <button onClick={() => setShowLossModal(openConvo.id)}
                    className="px-2 py-1 text-[9px] font-bold text-[#ef4444] border border-[#ef4444] rounded hover:bg-[#ef444418]">
                    Perdida
                  </button>
                )}
                <button onClick={() => handleArchive(openConvo.id, !openConvo.archived)}
                  className="px-2 py-1 text-[9px] font-bold text-[#64748b] border border-[#334155] rounded hover:bg-[#334155]">
                  {openConvo.archived ? 'Desarquivar' : 'Arquivar'}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {messages.map(m => {
                const isAgent = m.from_type === 'agent';
                const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] px-3 py-2 rounded-[10px]"
                      style={{ background: isAgent ? AGENTS[openConvo.agent_type].color + '20' : '#0f172a' }}>
                      <div className="text-[11px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                      <div className={`text-[9px] text-[#475569] mt-1 ${isAgent ? 'text-right' : 'text-left'}`}>
                        {isAgent ? AGENTS[openConvo.agent_type].name : 'Lead'} · {time}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="mt-2 pt-2 border-t border-[#334155] flex gap-2">
              <input type="text" value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={openConvo.channel === 'whatsapp' ? 'Enviar via WhatsApp...' : 'Enviar mensagem...'}
                className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#22d3ee]" />
              <button onClick={handleSend} disabled={sending || !msgInput.trim()}
                className="px-4 py-2 bg-[#22d3ee] text-[#0f172a] text-[11px] font-bold rounded-lg hover:bg-[#06b6d4] transition-colors disabled:opacity-50">
                {sending ? '...' : 'Enviar'}
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* ═══ LOSS MODAL ═══ */}
      {showLossModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLossModal(null)}>
          <div className="bg-[#1e293b] rounded-xl p-5 w-[400px] max-w-[90vw] border border-[#334155]" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold text-[#e2e8f0] mb-3">Marcar Conversa como Perdida</div>
            <div className="text-[10px] text-[#64748b] mb-4">
              O motivo sera salvo para analise e treinamento dos agentes.
            </div>

            {/* Reason select */}
            <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Motivo</label>
            <select value={lossReason} onChange={e => setLossReason(e.target.value as LossReason)}
              className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] text-[#e2e8f0] mb-3 outline-none focus:border-[#22d3ee]">
              {Object.entries(LOSS_REASONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* Notes */}
            <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Notas (opcional)</label>
            <textarea value={lossNotes} onChange={e => setLossNotes(e.target.value)}
              placeholder="Detalhes adicionais para treinamento..."
              rows={3}
              className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] text-[#e2e8f0] placeholder-[#475569] mb-4 outline-none focus:border-[#22d3ee] resize-none" />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLossModal(null)}
                className="px-4 py-2 text-[11px] text-[#94a3b8] border border-[#334155] rounded-lg hover:bg-[#334155]">
                Cancelar
              </button>
              <button onClick={handleMarkLost}
                className="px-4 py-2 text-[11px] font-bold text-white bg-[#ef4444] rounded-lg hover:bg-[#dc2626]">
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ HELPERS ═══

function getPhoneFromConvo(convo: Conversation, messages: Message[]): string | null {
  if (convo.contact_phone) return convo.contact_phone;
  for (const msg of messages) {
    const meta = msg.metadata as Record<string, unknown>;
    if (meta?.phone) return meta.phone as string;
  }
  const name = convo.contact_name || '';
  if (/^\d{10,13}$/.test(name.replace(/\D/g, ''))) return name;
  return null;
}

async function saveMessageToDb(conversationId: string, text: string) {
  const { supabase } = await import('@/lib/supabase');
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    from_type: 'agent',
    content: text,
    metadata: { source: 'crm_manual' },
  });
  await supabase
    .from('conversations')
    .update({ unread: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId);
}
