import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value / 100);
}

export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Force format as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  if (cleaned.length >= 11) {
    // Caso seja um número com 11 dígitos (com 9 na frente) - formato celular Brasil
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`;
  } else if (cleaned.length === 10) {
    // Para números com 10 dígitos (sem o 9) - formato antigo ou telefone fixo
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6, 10)}`;
  } else if (cleaned.length > 2) {
    // Trata números incompletos, mas com pelo menos o DDD
    const remainingDigits = cleaned.substring(2);
    if (remainingDigits.length <= 4) {
      // Para números com até 4 dígitos após o DDD
      return `(${cleaned.substring(0, 2)}) ${remainingDigits}`;
    } else if (remainingDigits.length <= 5) {
      // Para números com 5 dígitos após o DDD (provável celular incompleto)
      return `(${cleaned.substring(0, 2)}) ${remainingDigits}`;
    } else {
      // Para números mais completos, adiciona o hífen
      return `(${cleaned.substring(0, 2)}) ${remainingDigits.substring(0, remainingDigits.length-4)}-${remainingDigits.substring(remainingDigits.length-4)}`;
    }
  }
  
  return phone;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutos`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return hours === 1 ? `1 hora` : `${hours} horas`;
  }
  
  return `${hours}h ${remainingMinutes}min`;
}

export function getColorForStatus(status: string): string {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'confirmed':
      return 'success';
    case 'cancelled':
      return 'danger';
    case 'completed':
      return 'primary';
    default:
      return 'gray';
  }
}

export function getStatusTranslation(status: string): string {
  switch (status) {
    case 'pending':
      return 'Aguardando';
    case 'confirmed':
      return 'Confirmado';
    case 'cancelled':
      return 'Cancelado';
    case 'completed':
      return 'Concluído';
    default:
      return status;
  }
}

export function generateTimeSlots(startHour: number = 0, endHour: number = 24, interval: number = 30): string[] {
  const timeSlots: string[] = [];
  
  // Garantindo que startHour e endHour são números válidos
  const start = Math.max(0, Math.min(23, startHour || 0));
  const end = Math.max(1, Math.min(24, endHour || 24));
  
  console.log(`▶️ Gerando horários das ${start}h às ${end}h com intervalo de ${interval} minutos`);
  
  if (end <= start) {
    console.warn('Horário de término deve ser maior que o horário de início. Usando horários padrão (0-24).');
    return generateTimeSlots(0, 24, interval);
  }
  
  for (let hour = start; hour < end; hour++) {
    for (let minute = 0; minute < 60; minute += interval) {
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMinute = minute.toString().padStart(2, '0');
      timeSlots.push(`${formattedHour}:${formattedMinute}`);
    }
  }
  
  return timeSlots;
}

export function isOverlapping(
  newStart: Date, 
  newEnd: Date, 
  existingStart: Date, 
  existingEnd: Date
): boolean {
  return (
    (newStart >= existingStart && newStart < existingEnd) || 
    (newEnd > existingStart && newEnd <= existingEnd) ||
    (newStart <= existingStart && newEnd >= existingEnd)
  );
}
