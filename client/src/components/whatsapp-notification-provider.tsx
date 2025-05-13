import React, { useEffect, createContext, useContext, useState } from 'react';
import { 
  WhatsAppNotificationDialog, 
  WhatsAppNotificationType, 
  createWhatsAppMessage, 
  openWhatsApp 
} from './whatsapp-notification-dialog';
import { useWebSocket } from '@/hooks/use-websocket';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// Interface para os dados de notificação
interface AppointmentNotification {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string;
  serviceId: number;
  serviceName: string;
  date: Date;
  time: string;
  type: WhatsAppNotificationType;
}

// Contexto para gerenciar as notificações
const WhatsAppNotificationContext = createContext<{
  showNewAppointmentNotification: (appointment: any) => void;
  showReminderNotification: (appointment: any) => void;
  showCancellationNotification: (appointment: any) => void;
}>({
  showNewAppointmentNotification: () => {},
  showReminderNotification: () => {},
  showCancellationNotification: () => {},
});

// Hook para usar o contexto de notificações
export const useWhatsAppNotifications = () => useContext(WhatsAppNotificationContext);

export const WhatsAppNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado para controlar o diálogo de notificação
  const [dialogOpen, setDialogOpen] = useState(false);
  // Toast para mensagens de erro
  const { toast } = useToast();
  
  // Estado para a notificação atual sendo exibida
  const [currentNotification, setCurrentNotification] = useState<AppointmentNotification | null>(null);

  // Buscar dados do provider (nome do negócio para mensagens)
  const { data: provider } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch('/api/my-provider');
      if (!res.ok) throw new Error('Falha ao buscar dados do prestador');
      return res.json();
    },
  });

  // Integração com WebSocket para notificações em tempo real
  useWebSocket({
    onMessage: (data) => {
      // Quando um novo agendamento é criado
      if (data.type === 'appointment_created') {
        const appointment = data.data?.appointment;
        if (appointment) {
          // Verificar se o appointment tem todos os dados necessários
          showNewAppointmentNotification(appointment);
        }
      }
      
      // Quando um agendamento é cancelado
      if (data.type === 'appointment_updated' && data.data?.status === 'cancelled') {
        const appointment = data.data;
        if (appointment) {
          showCancellationNotification(appointment);
        }
      }
    }
  });

  // Verificar a cada minuto se há agendamentos próximos (1 hora)
  useEffect(() => {
    // Função para verificar agendamentos próximos
    const checkUpcomingAppointments = async () => {
      try {
        // Buscar agendamentos do dia (performance > precisão)
        const res = await fetch('/api/my-appointments');
        if (!res.ok) return;
        
        const appointments = await res.json();
        console.log("Verificando agendamentos próximos, encontrados:", appointments.length);
        
        // Filtrar agendamentos confirmados ou pendentes
        const activeAppointments = appointments.filter(
          (appt: any) => appt.status === 'confirmed' || appt.status === 'pending'
        );
        
        console.log("Agendamentos ativos:", activeAppointments.length);
        
        // Data atual
        const now = new Date();
        
        // Verificar se algum agendamento está próximo (1 hora)
        for (const appt of activeAppointments) {
          try {
            // Converter string ISO para objeto Date
            const apptDate = new Date(appt.date);
            
            // Calcular diferença de tempo em minutos
            const diffMs = apptDate.getTime() - now.getTime();
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            
            console.log(`Verificando agendamento ${appt.id} - Diferença: ${diffMinutes} minutos`);
            
            // Para teste, vamos relaxar a condição para mostrar lembretes com diferenças entre 1 e 120 minutos
            // Depois podemos voltar para o intervalo original de 55-65 minutos
            if (diffMinutes > 0 && diffMinutes <= 120) {
              console.log(`Agendamento próximo encontrado! ID: ${appt.id}, ${diffMinutes} min restantes`);
              
              // Buscar dados do cliente
              const clientResponse = await fetch(`/api/clients/${appt.clientId}`);
              if (!clientResponse.ok) {
                console.error(`Erro ao buscar cliente ${appt.clientId}`);
                continue;
              }
              
              const client = await clientResponse.json();
              console.log("Cliente encontrado:", client);
              
              // Buscar dados do serviço
              const serviceResponse = await fetch(`/api/services/${appt.serviceId}`);
              if (!serviceResponse.ok) {
                console.error(`Erro ao buscar serviço ${appt.serviceId}`);
                continue;
              }
              
              const service = await serviceResponse.json();
              console.log("Serviço encontrado:", service);
              
              // Mostrar notificação de lembrete com todos os dados necessários
              showReminderNotification({
                ...appt,
                clientName: client.name,
                clientPhone: client.phone,
                serviceName: service.name
              });
              
              console.log("Notificação de lembrete solicitada!");
              
              // Aguardar um pouco para evitar múltiplas notificações simultâneas
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          } catch (error) {
            console.error('Erro ao processar agendamento:', error);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar agendamentos próximos:', error);
      }
    };
    
    // Verificar a cada 2 minutos (reduzido para testes)
    const interval = setInterval(checkUpcomingAppointments, 2 * 60 * 1000);
    
    // Verificar na inicialização com um pequeno delay para garantir carregamento
    setTimeout(checkUpcomingAppointments, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Função para mostrar notificação de novo agendamento - DESATIVADA conforme solicitado
  const showNewAppointmentNotification = (appointment: any) => {
    // Função desativada - não exibe mais popups para novos agendamentos
    console.log("Novo agendamento recebido, mas popup desativado:", appointment);
    
    // Retorna sem fazer nada - popups de novos agendamentos foram desativados
    return;
    
    // Verificar se temos cliente e serviço IDs para buscar dados
    if (appointment && appointment.clientId && appointment.serviceId) {
      try {
        // Função segura para buscar com tratamento de erro
        const fetchWithErrorHandling = async (url: string) => {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Erro ao buscar dados: ${response.status}`);
            }
            return await response.json();
          } catch (error) {
            console.error(`Erro ao buscar ${url}:`, error);
            throw error;
          }
        };
        
        // Buscar dados do cliente e serviço
        Promise.all([
          fetchWithErrorHandling(`/api/clients/${appointment.clientId}`),
          fetchWithErrorHandling(`/api/services/${appointment.serviceId}`)
        ]).then(([client, service]) => {
          // Criar objeto de notificação
          const notification: AppointmentNotification = {
            id: appointment.id,
            clientId: appointment.clientId,
            clientName: client.name,
            clientPhone: client.phone,
            serviceId: appointment.serviceId,
            serviceName: service.name,
            date: new Date(appointment.date),
            time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            type: WhatsAppNotificationType.NEW_APPOINTMENT
          };
          
          // Mostrar diálogo
          setCurrentNotification(notification);
          setDialogOpen(true);
        }).catch(error => {
          console.error('Erro ao buscar dados para notificação:', error);
          toast({
            title: "Erro ao preparar mensagem",
            description: "Não foi possível obter os dados do cliente ou serviço",
            variant: "destructive"
          });
        });
      } catch (error) {
        console.error('Erro ao iniciar busca de dados:', error);
        toast({
          title: "Erro ao preparar mensagem",
          description: "Ocorreu um erro ao tentar preparar a mensagem do WhatsApp",
          variant: "destructive"
        });
      }
    }
  };

  // Função para mostrar notificação de lembrete
  const showReminderNotification = (appointment: any) => {
    console.log("Preparando notificação de lembrete (1h antes):", appointment);
    
    // Se já temos todos os dados necessários, não precisamos buscar nada
    if (appointment && appointment.clientName && appointment.clientPhone && appointment.serviceName) {
      // Criar objeto de notificação diretamente
      const notification: AppointmentNotification = {
        id: appointment.id,
        clientId: appointment.clientId || 0,
        clientName: appointment.clientName,
        clientPhone: appointment.clientPhone,
        serviceId: appointment.serviceId || 0,
        serviceName: appointment.serviceName,
        date: new Date(appointment.date),
        time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: WhatsAppNotificationType.REMINDER
      };
      
      // Mostrar diálogo
      setCurrentNotification(notification);
      setDialogOpen(true);
      return;
    }
    
    // Verificar se temos cliente e serviço IDs para buscar dados
    if (appointment && appointment.clientId && appointment.serviceId) {
      try {
        // Função segura para buscar com tratamento de erro
        const fetchWithErrorHandling = async (url: string) => {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Erro ao buscar dados: ${response.status}`);
            }
            return await response.json();
          } catch (error) {
            console.error(`Erro ao buscar ${url}:`, error);
            throw error;
          }
        };
        
        // Buscar dados do cliente e serviço
        Promise.all([
          fetchWithErrorHandling(`/api/clients/${appointment.clientId}`),
          fetchWithErrorHandling(`/api/services/${appointment.serviceId}`)
        ]).then(([client, service]) => {
          console.log("Dados obtidos para lembrete:", { client, service });
          
          // Criar objeto de notificação
          const notification: AppointmentNotification = {
            id: appointment.id,
            clientId: appointment.clientId,
            clientName: client.name,
            clientPhone: client.phone,
            serviceId: appointment.serviceId,
            serviceName: service.name,
            date: new Date(appointment.date),
            time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            type: WhatsAppNotificationType.REMINDER
          };
          
          // Mostrar diálogo
          setCurrentNotification(notification);
          setDialogOpen(true);
        }).catch(error => {
          console.error('Erro ao buscar dados para notificação de lembrete:', error);
          toast({
            title: "Erro ao preparar mensagem de lembrete",
            description: "Não foi possível obter os dados do cliente ou serviço",
            variant: "destructive"
          });
        });
      } catch (error) {
        console.error('Erro ao iniciar busca de dados para lembrete:', error);
        toast({
          title: "Erro ao preparar mensagem de lembrete",
          description: "Ocorreu um erro ao tentar preparar a mensagem do WhatsApp",
          variant: "destructive"
        });
      }
    } else {
      console.error("Dados insuficientes para lembrete:", appointment);
    }
  };

  // Função para mostrar notificação de cancelamento
  const showCancellationNotification = (appointment: any) => {
    // Se já temos todos os dados necessários, não precisamos buscar nada
    if (appointment && appointment.clientName && appointment.clientPhone && appointment.serviceName) {
      // Criar objeto de notificação diretamente
      const notification: AppointmentNotification = {
        id: appointment.id,
        clientId: appointment.clientId || 0,
        clientName: appointment.clientName,
        clientPhone: appointment.clientPhone,
        serviceId: appointment.serviceId || 0,
        serviceName: appointment.serviceName,
        date: new Date(appointment.date),
        time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        type: WhatsAppNotificationType.CANCELLATION
      };
      
      // Mostrar diálogo
      setCurrentNotification(notification);
      setDialogOpen(true);
      return;
    }
    
    // Verificar se temos cliente e serviço IDs para buscar dados
    if (appointment && appointment.clientId && appointment.serviceId) {
      try {
        // Função segura para buscar com tratamento de erro
        const fetchWithErrorHandling = async (url: string) => {
          try {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Erro ao buscar dados: ${response.status}`);
            }
            return await response.json();
          } catch (error) {
            console.error(`Erro ao buscar ${url}:`, error);
            throw error;
          }
        };
        
        // Buscar dados do cliente e serviço
        Promise.all([
          fetchWithErrorHandling(`/api/clients/${appointment.clientId}`),
          fetchWithErrorHandling(`/api/services/${appointment.serviceId}`)
        ]).then(([client, service]) => {
          // Criar objeto de notificação
          const notification: AppointmentNotification = {
            id: appointment.id,
            clientId: appointment.clientId,
            clientName: client.name,
            clientPhone: client.phone,
            serviceId: appointment.serviceId,
            serviceName: service.name,
            date: new Date(appointment.date),
            time: appointment.time || new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            type: WhatsAppNotificationType.CANCELLATION
          };
          
          // Mostrar diálogo
          setCurrentNotification(notification);
          setDialogOpen(true);
        }).catch(error => {
          console.error('Erro ao buscar dados para notificação:', error);
          toast({
            title: "Erro ao preparar mensagem",
            description: "Não foi possível obter os dados do cliente ou serviço",
            variant: "destructive"
          });
        });
      } catch (error) {
        console.error('Erro ao iniciar busca de dados:', error);
        toast({
          title: "Erro ao preparar mensagem",
          description: "Ocorreu um erro ao tentar preparar a mensagem do WhatsApp",
          variant: "destructive"
        });
      }
    }
  };

  // Função para enviar WhatsApp
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
    
    // Não fechamos o diálogo automaticamente
    // O usuário deve fechar manualmente após enviar a mensagem no WhatsApp
    // setDialogOpen(false);
    // setCurrentNotification(null);
  };

  // Função para fechar o diálogo
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentNotification(null);
  };

  return (
    <WhatsAppNotificationContext.Provider
      value={{
        showNewAppointmentNotification,
        showReminderNotification,
        showCancellationNotification
      }}
    >
      {children}
      
      {/* Dialog de notificação WhatsApp */}
      {currentNotification && (
        <WhatsAppNotificationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          type={currentNotification.type}
          clientName={currentNotification.clientName}
          clientPhone={currentNotification.clientPhone}
          serviceName={currentNotification.serviceName}
          appointmentDate={currentNotification.date}
          appointmentTime={currentNotification.time}
          onSendWhatsApp={handleSendWhatsApp}
          onCancel={handleCloseDialog}
        />
      )}
    </WhatsAppNotificationContext.Provider>
  );
};