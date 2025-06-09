import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import connectPg from "connect-pg-simple";
import { v4 as uuidv4 } from 'uuid';
import { pool, db } from "./db";
import { storage } from "./storage";
import { User as SchemaUser, systemSettings, isValidUsername } from "@shared/schema";
import { 
  generateVerificationToken, 
  sendVerificationEmail,
  sendWelcomeEmail, 
  verifyToken,
  isEmailServiceConfigured,
  sendAdminNewUserNotification
} from "./email-service";

declare global {
  namespace Express {
    interface User extends SchemaUser {}
  }
}

// Constantes para bcrypt
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  return bcrypt.compare(supplied, stored);
}

/**
 * Verifica se a assinatura de um usuário está expirada
 * @param user Objeto do usuário
 * @returns true se a assinatura estiver expirada ou não existir
 */
export function isSubscriptionExpired(user: SchemaUser): boolean {
  // Se o usuário tem flag de nunca expirar, a assinatura é válida
  if (user.neverExpires) return false;
  
  // Se o usuário não tem data de expiração, a assinatura é considerada expirada
  if (!user.subscriptionExpiry) return true;
  
  // Verifica se a data de expiração já passou
  const now = new Date();
  const expiry = new Date(user.subscriptionExpiry);
  
  return now > expiry;
}

// Limpa sessões antigas e inválidas
async function cleanupOldSessions() {
  try {
    // Deletar sessões expiradas (mais de 30 dias de inatividade)
    const query = `DELETE FROM "session" WHERE "expire" < NOW()`;
    const result = await pool.query(query);
    console.log(`Limpeza de sessões: ${result.rowCount} sessões expiradas removidas`);
    return result.rowCount;
  } catch (error) {
    console.error("Erro ao limpar sessões expiradas:", error);
    return 0;
  }
}

export function setupAuth(app: Express) {
  // Configuração de sessão mais robusta
  console.log(`Configurando sessão. Ambiente: ${process.env.NODE_ENV}`);
  console.log(`SESSION_SECRET disponível: ${!!process.env.SESSION_SECRET}`);
  
  // Limpar sessões expiradas no início e a cada 24 horas
  cleanupOldSessions().then(count => {
    console.log(`Limpeza inicial de sessões concluída. ${count} sessões removidas.`);
  });
  
  // Programar limpeza diária de sessões
  setInterval(() => {
    cleanupOldSessions().then(count => {
      console.log(`Limpeza programada de sessões concluída. ${count} sessões removidas.`);
    });
  }, 24 * 60 * 60 * 1000); // 24 horas
  
  // Usamos uma string constante como fallback para não quebrar o desenvolvimento
  const sessionSecret = process.env.SESSION_SECRET || 'meu-agendamento-secret-key-development-only';
  
  // Configurações de sessão
  const pgSession = connectPg(session);
  const sessionSettings: session.SessionOptions = {
    store: new pgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
      // Aumentar o tempo de expiração da sessão no banco de dados
      ttl: 60 * 60 * 24 * 365 // 1 ano em segundos
    }),
    secret: sessionSecret || 'default-secret-key',
    resave: true, // Alterado para true para garantir que a sessão seja salva mesmo sem alterações
    saveUninitialized: true, // Alterado para true para salvar sessões não inicializadas
    rolling: true, // Renovar o cookie a cada requisição
    name: 'meusistema.sid', // Nome personalizado para evitar conflitos
    cookie: {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 ano (aumentado para evitar expiração)
      // No ambiente de produção, só use secure: true se estiver em HTTPS
      secure: process.env.NODE_ENV === 'production' && 
              (process.env.SECURE_COOKIE === 'true' || undefined),
      httpOnly: true,
      sameSite: 'lax', // Permite autenticação em redirecionamentos
      path: '/' // Garantir que o cookie seja enviado para todas as rotas
    }
  };
  
  // Log para debug
  console.log('Configuração de sessão:', {
    secret: sessionSecret ? 'Definido' : 'Não definido',
    resave: sessionSettings.resave,
    saveUninitialized: sessionSettings.saveUninitialized,
    rolling: sessionSettings.rolling,
    cookieMaxAge: sessionSettings.cookie?.maxAge,
    cookieSecure: sessionSettings.cookie?.secure,
    cookiePath: sessionSettings.cookie?.path
  });

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Normalizar o nome de usuário para letras minúsculas
        const normalizedUsername = username.toLowerCase();
        console.log(`Tentando autenticar usuário: ${normalizedUsername}`);
        
        const user = await storage.getUserByUsername(normalizedUsername);
        console.log(`Resultado da busca por usuário: ${user ? 'Encontrado' : 'Não encontrado'}`);
        
        // Verificar se o usuário existe e se a senha está correta
        if (!user) {
          console.log(`Usuário não encontrado: ${username}`);
          return done(null, false, { message: "Credenciais inválidas" });
        }
        
        console.log(`Verificando senha para o usuário: ${username}`);
        const passwordMatch = await comparePasswords(password, user.password);
        console.log(`Resultado da verificação de senha: ${passwordMatch ? 'Correta' : 'Incorreta'}`);
        
        if (!passwordMatch) {
          console.log(`Senha incorreta para o usuário: ${username}`);
          return done(null, false, { message: "Credenciais inválidas" });
        }
        
        // Verificar se o usuário está ativo
        console.log(`Status de atividade do usuário ${username}: ${user.isActive ? 'Ativo' : 'Inativo'}`);
        if (user.isActive === false) {
          console.log(`Usuário bloqueado: ${username}`);
          return done(null, false, { message: "Conta de usuário bloqueada" });
        }
        
        // Verificar expiração da assinatura (apenas para provedores, não para admins)
        if (user.role === 'provider') {
          console.log(`Verificando expiração de assinatura para usuário ${user.username}`);
          
          if (isSubscriptionExpired(user)) {
            console.log(`Assinatura expirada para ${user.username}`);
            // IMPORTANTE: Agora permitimos o login mesmo com assinatura expirada
            // Apenas adicionamos uma flag para o frontend saber que precisa renovar
            // Em vez de barrar o login, autorizamos e marcamos como expirado
            // @ts-ignore - Adicionando propriedade personalizada
            user.subscriptionExpired = true;
            return done(null, user);
          }
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  // Serializa o usuário de forma mais robusta
  passport.serializeUser((user, done) => {
    // Verifica se o ID do usuário está presente
    if (user && user.id) {
      done(null, user.id);
    } else {
      console.error("Falha ao serializar usuário:", user);
      done(new Error("Falha ao serializar usuário - ID ausente"));
    }
  });
  
  // Deserializa o usuário com tratamento de erro mais robusto
  passport.deserializeUser(async (id: any, done) => {
    try {
      console.log("Deserializando usuário com ID:", id, "tipo:", typeof id);
      
      // Se o ID for um objeto (potencialmente um objeto de usuário completo), 
      // extraímos o ID numérico a partir dele
      let userId;
      if (typeof id === 'object' && id !== null && 'id' in id) {
        userId = id.id;
        console.log("ID extraído do objeto:", userId);
      } else {
        // Certifica-se de que o ID é um número
        userId = typeof id === 'string' ? parseInt(id, 10) : id;
      }
      
      if (isNaN(userId)) {
        console.error(`ID de usuário inválido: ${JSON.stringify(id)}`);
        return done(null, false);
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.error(`Usuário não encontrado para o ID: ${userId}`);
        return done(null, false);
      }
      
      // Verificar se o usuário está ativo a cada requisição
      if (user.isActive === false) {
        console.log(`Acesso bloqueado para usuário inativo: ${userId}`);
        return done(null, false);
      }
      
      // Verificar expiração da assinatura a cada requisição (apenas para provedores)
      // Agora não bloqueamos o acesso, apenas marcamos o usuário como tendo assinatura expirada
      // O redirecionamento para a página de renovação será feito no frontend
      if (user.role === 'provider') {
        if (isSubscriptionExpired(user)) {
          console.log(`Usuário ${userId} com assinatura expirada - marcando flag`);
          // @ts-ignore - Adicionando propriedade personalizada
          user.subscriptionExpired = true;
        }
      }
      
      done(null, user);
    } catch (error) {
      console.error("Erro ao deserializar usuário:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validar o nome de usuário usando a função auxiliar
      const username = req.body.username ? req.body.username.trim().toLowerCase() : '';
      req.body.username = username;
      
      console.log(`Validando nome de usuário: "${username}"`);
      
      // Validação de nome de usuário
      if (!isValidUsername(username)) {
        console.log(`Nome de usuário inválido: "${username}"`);
        return res.status(400).json({ 
          error: "Nome de usuário inválido", 
          message: "O nome de usuário deve ter entre 4 e 16 caracteres e conter apenas letras minúsculas e números, sem espaços."
        });
      }
      
      console.log(`Nome de usuário válido: "${username}"`);
      
      // Verificar se o nome de usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }
      
      // Verificar se o email já está em uso
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email já está em uso" });
      }

      // Buscar as configurações do sistema para obter o período de teste configurado
      let trialPeriodDays = 3; // Valor padrão
      try {
        const systemConfig = await db.select().from(systemSettings).limit(1);
        if (systemConfig.length > 0 && systemConfig[0].trialPeriodDays) {
          trialPeriodDays = systemConfig[0].trialPeriodDays;
          console.log(`Usando período de teste configurado: ${trialPeriodDays} dias`);
        }
      } catch (error) {
        console.error('Erro ao buscar configurações do sistema para período de teste:', error);
        // Continuar com o valor padrão em caso de erro
      }
      
      // Calcular a data de expiração com base no período configurado
      const subscriptionExpiry = new Date();
      subscriptionExpiry.setDate(subscriptionExpiry.getDate() + trialPeriodDays);
      
      // Hash da senha
      const hashedPassword = await hashPassword(req.body.password);
      
      // Verificar se o serviço de email está configurado
      const needsEmailVerification = isEmailServiceConfigured();
      
      // Criar o usuário com a data de expiração
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        role: "provider", // Define papel como provider por padrão
        subscriptionExpiry, // Define período de teste de 3 dias
        neverExpires: false, // Assinatura expira por padrão
        isEmailVerified: !needsEmailVerification, // Se não precisar de verificação, já marca como verificado
      });

      console.log(`Novo usuário criado: ${user.name} (ID: ${user.id})`);
      
      // Enviar notificação para o administrador sobre o novo cadastro
      try {
        await sendAdminNewUserNotification(user);
        console.log(`Notificação de novo cadastro enviada para o administrador: ${user.name} (${user.email})`);
      } catch (notificationError) {
        console.error('Erro ao enviar notificação de novo cadastro:', notificationError);
        // Não bloqueia o fluxo de registro se a notificação falhar
      }
      
      // Se o serviço de email estiver configurado, enviar email de verificação
      if (needsEmailVerification) {
        const token = generateVerificationToken(user.id);
        
        // Salvar o token no banco de dados
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // Token válido por 24 horas
        
        await storage.updateUser(user.id, {
          verificationToken: token,
          verificationTokenExpiry: expiresAt
        });
        
        // Enviar email com o token
        const emailSent = await sendVerificationEmail(user, token);
        
        if (!emailSent) {
          console.error(`Falha ao enviar email de verificação para o usuário ${user.id}`);
          // Não bloqueia o registro mesmo que o email falhe, mas registra o erro
        } else {
          console.log(`Email de verificação enviado para ${user.email}`);
        }
      }
      
      // Criar automaticamente o perfil de prestador para o usuário
      // Gerar um link único para compartilhamento baseado no nome de usuário
      const bookingLink = `/booking/${user.username}`;
      
      try {
        // Criar o perfil de prestador
        const providerData = {
          userId: user.id,
          name: user.name, // Usando o nome do usuário diretamente
          email: user.email,
          phone: "",
          bookingLink,
          avatarUrl: user.avatarUrl || null,
          workingHoursStart: 8, // 8:00 AM padrão
          workingHoursEnd: 18,  // 6:00 PM padrão
          workingDays: "1,2,3,4,5" // Segunda a sexta por padrão
        };
        
        const provider = await storage.createProvider(providerData);
        console.log(`Perfil de prestador criado automaticamente para usuário ${user.id}, provider ID: ${provider.id}`);

        // Criar serviço de exemplo para o novo prestador
        const exampleService = {
          providerId: provider.id,
          name: "Serviço de Exemplo",
          description: "Este é um serviço de exemplo. Edite ou exclua conforme necessário.",
          duration: 60, // 60 minutos
          price: 10000, // R$ 100,00 (em centavos)
          active: true
        };
        
        const service = await storage.createService(exampleService);
        console.log(`Serviço de exemplo criado para novo prestador: ${service.id}`);
      } catch (providerError) {
        console.error("Erro ao criar perfil de prestador automático:", providerError);
        // Continua com o login mesmo se houver erro na criação do perfil
      }

      // Não fazer login automático se a verificação de email estiver ativada
      if (isEmailServiceConfigured()) {
        // Retornar informação indicando que o email precisa ser verificado
        res.status(201).json({ 
          ...user, 
          needsVerification: true,
          message: "Verifique seu email para ativar sua conta" 
        });
      } else {
        // Se verificação de email não estiver ativada, fazer login automático
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json(user);
        });
      }
    } catch (error) {
      console.error("Erro no registro:", error);
      next(error);
    }
  });


  
  // Rota para verificar email
  app.post("/api/verify-email", async (req, res) => {
    const { email, token } = req.body;
    
    if (!email || !token) {
      return res.status(400).json({ error: "Email e token são obrigatórios" });
    }
    
    try {
      // Buscar usuário pelo email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(400).json({ error: "Email não encontrado" });
      }
      
      // Verificar se o email já foi verificado
      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email já verificado" });
      }
      
      // Verificar se o token é válido
      if (user.verificationToken !== token) {
        return res.status(400).json({ error: "Token inválido" });
      }
      
      // Verificar se o token expirou
      if (user.verificationTokenExpiry && new Date(user.verificationTokenExpiry) < new Date()) {
        return res.status(400).json({ error: "Token expirado. Solicite um novo." });
      }
      
      // Marcar email como verificado e limpar o token
      await storage.updateUser(user.id, {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      });
      
      // Enviar email de boas-vindas
      if (isEmailServiceConfigured()) {
        sendWelcomeEmail(user).catch(error => {
          console.error("Erro ao enviar email de boas-vindas:", error);
        });
      }
      
      // Responder com sucesso
      return res.status(200).json({ success: true, message: "Email verificado com sucesso" });
    } catch (error) {
      console.error("Erro ao verificar email:", error);
      return res.status(500).json({ error: "Erro ao verificar email" });
    }
  });
  
  // Rota para reenviar token de verificação
  app.post("/api/resend-verification", async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }
    
    try {
      // Buscar usuário pelo email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(400).json({ error: "Email não encontrado" });
      }
      
      // Verificar se o email já foi verificado
      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email já verificado" });
      }
      
      // Verificar se o serviço de email está configurado
      if (!isEmailServiceConfigured()) {
        return res.status(500).json({ error: "Serviço de email não configurado" });
      }
      
      // Gerar novo token
      const token = generateVerificationToken(user.id);
      
      // Atualizar token no banco de dados
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token válido por 24 horas
      
      await storage.updateUser(user.id, {
        verificationToken: token,
        verificationTokenExpiry: expiresAt
      });
      
      // Enviar email com o novo token
      const emailSent = await sendVerificationEmail(user, token);
      
      if (!emailSent) {
        return res.status(500).json({ error: "Falha ao enviar email de verificação" });
      }
      
      // Responder com sucesso
      return res.status(200).json({ success: true, message: "Email de verificação reenviado com sucesso" });
    } catch (error) {
      console.error("Erro ao reenviar verificação:", error);
      return res.status(500).json({ error: "Erro ao reenviar verificação" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err: Error | null, user: Express.User | false, info: any) => {
      if (err) return next(err);
      
      if (!user) {
        // Verificar se a falha é devido à assinatura expirada
        if (info && info.expired) {
          // Busca o usuário para obter informações adicionais
          const username = req.body.username;
          const user = await storage.getUserByUsername(username);
          
          return res.status(401).json({
            error: info.message || "Assinatura expirada",
            expired: true,
            username: username,
            name: user?.name || '',
            renewUrl: `/renew-subscription?username=${encodeURIComponent(username)}`
          });
        }
        
        return res.status(401).json({ error: info?.message || "Credenciais inválidas" });
      }
      
      // Verificar se o email foi verificado (se a verificação estiver habilitada)
      if (isEmailServiceConfigured() && !user.isEmailVerified) {
        return res.status(403).json({ 
          error: "Email não verificado", 
          needsVerification: true,
          email: user.email 
        });
      }
      
      // IMPLEMENTAÇÃO DE SESSÃO ÚNICA SIMPLIFICADA
      try {
        // 1. Remover todas as sessões antigas deste usuário do banco de dados
        await pool.query(
          `DELETE FROM "session" 
           WHERE sess ->> 'passport' IS NOT NULL 
           AND (sess -> 'passport' ->> 'user')::integer = $1`,
          [user.id]
        );
        console.log(`Sessões antigas removidas para usuário ${user.id}`);
        
        // 2. Limpar registros de sessões ativas
        await pool.query(
          'DELETE FROM active_sessions WHERE user_id = $1 OR user_email = $2',
          [user.id, user.email]
        );
        console.log(`Registros de sessões ativas limpos para usuário ${user.id}`);
        
      } catch (error) {
        console.error(`Erro ao limpar sessões antigas para usuário ${user.id}:`, error);
        // Continuar mesmo com erro para não bloquear o login
      }
      
      // 3. Fazer login do usuário (isso criará uma nova sessão)
      req.login(user, async (err: Error | null) => {
        if (err) return next(err);
        
        // 4. Registrar a nova sessão como ativa
        try {
          if (req.sessionID) {
            await pool.query(
              'INSERT INTO active_sessions (user_id, session_id, user_email, last_activity) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
              [user.id, req.sessionID, user.email]
            );
            console.log(`Nova sessão ativa registrada para usuário ${user.id}: ${req.sessionID}`);
          }
        } catch (error) {
          console.error(`Erro ao registrar nova sessão ativa:`, error);
          // Continuar mesmo com erro
        }
        
        // Retornar as informações do usuário
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
    res.json(req.user);
  });

  // Rota para verificar a validade da sessão
  app.get('/api/session/check', async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    
    // @ts-ignore - Acessando o ID e email do usuário
    const userId = req.user.id;
    const sessionId = req.sessionID;
    
    try {
      // Verificar se esta sessão está registrada como ativa
      const activeSessionCheck = await pool.query(
        'SELECT session_id FROM active_sessions WHERE user_id = $1 AND session_id = $2',
        [userId, sessionId]
      );
      
      if (activeSessionCheck.rows.length === 0) {
        // Esta sessão não está registrada como ativa
        // Verificar se existe alguma sessão ativa para este usuário
        const anyActiveSession = await pool.query(
          'SELECT session_id FROM active_sessions WHERE user_id = $1 LIMIT 1',
          [userId]
        );
        
        if (anyActiveSession.rows.length > 0) {
          // Existe outra sessão ativa, esta sessão é inválida
          return res.status(401).json({ 
            error: 'Sessão inválida', 
            code: 'SESSION_INVALIDATED',
            message: 'Sua sessão foi encerrada porque você fez login em outro dispositivo.'
          });
        }
      }
      
      // Sessão válida
      res.json({ valid: true });
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      // Em caso de erro, considerar a sessão válida para evitar deslogamentos indesejados
      res.json({ valid: true });
    }
  });
}