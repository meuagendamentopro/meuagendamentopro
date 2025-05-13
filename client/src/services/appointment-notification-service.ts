import { WhatsAppNotificationType } from "@/components/whatsapp-notification-dialog";

// Interface para armazenar dados de agendamentos que precisam de notificações
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

// Interface para o storage local
interface NotificationStorage {
  pendingNotifications: AppointmentNotification[];
  lastCheckedTime: number;
}

// Nome da chave para armazenamento no localStorage
const STORAGE_KEY = 'appointment_notifications';

/**
 * Verifica se há agendamentos próximos (1 hora de antecedência)
 * @param appointments Lista de agendamentos ativos
 * @param provider Dados do provider para incluir na notificação
 */
export function checkUpcomingAppointments(
  appointments: any[]
): AppointmentNotification[] {
  // Filtrar apenas agendamentos confirmados ou pendentes
  const activeAppointments = appointments.filter(
    (appt) => appt.status === 'confirmed' || appt.status === 'pending'
  );
  
  // Verificar quais agendamentos estão próximos (entre 55 e 65 minutos para evitar duplicações)
  const now = new Date();
  const upcomingNotifications: AppointmentNotification[] = [];
  
  activeAppointments.forEach(appt => {
    try {
      // Converter string ISO para objeto Date
      const apptDate = new Date(appt.date);
      
      // Calcular diferença de tempo em minutos
      const diffMs = apptDate.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      // Se estiver entre 55 e 65 minutos antes do agendamento
      if (diffMinutes >= 55 && diffMinutes <= 65) {
        upcomingNotifications.push({
          id: appt.id,
          clientId: appt.clientId,
          clientName: appt.clientName || 'Cliente',
          clientPhone: appt.clientPhone || '',
          serviceId: appt.serviceId,
          serviceName: appt.serviceName || 'Serviço',
          date: apptDate,
          time: appt.time || apptDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          type: WhatsAppNotificationType.REMINDER,
          createdAt: now,
          isRead: false
        });
      }
    } catch (error) {
      console.error('Erro ao processar agendamento:', error);
    }
  });
  
  return upcomingNotifications;
}

/**
 * Adiciona uma notificação para um novo agendamento
 */
export function addNewAppointmentNotification(
  appointment: any
): AppointmentNotification {
  // Criar objeto de notificação
  const notification: AppointmentNotification = {
    id: appointment.id,
    clientId: appointment.clientId,
    clientName: appointment.clientName || 'Cliente',
    clientPhone: appointment.clientPhone || '',
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName || 'Serviço',
    date: new Date(appointment.date),
    time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    type: WhatsAppNotificationType.NEW_APPOINTMENT,
    createdAt: new Date(),
    isRead: false
  };
  
  // Adicionar ao storage
  saveNotification(notification);
  
  return notification;
}

/**
 * Adiciona uma notificação para um agendamento cancelado
 */
export function addCancellationNotification(
  appointment: any
): AppointmentNotification {
  // Criar objeto de notificação
  const notification: AppointmentNotification = {
    id: appointment.id,
    clientId: appointment.clientId,
    clientName: appointment.clientName || 'Cliente',
    clientPhone: appointment.clientPhone || '',
    serviceId: appointment.serviceId,
    serviceName: appointment.serviceName || 'Serviço',
    date: new Date(appointment.date),
    time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    type: WhatsAppNotificationType.CANCELLATION,
    createdAt: new Date(),
    isRead: false
  };
  
  // Adicionar ao storage
  saveNotification(notification);
  
  return notification;
}

/**
 * Busca notificações pendentes do storage
 */
export function getPendingNotifications(): AppointmentNotification[] {
  try {
    const storageData = localStorage.getItem(STORAGE_KEY);
    
    if (!storageData) {
      return [];
    }
    
    const data: NotificationStorage = JSON.parse(storageData);
    
    // Converter strings de data para objetos Date
    return data.pendingNotifications.map(notification => ({
      ...notification,
      date: new Date(notification.date),
      createdAt: new Date(notification.createdAt)
    }));
  } catch (error) {
    console.error('Erro ao buscar notificações pendentes:', error);
    return [];
  }
}

/**
 * Salva uma nova notificação no storage
 */
export function saveNotification(notification: AppointmentNotification): void {
  try {
    // Buscar notificações existentes
    const existingNotifications = getPendingNotifications();
    
    // Verificar se já existe uma notificação com o mesmo ID e tipo
    const isDuplicate = existingNotifications.some(
      n => n.id === notification.id && n.type === notification.type
    );
    
    if (isDuplicate) {
      console.log('Notificação duplicada, ignorando.');
      return;
    }
    
    // Adicionar nova notificação
    const updatedNotifications = [...existingNotifications, notification];
    
    // Salvar no localStorage
    const storageData: NotificationStorage = {
      pendingNotifications: updatedNotifications,
      lastCheckedTime: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
  } catch (error) {
    console.error('Erro ao salvar notificação:', error);
  }
}

/**
 * Marca uma notificação como lida e a remove do storage
 */
export function markNotificationAsRead(id: number, type: WhatsAppNotificationType): void {
  try {
    const existingNotifications = getPendingNotifications();
    
    // Filtrar para remover a notificação específica
    const updatedNotifications = existingNotifications.filter(
      n => !(n.id === id && n.type === type)
    );
    
    // Salvar lista atualizada
    const storageData: NotificationStorage = {
      pendingNotifications: updatedNotifications,
      lastCheckedTime: Date.now()
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
  }
}