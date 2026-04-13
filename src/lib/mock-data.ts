import type { AgentLog, Conversation, Message, SearchLog, Condo, Lead, Invoice, ContentCalendar, Checkout } from '@/types/database';

// ═══ AGENT LOGS (Feed TIBIA) ═══
export const MOCK_AGENT_LOGS: AgentLog[] = [
  { id: '1', tenant_id: 't1', agent_type: 'hawkeye', action: 'Encontrou sindico profissional via LinkedIn', detail: 'Carlos Mendes — 12 condos na carteira, Zona Sul SP', metadata: {}, created_at: '2026-04-11T14:32:00Z' },
  { id: '2', tenant_id: 't1', agent_type: 'vision', action: 'Check-out registrado', detail: 'Catan — Apto 304, Res. Aurora, inicio: 14:30', metadata: {}, created_at: '2026-04-11T14:30:00Z' },
  { id: '3', tenant_id: 't1', agent_type: 'jarvis', action: 'Explicou regras de jogo', detail: 'Moradora Apto 304 perguntou sobre Catan — tutorial enviado', metadata: {}, created_at: '2026-04-11T14:28:00Z' },
  { id: '4', tenant_id: 't1', agent_type: 'loki', action: 'Pitch enviado via WhatsApp', detail: 'Sindico Carlos Mendes — dor identificada: area de lazer subutilizada', metadata: {}, created_at: '2026-04-11T14:25:00Z' },
  { id: '5', tenant_id: 't1', agent_type: 'hawkeye', action: 'Qualificou lead do Google Maps', detail: 'Cond. Jardim das Acacias — 200 unidades, sindica: Ana Rocha', metadata: {}, created_at: '2026-04-11T14:18:00Z' },
  { id: '6', tenant_id: 't1', agent_type: 'vision', action: 'Alerta 24h disparado', detail: 'Azul — Apto 712, cobranca R$30 ativada', metadata: {}, created_at: '2026-04-11T14:10:00Z' },
  { id: '7', tenant_id: 't1', agent_type: 'stark', action: 'Fechamento mensal gerado', detail: 'Res. Aurora — Mensalidade R$2.500 + taxas R$90 = R$2.590', metadata: {}, created_at: '2026-04-11T14:00:00Z' },
  { id: '8', tenant_id: 't1', agent_type: 'storm', action: 'Carrossel publicado', detail: "'5 jogos que unem vizinhos' — agendado 18h Instagram", metadata: {}, created_at: '2026-04-11T14:00:00Z' },
  { id: '9', tenant_id: 't1', agent_type: 'fury', action: 'Acervo separado para entrega', detail: '12 jogos para Cond. Pacifico — entrega 18/04', metadata: {}, created_at: '2026-04-11T14:00:00Z' },
  { id: '10', tenant_id: 't1', agent_type: 'hawkeye', action: 'Enriqueceu dados via SindicoNet', detail: 'Tel + email confirmados para 3 sindicos regiao Moema', metadata: {}, created_at: '2026-04-11T13:55:00Z' },
  { id: '11', tenant_id: 't1', agent_type: 'loki', action: 'Reuniao agendada + link enviado', detail: 'Ana Rocha — 16/04 15h, Google Meet, FUP programado 15/04', metadata: {}, created_at: '2026-04-11T13:50:00Z' },
  { id: '12', tenant_id: 't1', agent_type: 'hawkeye', action: 'Descartou lead frio', detail: 'Cond. Vista Alegre — sem sindico profissional, <40 unidades', metadata: {}, created_at: '2026-04-11T13:40:00Z' },
  { id: '13', tenant_id: 't1', agent_type: 'jarvis', action: 'Indicou jogo por perfil', detail: 'Familia com criancas 6-10 → Ticket to Ride + Dixit', metadata: {}, created_at: '2026-04-11T13:10:00Z' },
  { id: '14', tenant_id: 't1', agent_type: 'jarvis', action: 'Peca faltando reportada', detail: 'Azul — peca ausente, VISION notificado', metadata: {}, created_at: '2026-04-11T12:45:00Z' },
  { id: '15', tenant_id: 't1', agent_type: 'loki', action: 'FUP de confirmacao disparado', detail: 'Pedro Lins — reuniao amanha 10h, confirmou presenca', metadata: {}, created_at: '2026-04-11T11:30:00Z' },
  { id: '16', tenant_id: 't1', agent_type: 'fury', action: 'Portaria treinada', detail: 'Res. Aurora — zelador orientado sobre check-in/out', metadata: {}, created_at: '2026-04-11T11:00:00Z' },
  { id: '17', tenant_id: 't1', agent_type: 'stark', action: 'Pagamento confirmado', detail: 'Cond. Pacifico — mensalidade R$2.200 paga', metadata: {}, created_at: '2026-04-11T11:00:00Z' },
  { id: '18', tenant_id: 't1', agent_type: 'storm', action: 'Post gerado', detail: 'Frase sobre automacao + vida em condominio', metadata: {}, created_at: '2026-04-11T11:00:00Z' },
  { id: '19', tenant_id: 't1', agent_type: 'loki', action: 'Venda fechada! Plano R$2.200/mes', detail: 'Cond. Pacifico — passando ao FURY para implantacao', metadata: {}, created_at: '2026-04-11T10:15:00Z' },
  { id: '20', tenant_id: 't1', agent_type: 'stark', action: 'Relatorio do franqueado', detail: 'Zona Sul — 3 condos, MRR R$7.200', metadata: {}, created_at: '2026-04-11T10:00:00Z' },
  { id: '21', tenant_id: 't1', agent_type: 'vision', action: 'Devolucao conferida OK', detail: 'Ticket to Ride — todas pecas, estado bom', metadata: {}, created_at: '2026-04-11T09:00:00Z' },
  { id: '22', tenant_id: 't1', agent_type: 'storm', action: 'Semana planejada', detail: 'Seg: automacao / Qua: jogo da semana / Sex: historia Condo Play', metadata: {}, created_at: '2026-04-11T09:00:00Z' },
];

// ═══ CONVERSATIONS ═══
export const MOCK_CONVERSATIONS: (Conversation & { messages: Message[] })[] = [
  {
    id: 'c1', tenant_id: 't1', lead_id: 'l1', condo_id: null, agent_type: 'loki', channel: 'whatsapp',
    contact_name: 'Carlos Mendes', contact_phone: '11999001234', contact_role: 'Sindico Prof.', status: 'ativo', unread: 2,
    archived: false, loss_reason: null, loss_notes: null,
    created_at: '2026-04-11T14:30:00Z', updated_at: '2026-04-11T14:41:00Z',
    messages: [
      { id: 'm1', conversation_id: 'c1', from_type: 'agent', content: 'Boa tarde Carlos! Sou da Condo Play 🎮 Vi que voce administra 12 condominios na Zona Sul. Temos uma solucao que transforma a area de lazer em um espaco de convivencia com jogos de tabuleiro premium.', metadata: {}, created_at: '2026-04-11T14:30:00Z' },
      { id: 'm2', conversation_id: 'c1', from_type: 'contact', content: 'Opa, boa tarde! Interessante. Como funciona?', metadata: {}, created_at: '2026-04-11T14:33:00Z' },
      { id: 'm3', conversation_id: 'c1', from_type: 'agent', content: 'Levamos um acervo de 12+ jogos pro condominio. Moradores retiram na portaria, usam por ate 24h sem custo extra. Trocamos o acervo a cada 4 meses. Planos a partir de R$1.500/mes — e o condominio ganha uma area de lazer nova sem obra.', metadata: {}, created_at: '2026-04-11T14:34:00Z' },
      { id: 'm4', conversation_id: 'c1', from_type: 'contact', content: 'Quanto sai pra um condominio de 200 unidades?', metadata: {}, created_at: '2026-04-11T14:36:00Z' },
      { id: 'm5', conversation_id: 'c1', from_type: 'agent', content: 'Pra 200 unidades recomendo o plano de R$2.200/mes — inclui acervo de 15 jogos, suporte 24h pros moradores, troca quadrimestral e gestao completa. Da R$11 por unidade/mes. Posso te mostrar na pratica? Tenho 15min amanha as 15h.', metadata: {}, created_at: '2026-04-11T14:37:00Z' },
      { id: 'm6', conversation_id: 'c1', from_type: 'contact', content: 'Pode ser, me manda o link', metadata: {}, created_at: '2026-04-11T14:40:00Z' },
      { id: 'm7', conversation_id: 'c1', from_type: 'agent', content: '📅 Agendado: 16/04 as 15h. Link: meet.google.com/abc. Confirmo contigo amanha de manha. Ate la, Carlos!', metadata: {}, created_at: '2026-04-11T14:41:00Z' },
    ]
  },
  {
    id: 'c2', tenant_id: 't1', lead_id: 'l2', condo_id: null, agent_type: 'loki', channel: 'whatsapp',
    contact_name: 'Ana Rocha', contact_phone: '11998765432', contact_role: 'Sindica', status: 'aguardando', unread: 0,
    archived: false, loss_reason: null, loss_notes: null,
    created_at: '2026-04-11T10:15:00Z', updated_at: '2026-04-11T11:03:00Z',
    messages: [
      { id: 'm8', conversation_id: 'c2', from_type: 'agent', content: 'Bom dia Ana! Aqui e da Condo Play. Vi seu perfil no SindicoNet — o Jardim das Acacias tem uma area de lazer incrivel. Ja pensou em adicionar jogos de tabuleiro como opcao pros moradores?', metadata: {}, created_at: '2026-04-11T10:15:00Z' },
      { id: 'm9', conversation_id: 'c2', from_type: 'contact', content: 'Bom dia, pode falar sim', metadata: {}, created_at: '2026-04-11T10:40:00Z' },
      { id: 'm10', conversation_id: 'c2', from_type: 'agent', content: 'Levamos um acervo completo, os moradores usam sem custo adicional. Planos de R$1.500 a R$3.000/mes dependendo do tamanho. A gente cuida de tudo. Quer agendar 15min?', metadata: {}, created_at: '2026-04-11T10:42:00Z' },
      { id: 'm11', conversation_id: 'c2', from_type: 'contact', content: 'Vou pensar, semana que vem tenho assembleia', metadata: {}, created_at: '2026-04-11T11:02:00Z' },
      { id: 'm12', conversation_id: 'c2', from_type: 'agent', content: 'Perfeito! Posso preparar um material resumido pra voce apresentar na assembleia — mostrando o custo por unidade. Retorno segunda?', metadata: {}, created_at: '2026-04-11T11:03:00Z' },
    ]
  },
  {
    id: 'c3', tenant_id: 't1', lead_id: null, condo_id: 'cd1', agent_type: 'jarvis', channel: 'whatsapp',
    contact_name: 'Marina (Apto 304)', contact_phone: null, contact_role: 'Moradora', status: 'ativo', unread: 1,
    archived: false, loss_reason: null, loss_notes: null,
    created_at: '2026-04-11T14:20:00Z', updated_at: '2026-04-11T14:24:00Z',
    messages: [
      { id: 'm13', conversation_id: 'c3', from_type: 'contact', content: 'Oi! Queria pegar o Catan mas nunca joguei. E dificil?', metadata: {}, created_at: '2026-04-11T14:20:00Z' },
      { id: 'm14', conversation_id: 'c3', from_type: 'agent', content: 'Oi Marina! 😄 Catan e mais simples do que parece. 3-4 jogadores, uns 60min. Voce coleta recursos e constroi vilas. Mando um video de 3min?', metadata: {}, created_at: '2026-04-11T14:21:00Z' },
      { id: 'm15', conversation_id: 'c3', from_type: 'contact', content: 'Manda sim!', metadata: {}, created_at: '2026-04-11T14:23:00Z' },
      { id: 'm16', conversation_id: 'c3', from_type: 'agent', content: 'Aqui: [tutorial 3min]. Dica: posicione perto de recursos variados no inicio. Qualquer duvida durante o jogo, me chama! 🎲', metadata: {}, created_at: '2026-04-11T14:24:00Z' },
    ]
  },
  {
    id: 'c4', tenant_id: 't1', lead_id: null, condo_id: 'cd1', agent_type: 'vision', channel: 'whatsapp',
    contact_name: 'Portaria Res. Aurora', contact_phone: null, contact_role: 'Zelador', status: 'alerta', unread: 1,
    archived: false, loss_reason: null, loss_notes: null,
    created_at: '2026-04-11T14:10:00Z', updated_at: '2026-04-11T14:16:00Z',
    messages: [
      { id: 'm17', conversation_id: 'c4', from_type: 'agent', content: '⚠️ Alerta: Azul retirado pelo Apto 712 completou 24h. Cobranca R$30/dia ativada. Ja foi devolvido?', metadata: {}, created_at: '2026-04-11T14:10:00Z' },
      { id: 'm18', conversation_id: 'c4', from_type: 'contact', content: 'Ainda nao devolveram', metadata: {}, created_at: '2026-04-11T14:15:00Z' },
      { id: 'm19', conversation_id: 'c4', from_type: 'agent', content: 'Entendido. R$30 ativado. Notifiquei o morador. Me avise na devolucao para conferencia de pecas.', metadata: {}, created_at: '2026-04-11T14:16:00Z' },
    ]
  },
];

// ═══ SEARCH LOGS ═══
export const MOCK_SEARCH_LOGS: SearchLog[] = [
  { id: 's1', tenant_id: 't1', source: 'LinkedIn Sales Nav', query: 'sindico profissional Sao Paulo zona sul', cost: 0.45, results_count: 23, qualified_count: 8, leads_found: ['Carlos Mendes — 12 condos', 'Fernanda Alves — 6 condos', 'Roberto Dias — 9 condos'], created_at: '2026-04-11T14:32:00Z' },
  { id: 's2', tenant_id: 't1', source: 'Google Maps API', query: 'condominio 100+ unidades Moema', cost: 0.12, results_count: 47, qualified_count: 15, leads_found: ['Cond. Jardim Acacias — 200un', 'Res. Flores — 180un', 'Ed. Horizonte — 120un'], created_at: '2026-04-11T14:18:00Z' },
  { id: 's3', tenant_id: 't1', source: 'SindicoNet', query: 'sindicos ativos regiao sul SP', cost: 0, results_count: 31, qualified_count: 12, leads_found: ['Ana Rocha — Jd. Acacias', 'Pedro Lins — Res. Monte', 'Lucia Santos — Ed. Park'], created_at: '2026-04-11T13:55:00Z' },
  { id: 's4', tenant_id: 't1', source: 'Apollo.io', query: 'property manager condominium SP', cost: 0.80, results_count: 18, qualified_count: 5, leads_found: ['Marcos Ribeiro — Adm. Predial', 'Julia Costa — Gestora'], created_at: '2026-04-11T13:40:00Z' },
  { id: 's5', tenant_id: 't1', source: 'Instagram API', query: '#sindicoProfissional #gestaocondominial', cost: 0, results_count: 14, qualified_count: 3, leads_found: ['@sindico.carlos', '@gestao.predial.sp'], created_at: '2026-04-11T11:00:00Z' },
];

// ═══ CONDOS ═══
export const MOCK_CONDOS: Condo[] = [
  { id: 'cd1', tenant_id: 't1', name: 'Res. Aurora', address: 'Rua das Flores, 123 - Moema', units: 180, sindico_lead_id: null, status: 'ativo', monthly_plan: 2500, onboarded_at: '2026-02-01T00:00:00Z', created_at: '2026-01-15T00:00:00Z' },
  { id: 'cd2', tenant_id: 't1', name: 'Cond. Pacifico', address: 'Av. Atlantica, 456 - Vila Mariana', units: 120, sindico_lead_id: null, status: 'ativo', monthly_plan: 2200, onboarded_at: '2026-03-10T00:00:00Z', created_at: '2026-02-20T00:00:00Z' },
  { id: 'cd3', tenant_id: 't1', name: 'Ed. Monte Verde', address: 'Rua Verde, 789 - Brooklin', units: 90, sindico_lead_id: null, status: 'implantacao', monthly_plan: 1500, onboarded_at: null, created_at: '2026-04-05T00:00:00Z' },
];

// ═══ LEADS ═══
export const MOCK_LEADS: Lead[] = [
  { id: 'l1', tenant_id: 't1', name: 'Carlos Mendes', role: 'Sindico Profissional', phone: '11999001234', email: 'carlos@email.com', source: 'linkedin', source_cost: 0.45, status: 'reuniao', qualified: true, notes: '12 condos na carteira', metadata: {}, created_at: '2026-04-11T14:32:00Z', updated_at: '2026-04-11T14:41:00Z' },
  { id: 'l2', tenant_id: 't1', name: 'Ana Rocha', role: 'Sindica', phone: '11998765432', email: 'ana@email.com', source: 'sindiconet', source_cost: 0, status: 'em_contato', qualified: true, notes: 'Assembleia semana que vem', metadata: {}, created_at: '2026-04-11T14:18:00Z', updated_at: '2026-04-11T11:03:00Z' },
  { id: 'l3', tenant_id: 't1', name: 'Pedro Lins', role: 'Sindico', phone: '11997654321', email: 'pedro@email.com', source: 'sindiconet', source_cost: 0, status: 'reuniao', qualified: true, notes: 'Reuniao amanha 10h', metadata: {}, created_at: '2026-04-10T09:00:00Z', updated_at: '2026-04-11T11:30:00Z' },
  { id: 'l4', tenant_id: 't1', name: 'Fernanda Alves', role: 'Sindica Profissional', phone: '11996543210', email: 'fernanda@email.com', source: 'linkedin', source_cost: 0.45, status: 'prospectado', qualified: true, notes: '6 condos na carteira', metadata: {}, created_at: '2026-04-11T14:32:00Z', updated_at: '2026-04-11T14:32:00Z' },
  { id: 'l5', tenant_id: 't1', name: 'Roberto Dias', role: 'Sindico Profissional', phone: '11995432109', email: 'roberto@email.com', source: 'linkedin', source_cost: 0.45, status: 'prospectado', qualified: true, notes: '9 condos na carteira', metadata: {}, created_at: '2026-04-11T14:32:00Z', updated_at: '2026-04-11T14:32:00Z' },
  { id: 'l6', tenant_id: 't1', name: 'Marcos Ribeiro', role: 'Administrador Predial', phone: '11994321098', email: null, source: 'apollo', source_cost: 0.80, status: 'em_contato', qualified: true, notes: null, metadata: {}, created_at: '2026-04-11T13:40:00Z', updated_at: '2026-04-11T13:40:00Z' },
  { id: 'l7', tenant_id: 't1', name: 'Julia Costa', role: 'Gestora', phone: null, email: 'julia@email.com', source: 'apollo', source_cost: 0.80, status: 'proposta', qualified: true, notes: 'Proposta enviada R$1.800', metadata: {}, created_at: '2026-04-09T10:00:00Z', updated_at: '2026-04-10T15:00:00Z' },
  { id: 'l8', tenant_id: 't1', name: 'Lucia Santos', role: 'Sindica', phone: '11993210987', email: 'lucia@email.com', source: 'sindiconet', source_cost: 0, status: 'proposta', qualified: true, notes: 'Ed. Park — 150 unidades', metadata: {}, created_at: '2026-04-08T14:00:00Z', updated_at: '2026-04-10T09:00:00Z' },
];

// ═══ INVOICES ═══
export const MOCK_INVOICES: Invoice[] = [
  { id: 'i1', condo_id: 'cd1', tenant_id: 't1', month: '2026-04', plan_amount: 2500, extra_fees: 90, total: 2590, status: 'pago', paid_at: '2026-04-05T00:00:00Z', created_at: '2026-04-01T00:00:00Z' },
  { id: 'i2', condo_id: 'cd2', tenant_id: 't1', month: '2026-04', plan_amount: 2200, extra_fees: 0, total: 2200, status: 'pago', paid_at: '2026-04-03T00:00:00Z', created_at: '2026-04-01T00:00:00Z' },
  { id: 'i3', condo_id: 'cd1', tenant_id: 't1', month: '2026-03', plan_amount: 2500, extra_fees: 60, total: 2560, status: 'pago', paid_at: '2026-03-05T00:00:00Z', created_at: '2026-03-01T00:00:00Z' },
  { id: 'i4', condo_id: 'cd2', tenant_id: 't1', month: '2026-03', plan_amount: 2200, extra_fees: 30, total: 2230, status: 'pago', paid_at: '2026-03-04T00:00:00Z', created_at: '2026-03-01T00:00:00Z' },
];

// ═══ CHECKOUTS ═══
export const MOCK_CHECKOUTS: Checkout[] = [
  { id: 'ck1', condo_game_id: 'cg1', condo_id: 'cd1', tenant_id: 't1', resident_name: 'Marina Silva', apt: '304', checked_out_at: '2026-04-11T14:30:00Z', checked_in_at: null, hours_elapsed: null, fee_charged: 0, created_at: '2026-04-11T14:30:00Z' },
  { id: 'ck2', condo_game_id: 'cg2', condo_id: 'cd1', tenant_id: 't1', resident_name: 'Paulo Souza', apt: '712', checked_out_at: '2026-04-10T14:00:00Z', checked_in_at: null, hours_elapsed: null, fee_charged: 30, created_at: '2026-04-10T14:00:00Z' },
  { id: 'ck3', condo_game_id: 'cg3', condo_id: 'cd1', tenant_id: 't1', resident_name: 'Ana Clara', apt: '501', checked_out_at: '2026-04-11T08:00:00Z', checked_in_at: '2026-04-11T09:00:00Z', hours_elapsed: 1, fee_charged: 0, created_at: '2026-04-11T08:00:00Z' },
  { id: 'ck4', condo_game_id: 'cg4', condo_id: 'cd2', tenant_id: 't1', resident_name: 'Ricardo Lima', apt: '203', checked_out_at: '2026-04-11T10:00:00Z', checked_in_at: null, hours_elapsed: null, fee_charged: 0, created_at: '2026-04-11T10:00:00Z' },
];

// ═══ CONTENT CALENDAR ═══
export const MOCK_CONTENT_CALENDAR: ContentCalendar[] = [
  { id: 'cc1', tenant_id: 't1', day_of_week: 1, theme: 'Automacao', content_type: 'carrossel', content: '5 jogos que unem vizinhos — como a tecnologia transforma a convivencia', scheduled_at: '2026-04-14T18:00:00Z', published: false, created_at: '2026-04-11T09:00:00Z' },
  { id: 'cc2', tenant_id: 't1', day_of_week: 3, theme: 'Jogo da Semana', content_type: 'post', content: 'Catan: o jogo que ensina negociacao para todas as idades 🎲', scheduled_at: '2026-04-16T18:00:00Z', published: false, created_at: '2026-04-11T09:00:00Z' },
  { id: 'cc3', tenant_id: 't1', day_of_week: 5, theme: 'Historia Condo Play', content_type: 'reels', content: 'Como o Res. Aurora transformou a area de lazer com jogos de tabuleiro', scheduled_at: '2026-04-18T18:00:00Z', published: false, created_at: '2026-04-11T09:00:00Z' },
  { id: 'cc4', tenant_id: 't1', day_of_week: 1, theme: 'Automacao', content_type: 'carrossel', content: 'Sindico: como oferecer lazer premium sem gastar com obras', scheduled_at: '2026-04-07T18:00:00Z', published: true, created_at: '2026-04-04T09:00:00Z' },
  { id: 'cc5', tenant_id: 't1', day_of_week: 3, theme: 'Jogo da Semana', content_type: 'post', content: 'Azul: estrategia e arte em cada jogada', scheduled_at: '2026-04-09T18:00:00Z', published: true, created_at: '2026-04-04T09:00:00Z' },
  { id: 'cc6', tenant_id: 't1', day_of_week: 5, theme: 'Historia Condo Play', content_type: 'reels', content: 'Um mes depois: moradores do Cond. Pacifico contam a experiencia', scheduled_at: '2026-04-11T18:00:00Z', published: false, created_at: '2026-04-04T09:00:00Z' },
];

// ═══ CONDO EXTRA DATA (para UI) ═══
export const MOCK_CONDO_DETAILS = [
  { id: 'cd1', jogos: 12, fora: 3, taxas: 90, proxTroca: 'Jun/26' },
  { id: 'cd2', jogos: 8, fora: 1, taxas: 0, proxTroca: 'Jul/26' },
  { id: 'cd3', jogos: 0, fora: 0, taxas: 0, proxTroca: '—' },
];
