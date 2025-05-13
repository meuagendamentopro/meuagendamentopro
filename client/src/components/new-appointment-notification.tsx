import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate, formatTime } from "@/lib/dates";
import { useWhatsAppNotifications } from "./whatsapp-notification-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";

interface NewAppointmentNotificationProps {
  onClose: () => void;
}

/**
 * Componente que monitora novos agendamentos e exibe um popup de notificação
 * com opção de enviar WhatsApp para o cliente.
 */
export const NewAppointmentNotification: React.FC<NewAppointmentNotificationProps> = ({ 
  onClose 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [lastAppointmentId, setLastAppointmentId] = useState<number | null>(null);
  const [currentAppointment, setCurrentAppointment] = useState<any>(null);
  
  const { showNewAppointmentNotification } = useWhatsAppNotifications();
  
  // Busca os agendamentos
  const { data: appointments } = useQuery({
    queryKey: ['/api/my-appointments'],
    queryFn: async () => {
      const res = await fetch('/api/my-appointments');
      if (!res.ok) throw new Error('Failed to fetch appointments');
      return res.json();
    },
    refetchInterval: 10000 // Refetch a cada 10 segundos
  });

  // Busca os clientes
  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    }
  });
  
  // Busca os serviços
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch('/api/my-services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    }
  });

  // Monitora os agendamentos para identificar novos
  useEffect(() => {
    if (!appointments || !clients || !services) return;
    
    // Caso não tenha um último ID salvo, use o agendamento mais recente como referência
    if (lastAppointmentId === null && appointments.length > 0) {
      // Ordena por ID de forma decrescente para obter o mais recente
      const sortedAppointments = [...appointments].sort((a, b) => b.id - a.id);
      setLastAppointmentId(sortedAppointments[0].id);
      return;
    }
    
    // Verifica se há um novo agendamento (com ID maior que o último registrado)
    const newAppointment = appointments.find(
      (appointment: any) => appointment.id > (lastAppointmentId as number)
    );
    
    if (newAppointment) {
      console.log("Novo agendamento detectado:", newAppointment);
      
      // Busca informações adicionais do cliente e serviço
      const client = clients.find((c: any) => c.id === newAppointment.clientId);
      const service = services.find((s: any) => s.id === newAppointment.serviceId);
      
      if (client && service) {
        // Atualiza o último ID conhecido
        setLastAppointmentId(newAppointment.id);
        
        // Armazena o agendamento atual com informações completas
        setCurrentAppointment({
          ...newAppointment,
          clientName: client.name,
          clientPhone: client.phone,
          serviceName: service.name
        });
        
        // Abre o popup
        setIsOpen(true);
        
        // Notifica o usuário
        toast({
          title: "Novo agendamento recebido!",
          description: `${client.name} agendou ${service.name} para ${formatDate(new Date(newAppointment.date))}, às ${formatTime(new Date(newAppointment.date))}`,
        });
      }
    }
  }, [appointments, clients, services, lastAppointmentId, toast]);

  const handleClose = () => {
    setIsOpen(false);
    setCurrentAppointment(null);
    onClose();
  };

  const handleSendWhatsApp = () => {
    if (currentAppointment) {
      showNewAppointmentNotification(currentAppointment);
      handleClose();
    }
  };

  if (!currentAppointment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo agendamento recebido!</DialogTitle>
          <DialogDescription>
            Você recebeu um novo agendamento. Deseja enviar uma confirmação por WhatsApp?
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Cliente: <span className="font-bold">{currentAppointment.clientName}</span></p>
            <p className="text-sm font-medium">Serviço: <span className="font-bold">{currentAppointment.serviceName}</span></p>
            <p className="text-sm font-medium">Data: <span className="font-bold">{formatDate(new Date(currentAppointment.date))}</span></p>
            <p className="text-sm font-medium">Horário: <span className="font-bold">{formatTime(new Date(currentAppointment.date))}</span></p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button onClick={handleSendWhatsApp} className="bg-green-600 hover:bg-green-700">
            <MessageCircle className="h-4 w-4 mr-2" />
            Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};