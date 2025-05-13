/**
 * Utilitários para formatação e manipulação de dados
 */

/**
 * Formata uma data para o formato brasileiro (DD/MM/YYYY)
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('pt-BR');
}

/**
 * Formata um horário para o formato 24h (HH:MM)
 */
export function formatTime(time: string | Date | null): string {
  if (!time) return 'N/A';
  
  if (typeof time === 'string') {
    // Se já for uma string no formato HH:MM
    if (/^\d{1,2}:\d{2}$/.test(time)) {
      return time;
    }
    
    // Caso contrário, tenta converter para data
    time = new Date(time);
  }
  
  return time.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

/**
 * Formata um valor monetário para o formato brasileiro (R$ X.XXX,XX)
 */
export function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Verifica se uma data é hoje
 */
export function isToday(date: Date | string): boolean {
  const today = new Date();
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Verifica se uma data é amanhã
 */
export function isTomorrow(date: Date | string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return (
    dateObj.getDate() === tomorrow.getDate() &&
    dateObj.getMonth() === tomorrow.getMonth() &&
    dateObj.getFullYear() === tomorrow.getFullYear()
  );
}

/**
 * Formata um número de telefone para exibição
 * Por exemplo: (11) 98765-4321
 */
export function formatPhone(phone: string | null): string {
  if (!phone) return 'N/A';
  
  // Remove todos os caracteres não numéricos
  const digits = phone.replace(/\D/g, '');
  
  // Verifica se é um número brasileiro
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  // Retorna o número formatado ou no formato original se não foi possível formatar
  return phone;
}

/**
 * Extrai data e hora de um objeto de agendamento
 */
export function extractDateAndTime(appointment: { date: Date }): { 
  appointmentDate: Date,
  appointmentTime: string
} {
  const date = new Date(appointment.date);
  
  return {
    appointmentDate: date,
    appointmentTime: formatTime(date)
  };
}