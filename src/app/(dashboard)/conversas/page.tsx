'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { getConversations, getMessages } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { AGENTS, type Conversation, type Message } from '@/types/database';

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'loki', label: '🔱 LOKI' },
  { key: 'jarvis', label: '🤖 JARVIS' },
  { key: 'vision', label: '👁️ VISION' },
  { key: 'hawkeye', label: '🏹 HAWKEYE' },
];

const STATUS_COLORS: Record<string, string> = {
  ativo: '#4ade80', aguardando: '#fbbf24', encerrado: '#64748b', alerta: '#f472b6',
};

export default function ConversasPage() {
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getConversations().then(setConvos).catch(console.error);

    // Realtime: listen for new conversations
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        getConversations().then(setConvos).catch(console.error);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (openId) {
      getMessages(openId).then(setMessages).catch(console.error);

      // Realtime: listen for new messages in this conversation
      const channel = supabase
        .channel(`messages-${openId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
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

  const filtered = convos.filter(c => filter === 'all' || c.agent_type === filter);
  const openConvo = convos.find(c => c.id === openId);

  const handleSend = async () => {
    if (!msgInput.trim() || !openConvo || sending) return;

    setSending(true);
    const text = msgInput.trim();
    setMsgInput('');

    try {
      if (openConvo.channel === 'whatsapp') {
        // Get phone from conversation metadata or contact info
        const phone = getPhoneFromConvo(openConvo, messages);
        if (phone) {
          await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              text,
              conversationId: openConvo.id,
              agentType: openConvo.agent_type,
            }),
          });
        } else {
          // Fallback: save to DB only (no WhatsApp delivery)
          await saveMessageToDb(openConvo.id, text);
        }
      } else {
        // Internal channel: just save to DB
        await saveMessageToDb(openConvo.id, text);
      }
    } catch (err) {
      console.error('Send error:', err);
    }
    setSending(false);
  };

  if (convos.length === 0) return <div className="text-[#475569] text-sm animate-pulse">Carregando conversas...</div>;

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setOpenId(null); }}
            className={`px-3 py-1 text-[10px] rounded-xl font-semibold border transition-colors ${
              filter === f.key ? 'border-[#22d3ee] bg-[#22d3ee18] text-[#22d3ee]' : 'border-[#334155] text-[#64748b] hover:text-[#94a3b8]'
            }`}>{f.label}</button>
        ))}
      </div>

      <div className={`grid gap-3 ${openId ? 'grid-cols-[260px_1fr]' : 'grid-cols-1'}`}>
        <div className="space-y-1.5">
          {filtered.map(c => {
            const agent = AGENTS[c.agent_type];
            return (
              <div key={c.id} onClick={() => setOpenId(c.id)}
                className={`rounded-lg p-2.5 cursor-pointer transition-colors border-l-[3px] ${
                  openId === c.id ? 'bg-[#1e293b] border border-opacity-50' : 'bg-[#0f172a] border-transparent hover:bg-[#131a2e]'
                }`}
                style={{ borderLeftColor: agent.color, borderColor: openId === c.id ? agent.color : undefined }}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs">{c.contact_name}</span>
                  <div className="flex gap-1 items-center">
                    {c.channel === 'whatsapp' && <span className="text-[9px]">📱</span>}
                    {c.unread > 0 && <span className="bg-[#f472b6] text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-extrabold">{c.unread}</span>}
                    <Tag color={STATUS_COLORS[c.status] || '#64748b'}>{c.status}</Tag>
                  </div>
                </div>
                <div className="text-[10px] text-[#64748b] mt-1">{agent.name} · {c.contact_role}</div>
              </div>
            );
          })}
        </div>

        {openConvo && (
          <Card className="max-h-[500px] flex flex-col">
            <div className="flex justify-between mb-2 pb-2 border-b border-[#334155]">
              <span className="font-bold text-sm">
                {openConvo.contact_name}
                <span className="text-[#475569] font-normal text-[11px] ml-1">{openConvo.contact_role}</span>
                {openConvo.channel === 'whatsapp' && <span className="ml-1 text-[9px] text-[#25D366]">📱 WhatsApp</span>}
              </span>
              <Tag color={AGENTS[openConvo.agent_type].color}>{AGENTS[openConvo.agent_type].name}</Tag>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {messages.map(m => {
                const isAgent = m.from_type === 'agent';
                const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={m.id} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[80%] px-3 py-2 rounded-[10px]"
                      style={{ background: isAgent ? AGENTS[openConvo.agent_type].color + '20' : '#0f172a' }}>
                      <div className="text-[11px] text-[#e2e8f0] leading-relaxed">{m.content}</div>
                      <div className={`text-[9px] text-[#475569] mt-1 ${isAgent ? 'text-right' : 'text-left'}`}>
                        {isAgent ? `🤖 ${AGENTS[openConvo.agent_type].name}` : '👤'} · {time}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="mt-2 pt-2 border-t border-[#334155] flex gap-2">
              <input
                type="text"
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder={openConvo.channel === 'whatsapp' ? 'Enviar via WhatsApp...' : 'Enviar mensagem...'}
                className="flex-1 bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-[11px] text-[#e2e8f0] placeholder-[#475569] outline-none focus:border-[#22d3ee]"
              />
              <button
                onClick={handleSend}
                disabled={sending || !msgInput.trim()}
                className="px-4 py-2 bg-[#22d3ee] text-[#0f172a] text-[11px] font-bold rounded-lg hover:bg-[#06b6d4] transition-colors disabled:opacity-50"
              >
                {sending ? '...' : openConvo.channel === 'whatsapp' ? '📱 Enviar' : 'Enviar'}
              </button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══ HELPERS ═══

function getPhoneFromConvo(convo: Conversation, messages: Message[]): string | null {
  // Try to find phone in message metadata
  for (const msg of messages) {
    const meta = msg.metadata as Record<string, unknown>;
    if (meta?.phone) return meta.phone as string;
  }
  // Fallback: check if contact_name looks like a phone
  const name = convo.contact_name || '';
  if (/^\d{10,13}$/.test(name.replace(/\D/g, ''))) return name;
  return null;
}

async function saveMessageToDb(conversationId: string, text: string) {
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
