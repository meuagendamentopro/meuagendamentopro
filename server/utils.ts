/**
 * Funções utilitárias para o servidor
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma data para exibição em formato brasileiro
 * @param date Data a ser formatada
 * @param includeTime Se deve incluir a hora na formatação
 * @returns String formatada (DD/MM/YYYY HH:mm ou DD/MM/YYYY)
 */
export function formatDateBr(date: Date | string, includeTime = false): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  
  return format(
    parsedDate,
    includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy',
    { locale: ptBR }
  );
}

/**
 * Formata uma hora para exibição (HH:mm)
 * @param date Data contendo a hora a ser formatada
 * @returns String formatada (HH:mm)
 */
export function formatTime(date: Date | string): string {
  const parsedDate = typeof date === 'string' ? parseISO(date) : date;
  return format(parsedDate, 'HH:mm');
}

/**
 * Extrai a data e hora de um objeto Date para strings formatadas
 * @param date Data a ser processada
 * @returns Objeto contendo data e hora formatadas
 */
export function extractDateAndTime(date: Date): { 
  formattedDate: string; 
  formattedTime: string;
} {
  return {
    formattedDate: formatDateBr(date),
    formattedTime: formatTime(date)
  };
}

/**
 * Verifica se um número de telefone está no formato internacional válido
 * @param phoneNumber Número de telefone a ser validado
 * @returns true se for válido, false caso contrário
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  // Formato internacional: +XXXXXXXXXXXX (pelo menos 8 dígitos após o código do país)
  // Ex: +5511999999999
  const phoneRegex = /^\+\d{2,3}\d{8,}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Adiciona parâmetros à URL mantendo os existentes
 * @param url URL base
 * @param params Objeto com parâmetros a adicionar
 * @returns URL com parâmetros adicionados
 */
export function addParamsToUrl(url: string, params: Record<string, string>): string {
  const urlObj = new URL(url);
  
  Object.entries(params).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });
  
  return urlObj.toString();
}

/**
 * Gera uma string aleatória de tamanho específico
 * @param length Tamanho da string
 * @returns String aleatória
 */
export function generateRandomString(length: number): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
}

/**
 * Formata um valor monetário em Real brasileiro
 * @param value Valor a ser formatado
 * @returns String formatada (R$ X,XX)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}