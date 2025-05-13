import { Request, Response } from "express";
import { db } from "../db";
import { messageTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Controller para gerenciar templates de mensagens WhatsApp
 */
export class MessageTemplatesController {
  /**
   * Obtém os templates de mensagens do usuário atual
   */
  static async getTemplates(req: Request, res: Response) {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const userId = req.user.id;
      
      // Busca template do usuário
      const [existingTemplates] = await db
        .select()
        .from(messageTemplates)
        .where(eq(messageTemplates.userId, userId));
      
      if (!existingTemplates) {
        // Se não existir, retorna objeto vazio
        return res.status(200).json({});
      }
      
      return res.status(200).json(existingTemplates.templates);
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      return res.status(500).json({ message: "Erro ao buscar templates" });
    }
  }
  
  /**
   * Salva os templates de mensagens para o usuário atual
   */
  static async saveTemplates(req: Request, res: Response) {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autorizado" });
      }
      
      const userId = req.user.id;
      const templates = req.body;
      
      // Verifica se o usuário já tem templates
      const existingTemplates = await db
        .select()
        .from(messageTemplates)
        .where(eq(messageTemplates.userId, userId));
      
      if (existingTemplates.length === 0) {
        // Se não existe, cria novo registro
        await db.insert(messageTemplates).values({
          userId,
          templates
        });
      } else {
        // Se já existe, atualiza
        await db
          .update(messageTemplates)
          .set({ templates })
          .where(eq(messageTemplates.userId, userId));
      }
      
      return res.status(200).json({ message: "Templates salvos com sucesso" });
    } catch (error) {
      console.error("Erro ao salvar templates:", error);
      return res.status(500).json({ message: "Erro ao salvar templates" });
    }
  }
}