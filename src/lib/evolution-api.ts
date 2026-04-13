// ═══ EVOLUTION API CLIENT — WhatsApp Integration ═══

const EVOLUTION_API_URL = process.env.NEXT_PUBLIC_EVOLUTION_API_URL || '';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || '';
const INSTANCE_NAME = process.env.NEXT_PUBLIC_EVOLUTION_INSTANCE || 'condoplay';

function headers() {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    apikey: EVOLUTION_API_KEY,
  };
}

// ═══ INSTANCE MANAGEMENT ═══

export async function createInstance() {
  const res = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      instanceName: INSTANCE_NAME,
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
  if (!res.ok) {
    throw new Error(`Evolution API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getInstanceStatus() {
  const res = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Evolution API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getQrCode() {
  const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${INSTANCE_NAME}`, {
    headers: headers(),
  });
  if (!res.ok) {
    throw new Error(`Evolution API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function restartInstance() {
  const res = await fetch(`${EVOLUTION_API_URL}/instance/restart/${INSTANCE_NAME}`, {
    method: 'PUT',
    headers: headers(),
  });
  return res.json();
}

export async function logoutInstance() {
  const res = await fetch(`${EVOLUTION_API_URL}/instance/logout/${INSTANCE_NAME}`, {
    method: 'DELETE',
    headers: headers(),
  });
  return res.json();
}

export async function setWebhook(webhookUrl: string) {
  const res = await fetch(`${EVOLUTION_API_URL}/webhook/set/${INSTANCE_NAME}`, {
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
  if (!res.ok) {
    throw new Error(`Evolution API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ═══ ENCODING WORKAROUND FOR EVOLUTION API UTF-8 BUG ═══
// Evolution API infrastructure (nginx/Docker) discards non-ASCII bytes
// Solution: Strip diacritics, keeping text readable in Portuguese
// TODO: If Evolution API infra is fixed (nginx charset utf-8 + Docker LANG=C.UTF-8),
//       remove this workaround and return text as-is

function encodeBaileysWorkaround(text: string): string {
  // Step 1: Decompose characters (NFD separates base + combining marks)
  // "João" → "J" + "o" + "a" + combining_tilde + "o"
  const decomposed = text.normalize('NFD');

  // Step 2: Remove combining diacritical marks (accents, tildes, cedillas)
  // "João" → "Joao", "São" → "Sao", "área" → "area"
  return decomposed.replace(/[\u0300-\u036f]/g, '');
}

// ═══ MESSAGING ═══

export async function sendTextMessage(phone: string, text: string) {
  // Normalize phone: remove non-digits, ensure country code
  const number = phone.replace(/\D/g, '').replace(/^0+/, '');
  const jid = number.includes('55') ? `${number}@s.whatsapp.net` : `55${number}@s.whatsapp.net`;

  // Strip diacritics inline (redundant safety — Evolution API discards non-ASCII)
  const safeText = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  console.log('[sendTextMessage] original:', text.substring(0, 30), '→ safe:', safeText.substring(0, 30));

  const payload = {
    number: jid.replace('@s.whatsapp.net', ''),
    text: safeText,
  };

  const res = await fetch(`${EVOLUTION_API_URL}/message/sendText/${INSTANCE_NAME}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function sendMediaMessage(phone: string, mediaUrl: string, caption?: string, mediatype: 'image' | 'video' | 'document' = 'image') {
  const number = phone.replace(/\D/g, '').replace(/^0+/, '');

  const res = await fetch(`${EVOLUTION_API_URL}/message/sendMedia/${INSTANCE_NAME}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      number: number.includes('55') ? number : `55${number}`,
      mediatype,
      media: mediaUrl,
      caption: caption || '',
    }),
  });
  return res.json();
}

// ═══ CONTACT UTILS ═══

export async function checkNumberExists(phone: string) {
  const number = phone.replace(/\D/g, '').replace(/^0+/, '');

  const res = await fetch(`${EVOLUTION_API_URL}/chat/whatsappNumbers/${INSTANCE_NAME}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      numbers: [number.includes('55') ? number : `55${number}`],
    }),
  });
  return res.json();
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
