'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tag } from '@/components/ui/tag';
import { AGENTS, type AgentType } from '@/types/database';
import { AGENT_PROMPTS } from '@/lib/agent-prompts';

interface WhatsAppStatus {
  connected: boolean;
  configured: boolean;
  state?: string;
  message?: string;
}

interface QrCodeData {
  base64: string | null;
  pairingCode: string | null;
}

export default function ConfigPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('tibia');
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const agent = AGENTS[selectedAgent];

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        setWaStatus(data);
        setWaError(null);
      } catch (err) {
        console.error('[WhatsApp Status]', err);
        setWaStatus({ connected: false, configured: false, message: 'Erro ao verificar' });
        setWaError(err instanceof Error ? err.message : 'Erro desconhecido');
      }
    };

    fetchStatus();
  }, []);

  const handleConnectWhatsApp = async () => {
    setWaLoading(true);
    setQrData(null);
    setWaError(null);
    try {
      const res = await fetch('/api/whatsapp/status', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.message || data.error);
      }
      if (data.qrcode) {
        setQrData({ base64: data.qrcode, pairingCode: data.pairingCode });
      } else {
        // Refresh status — might already be connected
        const statusRes = await fetch('/api/whatsapp/status');
        if (statusRes.ok) {
          const status = await statusRes.json();
          setWaStatus(status);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao gerar QR Code';
      console.error('[WhatsApp QR Code]', errorMsg, err);
      setWaError(errorMsg);
      setQrData(null);
    } finally {
      setWaLoading(false);
    }
  };

  const integrations = [
    { name: 'Supabase', status: 'Conectado', color: '#4ade80' },
    {
      name: 'WhatsApp (Evolution)',
      status: waStatus?.connected ? 'Conectado' : waStatus?.configured ? (waStatus.state || 'Desconectado') : 'Aguardando Config',
      color: waStatus?.connected ? '#4ade80' : waStatus?.configured ? '#fb923c' : '#fbbf24',
    },
    { name: 'Google Calendar', status: 'Aguardando Config', color: '#fbbf24' },
    { name: 'Claude API (Sonnet)', status: 'Aguardando Key', color: '#fbbf24' },
    { name: 'LinkedIn Sales Nav', status: 'Aguardando Config', color: '#fbbf24' },
    { name: 'Instagram API', status: 'Aguardando Config', color: '#fbbf24' },
  ];

  return (
    <div>
      <Card className="mb-4 border-l-[3px] border-l-[#6366f1]">
        <div className="text-xs font-bold text-[#6366f1] mb-1">⚙️ Configuracao TIBIA Engine</div>
        <div className="text-[10px] text-[#64748b]">System prompts dos agentes, integracoes e parametros.</div>
      </Card>

      {/* Agent selector */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
        {(Object.keys(AGENTS) as AgentType[]).map(key => {
          const a = AGENTS[key];
          return (
            <button
              key={key}
              onClick={() => setSelectedAgent(key)}
              className={`rounded-lg p-2 text-center transition-colors border ${
                selectedAgent === key
                  ? 'bg-[#1e293b] border-opacity-50'
                  : 'bg-[#0c0c18] border-transparent hover:bg-[#0f172a]'
              }`}
              style={{ borderColor: selectedAgent === key ? a.color : 'transparent' }}
            >
              <div className="text-lg">{a.icon}</div>
              <div className="text-[9px] font-bold mt-0.5" style={{ color: a.color }}>{a.name}</div>
            </button>
          );
        })}
      </div>

      {/* Prompt */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{agent.icon}</span>
          <div>
            <div className="text-sm font-bold" style={{ color: agent.color }}>{agent.name}</div>
            <div className="text-[10px] text-[#64748b]">{agent.role}</div>
          </div>
          <Tag color={agent.color}>System Prompt</Tag>
        </div>
        <pre className="text-[11px] text-[#cbd5e1] leading-relaxed whitespace-pre-wrap bg-[#0a0a14] rounded-lg p-4 border border-[#1e293b]">
          {AGENT_PROMPTS[selectedAgent]}
        </pre>
      </Card>

      {/* WhatsApp Panel */}
      <Card className="mt-3 border-l-[3px] border-l-[#25D366]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-[#25D366]">📱 WhatsApp — Evolution API</div>
          <Tag color={waStatus?.connected ? '#4ade80' : waError ? '#ef4444' : '#fbbf24'}>
            {waError ? 'Erro' : waStatus?.connected ? 'Conectado' : waStatus?.configured ? 'Desconectado' : 'Nao Configurado'}
          </Tag>
        </div>

        {waError && (
          <div className="mb-3 text-[11px] text-[#ef4444] bg-[#7f1d1d] rounded-lg p-3 border border-[#991b1b]">
            <div className="font-bold mb-1">⚠️ Erro</div>
            <div>{waError}</div>
          </div>
        )}

        {waStatus?.connected ? (
          <div className="text-[11px] text-[#94a3b8] space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse"></span>
              WhatsApp conectado e recebendo mensagens
            </div>
            <div className="text-[10px] text-[#475569]">
              Webhook: <code className="text-[#22d3ee]">/api/webhook/evolution</code>
            </div>
            <div className="text-[10px] text-[#475569]">
              Mensagens chegam automaticamente na tela Conversas
            </div>
          </div>
        ) : waStatus?.configured ? (
          <div className="space-y-3">
            {qrData?.base64 ? (
              <div className="flex flex-col items-center gap-3">
                <div className="text-[11px] text-[#94a3b8] text-center">
                  Escaneie o QR Code com seu WhatsApp:
                  <br />
                  <span className="text-[10px] text-[#475569]">Configuracoes &gt; Aparelhos conectados &gt; Conectar aparelho</span>
                </div>
                <div className="bg-white rounded-xl p-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrData.base64}
                    alt="QR Code WhatsApp"
                    width={220}
                    height={220}
                    className="block"
                  />
                </div>
                {qrData.pairingCode && (
                  <div className="text-center">
                    <div className="text-[10px] text-[#475569]">Ou use o codigo de pareamento:</div>
                    <code className="text-sm font-bold text-[#25D366] tracking-widest">{qrData.pairingCode}</code>
                  </div>
                )}
                <button
                  onClick={handleConnectWhatsApp}
                  className="px-3 py-1.5 bg-[#1e293b] text-[#94a3b8] text-[10px] rounded-lg hover:bg-[#334155] transition-colors"
                >
                  Gerar novo QR Code
                </button>
              </div>
            ) : (
              <div>
                <div className="text-[11px] text-[#94a3b8] mb-2">
                  Evolution API configurada mas WhatsApp nao conectado.
                </div>
                <button
                  onClick={handleConnectWhatsApp}
                  disabled={waLoading}
                  className="px-4 py-2 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition-colors disabled:opacity-50"
                >
                  {waLoading ? 'Gerando QR Code...' : 'Gerar QR Code'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] text-[#94a3b8] leading-relaxed">
              Para conectar WhatsApp, adicione no <code className="text-[#22d3ee]">.env.local</code>:
            </div>
            <pre className="text-[10px] text-[#cbd5e1] bg-[#0a0a14] rounded-lg p-3 border border-[#1e293b]">
{`NEXT_PUBLIC_EVOLUTION_API_URL=https://sua-evolution.com
EVOLUTION_API_KEY=sua-api-key
NEXT_PUBLIC_EVOLUTION_INSTANCE=condoplay
NEXT_PUBLIC_APP_URL=https://seu-app.vercel.app`}
            </pre>
            <div className="text-[10px] text-[#475569]">
              Precisa de uma instancia Evolution API v2. Pode usar Docker ou cloud.
            </div>
          </div>
        )}
      </Card>

      {/* Integrations */}
      <Card className="mt-3">
        <div className="text-xs font-bold text-[#22d3ee] mb-3">🔌 Integracoes</div>
        <div className="grid grid-cols-2 gap-2">
          {integrations.map(int => (
            <div key={int.name} className="flex items-center justify-between bg-[#0f172a] rounded-lg p-2.5">
              <span className="text-[11px] text-[#e2e8f0]">{int.name}</span>
              <Tag color={int.color}>{int.status}</Tag>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
