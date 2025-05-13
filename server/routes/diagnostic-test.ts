import { Request, Response } from "express";
import twilio from 'twilio';
import { getNotificationSettings } from '../notification-settings';
import logger from '../logger';

/**
 * Função para teste de diagnóstico do serviço de WhatsApp
 * Esta função testa vários aspectos para ajudar a identificar problemas
 */
export async function handleDiagnosticTest(req: Request, res: Response) {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Número de telefone é obrigatório'
      });
    }

    // Obter o provider associado ao usuário
    const provider = (req as any).provider;
    if (!provider) {
      return res.status(403).json({
        success: false,
        message: 'Nenhum provedor associado à conta',
        details: { provider: null, userId: req.user?.id }
      });
    }

    const diagnosticResults: any = {
      provider: {
        id: provider.id,
        name: provider.name,
        hasPhone: !!provider.phone
      },
      phone: {
        input: phone,
        formatted: null
      },
      settings: null,
      twilioConnection: false,
      messageSent: false,
      messageResult: null,
      errors: []
    };

    // Formatar o número de telefone para o formato esperado pelo WhatsApp
    try {
      let formattedPhone = phone;
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone.replace(/^\+/, '');
      }
      if (!formattedPhone.startsWith('whatsapp:')) {
        formattedPhone = 'whatsapp:' + formattedPhone;
      }
      diagnosticResults.phone.formatted = formattedPhone;
    } catch (error: any) {
      diagnosticResults.errors.push({
        stage: 'formatting_phone',
        message: error.message
      });
    }

    // Obter configurações do WhatsApp
    try {
      const settings = await getNotificationSettings(provider.id);
      diagnosticResults.settings = {
        enableWhatsApp: settings.enableWhatsApp,
        hasAccountSid: !!settings.accountSid,
        hasAuthToken: !!settings.authToken,
        hasPhoneNumber: !!settings.phoneNumber,
      };

      // Verificar se as configurações estão completas
      if (!settings.enableWhatsApp || !settings.accountSid || !settings.authToken || !settings.phoneNumber) {
        diagnosticResults.errors.push({
          stage: 'check_settings',
          message: 'Configurações de WhatsApp incompletas',
          details: diagnosticResults.settings
        });
      } else {
        // Tentar inicializar o cliente Twilio
        try {
          const twilioClient = twilio(settings.accountSid, settings.authToken);
          diagnosticResults.twilioConnection = true;

          // Enviar uma mensagem de teste
          const from = 'whatsapp:+14155238886'; // Número do sandbox do Twilio
          
          logger.info(`[DIAGNÓSTICO] Enviando mensagem de teste para ${diagnosticResults.phone.formatted}`);
          
          const result = await twilioClient.messages.create({
            body: 'Esta é uma mensagem de teste do sistema de agendamento. Se você recebeu, significa que a configuração de WhatsApp está funcionando corretamente.',
            from: from,
            to: diagnosticResults.phone.formatted
          });

          diagnosticResults.messageSent = true;
          diagnosticResults.messageResult = {
            sid: result.sid,
            status: result.status,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage
          };
          
          logger.info(`[DIAGNÓSTICO] Mensagem enviada: SID=${result.sid}, Status=${result.status}`);
        } catch (error: any) {
          diagnosticResults.errors.push({
            stage: 'send_message',
            message: error.message,
            code: error.code,
            statusCode: error.statusCode,
            moreInfo: error.moreInfo || null
          });
          logger.error(`[DIAGNÓSTICO] Erro ao enviar mensagem: ${error.message}`);
        }
      }
    } catch (error: any) {
      diagnosticResults.errors.push({
        stage: 'get_settings',
        message: error.message
      });
    }

    // Retornar resultado completo do diagnóstico
    return res.status(200).json({
      success: diagnosticResults.messageSent,
      message: diagnosticResults.messageSent 
        ? 'Mensagem enviada com sucesso. Verifique o celular informado.'
        : 'Falha ao enviar mensagem. Verifique os detalhes do diagnóstico.',
      diagnosticResults
    });
  } catch (err) {
    const error = err as Error;
    logger.error(`[DIAGNÓSTICO] Erro no teste de diagnóstico: ${error.message}`);
    
    // Retornar erro formatado para o cliente
    res.status(500).json({
      success: false,
      message: `Erro no teste de diagnóstico: ${error.message}`,
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
}