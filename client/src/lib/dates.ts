export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
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

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
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
    
    // Usar UTC para garantir consistência no fuso horário e compensar para GMT-3 (Brasil)
    const result = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours + 3, // Adiciona 3 horas para compensar o fuso horário
      minutes,
      0,
      0
    ));
    
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
  // Cria uma nova data usando os componentes locais da data UTC
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}
