export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    console.error('Data inválida fornecida para formatDate:', date);
    return 'Data inválida';
  }
  
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    console.error('Data inválida fornecida para formatTime:', date);
    return 'Hora inválida';
  }
  
  // Usar UTC para manter consistência com o resto do sistema
  const hours = dateObj.getUTCHours().toString().padStart(2, '0');
  const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short' });
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function getNextDays(days: number = 7): Date[] {
  const result: Date[] = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    date.setHours(0, 0, 0, 0);
    result.push(date);
  }
  
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getToday(): Date {
  const today = new Date();
  
  // Resetar horas, minutos, segundos e milissegundos
  // E manter o fuso horário local
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0, 0, 0, 0
  );
}

export function getMonthStartEnd(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

export function combineDateAndTime(date: Date, timeString: string): Date {
  // Verifica se date é uma data válida
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error("Data inválida fornecida:", date);
    throw new Error("Data inválida");
  }
  
  // Verifica se timeString é uma string válida no formato HH:MM
  if (!timeString || typeof timeString !== 'string' || !timeString.match(/^\d{1,2}:\d{2}$/)) {
    console.error("Formato de hora inválido:", timeString);
    throw new Error("Formato de hora inválido");
  }
  
  try {
    // Extrai horas e minutos
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Verifica se horas e minutos são números válidos
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error(`Valores de hora inválidos: ${hours}:${minutes}`);
    }
    
    // CORREÇÃO: Criar data em UTC para evitar conversão automática de timezone
    // Isso garante que o horário selecionado pelo usuário seja mantido exatamente
    const result = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes,
      0,
      0
    ));
    
    console.log(`Data e hora combinadas (sem ajuste): ${date.toLocaleDateString()} ${timeString} -> ${result.toLocaleString()}`);
    
    return result;
  } catch (error) {
    console.error("Erro ao combinar data e hora:", error);
    throw new Error(`Erro ao combinar data (${date}) e hora (${timeString})`);
  }
}

export function dateToISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Ajusta uma data UTC para ser interpretada como data local (preservando o dia correto)
export function adjustToLocalTimezone(date: Date): Date {
  // Retorna a data como está, usando o fuso horário local automaticamente
  // O JavaScript já lida com a conversão de UTC para o fuso horário local
  return new Date(date.getTime());
}

/**
 * Formata uma data para exibir o tempo relativo (ex: "há 2 horas", "há 3 dias")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // Menos de 1 minuto
  if (diffInSeconds < 60) {
    return 'agora mesmo';
  }
  
  // Menos de 1 hora
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  
  // Menos de 1 dia
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  
  // Menos de 1 semana
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  
  // Menos de 1 mês (aproximadamente 30 dias)
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  
  // Menos de 1 ano
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  
  // Mais de 1 ano
  const years = Math.floor(diffInSeconds / 31536000);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
}
