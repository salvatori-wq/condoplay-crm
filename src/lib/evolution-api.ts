// ═══ EVOLUTION API CLIENT — WhatsApp Integration ═══

import { getEvolutionConfig } from './env';

function getConfig() {
  return getEvolutionConfig();
}

function headers() {
  const { apiKey } = getConfig();
  return {
    'Content-Type': 'application/json; charset=utf-8',
    apikey: apiKey,
  };
}

function instanceUrl(path: string): string {
  const { url, instance } = getConfig();
  return `${url}/${path}/${instance}`;
}

function baseUrl(path: string): string {
  const { url } = getConfig();
  return `${url}/${path}`;
}

async function checkedFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Evolution API ${res.status}: ${res.statusText} — ${body.substring(0, 200)}`);
  }
  return res;
}

// ═══ INSTANCE MANAGEMENT ═══

export async function createInstance() {
  const { url, instance } = getConfig();
  const res = await checkedFetch(`${url}/instance/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      instanceName: instance,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      rejectCall: true,
      msgCall: 'Nao aceitamos chamadas. Envie uma mensagem!',
      webhookByEvents: true,
      webhookBase64: false,
      webhookEvents: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'QRCODE_UPDATED',
      ],
    }),
  });
  return res.json();
}

export async function getInstanceStatus() {
  const res = await checkedFetch(instanceUrl('instance/connectionState'), {
    headers: headers(),
  });
  return res.json();
}

export async function getQrCode() {
  const res = await checkedFetch(instanceUrl('instance/connect'), {
    headers: headers(),
  });
  return res.json();
}

export async function restartInstance() {
  const res = await checkedFetch(instanceUrl('instance/restart'), {
    method: 'PUT',
    headers: headers(),
  });
  return res.json();
}

export async function logoutInstance() {
  const res = await checkedFetch(instanceUrl('instance/logout'), {
    method: 'DELETE',
    headers: headers(),
  });
  return res.json();
}

export async function setWebhook(webhookUrl: string) {
  const { url, instance } = getConfig();
  const res = await checkedFetch(`${url}/webhook/set/${instance}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: true,
        webhookBase64: false,
        events: [
          'MESSAGES_UPSERT',
          'CONNECTION_UPDATE',
        ],
      },
    }),
  });
  return res.json();
}

// ═══ ENCODING WORKAROUND FOR EVOLUTION API UTF-8 BUG ═══
// Evolution API infrastructure (nginx/Docker) discards non-ASCII bytes
// Solution: Strip diacritics, keeping text readable in Portuguese
// TODO: If Evolution API infra is fixed, remove this workaround

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ═══ MESSAGING ═══

export async function sendTextMessage(phone: string, text: string) {
  const number = normalizePhone(phone);
  const safeText = stripDiacritics(text);

  const res = await checkedFetch(instanceUrl('message/sendText'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number,
      text: safeText,
    }),
  });
  return res.json();
}

export async function sendMediaMessage(phone: string, mediaUrl: string, caption?: string, mediatype: 'image' | 'video' | 'document' = 'image') {
  const number = normalizePhone(phone);

  const res = await checkedFetch(instanceUrl('message/sendMedia'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number,
      mediatype,
      media: mediaUrl,
      caption: caption ? stripDiacritics(caption) : '',
    }),
  });
  return res.json();
}

// ═══ CONTACT UTILS ═══

export async function checkNumberExists(phone: string) {
  const number = normalizePhone(phone);

  const res = await checkedFetch(instanceUrl('chat/whatsappNumbers'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      numbers: [number],
    }),
  });
  return res.json();
}

// ═══ PHONE NORMALIZATION ═══

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (!digits || digits.length < 8) {
    throw new Error(`Invalid phone number: ${phone}`);
  }
  return digits.startsWith('55') ? digits : `55${digits}`;
}

// ═══ TYPES ═══

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      imageMessage?: { caption?: string; url?: string };
      videoMessage?: { caption?: string };
      documentMessage?: { fileName?: string };
      audioMessage?: Record<string, unknown>;
    };
    messageType?: string;
    messageTimestamp?: number;
    status?: string;
  };
}

export function extractMessageText(payload: EvolutionWebhookPayload): string {
  const msg = payload.data.message;
  if (!msg) return '';
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    `[${payload.data.messageType || 'media'}]`
  );
}

export function extractPhoneFromJid(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}
