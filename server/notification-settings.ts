/**
 * Gerenciador de configurações de notificação
 * 
 * Este módulo:
 * - Armazena e recupera configurações de notificação por provedor
 * - Valida credenciais do Twilio
 * - Gerencia as preferências de notificação
 */

import { db } from './db';
import { providers } from '../shared/schema';
import { eq } from 'drizzle-orm';
import logger from './logger';
import { isValidPhoneNumber } from './utils';
import twilio from 'twilio';

// Interface para configurações de notificação
export interface NotificationSettings {
  enableWhatsApp: boolean;
  accountSid?: string;
  authToken?: string;
  phoneNumber?: string;
  enableAppointmentConfirmation: boolean;
  enableAppointmentReminder: boolean;
  enableCancellationNotice: boolean;
}

/**
 * Salva as configurações de notificação de um provedor
 * @param providerId ID do provedor
 * @param settings Configurações de notificação
 * @returns Resultado da operação
 */
export async function saveNotificationSettings(providerId: number, settings: NotificationSettings): Promise<{ success: boolean; message?: string }> {
  try {
    // Validações
    if (settings.enableWhatsApp) {
      // Se WhatsApp estiver habilitado, as credenciais do Twilio são obrigatórias
      if (!settings.accountSid || !settings.authToken || !settings.phoneNumber) {
        return { 
          success: false, 
          message: "Para habilitar o WhatsApp, preencha todas as credenciais do Twilio" 
        };
      }

      // Validar número de telefone
      if (!isValidPhoneNumber(settings.phoneNumber)) {
        return { 
          success: false, 
          message: "Número de telefone inválido. Use o formato internacional (Ex: +5511999999999)" 
        };
      }

      // Testar credenciais do Twilio
      try {
        // Criamos um cliente Twilio apenas para verificar se as credenciais estão corretas
        const twilioClient = new Twilio(settings.accountSid, settings.authToken);
        await twilioClient.api.accounts(settings.accountSid).fetch();
      } catch (error) {
        logger.error('Erro ao validar credenciais do Twilio', error);
        return { 
          success: false, 
          message: "Credenciais do Twilio inválidas. Verifique Account SID e Auth Token." 
        };
      }
    }

    // Atualiza as configurações no banco de dados
    await db.update(providers)
      .set({
        whatsappEnabled: settings.enableWhatsApp,
        twilioAccountSid: settings.enableWhatsApp ? settings.accountSid : null,
        twilioAuthToken: settings.enableWhatsApp ? settings.authToken : null,
        twilioPhoneNumber: settings.enableWhatsApp ? settings.phoneNumber : null,
        enableAppointmentConfirmation: settings.enableAppointmentConfirmation,
        enableAppointmentReminder: settings.enableAppointmentReminder,
        enableCancellationNotice: settings.enableCancellationNotice
      })
      .where(eq(providers.id, providerId));

    logger.info(`Configurações de notificação atualizadas para o provedor ${providerId}`);
    return { success: true };
  } catch (error) {
    logger.error(`Erro ao salvar configurações de notificação para o provedor ${providerId}`, error);
    return { 
      success: false, 
      message: "Erro ao salvar configurações. Tente novamente." 
    };
  }
}

/**
 * Obtém as configurações de notificação de um provedor
 * @param providerId ID do provedor
 * @returns Configurações de notificação
 */
export async function getNotificationSettings(providerId: number): Promise<NotificationSettings> {
  try {
    const [provider] = await db.select({
      whatsappEnabled: providers.whatsappEnabled,
      twilioAccountSid: providers.twilioAccountSid,
      twilioAuthToken: providers.twilioAuthToken,
      twilioPhoneNumber: providers.twilioPhoneNumber,
      enableAppointmentConfirmation: providers.enableAppointmentConfirmation,
      enableAppointmentReminder: providers.enableAppointmentReminder,
      enableCancellationNotice: providers.enableCancellationNotice
    })
    .from(providers)
    .where(eq(providers.id, providerId));

    if (!provider) {
      throw new Error(`Provedor ${providerId} não encontrado`);
    }

    return {
      enableWhatsApp: provider.whatsappEnabled || false,
      accountSid: provider.twilioAccountSid || undefined,
      authToken: provider.twilioAuthToken || undefined,
      phoneNumber: provider.twilioPhoneNumber || undefined,
      enableAppointmentConfirmation: provider.enableAppointmentConfirmation || true,
      enableAppointmentReminder: provider.enableAppointmentReminder || true,
      enableCancellationNotice: provider.enableCancellationNotice || true
    };
  } catch (error) {
    logger.error(`Erro ao obter configurações de notificação para o provedor ${providerId}`, error);
    
    // Retorna valores padrão em caso de erro
    return {
      enableWhatsApp: false,
      enableAppointmentConfirmation: true,
      enableAppointmentReminder: true,
      enableCancellationNotice: true
    };
  }
}