/**
 * Scheduler para notificações automáticas
 * 
 * Este módulo:
 * - Executa tarefas em intervalos regulares
 * - Verifica agendamentos para enviar lembretes
 * - Atualiza status de agendamentos expirados
 */

import { db } from './db';
import { appointments, clients, providers, services } from '../shared/schema';
import { eq, and, gt, lt, isNull } from 'drizzle-orm';
import { addDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import logger from './logger';
import { formatDateBr } from './utils';
import { sendAppointmentReminder } from './whatsapp-service';

// Intervalo de verificação em milissegundos (a cada 30 minutos)
const CHECK_INTERVAL = 30 * 60 * 1000;

// Flag para rastrear se o scheduler já está em execução
let isRunning = false;

/**
 * Verifica agendamentos para enviar lembretes 24h antes
 */
async function sendReminders() {
  try {
    const now = new Date();
    
    // Data alvo para lembretes: agendamentos para amanhã
    const targetDate = addDays(now, 1);
    const startOfTargetDay = startOfDay(targetDate);
    const endOfTargetDay = endOfDay(targetDate);
    
    logger.info(`Verificando agendamentos para lembretes em ${formatDateBr(targetDate)}`);
    
    // Buscar agendamentos para amanhã que ainda não receberam lembrete
    const upcomingAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          gt(appointments.date, startOfTargetDay),
          lt(appointments.date, endOfTargetDay),
          eq(appointments.status, 'confirmed'),
          eq(appointments.reminderSent, false)
        )
      );
    
    if (upcomingAppointments.length === 0) {
      logger.info('Nenhum agendamento pendente de lembrete para amanhã');
      return;
    }
    
    logger.info(`Encontrados ${upcomingAppointments.length} agendamentos para enviar lembretes`);
    
    // Para cada agendamento, enviar lembrete
    for (const appointment of upcomingAppointments) {
      try {
        // Buscar dados relacionados
        const [service] = await db
          .select()
          .from(services)
          .where(eq(services.id, appointment.serviceId));
        
        const [provider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, appointment.providerId));
        
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, appointment.clientId));
        
        if (!service || !provider || !client) {
          logger.warn(`Dados incompletos para o agendamento ${appointment.id}, pulando lembrete`);
          continue;
        }
        
        // Enviar lembrete via WhatsApp
        const sent = await sendAppointmentReminder(appointment, service, provider, client);
        
        if (sent) {
          // Atualizar flag de lembrete enviado
          await db
            .update(appointments)
            .set({ reminderSent: true })
            .where(eq(appointments.id, appointment.id));
          
          logger.info(`Lembrete enviado com sucesso para o agendamento ${appointment.id}`);
        } else {
          logger.warn(`Falha ao enviar lembrete para o agendamento ${appointment.id}`);
        }
      } catch (err) {
        const error = err as Error;
        logger.error(`Erro ao processar lembrete para agendamento ${appointment.id}: ${error.message}`);
      }
    }
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao executar verificação de lembretes: ${error.message}`);
  }
}

/**
 * Verifica e atualiza status de agendamentos expirados
 */
async function updateExpiredAppointments() {
  try {
    const now = new Date();
    
    logger.info('Verificando agendamentos expirados');
    
    // Buscar agendamentos passados que ainda estão confirmados
    const expiredAppointments = await db
      .select()
      .from(appointments)
      .where(
        and(
          lt(appointments.date, now),
          eq(appointments.status, 'confirmed')
        )
      );
    
    if (expiredAppointments.length === 0) {
      logger.info('Nenhum agendamento expirado para atualizar');
      return;
    }
    
    logger.info(`Encontrados ${expiredAppointments.length} agendamentos expirados para atualizar`);
    
    // Atualizar status para "completed" (pode ser customizado conforme necessário)
    for (const appointment of expiredAppointments) {
      await db
        .update(appointments)
        .set({ status: 'completed' })
        .where(eq(appointments.id, appointment.id));
      
      logger.info(`Agendamento ${appointment.id} marcado como concluído`);
    }
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao atualizar agendamentos expirados: ${error.message}`);
  }
}

/**
 * Verifica agendamentos do dia atual para enviar lembretes
 */
async function sendSameDayReminders() {
  try {
    const now = new Date();
    
    // Pegamos apenas a data atual (início do dia e fim do dia)
    const startOfToday = startOfDay(now);
    const endOfToday = endOfDay(now);
    
    logger.info(`Verificando agendamentos do dia atual (${formatDateBr(now)}) para lembretes`);
    
    // Buscar agendamentos para hoje que estão confirmados e ainda não receberam lembrete
    const todayAppointments = await db
      .select({
        appointment: appointments,
        service: services,
        provider: providers,
        client: clients,
      })
      .from(appointments)
      .innerJoin(services, eq(appointments.serviceId, services.id))
      .innerJoin(providers, eq(appointments.providerId, providers.id))
      .innerJoin(clients, eq(appointments.clientId, clients.id))
      .where(
        and(
          gt(appointments.date, startOfToday),
          lt(appointments.date, endOfToday),
          gt(appointments.date, now), // Apenas agendamentos futuros do dia atual
          eq(appointments.status, 'confirmed'),
          eq(appointments.reminderSent, false)
        )
      );
    
    if (todayAppointments.length === 0) {
      logger.info('Nenhum agendamento pendente de lembrete para hoje');
      return;
    }
    
    logger.info(`Encontrados ${todayAppointments.length} agendamentos para hoje que precisam de lembrete`);
    
    // Para cada agendamento, enviar lembrete
    for (const { appointment, service, provider, client } of todayAppointments) {
      try {
        logger.info(`Enviando lembrete para agendamento ${appointment.id} (${formatDateBr(appointment.date, true)})`);
        
        // Enviar lembrete via WhatsApp
        const sent = await sendAppointmentReminder(appointment, service, provider, client);
        
        if (sent) {
          // Atualizar flag de lembrete enviado
          await db
            .update(appointments)
            .set({ reminderSent: true })
            .where(eq(appointments.id, appointment.id));
          
          logger.info(`Lembrete do mesmo dia enviado com sucesso para o agendamento ${appointment.id}`);
        } else {
          logger.warn(`Falha ao enviar lembrete do mesmo dia para o agendamento ${appointment.id}`);
        }
      } catch (err) {
        const error = err as Error;
        logger.error(`Erro ao processar lembrete para agendamento ${appointment.id}: ${error.message}`);
      }
    }
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao executar verificação de lembretes do mesmo dia: ${error.message}`);
  }
}

/**
 * Função principal executada periodicamente
 */
async function runSchedulerTasks() {
  if (isRunning) {
    return;
  }
  
  isRunning = true;
  
  try {
    logger.info('Iniciando tarefas agendadas');
    
    // Enviar lembretes para agendamentos do dia seguinte
    await sendReminders();
    
    // Enviar lembretes para agendamentos do mesmo dia
    await sendSameDayReminders();
    
    // Atualizar status de agendamentos expirados
    await updateExpiredAppointments();
    
    logger.info('Tarefas agendadas concluídas');
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao executar tarefas agendadas: ${error.message}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicializa o scheduler
 */
export function startScheduler() {
  logger.info('Inicializando scheduler de notificações');
  
  // Executar imediatamente na inicialização
  runSchedulerTasks();
  
  // Configurar execução periódica
  setInterval(runSchedulerTasks, CHECK_INTERVAL);
}