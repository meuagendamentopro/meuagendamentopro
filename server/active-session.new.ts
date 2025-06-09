import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { WebSocket } from 'ws';
import { pool } from './db';

// Mapa global para armazenar conexões WebSocket por usuário
// Será preenchido pelo módulo de rotas
export const userWebSockets = new Map<number, Set<WebSocket>>();

// Função para notificar outros dispositivos quando uma sessão for invalidada
export const notifySessionInvalidated = (userId: number, currentSessionId: string) => {
  const userSockets = userWebSockets.get(userId);
  
  if (userSockets && userSockets.size > 0) {
    console.log(`Notificando ${userSockets.size} dispositivos sobre sessão invalidada para usuário ${userId}`);
    
    const message = JSON.stringify({
      type: 'session_invalidated',
      message: 'Sua sessão foi encerrada automaticamente porque você fez login em outro dispositivo ou navegador.',
      timestamp: Date.now(),
      currentSessionId
    });
    
    userSockets.forEach(socket => {
      try {
        socket.send(message);
      } catch (error) {
        console.error('Erro ao enviar notificação de sessão invalidada:', error);
      }
    });
  }
};

// Inicializar a tabela de sessões ativas
const initActiveSessionTable = async () => {
  try {
    // Verificar se a tabela existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'active_sessions'
      )
    `);
    
    if (!tableExists.rows[0].exists) {
      // Se a tabela não existir, criá-la com uma estrutura correta
      await pool.query(`
        CREATE TABLE active_sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          session_id TEXT NOT NULL,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          user_email TEXT
        )
      `);
      console.log('Tabela de sessões ativas criada com sucesso');
    } else {
      // Se a tabela já existir, verificar se precisa ser alterada
      const checkPrimaryKey = await pool.query(`
        SELECT a.attname, format_type(a.atttypid, a.atttypmod) AS data_type
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'active_sessions'::regclass AND i.indisprimary
      `);
      
      // Se user_id for a chave primária, precisamos recriar a tabela
      if (checkPrimaryKey.rows.length > 0 && checkPrimaryKey.rows[0].attname === 'user_id') {
        console.log('Recriando tabela active_sessions com estrutura correta...');
        
        // Fazer backup dos dados existentes
        await pool.query(`CREATE TEMP TABLE active_sessions_backup AS SELECT * FROM active_sessions`);
        
        // Dropar a tabela existente
        await pool.query(`DROP TABLE active_sessions`);
        
        // Criar a nova tabela com a estrutura correta
        await pool.query(`
          CREATE TABLE active_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            session_id TEXT NOT NULL,
            last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            user_email TEXT
          )
        `);
        
        // Restaurar os dados, ignorando possíveis duplicatas
        try {
          await pool.query(`
            INSERT INTO active_sessions (user_id, session_id, last_activity, user_email)
            SELECT DISTINCT ON (user_id) user_id, session_id, last_activity, user_email 
            FROM active_sessions_backup
          `);
        } catch (restoreErr) {
          console.error('Erro ao restaurar dados da tabela active_sessions:', restoreErr);
        }
        
        // Limpar a tabela temporária
        await pool.query(`DROP TABLE active_sessions_backup`);
      }
    }
    
    console.log('Tabela de sessões ativas verificada com sucesso');
  } catch (error) {
    console.error('Erro ao criar tabela de sessões ativas:', error);
  }
};

// Inicializar a tabela ao iniciar o servidor
initActiveSessionTable();

// Função para destruir todas as sessões de um usuário, exceto a atual
export const destroyUserSessions = async (userId: number, currentSessionId: string, userEmail?: string): Promise<void> => {
  try {
    console.log(`Destruindo sessões antigas do usuário ${userId}, mantendo apenas ${currentSessionId}`);
    
    if (!currentSessionId) {
      console.log('Nenhuma sessão atual fornecida. Abortando operação.');
      return;
    }
    
    // Verificar se a sessão atual é válida antes de prosseguir
    const currentSessionCheck = await pool.query(
      'SELECT sid FROM "session" WHERE sid = $1',
      [currentSessionId]
    );
    
    // Se a sessão atual não existir no banco, não prosseguir
    if (currentSessionCheck.rows.length === 0) {
      console.log(`Sessão atual ${currentSessionId} não encontrada no banco. Abortando operação.`);
      return;
    }
    
    // Obter todas as sessões ativas deste usuário
    const activeSessionsResult = await pool.query(
      'SELECT session_id FROM active_sessions WHERE user_id = $1 OR user_email = $2',
      [userId, userEmail || '']
    );
    
    const activeSessions = activeSessionsResult.rows.map(row => row.session_id);
    console.log(`Sessões ativas encontradas para o usuário ${userId}: ${activeSessions.join(', ')}`);
    
    // Se houver sessões ativas diferentes da atual, notificar dispositivos
    const sessionsToInvalidate = activeSessions.filter(sid => sid !== currentSessionId);
    if (sessionsToInvalidate.length > 0) {
      console.log(`Notificando dispositivos sobre sessões invalidadas: ${sessionsToInvalidate.join(', ')}`);
      notifySessionInvalidated(userId, currentSessionId);
    }
    
    // Remover todas as sessões antigas da tabela session
    const sessionCleanupResult = await pool.query(
      `DELETE FROM "session" 
       WHERE sess ->> 'passport' IS NOT NULL 
       AND (sess -> 'passport' ->> 'user')::integer = $1 
       AND sid != $2
       RETURNING sid`,
      [userId, currentSessionId]
    );
    
    const removedSessionCount = sessionCleanupResult.rowCount || 0;
    console.log(`Removidas ${removedSessionCount} sessões antigas da tabela session para o usuário ${userId}`);
    
    // Remover todas as sessões ativas anteriores
    const activeSessionsCleanupResult = await pool.query(
      'DELETE FROM active_sessions WHERE user_id = $1 OR user_email = $2',
      [userId, userEmail || '']
    );
    
    console.log(`Removidas ${activeSessionsCleanupResult.rowCount || 0} sessões ativas anteriores para o usuário ${userId}`);
    
  } catch (error) {
    console.error('Erro ao destruir sessões de usuário:', error);
  }
};

// Atualizar a sessão ativa de um usuário - modificado para permitir múltiplas sessões
export const setActiveSession = async (userId: number, sessionId: string, userEmail: string): Promise<boolean> => {
  try {
    console.log(`Configurando sessão ativa para o usuário ${userEmail} (ID: ${userId}) com sessão ${sessionId} - modo multi-sessão ativado`);
    
    // Verificar se a sessão atual é válida antes de prosseguir
    const currentSessionCheck = await pool.query(
      'SELECT sid FROM "session" WHERE sid = $1',
      [sessionId]
    );
    
    // Se a sessão atual não existir no banco, não prosseguir
    if (currentSessionCheck.rows.length === 0) {
      console.log(`Sessão atual ${sessionId} não encontrada no banco. Abortando operação de setActiveSession.`);
      return false;
    }
    
    // Verificar se esta sessão já está registrada como ativa
    const existingSessionCheck = await pool.query(
      'SELECT id FROM active_sessions WHERE session_id = $1',
      [sessionId]
    );
    
    // Se a sessão já estiver registrada, apenas atualizar o timestamp
    if (existingSessionCheck.rows.length > 0) {
      await pool.query(
        'UPDATE active_sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = $1',
        [sessionId]
      );
      console.log(`Sessão ${sessionId} já está ativa, timestamp atualizado`);
      return true;
    }
    
    // Inserir a nova sessão ativa para este usuário (sem remover as existentes)
    await pool.query(
      'INSERT INTO active_sessions (user_id, session_id, last_activity, user_email) VALUES ($1, $2, CURRENT_TIMESTAMP, $3)',
      [userId, sessionId, userEmail]
    );
    console.log(`Nova sessão ativa inserida para o usuário ${userId}: ${sessionId} (mantendo sessões existentes)`);
    
    return true;
  } catch (error) {
    console.error(`Erro ao atualizar sessão ativa para usuário ${userId}:`, error);
    return false;
  }
};

// Verificar se uma sessão é ativa para um usuário - DESATIVADO para permitir múltiplos acessos
export const isActiveSession = async (userId: number, sessionId: string, userEmail: string): Promise<boolean> => {
  // Registrar a verificação para fins de log
  console.log(`Verificação de sessão desativada. Sempre retornando válida.`);
  console.log(`Sessão ${sessionId} para usuário ${userId} (${userEmail}) - permitindo acesso simultâneo`);
  
  try {
    // Verificar se a sessão existe na tabela session (apenas para log)
    const sessionCheck = await pool.query(
      'SELECT sid FROM "session" WHERE sid = $1',
      [sessionId]
    );
    
    if (sessionCheck.rows.length === 0) {
      console.log(`Sessão ${sessionId} não encontrada na tabela session, mas permitindo acesso mesmo assim`);
    } else {
      console.log(`Sessão ${sessionId} encontrada e válida`);
    }
    
    // Registrar a sessão como ativa sem verificar exclusividade
    try {
      await pool.query(
        'INSERT INTO active_sessions (user_id, session_id, user_email, last_activity) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (session_id) DO UPDATE SET last_activity = CURRENT_TIMESTAMP',
        [userId, sessionId, userEmail]
      );
    } catch (dbError) {
      // Ignorar erros de banco de dados para não afetar a experiência do usuário
      console.error('Erro ao registrar sessão ativa (não crítico):', dbError);
    }
    
    // Sempre retornar true para permitir múltiplos acessos simultâneos
    return true;
  } catch (error) {
    console.error(`Erro ao processar sessão para usuário ${userId}:`, error);
    // Em caso de erro, permitir a sessão para evitar deslogamentos indesejados
    return true;
  }
};

// Middleware para verificar se a sessão atual é a ativa
// Modificado para permitir múltiplos acessos simultâneos
export const activeSessionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Ignorar se não estiver autenticado
  // Verificamos se o usuário está autenticado pela presença do objeto user na requisição
  if (!req.user) {
    return next();
  }
  
  // @ts-ignore - Acessando o ID e email do usuário
  const userId = req.user.id;
  // @ts-ignore - Acessando o email do usuário
  const userEmail = req.user.email;
  const sessionId = req.sessionID;
  
  console.log(`Sessão ${sessionId} para usuário ${userId} (${userEmail}) - verificação desativada, permitindo múltiplos acessos`);
  
  try {
    // Registrar esta sessão como ativa, mas não verificar exclusividade
    // Isso permite que múltiplas sessões estejam ativas simultaneamente
    if (sessionId) {
      try {
        await pool.query(
          'INSERT INTO active_sessions (user_id, session_id, user_email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, sessionId, userEmail]
        );
        
        // Atualizar o timestamp de última atividade
        await pool.query(
          'UPDATE active_sessions SET last_activity = CURRENT_TIMESTAMP WHERE session_id = $1',
          [sessionId]
        );
      } catch (dbError) {
        console.error('Erro ao registrar sessão ativa (não crítico):', dbError);
        // Continuar mesmo se houver erro, para não impactar a experiência do usuário
      }
    }
    
    // Sempre permitir o acesso, independentemente de outras sessões ativas
    next();
  } catch (error) {
    console.error('Erro no middleware de sessão ativa:', error);
    // Em caso de erro, permitir a requisição para evitar problemas
    next();
  }
};

// Limpar sessões antigas (mais de 30 dias de inatividade)
export const cleanupOldActiveSessions = async () => {
  try {
    const query = `
      DELETE FROM active_sessions
      WHERE last_activity < NOW() - INTERVAL '30 days'
    `;
    
    const result = await pool.query(query);
    console.log(`${result.rowCount} sessões antigas removidas`);
  } catch (error) {
    console.error('Erro ao limpar sessões antigas:', error);
  }
};

// Executar limpeza diária
setInterval(cleanupOldActiveSessions, 24 * 60 * 60 * 1000); // 24 horas
