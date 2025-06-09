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

export function formatPhoneNumber(phone: string, countryCode: string = "BR"): string {
  if (!phone) return "";
  
  // Se o número já começa com +, é um número internacional completo
  if (phone.startsWith('+')) {
    return phone; // Retorna o número como está, já formatado internacionalmente
  }
  
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Detectar país pelo formato do número
  // Se o número começa com 35 e tem 9-11 dígitos, provavelmente é de Portugal
  if (cleaned.startsWith('35') && (cleaned.length >= 9 && cleaned.length <= 11)) {
    // Adicionar o prefixo internacional de Portugal
    return `+${cleaned}`;
  }
  
  // Formatação específica para cada país
  switch (countryCode) {
    case "BR": // Brasil
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
      break;
      
    case "US": // Estados Unidos
    case "CA": // Canadá
      if (cleaned.length === 10) {
        // Formato: (XXX) XXX-XXXX
        return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
      } else if (cleaned.length > 3) {
        // Trata números incompletos
        const remainingDigits = cleaned.substring(3);
        if (remainingDigits.length <= 3) {
          return `(${cleaned.substring(0, 3)}) ${remainingDigits}`;
        } else {
          return `(${cleaned.substring(0, 3)}) ${remainingDigits.substring(0, 3)}-${remainingDigits.substring(3)}`;
        }
      }
      break;
      
    case "PT": // Portugal
      if (cleaned.length === 9) {
        // Formato: XXX XXX XXX
        return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)}`;
      }
      break;
      
    case "ES": // Espanha
      if (cleaned.length === 9) {
        // Formato: XXX XX XX XX
        return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 5)} ${cleaned.substring(5, 7)} ${cleaned.substring(7, 9)}`;
      }
      break;
      
    case "AR": // Argentina
    case "CL": // Chile
    case "CO": // Colômbia
    case "MX": // México
      if (cleaned.length >= 10) {
        // Formato: (XX) XXXX-XXXX
        return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6, 10)}`;
      }
      break;
      
    case "DE": // Alemanha
      // Formato variável, apenas agrupamos os dígitos
      if (cleaned.length > 3 && cleaned.length <= 11) {
        return cleaned.replace(/(.{3})/g, "$1 ").trim();
      }
      break;
      
    case "FR": // França
      if (cleaned.length === 9) {
        // Formato: XX XX XX XX XX
        return `${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 6)} ${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}`;
      }
      break;
      
    case "IT": // Itália
      if (cleaned.length >= 10) {
        // Formato: XXX XXX XXXX
        return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 10)}`;
      }
      break;
      
    case "UK": // Reino Unido
      if (cleaned.length === 11) {
        // Formato: XXXXX XXXXXX
        return `${cleaned.substring(0, 5)} ${cleaned.substring(5, 11)}`;
      }
      break;
  }
  
  // Formato padrão para países não especificados ou formatos desconhecidos
  // Agrupa os dígitos em grupos de 3 ou 4
  if (cleaned.length <= 4) {
    return cleaned;
  } else if (cleaned.length <= 7) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3)}`;
  } else if (cleaned.length <= 10) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
  } else {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
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
