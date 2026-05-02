'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getConversations, getMessages } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { AGENTS, LOSS_REASONS, type AgentType, type Conversation, type Message, type LossReason } from '@/types/database';

// ═══ CONSTANTS ═══

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

const AVATAR_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f97316',
  '#ec4899', '#14b8a6', '#6366f1', '#f43f5e',
  '#06b6d4', '#f59e0b', '#22c55e', '#7c3aed',
];

// ═══ HELPERS ═══

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getInitials(name: string | null | undefined, phone?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (phone) return phone.replace(/\D/g, '').slice(-2);
  return '??';
}

function getAvatarColor(name: string | null | undefined, phone?: string | null): string {
  const str = name || phone || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatHora(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

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

// ═══ NOVA CONVERSA MODAL ═══

function NovaConversaModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async () => {
    if (!telefone.trim() || !mensagem.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: telefone.replace(/\D/g, ''),
          text: mensagem,
          contactName: nome || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || 'Erro ao enviar');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[#1e293b] rounded-xl p-5 w-[420px] max-w-[90vw] border border-[#334155]" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-bold text-[#e2e8f0] mb-4">Nova Conversa WhatsApp</div>

        <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Telefone (com DDD)</label>
        <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
          placeholder="11 99999-8888"
          className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[12px] text-[#e2e8f0] placeholder-[#475569] mb-3 outline-none focus:border-[#25D366]" />

        <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Nome do Contato (opcional)</label>
        <input type="text" value={nome} onChange={e => setNome(e.target.value)}
          placeholder="Nome do sindico..."
          className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[12px] text-[#e2e8f0] placeholder-[#475569] mb-3 outline-none focus:border-[#25D366]" />

        <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Mensagem</label>
        <textarea value={mensagem} onChange={e => setMensagem(e.target.value)}
          rows={4} placeholder="Digite a primeira mensagem..."
          className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[12px] text-[#e2e8f0] placeholder-[#475569] mb-1 outline-none focus:border-[#25D366] resize-none" />
        <div className="text-[9px] text-[#475569] mb-3">{mensagem.length} caracteres</div>

        {erro && <div className="text-[11px] text-[#ef4444] mb-3 bg-[#7f1d1d] rounded-lg px-3 py-2">{erro}</div>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-[11px] text-[#94a3b8] border border-[#334155] rounded-lg hover:bg-[#334155]">
            Cancelar
          </button>
          <button onClick={enviar} disabled={!telefone.trim() || !mensagem.trim() || enviando}
            className="flex-1 px-4 py-2 bg-[#25D366] text-white text-[11px] font-bold rounded-lg hover:bg-[#128C7E] disabled:opacity-50">
            {enviando ? 'Enviando...' : 'Enviar WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ MAIN PAGE ═══

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);
  const prevMsgCountRef = useRef(0);

  // ═══ LOAD CONVERSATIONS ═══
  const loadConversations = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await getConversations({
        agentType: activeTab === 'all' ? undefined : activeTab,
        archived: showArchived,
      });
      setConvos(data);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err));
      console.error('Error loading conversations:', errMsg);
      setLoadError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, showArchived]);

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
      isFirstLoadRef.current = true;
      prevMsgCountRef.current = 0;
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

  // ═══ SMART SCROLL ═══
  useEffect(() => {
    const container = messagesContainerRef.current;
    const msgCount = messages.length;

    if (isFirstLoadRef.current && msgCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      isFirstLoadRef.current = false;
      prevMsgCountRef.current = msgCount;
      return;
    }

    if (msgCount !== prevMsgCountRef.current) {
      prevMsgCountRef.current = msgCount;
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
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
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 300);
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

  // ═══ DELETE ═══
  const handleDelete = async (conversationId: string) => {
    try {
      await fetch('/api/conversations/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (openId === conversationId) setOpenId(null);
      setDeleteConfirm(null);
      loadConversations();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // ═══ MARK LOST ═══
  const handleMarkLost = async () => {
    if (!showLossModal) return;
    try {
      await fetch('/api/conversations/mark-lost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: showLossModal, lossReason, lossNotes }),
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

  // ═══ CHANGE AGENT ═══
  const handleChangeAgent = async (conversationId: string, newAgent: AgentType) => {
    try {
      await supabase
        .from('conversations')
        .update({ agent_type: newAgent, updated_at: new Date().toISOString() })
        .eq('id', conversationId);
      loadConversations();
    } catch (err) {
      console.error('Change agent error:', err);
    }
  };

  // ═══ FILTER + COUNTS ═══
  const filteredConvos = convos.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.contact_phone || '').includes(q)
    );
  });

  const getCounts = () => {
    const counts: Record<string, number> = { all: convos.length };
    for (const c of convos) {
      counts[c.agent_type] = (counts[c.agent_type] || 0) + 1;
    }
    return counts;
  };
  const counts = getCounts();

  // ═══ LOADING / ERROR STATES ═══
  if (loading) {
    return <div className="text-[#475569] text-sm animate-pulse">Carregando conversas...</div>;
  }

  if (loadError) {
    return (
      <div className="text-center py-10">
        <div className="text-[#ef4444] text-sm mb-2">Erro ao carregar conversas</div>
        <div className="text-[#64748b] text-[11px] mb-3">{loadError}</div>
        <button onClick={loadConversations} className="px-4 py-2 bg-[#1e293b] text-[#94a3b8] text-[11px] rounded-lg hover:bg-[#334155]">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* ═══ TOP BAR: Tabs + Search + Actions ═══ */}
      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        {AGENT_TABS.map(tab => {
          const agent = tab.key !== 'all' ? AGENTS[tab.key] : null;
          const isPaused = tab.key !== 'all' && pausedAgents[tab.key];
          const count = counts[tab.key] || 0;
          return (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setOpenId(null); }}
              className={`px-2.5 py-1 text-[10px] rounded-lg font-semibold border transition-colors flex items-center gap-1 ${
                activeTab === tab.key
                  ? 'border-[#22d3ee] bg-[#22d3ee18] text-[#22d3ee]'
                  : 'border-[#334155] text-[#64748b] hover:text-[#94a3b8]'
              } ${isPaused ? 'opacity-50' : ''}`}>
              {agent && <span className="text-[10px]">{agent.icon}</span>}
              {tab.label}
              {count > 0 && <span className="text-[9px] opacity-60">({count})</span>}
              {isPaused && <span className="text-[9px] text-[#ef4444] ml-0.5">||</span>}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowNewModal(true)}
            className="px-3 py-1 text-[10px] rounded-lg font-bold border border-[#25D366] text-[#25D366] hover:bg-[#25D36618]">
            + Nova
          </button>
          <button onClick={() => { setShowArchived(!showArchived); setOpenId(null); }}
            className={`px-2.5 py-1 text-[10px] rounded-lg font-semibold border transition-colors ${
              showArchived ? 'border-[#a78bfa] bg-[#a78bfa18] text-[#a78bfa]' : 'border-[#334155] text-[#475569] hover:text-[#94a3b8]'
            }`}>
            {showArchived ? 'Arquivadas' : 'Arquivo'}
          </button>
          {activeTab !== 'all' && (
            <button onClick={() => handleTogglePause(activeTab)}
              className={`px-2.5 py-1 text-[10px] rounded-lg font-bold border transition-colors ${
                pausedAgents[activeTab] ? 'border-[#4ade80] bg-[#4ade8018] text-[#4ade80]' : 'border-[#ef4444] bg-[#ef444418] text-[#ef4444]'
              }`}>
              {pausedAgents[activeTab] ? 'Retomar' : 'Pausar'}
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-2">
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-[11px] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#22d3ee]" />
      </div>

      {/* Pause banner */}
      {activeTab !== 'all' && pausedAgents[activeTab] && (
        <div className="mb-2 px-3 py-1.5 bg-[#ef444418] border border-[#ef4444] rounded-lg text-[10px] text-[#ef4444] flex items-center gap-2">
          <span className="font-bold">|| PAUSADO</span>
          <span className="text-[#fca5a5]">— {AGENTS[activeTab].name} nao responde automaticamente.</span>
        </div>
      )}

      {/* ═══ MAIN LAYOUT ═══ */}
      <div className={`flex-1 min-h-0 grid gap-2 ${openId ? 'grid-cols-[280px_1fr]' : 'grid-cols-1'}`}>

        {/* ═══ CONVERSATION LIST ═══ */}
        <div className="overflow-y-auto space-y-1">
          {filteredConvos.length === 0 && (
            <div className="text-[#475569] text-[11px] p-4 text-center">
              {searchQuery ? 'Nenhuma conversa encontrada' : showArchived ? 'Nenhuma conversa arquivada' : 'Nenhuma conversa ativa'}
            </div>
          )}
          {filteredConvos.map(c => {
            const agent = AGENTS[c.agent_type];
            const isLost = c.status === 'perdido';
            const avatarColor = getAvatarColor(c.contact_name, c.contact_phone);
            const initials = getInitials(c.contact_name, c.contact_phone);

            return (
              <div key={c.id} onClick={() => setOpenId(c.id)}
                className={`rounded-lg p-2 cursor-pointer transition-colors border-l-[3px] group relative ${
                  openId === c.id ? 'bg-[#1e293b]' : 'bg-[#0f172a] hover:bg-[#131a2e]'
                } ${isLost ? 'opacity-60' : ''} ${c.archived ? 'opacity-50' : ''}`}
                style={{ borderLeftColor: isLost ? '#ef4444' : agent.color }}>
                <div className="flex gap-2 items-start">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: avatarColor }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[11px] truncate max-w-[120px] text-[#e2e8f0]">{c.contact_name || c.contact_phone}</span>
                      <span className="text-[9px] text-[#475569] flex-shrink-0">{timeAgo(c.updated_at)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[9px] text-[#475569] truncate max-w-[140px]">
                        {agent.icon} {agent.name}
                      </span>
                      <div className="flex gap-1 items-center flex-shrink-0">
                        {c.unread > 0 && <span className="bg-[#25D366] text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-extrabold">{c.unread}</span>}
                        <Tag color={STATUS_COLORS[c.status] || '#64748b'}>{c.status}</Tag>
                      </div>
                    </div>
                    {isLost && c.loss_reason && (
                      <span className="text-[#ef4444] text-[8px]">{LOSS_REASONS[c.loss_reason as LossReason] || c.loss_reason}</span>
                    )}
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                  {!c.archived && c.status !== 'perdido' && (
                    <button onClick={e => { e.stopPropagation(); setShowLossModal(c.id); }}
                      className="w-5 h-5 rounded bg-[#ef444430] text-[#ef4444] text-[9px] flex items-center justify-center hover:bg-[#ef444450]"
                      title="Marcar perdida">X</button>
                  )}
                  <button onClick={e => { e.stopPropagation(); handleArchive(c.id, !c.archived); }}
                    className="w-5 h-5 rounded bg-[#64748b30] text-[#94a3b8] text-[9px] flex items-center justify-center hover:bg-[#64748b50]"
                    title={c.archived ? 'Desarquivar' : 'Arquivar'}>{c.archived ? '<' : '>'}</button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(c.id); }}
                    className="w-5 h-5 rounded bg-[#ef444430] text-[#ef4444] text-[9px] flex items-center justify-center hover:bg-[#ef444450]"
                    title="Excluir">D</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ═══ CHAT PANEL ═══ */}
        {openConvo && (
          <Card className="flex flex-col overflow-hidden p-0">
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#334155]">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: getAvatarColor(openConvo.contact_name, openConvo.contact_phone) }}>
                {getInitials(openConvo.contact_name, openConvo.contact_phone)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#e2e8f0] truncate">{openConvo.contact_name || openConvo.contact_phone}</span>
                  {openConvo.channel === 'whatsapp' && <span className="text-[9px] text-[#25D366] font-bold">WA</span>}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#475569]">
                  <span>{openConvo.contact_phone}</span>
                  {/* Agent dropdown */}
                  <select value={openConvo.agent_type}
                    onChange={e => handleChangeAgent(openConvo.id, e.target.value as AgentType)}
                    className="bg-transparent border border-[#334155] rounded px-1 py-0.5 text-[10px] text-[#94a3b8] outline-none cursor-pointer hover:border-[#22d3ee]">
                    {(Object.keys(AGENTS) as AgentType[]).map(key => (
                      <option key={key} value={key}>{AGENTS[key].icon} {AGENTS[key].name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {openConvo.contact_phone && (
                  <a href={`https://wa.me/${openConvo.contact_phone}`} target="_blank" rel="noopener noreferrer"
                    className="px-2 py-1 text-[9px] text-[#25D366] border border-[#25D36640] rounded hover:bg-[#25D36618]"
                    title="Abrir no WhatsApp">wa.me</a>
                )}
                {openConvo.status !== 'perdido' && (
                  <button onClick={() => setShowLossModal(openConvo.id)}
                    className="px-2 py-1 text-[9px] font-bold text-[#ef4444] border border-[#ef4444] rounded hover:bg-[#ef444418]">
                    Perdida
                  </button>
                )}
                <button onClick={() => handleArchive(openConvo.id, !openConvo.archived)}
                  className="px-2 py-1 text-[9px] text-[#64748b] border border-[#334155] rounded hover:bg-[#334155]">
                  {openConvo.archived ? 'Desarq' : 'Arquiv'}
                </button>
                <button onClick={() => setDeleteConfirm(openConvo.id)}
                  className="px-2 py-1 text-[9px] text-[#ef4444] border border-[#ef444440] rounded hover:bg-[#ef444418]">
                  Excluir
                </button>
              </div>
            </div>

            {/* Perdida/Arquivada banners */}
            {openConvo.status === 'perdido' && openConvo.loss_reason && (
              <div className="px-4 py-1.5 bg-[#ef444418] border-b border-[#ef444440] text-[10px] text-[#ef4444] flex items-center gap-2">
                <span className="font-bold">PERDIDA</span>
                <span>— {LOSS_REASONS[openConvo.loss_reason as LossReason] || openConvo.loss_reason}</span>
                {openConvo.loss_notes && <span className="text-[#fca5a5]">({openConvo.loss_notes})</span>}
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-[#475569] text-sm mb-1">Nenhuma mensagem</div>
                  <div className="text-[#334155] text-[10px]">Envie a primeira mensagem para iniciar</div>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const isAgent = m.from_type === 'agent';
                  const msgDate = new Date(m.created_at).toLocaleDateString('pt-BR');
                  const prevDate = idx > 0 ? new Date(messages[idx - 1].created_at).toLocaleDateString('pt-BR') : null;
                  const showDateSep = idx === 0 || msgDate !== prevDate;

                  return (
                    <div key={m.id}>
                      {showDateSep && (
                        <div className="flex items-center justify-center my-2">
                          <span className="px-3 py-0.5 bg-[#1e293b] rounded-full text-[9px] font-medium text-[#64748b] border border-[#334155]">
                            {getDateLabel(m.created_at)}
                          </span>
                        </div>
                      )}
                      <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-2xl ${
                          isAgent
                            ? 'bg-[#25D36620] rounded-br-md'
                            : 'bg-[#0f172a] rounded-bl-md'
                        }`}>
                          <div className="text-[12px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{m.content}</div>
                          <div className={`flex items-center gap-1 mt-0.5 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[9px] text-[#475569]">
                              {isAgent ? AGENTS[openConvo.agent_type]?.name || 'Agente' : 'Lead'}
                            </span>
                            <span className="text-[9px] text-[#475569]">{formatHora(m.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[#334155] px-4 py-2 flex gap-2">
              <textarea value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={openConvo.channel === 'whatsapp' ? 'Enviar via WhatsApp... (Enter para enviar)' : 'Enviar mensagem...'}
                rows={1}
                className="flex-1 bg-[#0f172a] border border-[#334155] rounded-2xl px-4 py-2 text-[12px] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#25D366] resize-none"
                style={{ minHeight: '40px', maxHeight: '100px' }} />
              <button onClick={handleSend} disabled={sending || !msgInput.trim()}
                className="px-4 py-2 bg-[#25D366] text-white text-[11px] font-bold rounded-full hover:bg-[#128C7E] transition-colors disabled:opacity-50 self-end">
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
            <div className="text-[10px] text-[#64748b] mb-4">O motivo sera salvo para analise e treinamento dos agentes.</div>

            <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Motivo</label>
            <select value={lossReason} onChange={e => setLossReason(e.target.value as LossReason)}
              className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] text-[#e2e8f0] mb-3 outline-none focus:border-[#22d3ee]">
              {Object.entries(LOSS_REASONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <label className="block text-[10px] text-[#94a3b8] mb-1 font-bold">Notas (opcional)</label>
            <textarea value={lossNotes} onChange={e => setLossNotes(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
              className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] text-[#e2e8f0] placeholder-[#475569] mb-4 outline-none focus:border-[#22d3ee] resize-none" />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowLossModal(null)}
                className="px-4 py-2 text-[11px] text-[#94a3b8] border border-[#334155] rounded-lg hover:bg-[#334155]">Cancelar</button>
              <button onClick={handleMarkLost}
                className="px-4 py-2 text-[11px] font-bold text-white bg-[#ef4444] rounded-lg hover:bg-[#dc2626]">Confirmar Perda</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE CONFIRM ═══ */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#1e293b] rounded-xl p-5 w-[380px] max-w-[90vw] border border-[#334155]" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-bold text-[#ef4444] mb-2">Excluir Conversa</div>
            <div className="text-[11px] text-[#94a3b8] mb-4">
              Todas as mensagens serao apagadas permanentemente. Esta acao nao pode ser desfeita.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-[11px] text-[#94a3b8] border border-[#334155] rounded-lg hover:bg-[#334155]">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 text-[11px] font-bold text-white bg-[#ef4444] rounded-lg hover:bg-[#dc2626]">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NOVA CONVERSA MODAL ═══ */}
      {showNewModal && (
        <NovaConversaModal
          onClose={() => setShowNewModal(false)}
          onSuccess={loadConversations}
        />
      )}
    </div>
  );
}

// ═══ DB HELPER ═══

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
