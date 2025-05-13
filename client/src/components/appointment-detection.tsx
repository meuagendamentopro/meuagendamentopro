import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { formatDate, formatTime } from "@/lib/dates";
import { useWhatsAppNotifications } from "./whatsapp-notification-provider";

/**
 * Componente que monitora novos agendamentos e exibe um popup de notificação
 * oferecendo ao usuário a opção de enviar uma mensagem WhatsApp
 */
export const AppointmentDetection: React.FC = () => {
  const { toast } = useToast();
  const [lastAppointmentId, setLastAppointmentId] = useState<number | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [newAppointment, setNewAppointment] = useState<any>(null);
  
  const { showNewAppointmentNotification } = useWhatsAppNotifications();
  
  // Busca agendamentos recentes
  const { data: appointments } = useQuery({
    queryKey: ['/api/my-appointments', { recent: true }],
    queryFn: async () => {
      const res = await fetch('/api/my-appointments?recent=true');
      if (!res.ok) throw new Error('Falha ao buscar agendamentos');
      return res.json();
    },
    refetchInterval: 10000 // Refetch a cada 10 segundos
  });
  
  // Busca clientes
  const { data: clients } = useQuery({
    queryKey: ['/api/clients'],
    queryFn: async () => {
      const res = await fetch('/api/clients');
      if (!res.ok) throw new Error('Falha ao buscar clientes');
      return res.json();
    }
  });
  
  // Busca serviços
  const { data: services } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch('/api/my-services');
      if (!res.ok) throw new Error('Falha ao buscar serviços');
      return res.json();
    }
  });

  useEffect(() => {
    if (!appointments || !clients || !services) return;
    
    // Ordena agendamentos por ID (decrescente) para pegar o mais recente
    const sortedAppointments = [...appointments].sort((a, b) => b.id - a.id);
    
    // Se não tivermos um lastAppointmentId, atribuir o ID do agendamento mais recente
    if (lastAppointmentId === null && sortedAppointments.length > 0) {
      setLastAppointmentId(sortedAppointments[0].id);
      return;
    }
    
    // Procurar por novos agendamentos (IDs maiores que o último registrado)
    const newAppointments = sortedAppointments.filter(
      (appointment) => appointment.id > (lastAppointmentId || 0)
    );
    
    if (newAppointments.length > 0) {
      // Pegar apenas o agendamento mais recente para notificar
      const latestAppointment = newAppointments[0];
      console.log("Novo agendamento detectado:", latestAppointment);
      
      // Atualizar o último ID conhecido
      setLastAppointmentId(latestAppointment.id);
      
      // Buscar informações do cliente e serviço
      const client = clients.find(c => c.id === latestAppointment.clientId);
      const service = services.find(s => s.id === latestAppointment.serviceId);
      
      if (client && service) {
        // Preparar objeto com informações completas
        const appointmentWithDetails = {
          ...latestAppointment,
          clientName: client.name,
          clientPhone: client.phone,
          serviceName: service.name
        };
        
        // Salvar para o popup
        setNewAppointment(appointmentWithDetails);
        
        // Mostrar diálogo
        setShowDialog(true);
        
        // Notificar usuário
        toast({
          title: "Novo agendamento recebido!",
          description: `${client.name} agendou ${service.name} para ${formatDate(new Date(latestAppointment.date))}, às ${formatTime(new Date(latestAppointment.date))}`,
        });
      }
    }
  }, [appointments, clients, services, lastAppointmentId, toast]);

  // Envia mensagem WhatsApp para o cliente
  const handleSendWhatsApp = () => {
    if (newAppointment) {
      showNewAppointmentNotification(newAppointment);
      setShowDialog(false);
    }
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo agendamento recebido!</DialogTitle>
          <DialogDescription>
            Você recebeu um novo agendamento. Deseja enviar uma confirmação por WhatsApp?
          </DialogDescription>
        </DialogHeader>
        
        {newAppointment && (
          <div className="py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Cliente: <span className="font-bold">{newAppointment.clientName}</span></p>
              <p className="text-sm font-medium">Serviço: <span className="font-bold">{newAppointment.serviceName}</span></p>
              <p className="text-sm font-medium">Data: <span className="font-bold">{formatDate(new Date(newAppointment.date))}</span></p>
              <p className="text-sm font-medium">Horário: <span className="font-bold">{formatTime(new Date(newAppointment.date))}</span></p>
            </div>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowDialog(false)}>
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