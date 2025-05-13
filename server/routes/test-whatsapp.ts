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
  let cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
  
  // Remove todos os caracteres não numéricos EXCETO o sinal de +
  cleanNumber = cleanNumber.replace(/[^\d+]/g, '');
  
  // Se o número não começar com +, tratamos como um número brasileiro
  if (!cleanNumber.startsWith('+')) {
    // Se começar com 55, adicionamos apenas o +
    if (cleanNumber.startsWith('55')) {
      cleanNumber = `+${cleanNumber}`;
    } 
    // Se for um número 9 dígitos com DDD (ex: 11987654321)
    else if (/^[1-9]\d[9]\d{8}$/.test(cleanNumber)) {
      cleanNumber = `+55${cleanNumber}`;
    }
    // Se for um número 8 dígitos com DDD (ex: 1187654321)
    else if (/^[1-9]\d[8]\d{7}$/.test(cleanNumber)) {
      // Adiciona o 9 na frente do número para conformidade com padrão brasileiro atual
      const ddd = cleanNumber.substring(0, 2);
      const number = cleanNumber.substring(2);
      cleanNumber = `+55${ddd}9${number}`;
    }
    // Se for qualquer outro formato de número (possível número completo sem +)
    else {
      // Se o número for muito curto (menos de 8 dígitos), provavelmente está incompleto
      // mas vamos formatar mesmo assim para evitar erros
      cleanNumber = `+55${cleanNumber}`;
    }
  }
  
  console.log(`Número original: "${phoneNumber}" formatado para: "${cleanNumber}"`);
  
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

    // Para contas sandbox do Twilio, é NECESSÁRIO usar exatamente 'whatsapp:+14155238886'
    // Este é o número do sistema Sandbox do Twilio, independente do número configurado na conta
    const from = 'whatsapp:+14155238886';
    
    // Formatar o número de destino
    let to = phone;
    if (!to.startsWith('+')) {
      to = '+' + to.replace(/^\+/, '');
    }
    to = 'whatsapp:' + to;
    
    logger.info(`Enviando de ${from} para ${to} usando número do Sandbox Twilio`);

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