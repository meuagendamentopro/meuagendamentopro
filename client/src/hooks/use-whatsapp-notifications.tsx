import { useState, useEffect } from 'react';
import { 
  WhatsAppNotificationType, 
  openWhatsApp, 
  createWhatsAppMessage 
} from '@/components/whatsapp-notification-dialog';
import { 
  getPendingNotifications, 
  markNotificationAsRead,
  checkUpcomingAppointments,
  addNewAppointmentNotification,
  addConfirmationNotification,
  addCancellationNotification,
  AppointmentNotification
} from '@/services/appointment-notification-service';
import { useQuery } from '@tanstack/react-query';

export function useWhatsAppNotifications() {
  // Estado para controlar o diálogo de notificação
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Estado para a notificação atual sendo exibida
  const [currentNotification, setCurrentNotification] = useState<AppointmentNotification | null>(null);
  
  // Estado para controlar o timer de verificação
  const [lastCheckTime, setLastCheckTime] = useState(Date.now());
  
  // Buscar dados de agendamentos para verificação automática
  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/my-appointments'],
    queryFn: async () => {
      const res = await fetch('/api/my-appointments');
      if (!res.ok) throw new Error('Falha ao buscar agendamentos');
      return res.json();
    },
    staleTime: 60000, // 1 minuto
  });
  
  // Buscar dados do provider (para mostrar nome do negócio nas mensagens)
  const { data: provider } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch('/api/my-provider');
      if (!res.ok) throw new Error('Falha ao buscar dados do prestador');
      return res.json();
    },
  });
  
  // Processar notificações e mostrar o diálogo quando necessário
  useEffect(() => {
    // Buscar notificações pendentes
    const pendingNotifications = getPendingNotifications();
    
    // Se houver notificações pendentes, mostrar o diálogo para a primeira
    if (pendingNotifications.length > 0 && !isDialogOpen) {
      setCurrentNotification(pendingNotifications[0]);
      setIsDialogOpen(true);
    }
  }, [isDialogOpen]);
  
  // Verificar periodicamente agendamentos próximos para lembretes
  useEffect(() => {
    // Função para verificar agendamentos
    const checkAppointments = () => {
      // Só executar se tivermos dados de agendamentos
      if (appointments.length > 0) {
        // Verificar agendamentos próximos (1h)
        const upcomingNotifications = checkUpcomingAppointments(appointments);
        
        // Registrar notificações
        upcomingNotifications.forEach(notification => {
          // Ao invés de salvar diretamente, usamos a função específica que evita duplicações
          markNotificationAsRead(notification.id, notification.type);
          // Agora salvamos com a função especializada
          const storageNotification = {
            ...notification,
            // Garantir os tipos corretos (necessário para TypeScript)
            clientId: notification.clientId,
            serviceId: notification.serviceId,
            id: notification.id,
            date: notification.date,
            createdAt: notification.createdAt
          };
          // Salvar no storage
          saveNotification(storageNotification);
        });
      }
      
      // Atualizar timestamp da última verificação
      setLastCheckTime(Date.now());
    };
    
    // Verificar a cada 5 minutos
    const interval = setInterval(checkAppointments, 5 * 60 * 1000);
    
    // Executar uma vez no início
    if (Date.now() - lastCheckTime > 60 * 1000) {
      checkAppointments();
    }
    
    return () => clearInterval(interval);
  }, [appointments, lastCheckTime]);
  
  // Função para processar um novo agendamento
  const handleNewAppointment = (appointment: any) => {
    const notification = addNewAppointmentNotification(appointment);
    // Mostrar diálogo imediatamente
    setCurrentNotification(notification);
    setIsDialogOpen(true);
  };
  
  // Função para processar um agendamento cancelado
  const handleCancelledAppointment = (appointment: any) => {
    const notification = addCancellationNotification(appointment);
    // Mostrar diálogo imediatamente
    setCurrentNotification(notification);
    setIsDialogOpen(true);
  };
  
  // Função para enviar mensagem de WhatsApp
  const handleSendWhatsApp = () => {
    if (!currentNotification) return;
    
    // Criar mensagem apropriada
    const message = createWhatsAppMessage(
      currentNotification.type,
      currentNotification.clientName,
      currentNotification.serviceName,
      currentNotification.date,
      currentNotification.time,
      provider?.name || 'Agenda Online'
    );
    
    // Abrir WhatsApp Web - Não fechamos o diálogo automaticamente
    // para que o usuário possa voltar depois de enviar a mensagem
    openWhatsApp(currentNotification.clientPhone, message);
    
    // Marcar notificação como lida
    markNotificationAsRead(currentNotification.id, currentNotification.type);
    
    // Não fechamos o diálogo automaticamente
    // O usuário deve fechar manualmente após enviar a mensagem no WhatsApp
    // setIsDialogOpen(false);
    // setCurrentNotification(null);
  };
  
  // Função para cancelar e pular notificação
  const handleCancelNotification = () => {
    if (currentNotification) {
      // Marcar notificação como lida
      markNotificationAsRead(currentNotification.id, currentNotification.type);
    }
    
    // Fechar diálogo
    setIsDialogOpen(false);
    setCurrentNotification(null);
  };
  
  // Função auxiliar para salvar notificação
  const saveNotification = (notification: AppointmentNotification) => {
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
      const storageData = {
        pendingNotifications: updatedNotifications,
        lastCheckedTime: Date.now()
      };
      
      localStorage.setItem('appointment_notifications', JSON.stringify(storageData));
    } catch (error) {
      console.error('Erro ao salvar notificação:', error);
    }
  };
  
  return {
    isDialogOpen,
    currentNotification,
    setIsDialogOpen,
    handleNewAppointment,
    handleCancelledAppointment,
    handleSendWhatsApp,
    handleCancelNotification
  };
}