import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User as SchemaUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool, db } from "./db";
import { 
  generateVerificationToken, 
  sendVerificationEmail,
  sendWelcomeEmail, 
  verifyToken,
  isEmailServiceConfigured
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
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renova o cookie em cada requisição
    store: storage.sessionStore,
    name: 'meuagendamento.sid', // Nome específico para evitar colisões
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
      // No ambiente de produção, só use secure: true se estiver em HTTPS
      secure: process.env.NODE_ENV === 'production' && 
              (process.env.SECURE_COOKIE === 'true' || undefined),
      httpOnly: true,
      sameSite: 'lax' // Permite autenticação em redirecionamentos
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        
        // Verificar se o usuário existe e se a senha está correta
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Credenciais inválidas" });
        }
        
        // Verificar se o usuário está ativo
        if (user.isActive === false) {
          return done(null, false, { message: "Conta de usuário bloqueada" });
        }
        
        // Verificar expiração da assinatura (apenas para provedores, não para admins)
        if (user.role === 'provider' && !user.neverExpires) {
          const now = new Date();
          const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
          
          console.log(`Verificando expiração de assinatura para usuário ${user.username}:`, {
            agora: now,
            expiracao: expiry,
            nuncaExpira: user.neverExpires
          });
          
          if (expiry && now > expiry) {
            console.log(`Assinatura expirada para ${user.username}`);
            return done(null, false, { message: "Assinatura expirada", expired: true });
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
      if (user.role === 'provider' && !user.neverExpires) {
        const now = new Date();
        const expiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
        
        if (expiry && now > expiry) {
          console.log(`Acesso bloqueado para usuário ${userId} com assinatura expirada`);
          return done(null, false);
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
      // Verificar se o nome de usuário já existe
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }
      
      // Verificar se o email já está em uso
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email já está em uso" });
      }

      // Calcular a data de expiração (3 dias a partir de hoje)
      const trialPeriodDays = 3;
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

  // Função auxiliar para remover sessões antigas de um usuário
  async function destroyUserSessions(userId: number) {
    try {
      // Usando SQL direto para deletar sessões antigas deste usuário
      // A estrutura da tabela session do connect-pg-simple tem uma coluna sess
      // que contém os dados da sessão em formato JSON, incluindo passport.user
      const query = `
        DELETE FROM "session"
        WHERE sess->'passport'->'user' = $1::text
      `;
      await pool.query(query, [userId.toString()]);
      console.log(`Sessões antigas do usuário ${userId} removidas com sucesso`);
      return true;
    } catch (error) {
      console.error(`Erro ao remover sessões antigas do usuário ${userId}:`, error);
      return false;
    }
  }
  
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
    passport.authenticate("local", async (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Credenciais inválidas" });
      
      // Verificar se o email foi verificado (se a verificação estiver habilitada)
      if (isEmailServiceConfigured() && !user.isEmailVerified) {
        return res.status(403).json({ 
          error: "Email não verificado", 
          needsVerification: true,
          email: user.email 
        });
      }
      
      // Antes de fazer login, destruir todas as sessões existentes deste usuário
      await destroyUserSessions(user.id);
      
      req.login(user, (err: Error | null) => {
        if (err) return next(err);
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
}