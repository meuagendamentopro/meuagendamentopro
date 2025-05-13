import { WhatsAppNotificationType } from '@/components/whatsapp-notification-dialog';

// Interface para as notificações
export interface AppointmentNotification {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string;
  serviceId: number;
  serviceName: string;
  date: Date;
  time: string;
  type: WhatsAppNotificationType;
  createdAt: Date;
  isRead: boolean;
}

// Interface para o storage
interface NotificationStorage {
  pendingNotifications: AppointmentNotification[];
  lastCheckedTime: number;
}

// Chave para o localStorage
const STORAGE_KEY = 'appointment_notifications';

/**
 * Verifica se há agendamentos próximos (1 hora de antecedência)
 * @param appointments Lista de agendamentos ativos
 * @param provider Dados do provider para incluir na notificação
 */
export function checkUpcomingAppointments(
  appointments: any[]
): AppointmentNotification[] {
  const now = new Date();
  const notifications: AppointmentNotification[] = [];
  
  // Filtra agendamentos confirmados ou pendentes
  const activeAppointments = appointments.filter(
    appt => appt.status === 'confirmed' || appt.status === 'pending'
  );
  
  // Verifica cada agendamento
  activeAppointments.forEach(appt => {
    try {
      // Converter string ISO para objeto Date
      const apptDate = new Date(appt.date);
      
      // Calcular diferença de tempo em minutos
      const diffMs = apptDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      // Se estiver entre 55 e 65 minutos antes do agendamento
      if (diffMinutes >= 55 && diffMinutes <= 65) {
        console.log(`Agendamento com ID ${appt.id} está próximo (${diffMinutes} minutos)`);
        
        // Precisamos apenas do ID do agendamento, cliente e serviço
        // Os dados completos serão buscados posteriormente
        const notification: AppointmentNotification = {
          id: appt.id,
          clientId: appt.clientId,
          clientName: appt.clientName || "Cliente", // Será substituído depois
          clientPhone: appt.clientPhone || "",      // Será substituído depois
          serviceId: appt.serviceId,
          serviceName: appt.serviceName || "Serviço", // Será substituído depois
          date: apptDate,
          time: appt.time || apptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          type: WhatsAppNotificationType.REMINDER,
          createdAt: new Date(),
          isRead: false
        };
        
        notifications.push(notification);
      }
    } catch (error) {
      console.error('Erro ao processar agendamento:', error);
    }
  });
  
  return notifications;
}

/**
 * Adiciona uma notificação para um novo agendamento
 */
export function addNewAppointmentNotification(
  appointment: any,
  client?: any,
  service?: any
): AppointmentNotification {
  const now = new Date();
  const apptDate = new Date(appointment.date);
  
  const notification: AppointmentNotification = {
    id: appointment.id,
    clientId: appointment.clientId,
    clientName: client?.name || appointment.clientName,
    clientPhone: client?.phone || appointment.clientPhone,
    serviceId: appointment.serviceId,
    serviceName: service?.name || appointment.serviceName,
    date: apptDate,
    time: appointment.time || apptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    type: WhatsAppNotificationType.NEW_APPOINTMENT,
    createdAt: now,
    isRead: false
  };
  
  // Salvar notificação
  saveNotification(notification);
  
  return notification;
}

/**
 * Adiciona uma notificação para um agendamento cancelado
 */
export function addCancellationNotification(
  appointment: any,
  client?: any,
  service?: any
): AppointmentNotification {
  const now = new Date();
  const apptDate = new Date(appointment.date);
  
  const notification: AppointmentNotification = {
    id: appointment.id,
    clientId: appointment.clientId,
    clientName: client?.name || appointment.clientName,
    clientPhone: client?.phone || appointment.clientPhone,
    serviceId: appointment.serviceId,
    serviceName: service?.name || appointment.serviceName,
    date: apptDate,
    time: appointment.time || apptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    type: WhatsAppNotificationType.CANCELLATION,
    createdAt: now,
    isRead: false
  };
  
  // Salvar notificação
  saveNotification(notification);
  
  return notification;
}

/**
 * Busca notificações pendentes do storage
 */
export function getPendingNotifications(): AppointmentNotification[] {
  try {
    const storageData = localStorage.getItem(STORAGE_KEY);
    if (!storageData) return [];
    
    const data: NotificationStorage = JSON.parse(storageData);
    
    // Filtrar apenas notificações não lidas
    return data.pendingNotifications.filter(notification => !notification.isRead);
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    return [];
  }
}

/**
 * Salva uma nova notificação no storage
 */
export function saveNotification(notification: AppointmentNotification): void {
  try {
    // Buscar dados existentes ou inicializar
    const storageData = localStorage.getItem(STORAGE_KEY);
    const data: NotificationStorage = storageData 
      ? JSON.parse(storageData)
      : { 
          pendingNotifications: [], 
          lastCheckedTime: Date.now() 
        };
    
    // Verificar se já existe uma notificação idêntica
    const isDuplicate = data.pendingNotifications.some(
      n => n.id === notification.id && n.type === notification.type
    );
    
    if (!isDuplicate) {
      // Adicionar nova notificação
      data.pendingNotifications.push(notification);
      
      // Atualizar timestamp
      data.lastCheckedTime = Date.now();
      
      // Salvar no localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.error('Erro ao salvar notificação:', error);
  }
}

/**
 * Marca uma notificação como lida e a remove do storage
 */
export function markNotificationAsRead(id: number, type: WhatsAppNotificationType): void {
  try {
    // Buscar dados existentes
    const storageData = localStorage.getItem(STORAGE_KEY);
    if (!storageData) return;
    
    const data: NotificationStorage = JSON.parse(storageData);
    
    // Filtrar notificações, removendo a que foi lida
    const updatedNotifications = data.pendingNotifications.filter(
      n => !(n.id === id && n.type === type)
    );
    
    // Atualizar storage
    const updatedData: NotificationStorage = {
      pendingNotifications: updatedNotifications,
      lastCheckedTime: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
  }
}