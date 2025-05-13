import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { messageTemplates } from "@shared/schema";
import z from "zod";

// Schema para validação dos templates de mensagem
const messageTemplateSchema = z.object({
  welcomeTemplate: z.string().min(1),
  reminderTemplate: z.string().min(1),
  confirmationTemplate: z.string().min(1),
  cancellationTemplate: z.string().min(1),
});

export async function getMessageTemplates(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    // Buscar templates existentes para o usuário atual
    const templates = await db.select().from(messageTemplates).where(eq(messageTemplates.userId, req.user.id));
    
    if (templates.length === 0) {
      // Se não existirem templates, retornar templates padrão
      return res.status(200).json({
        welcomeTemplate: "Olá {clientName}, seu agendamento para {serviceName} foi confirmado para {appointmentDate} às {appointmentTime}. Agradecemos sua preferência!",
        reminderTemplate: "Olá {clientName}, lembrando do seu agendamento para {serviceName} hoje às {appointmentTime}. Estamos te esperando!",
        confirmationTemplate: "Olá {clientName}, seu agendamento para {serviceName} foi confirmado! Te esperamos no dia {appointmentDate} às {appointmentTime}.",
        cancellationTemplate: "Olá {clientName}, seu agendamento para {serviceName} marcado para {appointmentDate} às {appointmentTime} foi cancelado.",
      });
    }

    // Se existirem templates, parsear o campo templates e retornar
    return res.status(200).json(JSON.parse(templates[0].templates));
  } catch (error) {
    console.error("Erro ao buscar templates de mensagem:", error);
    return res.status(500).json({ error: "Erro ao buscar templates de mensagem" });
  }
}

export async function saveMessageTemplates(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    // Validar dados recebidos
    const validatedData = messageTemplateSchema.parse(req.body);
    
    // Verificar se já existem templates para este usuário
    const existingTemplates = await db.select()
      .from(messageTemplates)
      .where(eq(messageTemplates.userId, req.user.id));
    
    // Armazenar os templates como string JSON
    const templatesJson = JSON.stringify(validatedData);
    
    if (existingTemplates.length === 0) {
      // Se não existirem, criar novo registro
      const [newTemplate] = await db.insert(messageTemplates)
        .values({
          userId: req.user.id,
          templates: templatesJson,
        })
        .returning();
      
      return res.status(201).json({ 
        id: newTemplate.id,
        ...validatedData
      });
    } else {
      // Se existirem, atualizar o registro existente
      const [updatedTemplate] = await db.update(messageTemplates)
        .set({ 
          templates: templatesJson,
          updatedAt: new Date()
        })
        .where(eq(messageTemplates.userId, req.user.id))
        .returning();
      
      return res.status(200).json({ 
        id: updatedTemplate.id,
        ...validatedData
      });
    }
  } catch (error) {
    console.error("Erro ao salvar templates de mensagem:", error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos", details: error.errors });
    }
    
    return res.status(500).json({ error: "Erro ao salvar templates de mensagem" });
  }
}