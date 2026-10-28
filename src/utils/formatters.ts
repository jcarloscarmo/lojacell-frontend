import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AroPecaTipo } from '@/types/domain';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarMoeda(centavos: number): string {
  const reais = (centavos || 0) / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function parseMoedaParaCentavos(valorTexto: string): number {
  const limpo = valorTexto.replace(/[^\d,-]/g, '').replace(',', '.');
  const numero = parseFloat(limpo);
  if (isNaN(numero)) return 0;
  return Math.round(numero * 100);
}

export function formatarData(isoString?: string): string {
  if (!isoString) return '—';
  try {
    return format(parseISO(isoString), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatarDataHora(isoString?: string): string {
  if (!isoString) return '—';
  try {
    return format(parseISO(isoString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
}

export function formatarNumeroOS(numero: number): string {
  return String(numero).padStart(6, '0');
}

export function caixaEhDeDiaAnterior(aberturaDataIso?: string, referenciaHoje: Date = new Date()): boolean {
  if (!aberturaDataIso) return false;
  try {
    const dataAbertura = startOfDay(parseISO(aberturaDataIso));
    const hoje = startOfDay(referenciaHoje);
    return dataAbertura.getTime() < hoje.getTime();
  } catch {
    return false;
  }
}

export function formatarAroPeca(aro?: AroPecaTipo): string {
  if (aro === 'com_aro') return 'Com Aro';
  if (aro === 'sem_aro') return 'Sem Aro';
  return 'N/A';
}

export function montarDescricaoPecaManual(params: {
  pecaTipo: string;
  modeloAparelho: string;
  qualidadePeca?: string;
  aroPeca?: AroPecaTipo;
}): string {
  const { pecaTipo, modeloAparelho, qualidadePeca, aroPeca } = params;
  const detalhes: string[] = [];
  if (qualidadePeca && qualidadePeca !== 'N/A') detalhes.push(qualidadePeca);
  if (aroPeca === 'com_aro') detalhes.push('Com Aro');
  if (aroPeca === 'sem_aro') detalhes.push('Sem Aro');
  const sufixo = detalhes.length > 0 ? ` (${detalhes.join(' • ')})` : '';
  return `${pecaTipo.trim()} ${modeloAparelho.trim()}${sufixo}`.trim();
}

export function aplicarMascaraTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

export function aplicarMascaraCpfCnpj(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);
  if (digitos.length <= 11) {
    return digitos
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function aplicarMascaraCep(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 5) return digitos;
  return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
}

export function gerarId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
