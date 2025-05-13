/**
 * Utilitários gerais para uso no servidor
 */

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data para exibição no formato brasileiro
 * @param date A data a ser formatada
 * @param includeTime Se deve incluir o horário na formatação (default: false)
 * @returns String formatada (ex: "01/01/2023" ou "01/01/2023 14:30")
 */
export function formatDateBR(date: Date, includeTime = false): string {
  const formatStr = includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
  return format(date, formatStr, { locale: ptBR });
}

/**
 * Verifica se uma string é um número de telefone válido
 * @param phone O número de telefone a ser validado
 * @returns Boolean indicando se é válido
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Implementação simples para verificar se é um número de telefone válido
  // Aceita formato internacional com ou sem '+' e com ou sem espaços
  // E.g. +5511999999999, 5511999999999, +55 11 99999-9999
  return /^(\+)?[0-9\s-]{10,15}$/.test(phone);
}

/**
 * Normaliza um número de telefone para o formato E.164
 * @param phone O número de telefone a ser normalizado
 * @returns String no formato E.164 (ex: +5511999999999)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove tudo que não for dígito
  const digits = phone.replace(/\D/g, '');
  
  // Se começar com 55 (Brasil), adiciona o "+"
  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }
  
  // Se não tiver o código do país, assume Brasil (+55)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  
  // Se já estiver em outro formato, apenas adiciona o "+" se não tiver
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/**
 * Formata um preço para exibição no formato brasileiro
 * @param value O valor a ser formatado
 * @returns String formatada (ex: "R$ 10,50")
 */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}