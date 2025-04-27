import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User as SchemaUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

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

export function setupAuth(app: Express) {
  // Configuração de sessão mais robusta
  console.log(`Configurando sessão. Ambiente: ${process.env.NODE_ENV}`);
  console.log(`SESSION_SECRET disponível: ${!!process.env.SESSION_SECRET}`);
  
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
      // Certifica-se de que o ID é um número
      const userId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      if (isNaN(userId)) {
        return done(new Error(`ID de usuário inválido: ${id}`));
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
      
      done(null, user);
    } catch (error) {
      console.error("Erro ao deserializar usuário:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "Credenciais inválidas" });
      
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