/**
 * Agendador de tarefas para envio automático de lembretes e notificações
 * 
 * Este módulo gerencia:
 * - Lembretes de agendamentos (24h antes)
 * - Lembretes no dia do agendamento
 * - Verificação e limpeza de agendamentos expirados
 */

import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { db } from './db';
import { appointments, services, providers, clients, AppointmentStatus } from '../shared/schema';
import logger from './logger';
import { extractDateAndTime, isToday, isTomorrow } from './utils';
import * as whatsappService from './whatsapp-service';

/**
 * Intervalo para verificação de agendamentos pendentes em milissegundos
 * Padrão: 5 minutos (300000ms)
 */
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Inicia o agendador de tarefas
 */
export function startScheduler() {
  logger.info('Iniciando agendador de tarefas para notificações automáticas');
  
  // Execução inicial
  runScheduledTasks();
  
  // Programar execuções periódicas
  setInterval(runScheduledTasks, SCHEDULER_INTERVAL_MS);
}

/**
 * Executa todas as tarefas agendadas
 */
async function runScheduledTasks() {
  try {
    logger.debug('Executando tarefas agendadas');
    
    // Enviar lembretes 24h antes
    await sendUpcomingAppointmentReminders();
    
    // Enviar lembretes no dia do agendamento
    await sendTodayAppointmentReminders();
    
    // Verificar agendamentos expirados (no passado e ainda com status PENDING)
    await handleExpiredAppointments();
    
  } catch (error) {
    logger.error('Erro ao executar tarefas agendadas:', error);
  }
}

/**
 * Envia lembretes para agendamentos que acontecerão no dia seguinte
 */
async function sendUpcomingAppointmentReminders() {
  try {
    // Busca agendamentos para amanhã que ainda não receberam lembrete
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(tomorrow);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const upcomingAppointments = await db.select()
      .from(appointments)
      .where(
        and(
          gt(appointments.date, tomorrow),
          lt(appointments.date, nextDay),
          eq(appointments.status, AppointmentStatus.CONFIRMED),
          eq(appointments.reminderSent, false)
        )
      );
    
    if (upcomingAppointments.length > 0) {
      logger.info(`Enviando lembretes para ${upcomingAppointments.length} agendamentos de amanhã`);
      
      for (const appointment of upcomingAppointments) {
        try {
          // Buscar dados relacionados
          const [service] = await db.select().from(services).where(eq(services.id, appointment.serviceId));
          const [provider] = await db.select().from(providers).where(eq(providers.id, appointment.providerId));
          const [client] = await db.select().from(clients).where(eq(clients.id, appointment.clientId));
          
          if (!service || !provider || !client) {
            logger.warn(`Dados incompletos para lembrete do agendamento #${appointment.id}`);
            continue;
          }
          
          // Enviar lembrete via WhatsApp
          const success = await whatsappService.sendAppointmentReminder(
            appointment,
            service,
            provider,
            client
          );
          
          // Atualizar flag de lembrete enviado
          if (success) {
            await db.update(appointments)
              .set({ reminderSent: true })
              .where(eq(appointments.id, appointment.id));
              
            logger.info(`Lembrete enviado para agendamento #${appointment.id} (${client.name})`);
          } else {
            logger.warn(`Falha ao enviar lembrete para agendamento #${appointment.id}`);
          }
        } catch (error) {
          logger.error(`Erro ao processar lembrete para agendamento #${appointment.id}:`, error);
        }
      }
    } else {
      logger.debug('Nenhum agendamento para amanhã necessita de lembretes');
    }
  } catch (error) {
    logger.error('Erro ao enviar lembretes para agendamentos de amanhã:', error);
  }
}

/**
 * Envia lembretes para agendamentos que acontecem hoje
 */
async function sendTodayAppointmentReminders() {
  try {
    // Busca agendamentos para hoje que ainda não receberam lembrete
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayAppointments = await db.select()
      .from(appointments)
      .where(
        and(
          gt(appointments.date, today),
          lt(appointments.date, tomorrow),
          eq(appointments.status, AppointmentStatus.CONFIRMED),
          eq(appointments.reminderSent, false)
        )
      );
    
    if (todayAppointments.length > 0) {
      logger.info(`Enviando lembretes para ${todayAppointments.length} agendamentos de hoje`);
      
      for (const appointment of todayAppointments) {
        try {
          // Buscar dados relacionados
          const [service] = await db.select().from(services).where(eq(services.id, appointment.serviceId));
          const [provider] = await db.select().from(providers).where(eq(providers.id, appointment.providerId));
          const [client] = await db.select().from(clients).where(eq(clients.id, appointment.clientId));
          
          if (!service || !provider || !client) {
            logger.warn(`Dados incompletos para lembrete do agendamento #${appointment.id}`);
            continue;
          }
          
          // Enviar lembrete via WhatsApp
          const success = await whatsappService.sendAppointmentReminder(
            appointment,
            service,
            provider,
            client
          );
          
          // Atualizar flag de lembrete enviado
          if (success) {
            await db.update(appointments)
              .set({ reminderSent: true })
              .where(eq(appointments.id, appointment.id));
              
            logger.info(`Lembrete enviado para agendamento #${appointment.id} (${client.name})`);
          } else {
            logger.warn(`Falha ao enviar lembrete para agendamento #${appointment.id}`);
          }
        } catch (error) {
          logger.error(`Erro ao processar lembrete para agendamento #${appointment.id}:`, error);
        }
      }
    } else {
      logger.debug('Nenhum agendamento para hoje necessita de lembretes');
    }
  } catch (error) {
    logger.error('Erro ao enviar lembretes para agendamentos de hoje:', error);
  }
}

/**
 * Verifica e processa agendamentos expirados (passados sem confirmação/cancelamento)
 */
async function handleExpiredAppointments() {
  try {
    const now = new Date();
    
    // Busca agendamentos no passado com status ainda pendente
    const expiredAppointments = await db.select()
      .from(appointments)
      .where(
        and(
          lt(appointments.date, now),
          eq(appointments.status, AppointmentStatus.PENDING)
        )
      );
    
    if (expiredAppointments.length > 0) {
      logger.info(`Processando ${expiredAppointments.length} agendamentos expirados`);
      
      for (const appointment of expiredAppointments) {
        try {
          // Marcar como expirado/cancelado automaticamente
          await db.update(appointments)
            .set({ 
              status: AppointmentStatus.CANCELLED,
              cancellationReason: 'Cancelado automaticamente por expiração' 
            })
            .where(eq(appointments.id, appointment.id));
          
          logger.info(`Agendamento #${appointment.id} marcado como cancelado por expiração`);
          
          // Notificar cliente e provider sobre o cancelamento automático
          // Aqui poderíamos adicionar uma notificação no sistema ou via WhatsApp
        } catch (error) {
          logger.error(`Erro ao processar agendamento expirado #${appointment.id}:`, error);
        }
      }
    } else {
      logger.debug('Nenhum agendamento expirado para processar');
    }
  } catch (error) {
    logger.error('Erro ao processar agendamentos expirados:', error);
  }
}