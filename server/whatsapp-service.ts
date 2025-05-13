/**
 * Serviço para envio de mensagens WhatsApp via Twilio
 */

import { extractDateAndTime, formatCurrency } from './utils';
import logger from './logger';
import twilio from 'twilio';
import { Appointment, Client, Provider, Service } from '../shared/schema';
import { getNotificationSettings } from './notification-settings';

// Cliente Twilio será inicializado sob demanda com as credenciais de cada provider
let twilioClient: ReturnType<typeof twilio> | null = null;

/**
 * Normaliza o número de telefone para o formato esperado pelo WhatsApp
 * @param phoneNumber Número de telefone (ex: +5511999999999)
 * @returns Número formatado (ex: whatsapp:+5511999999999)
 */
function formatWhatsAppNumber(phoneNumber: string): string {
  if (!phoneNumber) return '';
  
  // Remove qualquer prefixo whatsapp: existente para evitar duplicação
  let cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
  
  // Verifica se o número já contém o código do país
  if (!cleanNumber.startsWith('+')) {
    // Se não tiver o código do país, adiciona +55 (Brasil)
    if (/^\d+$/.test(cleanNumber)) {
      cleanNumber = `+55${cleanNumber}`;
    } else {
      // Se não for apenas dígitos, mantém como está mas garante o + inicial
      cleanNumber = `+${cleanNumber.replace(/^\+/, '')}`;
    }
  }
  
  // Adiciona o prefixo whatsapp: necessário para a API do Twilio
  return `whatsapp:${cleanNumber}`;
}

/**
 * Envia uma mensagem via WhatsApp usando o Twilio
 * @param to Número do destinatário (será normalizado automaticamente)
 * @param message Mensagem a ser enviada
 * @param providerSettings Configurações do provedor com credenciais do Twilio
 * @returns Promise com o resultado do envio
 */
async function sendWhatsAppMessage(
  to: string,
  message: string,
  providerSettings: { accountSid?: string; authToken?: string; phoneNumber?: string }
): Promise<boolean> {
  try {
    if (!providerSettings.accountSid || !providerSettings.authToken || !providerSettings.phoneNumber) {
      logger.error('Credenciais do Twilio incompletas');
      return false;
    }

    // Inicializa o cliente Twilio com as credenciais do provider
    twilioClient = twilio(providerSettings.accountSid, providerSettings.authToken);

    // Formatar números para WhatsApp Sandbox
    // Garantir que o formato seja exatamente 'whatsapp:+XXXXXXXXXX'
    let from = providerSettings.phoneNumber;
    if (!from.startsWith('whatsapp:')) {
      from = 'whatsapp:' + from.replace(/^\+?/, '+');
    }

    let formattedTo = to;
    if (!formattedTo.startsWith('+')) {
      formattedTo = '+' + formattedTo.replace(/^\+/, '');
    }
    if (!formattedTo.startsWith('whatsapp:')) {
      formattedTo = 'whatsapp:' + formattedTo;
    }

    logger.info(`Enviando mensagem WhatsApp de ${from} para ${formattedTo}`);

    // Envia a mensagem
    const result = await twilioClient.messages.create({
      body: message,
      from: from,
      to: formattedTo
    });

    logger.info(`Mensagem WhatsApp enviada: ${result.sid}`);
    return true;
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao enviar mensagem WhatsApp: ${error.message}`);
    return false;
  }
}

/**
 * Envia notificação de confirmação após criação de agendamento
 * @param appointment Dados do agendamento
 * @param service Serviço agendado
 * @param provider Dados do prestador
 * @param client Dados do cliente
 * @returns Resultado do envio
 */
export async function sendAppointmentConfirmation(
  appointment: Appointment,
  service: Service,
  provider: Provider,
  client: Client
): Promise<boolean> {
  try {
    // Verificar se o provedor tem notificações de WhatsApp habilitadas
    const settings = await getNotificationSettings(provider.id);
    
    if (!settings.enableWhatsApp || !settings.enableAppointmentConfirmation) {
      logger.info(`Notificação WhatsApp desabilitada para o provedor ${provider.id}`);
      return false;
    }
    
    // Extrair data e hora formatadas
    const { formattedDate, formattedTime } = extractDateAndTime(appointment.date);
    
    // Preço formatado
    const formattedPrice = formatCurrency(service.price);
    
    // Montar a mensagem
    const message = [
      `Olá ${client.name}!`,
      '',
      `Seu agendamento com ${provider.name} foi confirmado com sucesso.`,
      '',
      `*Detalhes do agendamento:*`,
      `📅 Data: ${formattedDate}`,
      `⏰ Horário: ${formattedTime}`,
      `✨ Serviço: ${service.name}`,
      `💰 Valor: ${formattedPrice}`,
      '',
      `Para cancelar ou reagendar, entre em contato pelo telefone ${provider.phone}.`,
      '',
      `Obrigado por agendar conosco!`
    ].join('\n');
    
    // Enviar a mensagem
    return await sendWhatsAppMessage(
      client.phone,
      message,
      {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        phoneNumber: settings.phoneNumber
      }
    );
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao enviar confirmação de agendamento: ${error.message}`);
    return false;
  }
}

/**
 * Envia lembrete de agendamento 24h antes
 * @param appointment Dados do agendamento
 * @param service Serviço agendado
 * @param provider Dados do prestador
 * @param client Dados do cliente
 * @returns Resultado do envio
 */
export async function sendAppointmentReminder(
  appointment: Appointment,
  service: Service,
  provider: Provider,
  client: Client
): Promise<boolean> {
  try {
    // Verificar se o provedor tem notificações de WhatsApp habilitadas
    const settings = await getNotificationSettings(provider.id);
    
    if (!settings.enableWhatsApp || !settings.enableAppointmentReminder) {
      logger.info(`Lembrete WhatsApp desabilitado para o provedor ${provider.id}`);
      return false;
    }
    
    // Extrair data e hora formatadas
    const { formattedDate, formattedTime } = extractDateAndTime(appointment.date);
    
    // Verificar se o agendamento é para hoje ou amanhã
    const now = new Date();
    const appointmentDate = new Date(appointment.date);
    const isSameDay = 
      appointmentDate.getDate() === now.getDate() && 
      appointmentDate.getMonth() === now.getMonth() && 
      appointmentDate.getFullYear() === now.getFullYear();
    
    // Texto contextual com base no dia do agendamento
    const reminderText = isSameDay ? 
      `Lembrete do seu agendamento hoje com ${provider.name}.` : 
      `Lembrete do seu agendamento amanhã com ${provider.name}.`;
    
    // Montar a mensagem
    const message = [
      `Olá ${client.name}!`,
      '',
      reminderText,
      '',
      `*Detalhes do agendamento:*`,
      `📅 Data: ${formattedDate}`,
      `⏰ Horário: ${formattedTime}`,
      `✨ Serviço: ${service.name}`,
      '',
      `Por favor, confirme sua presença respondendo esta mensagem.`,
      `Para reagendar ou cancelar, entre em contato o quanto antes pelo telefone ${provider.phone}.`,
      '',
      `Estamos ansiosos para recebê-lo(a)!`
    ].join('\n');
    
    // Enviar a mensagem
    return await sendWhatsAppMessage(
      client.phone,
      message,
      {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        phoneNumber: settings.phoneNumber
      }
    );
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao enviar lembrete de agendamento: ${error.message}`);
    return false;
  }
}

/**
 * Envia notificação de cancelamento de agendamento
 * @param appointment Dados do agendamento
 * @param service Serviço agendado
 * @param provider Dados do prestador
 * @param client Dados do cliente
 * @param cancelledBy Quem cancelou o agendamento (cliente, provedor ou sistema)
 * @returns Resultado do envio
 */
export async function sendAppointmentCancellation(
  appointment: Appointment,
  service: Service,
  provider: Provider,
  client: Client,
  cancelledBy: 'client' | 'provider' | 'system' = 'system'
): Promise<boolean> {
  try {
    // Verificar se o provedor tem notificações de WhatsApp habilitadas
    const settings = await getNotificationSettings(provider.id);
    
    if (!settings.enableWhatsApp || !settings.enableCancellationNotice) {
      logger.info(`Notificação de cancelamento WhatsApp desabilitada para o provedor ${provider.id}`);
      return false;
    }
    
    // Extrair data e hora formatadas
    const { formattedDate, formattedTime } = extractDateAndTime(appointment.date);
    
    // Texto personalizado com base em quem cancelou
    let cancellationReason = '';
    
    if (cancelledBy === 'client') {
      cancellationReason = 'Este agendamento foi cancelado a seu pedido.';
    } else if (cancelledBy === 'provider') {
      cancellationReason = `Este agendamento foi cancelado por ${provider.name}.`;
    } else {
      cancellationReason = 'Este agendamento foi cancelado pelo sistema.';
    }
    
    // Montar a mensagem
    const message = [
      `Olá ${client.name}!`,
      '',
      `Seu agendamento foi cancelado.`,
      '',
      `*Detalhes do agendamento cancelado:*`,
      `📅 Data: ${formattedDate}`,
      `⏰ Horário: ${formattedTime}`,
      `✨ Serviço: ${service.name}`,
      '',
      cancellationReason,
      '',
      `Para fazer um novo agendamento, entre em contato pelo telefone ${provider.phone}.`,
      '',
      `Agradecemos sua compreensão.`
    ].join('\n');
    
    // Enviar a mensagem
    return await sendWhatsAppMessage(
      client.phone,
      message,
      {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        phoneNumber: settings.phoneNumber
      }
    );
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao enviar notificação de cancelamento: ${error.message}`);
    return false;
  }
}

/**
 * Envia notificação de alteração de agendamento
 * @param appointment Dados do agendamento atualizado
 * @param service Serviço agendado
 * @param provider Dados do prestador
 * @param client Dados do cliente
 * @param oldDate Data anterior do agendamento
 * @returns Resultado do envio
 */
export async function sendAppointmentReschedule(
  appointment: Appointment,
  service: Service, 
  provider: Provider,
  client: Client,
  oldDate: Date,
): Promise<boolean> {
  try {
    // Verificar se o provedor tem notificações de WhatsApp habilitadas
    const settings = await getNotificationSettings(provider.id);
    
    if (!settings.enableWhatsApp) {
      logger.info(`Notificação WhatsApp desabilitada para o provedor ${provider.id}`);
      return false;
    }
    
    // Extrair data e hora formatadas (atual e antiga)
    const newDateDetails = extractDateAndTime(appointment.date);
    const oldDateDetails = extractDateAndTime(oldDate);
    
    // Montar a mensagem
    const message = [
      `Olá ${client.name}!`,
      '',
      `Seu agendamento com ${provider.name} foi remarcado.`,
      '',
      `*Novo horário:*`,
      `📅 Data: ${newDateDetails.formattedDate}`,
      `⏰ Horário: ${newDateDetails.formattedTime}`,
      '',
      `*Horário anterior:*`,
      `📅 Data: ${oldDateDetails.formattedDate}`,
      `⏰ Horário: ${oldDateDetails.formattedTime}`,
      '',
      `✨ Serviço: ${service.name}`,
      '',
      `Se este novo horário não for adequado para você, por favor entre em contato pelo telefone ${provider.phone}.`,
      '',
      `Obrigado pela compreensão.`
    ].join('\n');
    
    // Enviar a mensagem
    return await sendWhatsAppMessage(
      client.phone,
      message,
      {
        accountSid: settings.accountSid,
        authToken: settings.authToken,
        phoneNumber: settings.phoneNumber
      }
    );
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao enviar notificação de reagendamento: ${error.message}`);
    return false;
  }
}

/**
 * Verifica se o serviço de WhatsApp está configurado e disponível
 * @param providerId ID do provedor para verificar configurações
 * @returns true se disponível, false caso contrário
 */
export async function isWhatsAppServiceAvailable(providerId: number): Promise<boolean> {
  try {
    const settings = await getNotificationSettings(providerId);
    
    return !!(
      settings.enableWhatsApp && 
      settings.accountSid && 
      settings.authToken && 
      settings.phoneNumber
    );
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao verificar disponibilidade do serviço WhatsApp: ${error.message}`);
    return false;
  }
}