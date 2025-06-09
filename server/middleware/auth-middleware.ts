import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { providers } from "@shared/schema";
import { eq } from "drizzle-orm";

// Estendendo o tipo Request para incluir o campo user
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      name: string;
      role: string;
      providerId?: number;
    }
    
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware para verificar se o usuário está autenticado
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  // Garantir que o usuário tenha um providerId
  if (!req.user) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }
  
  // Se o usuário não tiver um providerId, buscar o providerId correspondente
  if (!req.user.providerId) {
    getProviderIdForUser(req.user.id)
      .then(providerId => {
        if (providerId) {
          req.user!.providerId = providerId;
          next();
        } else {
          res.status(403).json({ error: "Usuário não é um provedor" });
        }
      })
      .catch(error => {
        console.error("Erro ao buscar providerId:", error);
        res.status(500).json({ error: "Erro ao verificar permissões" });
      });
  } else {
    next();
  }
}

/**
 * Busca o providerId para um usuário
 */
async function getProviderIdForUser(userId: number): Promise<number | undefined> {
  const provider = await db.query.providers.findFirst({
    where: eq(providers.userId, userId)
  });
  
  return provider?.id;
}
