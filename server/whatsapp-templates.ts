import { db } from "./db";
import { providers } from "@shared/schema";
import { eq } from "drizzle-orm";
import logger from "./logger";

// Estrutura de templates de mensagens
export interface WhatsAppTemplates {
  confirmation: string;
  reminder: string;
  sameDayReminder: string;
  cancellation: string;
  reschedule: string;
}

// Templates padrão
export const DEFAULT_TEMPLATES: WhatsAppTemplates = {
  confirmation: 
`Olá {name}!

Seu agendamento com {provider} foi confirmado com sucesso.

*Detalhes do agendamento:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}
💰 Valor: {price}

Para cancelar ou reagendar, entre em contato pelo telefone {phone}.

Obrigado por agendar conosco!`,

  reminder: 
`Olá {name}!

Lembrete do seu agendamento amanhã com {provider}.

*Detalhes do agendamento:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}

Por favor, confirme sua presença respondendo esta mensagem.
Para reagendar ou cancelar, entre em contato o quanto antes pelo telefone {phone}.

Estamos ansiosos para recebê-lo(a)!`,

  sameDayReminder: 
`Olá {name}!

Lembrete do seu agendamento HOJE com {provider}.

*Detalhes do agendamento:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}

Por favor, confirme sua presença respondendo esta mensagem.
Para reagendar ou cancelar, entre em contato o quanto antes pelo telefone {phone}.

Estamos ansiosos para recebê-lo(a)!`,

  cancellation: 
`Olá {name}!

Seu agendamento foi cancelado.

*Detalhes do agendamento cancelado:*
📅 Data: {date}
⏰ Horário: {time}
✨ Serviço: {service}

{cancellationReason}

Para fazer um novo agendamento, entre em contato pelo telefone {phone}.

Agradecemos sua compreensão.`,

  reschedule: 
`Olá {name}!

Seu agendamento com {provider} foi remarcado.

*Novo horário:*
📅 Data: {newDate}
⏰ Horário: {newTime}

*Horário anterior:*
📅 Data: {oldDate}
⏰ Horário: {oldTime}

✨ Serviço: {service}

Se este novo horário não for adequado para você, por favor entre em contato pelo telefone {phone}.

Obrigado pela compreensão.`
};

/**
 * Buscar os templates de mensagens para um provedor
 */
export async function getWhatsAppTemplates(providerId: number): Promise<WhatsAppTemplates> {
  try {
    // Buscar os templates armazenados no banco de dados
    const [providerData] = await db
      .select({
        whatsappTemplateConfirmation: providers.whatsappTemplateConfirmation,
        whatsappTemplateReminder: providers.whatsappTemplateReminder,
        whatsappTemplateSameDayReminder: providers.whatsappTemplateSameDayReminder,
        whatsappTemplateCancellation: providers.whatsappTemplateCancellation,
        whatsappTemplateReschedule: providers.whatsappTemplateReschedule
      })
      .from(providers)
      .where(eq(providers.id, providerId));

    if (!providerData) {
      return DEFAULT_TEMPLATES;
    }

    // Retornar os templates personalizados ou os padrões se estiverem vazios
    return {
      confirmation: providerData.whatsappTemplateConfirmation || DEFAULT_TEMPLATES.confirmation,
      reminder: providerData.whatsappTemplateReminder || DEFAULT_TEMPLATES.reminder,
      sameDayReminder: providerData.whatsappTemplateSameDayReminder || DEFAULT_TEMPLATES.sameDayReminder,
      cancellation: providerData.whatsappTemplateCancellation || DEFAULT_TEMPLATES.cancellation, 
      reschedule: providerData.whatsappTemplateReschedule || DEFAULT_TEMPLATES.reschedule
    };
  } catch (error) {
    logger.error(`Erro ao buscar templates de WhatsApp: ${error}`);
    return DEFAULT_TEMPLATES;
  }
}

/**
 * Salvar os templates de mensagens para um provedor
 */
export async function saveWhatsAppTemplates(
  providerId: number,
  templates: WhatsAppTemplates
): Promise<boolean> {
  try {
    // Atualizar os templates no banco de dados
    await db
      .update(providers)
      .set({
        whatsappTemplateConfirmation: templates.confirmation,
        whatsappTemplateReminder: templates.reminder,
        whatsappTemplateSameDayReminder: templates.sameDayReminder,
        whatsappTemplateCancellation: templates.cancellation,
        whatsappTemplateReschedule: templates.reschedule
      })
      .where(eq(providers.id, providerId));

    return true;
  } catch (error) {
    logger.error(`Erro ao salvar templates de WhatsApp: ${error}`);
    return false;
  }
}

/**
 * Obter o template específico ou o padrão
 */
export async function getSpecificTemplate(
  providerId: number,
  templateType: keyof WhatsAppTemplates
): Promise<string> {
  const templates = await getWhatsAppTemplates(providerId);
  return templates[templateType] || DEFAULT_TEMPLATES[templateType];
}