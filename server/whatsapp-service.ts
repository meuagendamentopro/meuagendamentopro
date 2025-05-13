import { Twilio } from 'twilio';
import { Appointment, Service, Provider, Client } from '../shared/schema';
import { formatDate, formatTime } from './utils';
import logger from './logger';

// Verificar se as credenciais do Twilio estão configuradas
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // Formato: 'whatsapp:+14155238886'

// Inicializar cliente do Twilio se as credenciais estiverem disponíveis
let twilioClient: Twilio | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  logger.info('Serviço WhatsApp inicializado com Twilio');
} else {
  logger.warn('Credenciais do Twilio não encontradas. Serviço de WhatsApp desativado.');
}

/**
 * Normaliza o número de telefone para o formato esperado pelo WhatsApp
 * @param phoneNumber Número de telefone (ex: +5511999999999)
 * @returns Número formatado (ex: whatsapp:+5511999999999)
 */
function formatWhatsAppNumber(phoneNumber: string): string {
  // Remover caracteres não numéricos
  const normalizedNumber = phoneNumber.replace(/[^\d+]/g, '');
  
  // Adicionar prefixo do país se não existir
  let formattedNumber = normalizedNumber;
  if (!normalizedNumber.startsWith('+')) {
    formattedNumber = `+55${normalizedNumber}`; // Assumindo Brasil como padrão
  }
  
  // Adicionar prefixo whatsapp:
  return `whatsapp:${formattedNumber}`;
}

/**
 * Envia uma mensagem via WhatsApp usando o Twilio
 * @param to Número do destinatário (será normalizado automaticamente)
 * @param message Mensagem a ser enviada
 * @returns Promise com o resultado do envio
 */
async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!twilioClient || !TWILIO_WHATSAPP_NUMBER) {
    logger.warn('Tentativa de envio de WhatsApp sem configuração. Mensagem não enviada.');
    return false;
  }

  try {
    const formattedTo = formatWhatsAppNumber(to);
    const response = await twilioClient.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: formattedTo,
      body: message
    });

    logger.info(`Mensagem WhatsApp enviada para ${to}. SID: ${response.sid}`);
    return true;
  } catch (error: any) {
    logger.error(`Erro ao enviar mensagem WhatsApp: ${error.message}`, error);
    return false;
  }
}

/**
 * Envia notificação de confirmação após criação de agendamento
 */
export async function sendAppointmentConfirmation(
  appointment: Appointment,
  service: Service,
  provider: Provider,
  client: Client
): Promise<boolean> {
  if (!client.phone) {
    logger.warn(`Cliente ${client.name} não possui telefone. Notificação WhatsApp não enviada.`);
    return false;
  }

  const message = `Olá, ${client.name}! Seu agendamento foi confirmado.

📅 *Serviço*: ${service.name}
📆 *Data*: ${formatDate(appointment.appointmentDate)}
⏰ *Horário*: ${formatTime(appointment.appointmentTime)}
👨‍💼 *Profissional*: ${provider.name}
${appointment.totalPrice ? `💰 *Valor*: R$ ${appointment.totalPrice.toFixed(2)}` : ''}

${appointment.pixQrCode ? `Um pagamento via PIX foi gerado e está disponível no seu agendamento.` : ''}

Para cancelar ou reagendar, entre em contato conosco.
Obrigado por agendar conosco!`;

  return sendWhatsAppMessage(client.phone, message);
}

/**
 * Envia lembrete de agendamento 24h antes
 */
export async function sendAppointmentReminder(
  appointment: Appointment,
  service: Service,
  provider: Provider,
  client: Client
): Promise<boolean> {
  if (!client.phone) {
    logger.warn(`Cliente ${client.name} não possui telefone. Lembrete WhatsApp não enviado.`);
    return false;
  }

  const message = `Olá, ${client.name}! Lembrete do seu agendamento para amanhã.

📅 *Serviço*: ${service.name}
📆 *Data*: ${formatDate(appointment.appointmentDate)}
⏰ *Horário*: ${formatTime(appointment.appointmentTime)}
👨‍💼 *Profissional*: ${provider.name}
📍 *Local*: ${provider.address || 'Endereço não informado'}

${appointment.notes ? `📝 *Observações*: ${appointment.notes}` : ''}

Para cancelar ou reagendar, entre em contato conosco.
Obrigado e até breve!`;

  return sendWhatsAppMessage(client.phone, message);
}

/**
 * Envia notificação de cancelamento de agendamento
 */
export async function sendAppointmentCancellation(
  appointment: Appointment,
  service: Service,
  provider: Provider,
  client: Client,
  reason?: string
): Promise<boolean> {
  if (!client.phone) {
    logger.warn(`Cliente ${client.name} não possui telefone. Notificação de cancelamento não enviada.`);
    return false;
  }

  const message = `Olá, ${client.name}. O seu agendamento foi cancelado.

📅 *Serviço*: ${service.name}
📆 *Data*: ${formatDate(appointment.appointmentDate)}
⏰ *Horário*: ${formatTime(appointment.appointmentTime)}
${reason ? `📝 *Motivo*: ${reason}` : ''}

Entre em contato conosco para reagendar em outra data/horário.
Agradecemos sua compreensão.`;

  return sendWhatsAppMessage(client.phone, message);
}

/**
 * Envia notificação de alteração de agendamento
 */
export async function sendAppointmentReschedule(
  appointment: Appointment,
  service: Service, 
  provider: Provider,
  client: Client,
  oldDate: Date,
  oldTime: string
): Promise<boolean> {
  if (!client.phone) {
    logger.warn(`Cliente ${client.name} não possui telefone. Notificação de reagendamento não enviada.`);
    return false;
  }

  const message = `Olá, ${client.name}. O seu agendamento foi alterado.

📅 *Serviço*: ${service.name}

*De:*
📆 Data: ${formatDate(oldDate)}
⏰ Horário: ${oldTime}

*Para:*
📆 Data: ${formatDate(appointment.appointmentDate)}
⏰ Horário: ${formatTime(appointment.appointmentTime)}
👨‍💼 Profissional: ${provider.name}

Se você tiver alguma dúvida ou precisar fazer alterações, entre em contato conosco.
Obrigado!`;

  return sendWhatsAppMessage(client.phone, message);
}

/**
 * Verifica se o serviço de WhatsApp está configurado e disponível
 */
export function isWhatsAppServiceAvailable(): boolean {
  return !!twilioClient && !!TWILIO_WHATSAPP_NUMBER;
}

export default {
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendAppointmentCancellation,
  sendAppointmentReschedule,
  isWhatsAppServiceAvailable
};