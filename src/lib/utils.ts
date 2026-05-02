import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatCurrencyShort(value: number): string {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return `R$${value.toFixed(0)}`;
}

export function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function hoursElapsed(from: string, to?: string): number {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  return (end - start) / (1000 * 60 * 60);
}

export function calculateFee(hoursElapsed: number): number {
  if (hoursElapsed <= 24) return 0;
  return Math.ceil(hoursElapsed / 24 - 1) * 30;
}

// ═══ PHONE NORMALIZATION ═══
// Fonte única: remove tudo que não é dígito e zeros à esquerda.
// Usar em hawkeye, LOKI, webhook Evolution e UI de conversas para garantir match.
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '').replace(/^0+/, '');
}

// Retorna [numero, numero_com_55, numero_sem_55] para queries que precisam
// procurar o mesmo telefone com ou sem DDI.
export function phoneVariants(phone: string | null | undefined): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  if (normalized.startsWith('55')) {
    variants.add(normalized.substring(2));
  } else {
    variants.add(`55${normalized}`);
  }
  return Array.from(variants);
}
