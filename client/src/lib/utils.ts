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
  
  // Force format as (XX) XXXXX-XXXX 
  if (cleaned.length >= 11) {
    // If more than 11 digits, truncate
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7, 11)}`;
  } else if (cleaned.length === 10) {
    // For 10 digit numbers, add a 9 after DDD (new Brazilian format)
    return `(${cleaned.substring(0, 2)}) 9${cleaned.substring(2, 6)}-${cleaned.substring(6, 10)}`;
  } else if (cleaned.length > 2) {
    // Handle incomplete numbers but with at least DDD
    const remainingDigits = cleaned.substring(2);
    if (remainingDigits.length <= 5) {
      return `(${cleaned.substring(0, 2)}) ${remainingDigits}`;
    } else {
      return `(${cleaned.substring(0, 2)}) ${remainingDigits.substring(0, 5)}-${remainingDigits.substring(5)}`;
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
