import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  appointmentId: number | null;
  createdAt: string;
}

export function useNotifications() {
  const { toast } = useToast();
  
  // Buscar todas as notificações
  const { data: allNotifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Falha ao buscar notificações');
      return res.json();
    },
    staleTime: 60000, // 1 minuto
  });
  
  // Buscar notificações não lidas
  const { 
    data: unreadNotifications = [], 
    isLoading: isLoadingUnread,
    refetch: refetchUnread 
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications/unread'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread');
      if (!res.ok) throw new Error('Falha ao buscar notificações não lidas');
      return res.json();
    },
    staleTime: 60000, // 1 minuto
  });

  // Usar WebSocket para atualizar notificações em tempo real
  const { connected } = useWebSocket({
    onMessage: (data) => {
      if (data.type === 'appointment_created') {
        // Quando um novo agendamento é criado, recarregar as notificações não lidas
        refetchUnread();
        
        toast({
          title: 'Nova notificação',
          description: 'Você recebeu um novo agendamento',
          variant: 'default',
        });
      }
    },
  });
  
  // Mutação para marcar uma notificação como lida
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('PATCH', `/api/notifications/${id}/mark-as-read`);
    },
    onSuccess: () => {
      // Invalidar queries para recarregar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: 'Erro ao marcar notificação como lida',
        variant: 'destructive',
      });
    },
  });
  
  // Mutação para marcar todas as notificações como lidas
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/notifications/mark-all-as-read');
    },
    onSuccess: () => {
      // Invalidar queries para recarregar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
      
      toast({
        title: 'Notificações',
        description: 'Todas as notificações foram marcadas como lidas',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: 'Erro ao marcar todas notificações como lidas',
        variant: 'destructive',
      });
    },
  });
  
  return {
    allNotifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    isLoadingUnread,
    markAsRead: (id: number) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    isConnected: connected,
  };
}