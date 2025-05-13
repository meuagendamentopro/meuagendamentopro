import { Request, Response } from 'express';
import { getNotificationSettings } from '../notification-settings';
import twilio from 'twilio';
import logger from '../logger';
import { storage } from '../storage';

/**
 * Função para formatar o número de telefone para o formato do WhatsApp
 */
function formatWhatsAppNumber(phoneNumber: string): string {
  if (!phoneNumber) return '';
  
  // Remove qualquer prefixo whatsapp: existente para evitar duplicação
  const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
  
  // Adiciona o prefixo whatsapp: necessário para a API do Twilio
  return `whatsapp:${cleanNumber}`;
}

/**
 * Rota para enviar uma mensagem de teste via WhatsApp
 */
export async function handleTestWhatsAppSend(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Número de telefone e mensagem são obrigatórios' });
    }

    // Obter o provider associado ao usuário autenticado
    const userId = req.user!.id;
    
    // Buscar o provider associado ao usuário
    const provider = await storage.getProviderByUserId(userId);
    
    if (!provider) {
      return res.status(400).json({ error: 'Usuário não é um provedor' });
    }
    
    const providerId = provider.id;

    // Obter as configurações de notificação do provider
    const settings = await getNotificationSettings(providerId);
    
    if (!settings.enableWhatsApp || !settings.accountSid || !settings.authToken || !settings.phoneNumber) {
      return res.status(400).json({ error: 'Configurações de WhatsApp incompletas' });
    }

    logger.info(`Enviando mensagem de teste WhatsApp para ${phone}`);
    
    // Inicializar o cliente Twilio
    const twilioClient = twilio(settings.accountSid, settings.authToken);

    // Formatar números
    const from = formatWhatsAppNumber(settings.phoneNumber);
    const to = formatWhatsAppNumber(phone);

    // Enviar a mensagem
    const result = await twilioClient.messages.create({
      body: message,
      from: from,
      to: to
    });

    logger.info(`Mensagem de teste enviada com sucesso. SID: ${result.sid}`);

    res.status(200).json({ 
      success: true, 
      message: 'Mensagem enviada com sucesso',
      sid: result.sid
    });
  } catch (err) {
    const error = err as Error;
    logger.error(`Erro ao enviar mensagem de teste: ${error.message}`);
    res.status(500).json({ error: `Erro ao enviar mensagem: ${error.message}` });
  }
}