import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime } from "@/lib/dates";
import { Appointment, AppointmentStatus } from "@shared/schema";
import { MessageSquare, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Estendendo o tipo Appointment para incluir as propriedades necessárias
interface EnrichedAppointment extends Appointment {
  clientName?: string;
  clientPhone?: string;
  serviceName?: string;
}

interface AppointmentNotificationProps {
  appointment: EnrichedAppointment | null;
  isOpen: boolean;
  onClose: () => void;
}

const AppointmentNotification: React.FC<AppointmentNotificationProps> = ({
  appointment,
  isOpen,
  onClose,
}) => {
  if (!appointment) return null;

  // Formatação da data e hora do agendamento
  const appointmentDate = typeof appointment.date === 'string' 
    ? new Date(appointment.date) 
    : appointment.date;
  
  const formattedDate = formatDate(appointmentDate);
  const formattedTime = formatTime(appointmentDate);
  
  // Estados para controlar o processo de confirmação
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(appointment.status === AppointmentStatus.CONFIRMED);
  const [messageTemplate, setMessageTemplate] = useState("Caro {cliente}. Seu agendamento para o dia {data} às {hora} foi confirmado.");
  const { toast } = useToast();
  
  // Buscar configurações do provedor para obter o template personalizado
  const { data: providerSettings } = useQuery({
    queryKey: ["/api/my-provider"],
    queryFn: async () => {
      const res = await fetch("/api/my-provider");
      if (!res.ok) throw new Error("Failed to fetch provider settings");
      return res.json();
    },
  });
  
  // Atualizar o template de mensagem quando as configurações forem carregadas
  useEffect(() => {
    if (providerSettings?.whatsappTemplateAppointment) {
      setMessageTemplate(providerSettings.whatsappTemplateAppointment);
    }
  }, [providerSettings]);
  
  // Função para confirmar o agendamento
  const confirmAppointment = async () => {
    if (!appointment.id) {
      console.error("ID do agendamento não disponível");
      return false;
    }
    
    try {
      setIsConfirming(true);
      console.log(`Confirmando agendamento ID: ${appointment.id}`);
      
      const response = await fetch(`/api/appointments/${appointment.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: AppointmentStatus.CONFIRMED
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao confirmar agendamento: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("Agendamento confirmado com sucesso:", result);
      
      setIsConfirmed(true);
      toast({
        title: "Agendamento confirmado",
        description: `O agendamento de ${appointment.clientName} foi confirmado com sucesso.`,
        variant: "default",
      });
      
      return true;
    } catch (error) {
      console.error("Erro ao confirmar agendamento:", error);
      toast({
        title: "Erro ao confirmar",
        description: "Não foi possível confirmar o agendamento. Tente novamente mais tarde.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsConfirming(false);
    }
  };
  
  // Função para abrir o WhatsApp com mensagem predefinida
  const handleWhatsAppClick = async () => {
    if (!appointment.clientPhone) {
      alert("Número de telefone do cliente não disponível");
      return;
    }
    
    // Confirmar o agendamento automaticamente antes de enviar a mensagem
    if (!isConfirmed) {
      const confirmed = await confirmAppointment();
      if (!confirmed) {
        // Se a confirmação falhar, perguntar se deseja continuar
        if (!window.confirm("Não foi possível confirmar o agendamento automaticamente. Deseja enviar a mensagem mesmo assim?")) {
          return;
        }
      }
    }
    
    // Formatar o número de telefone (remover caracteres não numéricos)
    let phoneNumber = appointment.clientPhone.replace(/\D/g, "");
    
    // Verificar se o número já tem código internacional
    if (appointment.clientPhone?.startsWith('+')) {
      // Se já tem código internacional, remover o + e usar como está
      phoneNumber = appointment.clientPhone.substring(1);
    } else {
      // Se não tem código internacional, verificar o formato
      if (phoneNumber.startsWith("55")) {
        // Já tem o prefixo 55, não precisa adicionar
      } else if (phoneNumber.startsWith("0")) {
        // Remove o 0 inicial e adiciona 55
        phoneNumber = "55" + phoneNumber.substring(1);
      } else if (phoneNumber.length <= 11) {
        // É um número brasileiro sem o prefixo, adiciona 55
        phoneNumber = "55" + phoneNumber;
      }
    }
    
    console.log(`Número original: ${appointment.clientPhone}, Formatado: ${phoneNumber}`);
    
    // Criar a mensagem personalizada usando o template
    let message = messageTemplate;
    
    // Substituir as variáveis no template
    message = message.replace(/{cliente}/g, appointment.clientName || "Cliente")
                   .replace(/{data}/g, formattedDate)
                   .replace(/{hora}/g, formattedTime)
                   .replace(/{serviço}/g, appointment.serviceName || "Serviço");
    
    // Codificar a mensagem para URL
    const encodedMessage = encodeURIComponent(message);
    
    // Criar a URL do WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // Abrir o WhatsApp em uma nova janela
    window.open(whatsappUrl, "_blank");
    
    // Fechar o popup após abrir o WhatsApp
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Novo Agendamento Recebido!</DialogTitle>
        </DialogHeader>
        
        <div className="p-4 space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg">
            <p className="font-semibold text-lg">{appointment.clientName}</p>
            <p>Serviço: {appointment.serviceName}</p>
            <p>Data: {formattedDate}</p>
            <p>Horário: {formattedTime}</p>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Um novo agendamento foi criado. Você pode enviar uma mensagem de confirmação para o cliente via WhatsApp.
          </p>
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="sm:flex-1"
          >
            Fechar
          </Button>
          <Button 
            onClick={handleWhatsAppClick} 
            className="bg-green-600 hover:bg-green-700 text-white sm:flex-1"
            disabled={isConfirming}
          >
            {isConfirming ? (
              <>
                <span className="mr-2 animate-spin">&#8635;</span>
                Confirmando...
              </>
            ) : (
              <>
                {isConfirmed && <CheckCircle className="mr-1 h-3 w-3" />}
                <MessageSquare className="mr-2 h-4 w-4" />
                {isConfirmed ? "Enviar WhatsApp" : "Confirmar e Enviar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentNotification;
