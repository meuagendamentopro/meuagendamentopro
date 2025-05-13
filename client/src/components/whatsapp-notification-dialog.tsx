import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatPhoneNumber } from '@/lib/utils';
import { MessageSquare, Calendar, Clock, X, Send, AlertCircle } from 'lucide-react';

// Tipos de notificação
export enum WhatsAppNotificationType {
  NEW_APPOINTMENT = 'new_appointment',
  REMINDER = 'reminder',
  CANCELLATION = 'cancellation'
}

interface WhatsAppNotificationDialogProps {
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

// Função auxiliar para criar a mensagem de WhatsApp de acordo com o tipo de notificação
export function createWhatsAppMessage(
  type: WhatsAppNotificationType,
  clientName: string,
  serviceName: string,
  appointmentDate: Date,
  appointmentTime: string,
  businessName: string
): string {
  // Formatar a data para o formato brasileiro
  const formattedDate = format(appointmentDate, "dd/MM/yyyy", { locale: ptBR });
  
  switch (type) {
    case WhatsAppNotificationType.NEW_APPOINTMENT:
      return `Olá ${clientName}, sua reserva para ${serviceName} foi confirmada para o dia ${formattedDate} às ${appointmentTime}. Agradecemos por agendar conosco! ${businessName}`;
      
    case WhatsAppNotificationType.REMINDER:
      return `Olá ${clientName}, estamos enviando este lembrete para o seu agendamento de ${serviceName} hoje às ${appointmentTime}. Estamos ansiosos para recebê-lo! ${businessName}`;
      
    case WhatsAppNotificationType.CANCELLATION:
      return `Olá ${clientName}, informamos que seu agendamento para ${serviceName} no dia ${formattedDate} às ${appointmentTime} foi cancelado. Entre em contato caso queira reagendar! ${businessName}`;
      
    default:
      return `Olá ${clientName}, temos uma atualização sobre seu agendamento de ${serviceName} no dia ${formattedDate} às ${appointmentTime}. ${businessName}`;
  }
}

// Função para abrir o WhatsApp Web com a mensagem
export function openWhatsApp(phone: string, message: string): void {
  // Remove formatação do telefone
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Certificar que temos o código do país (55 para Brasil)
  const formattedPhone = cleanPhone.startsWith('55') 
    ? cleanPhone 
    : `55${cleanPhone}`;
  
  // Criar URL para abrir o WhatsApp Web
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
  
  // Abrir em nova aba
  window.open(whatsappUrl, '_blank');
}

export const WhatsAppNotificationDialog: React.FC<WhatsAppNotificationDialogProps> = ({
  open,
  onOpenChange,
  type,
  clientName,
  clientPhone,
  serviceName,
  appointmentDate,
  appointmentTime,
  onSendWhatsApp,
  onCancel
}) => {
  // Definir título baseado no tipo
  let title = "Novo agendamento recebido";
  let icon = <MessageSquare className="h-5 w-5 text-primary-500 mr-2" />;
  
  if (type === WhatsAppNotificationType.REMINDER) {
    title = "Lembrete de agendamento";
    icon = <Clock className="h-5 w-5 text-amber-500 mr-2" />;
  } else if (type === WhatsAppNotificationType.CANCELLATION) {
    title = "Agendamento cancelado";
    icon = <AlertCircle className="h-5 w-5 text-red-500 mr-2" />;
  }
  
  // Formatar data para exibição
  const formattedDate = format(appointmentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-lg">
            {icon}
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium">Cliente</p>
              <p className="text-sm">{clientName}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium">Serviço</p>
              <p className="text-sm">{serviceName}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium">Data e hora</p>
              <p className="text-sm">{formattedDate} às {appointmentTime}</p>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-green-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium">Telefone</p>
              <p className="text-sm">{formatPhoneNumber(clientPhone)}</p>
            </div>
          </div>
          
          <div className="bg-muted p-3 rounded-md mt-4">
            <p className="text-sm font-medium mb-1">
              {type === WhatsAppNotificationType.NEW_APPOINTMENT && 'Enviar confirmação via WhatsApp?'}
              {type === WhatsAppNotificationType.REMINDER && 'Enviar lembrete via WhatsApp?'}
              {type === WhatsAppNotificationType.CANCELLATION && 'Notificar o cliente sobre o cancelamento?'}
            </p>
            <p className="text-xs text-muted-foreground">
              Esta ação abrirá o WhatsApp Web com uma mensagem pré-formatada para o cliente.
            </p>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          
          <Button onClick={onSendWhatsApp} className="bg-green-600 hover:bg-green-700 text-white">
            <Send className="h-4 w-4 mr-2" />
            Enviar WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};