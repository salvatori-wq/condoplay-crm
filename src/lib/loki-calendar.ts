// ═══ LOKI x GOOGLE CALENDAR — Agendamento de Reunioes ═══
// Integra LOKI com Google Calendar para marcar reunioes com sindicos.
// Horarios: 12-13h ou 18h+, seg-sab

import { supabaseServer } from './supabase-server';
import { DEFAULT_TENANT_ID } from './env';

export interface MeetingRequest {
  conversationId: string;
  leadId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  preferredDate?: string; // YYYY-MM-DD
  preferredTime?: 'noon' | 'evening'; // 12-13h ou 18h+
  isVideo?: boolean; // true = Google Meet, false = presencial
}

// ═══ AGENDAR REUNIAO (chamado pelo LOKI ao confirmar) ═══

export async function scheduleMeeting(req: MeetingRequest) {
  const { conversationId, leadId, contactName, contactEmail, contactPhone, preferredTime, isVideo } = req;

  let hour: number;
  if (preferredTime === 'noon') {
    hour = 12;
  } else if (preferredTime === 'evening') {
    hour = 18;
  } else {
    hour = 12;
  }

  // TODO: Integrar com Google Calendar API para criar evento real
  // Por enquanto, apenas registra no CRM
  const meetLink = isVideo ? 'https://meet.google.com/new' : null;

  // Salvar no CRM
  const { error: leadErr } = await supabaseServer
    .from('leads')
    .update({
      status: 'reuniao_agendada',
      metadata: {
        meeting_scheduled: new Date().toISOString(),
        meeting_email: contactEmail,
        meeting_phone: contactPhone,
        meeting_type: isVideo ? 'google_meet' : 'presencial',
        meeting_link: meetLink,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (leadErr) {
    console.error('[LokiCalendar] Failed to update lead:', leadErr.message);
  }

  // Atualizar conversation
  const { error: convoErr } = await supabaseServer
    .from('conversations')
    .update({
      status: 'reuniao_agendada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (convoErr) {
    console.error('[LokiCalendar] Failed to update conversation:', convoErr.message);
  }

  // Log
  try {
    await supabaseServer.from('agent_logs').insert({
      tenant_id: DEFAULT_TENANT_ID,
      agent_type: 'loki',
      action: `Reuniao agendada: ${contactName} as ${hour}h`,
      detail: JSON.stringify({
        conversation_id: conversationId,
        lead_id: leadId,
        contact_email: contactEmail,
        meeting_link: meetLink,
      }),
      metadata: { source: 'loki_schedule_meeting' },
    });
  } catch (err) {
    console.error('[LokiCalendar] Failed to log meeting:', err instanceof Error ? err.message : err);
  }

  return {
    ok: true,
    meeting: {
      contactName,
      contactEmail,
      contactPhone,
      time: `${hour}:00`,
      type: isVideo ? 'Google Meet' : 'Presencial',
      meetLink,
    },
  };
}

// ═══ HELPER: Detectar se sindico forneceu email ═══

export function extractEmailFromMessage(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

// ═══ HELPER: Extrair horario preferido da mensagem ═══

export function extractPreferredTime(text: string): 'noon' | 'evening' | null {
  const lower = text.toLowerCase();

  if (lower.includes('12') || lower.includes('almoco') || lower.includes('medio')) {
    return 'noon';
  }

  if (lower.includes('18') || lower.includes('noite') || lower.includes('depois') || lower.includes('final')) {
    return 'evening';
  }

  return null;
}

// ═══ MESSAGES (sem emojis — comunicacao profissional) ═══

export const ASK_EMAIL_MESSAGE = `Para confirmar a reuniao, preciso do seu email profissional. Qual e?`;

export function getMeetingConfirmationMessage(
  date: string,
  time: 'noon' | 'evening',
  isVideo: boolean,
  meetLink?: string
) {
  const lines = [
    `Perfeito! Reuniao confirmada:`,
    ``,
    `Data: ${date}`,
    `Horario: ${time === 'noon' ? '12h-13h' : '18h+'}`,
    isVideo
      ? `Formato: Google Meet${meetLink ? ` — ${meetLink}` : ' (link sera enviado)'}`
      : `Formato: Presencial`,
    ``,
    `Voce recebera um email de confirmacao em breve. Qualquer duvida, e so mandar um WhatsApp!`,
    ``,
    `Ate la!`,
  ];
  return lines.join('\n');
}
