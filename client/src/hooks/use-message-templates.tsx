import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface MessageTemplates {
  newAppointmentTemplate: string;
  reminderTemplate: string;
  cancellationTemplate: string;
}

const defaultTemplates: MessageTemplates = {
  newAppointmentTemplate: "Olá {clientName}, sua reserva para {serviceName} foi confirmada para o dia {appointmentDate} às {appointmentTime}. Agradecemos por agendar conosco! {businessName}",
  reminderTemplate: "Olá {clientName}, estamos enviando este lembrete para o seu agendamento de {serviceName} hoje às {appointmentTime}. Estamos ansiosos para recebê-lo! {businessName}",
  cancellationTemplate: "Olá {clientName}, informamos que seu agendamento para {serviceName} no dia {appointmentDate} às {appointmentTime} foi cancelado. Entre em contato caso queira reagendar! {businessName}"
};

export function useMessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplates>(defaultTemplates);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/message-templates'],
    queryFn: async () => {
      const res = await fetch('/api/message-templates');
      if (!res.ok) {
        if (res.status === 404) {
          return defaultTemplates;
        }
        throw new Error('Falha ao buscar templates de mensagens');
      }
      return res.json();
    }
  });
  
  useEffect(() => {
    if (data) {
      setTemplates(data);
    }
  }, [data]);
  
  const processTemplate = (
    templateKey: keyof MessageTemplates, 
    replacements: Record<string, string>
  ): string => {
    let template = templates[templateKey];
    
    Object.entries(replacements).forEach(([key, value]) => {
      template = template.replace(new RegExp(`{${key}}`, 'g'), value);
    });
    
    return template;
  };
  
  return {
    templates,
    isLoading,
    error,
    processTemplate
  };
}