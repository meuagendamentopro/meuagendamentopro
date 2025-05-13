import { db } from './db';
import { eq, and, gt, lt } from 'drizzle-orm';
import { appointments, services, providers, clients } from '../shared/schema';
import whatsappService from './whatsapp-service';
import logger from './logger';
import { formatDate } from './utils';

// Intervalo para verificação de lembretes (a cada 1 hora)
const REMINDER_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hora em ms

// Iniciar agendador
let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Inicia o agendador de tarefas para enviar lembretes automáticos
 */
export function startScheduler() {
  if (schedulerInterval) {
    return;
  }

  logger.info('Iniciando agendador de tarefas');
  
  // Executar imediatamente na inicialização e depois a cada intervalo
  checkAndSendReminders();
  
  schedulerInterval = setInterval(() => {
    checkAndSendReminders();
  }, REMINDER_CHECK_INTERVAL);
}

/**
 * Para o agendador de tarefas
 */
export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Agendador de tarefas parado');
  }
}

/**
 * Verifica agendamentos que precisam de lembretes e os envia
 */
async function checkAndSendReminders() {
  logger.info('Verificando agendamentos para enviar lembretes');
  
  try {
    // Calcular data para amanhã (24h a partir de agora)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Definir intervalo para buscar agendamentos de amanhã
    const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
    const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));
    
    // Buscar agendamentos para amanhã que ainda não receberam lembrete
    const upcomingAppointments = await db
      .select({
        appointment: appointments,
        service: services,
        provider: providers,
        client: clients
      })
      .from(appointments)
      .leftJoin(services, eq(appointments.serviceId, services.id))
      .leftJoin(providers, eq(appointments.providerId, providers.id))
      .leftJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          gt(appointments.appointmentDate, tomorrowStart),
          lt(appointments.appointmentDate, tomorrowEnd),
          eq(appointments.reminderSent, false)
        )
      );
    
    logger.info(`Encontrados ${upcomingAppointments.length} agendamentos para enviar lembrete`);
    
    // Enviar lembretes para cada agendamento
    for (const { appointment, service, provider, client } of upcomingAppointments) {
      if (!client || !service || !provider) {
        logger.warn(`Dados incompletos para agendamento ID ${appointment.id}. Lembrete não enviado.`);
        continue;
      }
      
      logger.info(`Enviando lembrete para cliente ${client.name} - Agendamento ${formatDate(appointment.appointmentDate)}`);
      
      // Enviar lembrete via WhatsApp
      const sent = await whatsappService.sendAppointmentReminder(
        appointment,
        service,
        provider,
        client
      );
      
      if (sent) {
        // Atualizar flag de lembrete enviado
        await db
          .update(appointments)
          .set({ reminderSent: true })
          .where(eq(appointments.id, appointment.id));
          
        logger.info(`Lembrete enviado com sucesso para agendamento ID ${appointment.id}`);
      }
    }
  } catch (error: any) {
    logger.error(`Erro ao verificar e enviar lembretes: ${error.message}`, error);
  }
}

export default {
  startScheduler,
  stopScheduler
};