import { Express, Request, Response } from 'express';
import { pool } from '../db';

// Endpoint para verificar se a sessão é válida
export const sessionCheckRoute = (app: Express) => {
  app.get('/api/session/check', async (req: Request, res: Response) => {
    // Se não há usuário autenticado, retornar 401
    if (!req.user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada' });
    }
    
    // @ts-ignore - Acessando o ID e email do usuário
    const userId = req.user.id;
    // @ts-ignore - Acessando o email do usuário
    const userEmail = req.user.email;
    const sessionId = req.sessionID;
    
    try {
      // Verificar se esta sessão está na tabela active_sessions
      const result = await pool.query(
        'SELECT session_id FROM active_sessions WHERE user_email = $1',
        [userEmail]
      );
      
      const activeSessions = result.rows.map(row => row.session_id);
      
      // Se esta sessão estiver entre as ativas, ela é válida
      if (activeSessions.includes(sessionId)) {
        return res.status(200).json({ valid: true });
      } else {
        // Sessão inválida
        return res.status(401).json({ 
          error: 'Sessão inválida', 
          code: 'SESSION_INVALIDATED',
          message: 'Sua sessão foi encerrada porque você fez login em outro dispositivo.'
        });
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      return res.status(500).json({ error: 'Erro ao verificar sessão' });
    }
  });
};
