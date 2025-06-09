import { Request, Response, NextFunction } from "express";

// Middleware para verificar se o usuário está autenticado
export function checkAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

// Middleware para verificar se o usuário é administrador
export function checkAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar este recurso." });
  }
  
  next();
}
