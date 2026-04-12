// ═══ LOKI × GOOGLE CALENDAR — Agendamento de Reuniões ═══
// Integra LOKI com Google Calendar para marcar reuniões com síndicos.
// Horários: 12-13h ou 18h+, seg-sáb

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const SALVATORI_EMAIL = 'salvatori@washme.com.br';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

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

// ═══ AGENDAR REUNIÃO (chamado pelo LOKI ao confirmar) ═══

export async function scheduleMetodoing(req: MeetingRequest) {
  const { conversationId, leadId, contactName, contactEmail, contactPhone, preferredTime, isVideo } = req;

  // Validar horário
  let hour: number;
  if (preferredTime === 'noon') {
    hour = 12; // 12:00-13:00
  } else if (preferredTime === 'evening') {
    hour = 18; // 18:00+
  } else {
    hour = 12; // default
  }

  // Gerar link Google Meet se for video
  let meetLink: string | null = null;
  if (isVideo) {
    meetLink = `https://meet.google.com/new`; // Em produção, criar via Google API
  }

  // Montar email para confirmação
  const emailSubject = `Reunião agendada: ${contactName} - Condo Play`;
  const emailBody = `
Olá João,

Reunião agendada com ${contactName} (${contactPhone}):

Data: ${req.preferredDate || 'A confirmar'}
Horário: ${preferredTime === 'noon' ? '12h-13h' : '18h+'}
Formato: ${isVideo ? 'Google Meet' : 'Presencial'}
${isVideo ? `Link: ${meetLink}` : ''}

Contato do síndico: ${contactEmail}

Attendees:
- João Salvatori <salvatori@washme.com.br>
- ${contactName} <${contactEmail}>

--
Condo Play
Trazendo jogos para condomínios
  `;

  // Salvar no CRM
  await supabase
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

  // Atualizar conversation
  await supabase
    .from('conversations')
    .update({
      status: 'reuniao_agendada',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // Log (tolerante a agent_logs não existir)
  try {
    await supabase.from('agent_logs').insert({
      tenant_id: 'aaaa0001-0000-0000-0000-000000000001',
      agent_type: 'loki',
      action: `Reunião agendada: ${contactName} às ${hour}h`,
      detail: JSON.stringify({
        conversation_id: conversationId,
        lead_id: leadId,
        contact_email: contactEmail,
        meeting_link: meetLink,
      }),
      metadata: { source: 'loki_schedule_meeting' },
    });
  } catch {
    // agent_logs may not exist
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
    emailTemplate: {
      to: SALVATORI_EMAIL,
      cc: contactEmail,
      subject: emailSubject,
      body: emailBody,
    },
  };
}

// ═══ HELPER: Detectar se síndico forneceu email ═══

export function extractEmailFromMessage(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

// ═══ HELPER: Extrair horário preferido da mensagem ═══

export function extractPreferredTime(text: string): 'noon' | 'evening' | null {
  const lower = text.toLowerCase();

  // Detectar 12-13h
  if (lower.includes('12') || lower.includes('almoço') || lower.includes('medio')) {
    return 'noon';
  }

  // Detectar 18h+
  if (lower.includes('18') || lower.includes('noite') || lower.includes('depois') || lower.includes('final')) {
    return 'evening';
  }

  return null;
}

// ═══ MESSAGE: Solicitar Email ═══

export const ASK_EMAIL_MESSAGE = `Para confirmar a reunião, preciso do seu email profissional. Qual é?`;

// ═══ MESSAGE: Confirmação Agendada ═══

export function getMeetingConfirmationMessage(
  date: string,
  time: 'noon' | 'evening',
  isVideo: boolean,
  meetLink?: string
) {
  return `Perfeito! 🎉 Reunião confirmada:

📅 ${date}
🕐 ${time === 'noon' ? '12h-13h' : '18h+'}
${isVideo ? `📹 Google Meet: ${meetLink || 'Link será enviado'}` : '📍 Presencial'}

Você receberá um email de confirmação em breve. Qualquer dúvida, é só mandar um WhatsApp!

Até lá! 👋`;
}
