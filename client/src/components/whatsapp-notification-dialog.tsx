import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/lib/format";

// Tipos de notificação que podemos enviar
export enum WhatsAppNotificationType {
  NEW_APPOINTMENT = "new_appointment",
  REMINDER = "reminder",
  CANCELLATION = "cancellation",
}

// Interface para os dados do cliente e agendamento
interface WhatsAppNotificationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: WhatsAppNotificationType;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  appointmentDate: Date;
  appointmentTime: string;
  onSendWhatsApp: () => void;
  onCancel: () => void;
}

export function WhatsAppNotificationDialog({
  open,
  onOpenChange,
  type,
  clientName,
  clientPhone,
  serviceName,
  appointmentDate,
  appointmentTime,
  onSendWhatsApp,
  onCancel,
}: WhatsAppNotificationProps) {
  // Função para formatar a data para exibição (DD/MM/YYYY)
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("pt-BR");
  };

  // Determinar título, descrição e mensagem com base no tipo de notificação
  const getDialogContent = () => {
    switch (type) {
      case WhatsAppNotificationType.NEW_APPOINTMENT:
        return {
          title: "Novo Agendamento Realizado",
          description: `${clientName} agendou ${serviceName} para ${formatDate(appointmentDate)} às ${appointmentTime}.`,
          question: "Deseja enviar uma mensagem de confirmação para o cliente?",
        };
      case WhatsAppNotificationType.REMINDER:
        return {
          title: "Lembrete de Agendamento",
          description: `Falta 1 hora para o agendamento de ${clientName} (${serviceName}) às ${appointmentTime}.`,
          question: "Deseja enviar um lembrete para o cliente?",
        };
      case WhatsAppNotificationType.CANCELLATION:
        return {
          title: "Agendamento Cancelado",
          description: `O agendamento de ${clientName} para ${formatDate(appointmentDate)} às ${appointmentTime} foi cancelado.`,
          question: "Deseja notificar o cliente sobre o cancelamento?",
        };
      default:
        return {
          title: "Notificação",
          description: "Deseja enviar uma mensagem para o cliente?",
          question: "Confirmar envio?",
        };
    }
  };

  const { title, description, question } = getDialogContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-9 h-9 flex items-center justify-center bg-green-50 rounded-full">
              <svg
                className="w-5 h-5 text-green-600"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.101-.473-.15-.673.15-.197.295-.771.964-.944 1.162-.175.195-.349.21-.646.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.484-1.77-1.66-2.07-.174-.3-.019-.465.13-.615.136-.135.301-.345.451-.523.146-.181.194-.301.297-.496.1-.21.049-.375-.025-.524-.075-.15-.672-1.62-.922-2.206-.24-.584-.487-.51-.672-.51-.172-.015-.371-.015-.571-.015-.2 0-.523.074-.797.359-.273.3-1.045 1.02-1.045 2.475s1.07 2.865 1.219 3.075c.149.195 2.105 3.195 5.1 4.485.714.3 1.27.48 1.704.629.714.227 1.365.195 1.88.121.574-.091 1.767-.721 2.016-1.426.255-.705.255-1.29.18-1.425-.074-.135-.27-.21-.57-.345m-5.446 7.443h-.016c-1.77 0-3.524-.48-5.055-1.38l-.36-.214-3.75.975 1.005-3.645-.239-.375a9.869 9.869 0 0 1-1.516-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
              </svg>
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription>
            {description}
            <p className="mt-2 font-medium">{question}</p>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-sm text-slate-500 mb-1">Cliente:</p>
            <p className="font-medium">{clientName}</p>
            <p className="text-slate-500">{formatPhoneNumber(clientPhone)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Fechar
          </Button>
          <Button 
            onClick={onSendWhatsApp}
            className="bg-green-600 hover:bg-green-700"
          >
            Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Função auxiliar para criar mensagem para o WhatsApp com base no tipo de notificação
export function createWhatsAppMessage(
  type: WhatsAppNotificationType,
  clientName: string,
  serviceName: string,
  appointmentDate: Date,
  appointmentTime: string,
  businessName: string = "Agenda Online"
): string {
  // Formatar data para exibição
  const formattedDate = appointmentDate.toLocaleDateString("pt-BR");
  
  switch (type) {
    case WhatsAppNotificationType.NEW_APPOINTMENT:
      return `Olá ${clientName}! Seu agendamento para ${serviceName} em ${formattedDate} às ${appointmentTime} foi confirmado com sucesso.\n\nAgradecemos a preferência!\n\n${businessName}`;
    
    case WhatsAppNotificationType.REMINDER:
      return `Olá ${clientName}! Apenas um lembrete amigável do seu agendamento para ${serviceName} hoje às ${appointmentTime}.\n\nEstamos aguardando você!\n\n${businessName}`;
    
    case WhatsAppNotificationType.CANCELLATION:
      return `Olá ${clientName}! Informamos que seu agendamento para ${serviceName} em ${formattedDate} às ${appointmentTime} foi cancelado.\n\nPor favor, entre em contato caso deseje reagendar.\n\n${businessName}`;
    
    default:
      return `Olá ${clientName}! Esta é uma mensagem sobre seu agendamento para ${serviceName} em ${formattedDate} às ${appointmentTime}.\n\n${businessName}`;
  }
}

// Função para abrir o WhatsApp Web com a mensagem
export function openWhatsApp(phone: string, message: string): void {
  // Formatar o telefone (remover formatação)
  const cleanPhone = phone.replace(/\D/g, "");
  
  // Garantir que o telefone tenha o formato correto para o Brasil (com 55)
  const formattedPhone = cleanPhone.startsWith("55") 
    ? cleanPhone 
    : `55${cleanPhone}`;
  
  // Codificar a mensagem para URL
  const encodedMessage = encodeURIComponent(message);
  
  // Criar URL do WhatsApp
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedMessage}`;
  
  // Abrir em uma nova aba
  window.open(whatsappUrl, "_blank");
}