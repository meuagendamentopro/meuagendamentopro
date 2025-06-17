import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";

// Estender o tipo da sessão para incluir dados de simulação
declare module 'express-session' {
  interface SessionData {
    originalAdminId?: number;
    impersonatedUserId?: number;
  }
}
import { storage } from "./storage";
import { db } from "./db";
import multer from "multer";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { SubscriptionService } from './subscription-service';
import { 
  insertServiceSchema, 
  insertClientSchema, 
  insertAppointmentSchema, 
  bookingFormSchema,
  AppointmentStatus,
  PaymentStatus,
  services,
  clients,
  providerClients,
  appointments,
  notifications,
  timeExclusions,
  InsertProvider,
  insertProviderSchema,
  InsertTimeExclusion,
  subscriptionPlans,
  subscriptionTransactions,
  users,
  employees,
  insertEmployeeSchema
} from "@shared/schema";
import { and, eq, gt, gte, lte, ne, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import systemSettingsRoutes from "./routes/system-settings";
import maintenanceRoutes from "./routes/maintenance.routes";
import passport from "passport";
import { activeSessionMiddleware, userWebSockets } from "./active-session";
import { verifyToken, generateVerificationToken, sendVerificationEmail, sendWelcomeEmail, isEmailServiceConfigured } from "./email-service";
import { paymentService } from "./payment-service";
import adminDatabaseRouter from "./routes/admin-database";
import { registerAppointmentDeleteRoute } from "./routes/appointments-delete";
import clinicalNotesRoutes from "./routes/clinical-notes-routes";
import clientAppointmentsRoutes from "./routes/client-appointments";
import appointmentLookupRoutes from "./routes/appointment-lookup";
import { sessionCheckRoute } from "./routes/session-check";
import excelDataRoutes from "./routes/excel-data";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação
  setupAuth(app);
  
  // Aplicar o middleware de sessão única em todas as rotas protegidas
  // Importante: deve ser aplicado após a inicialização do Passport
  app.use('/api', (req, res, next) => activeSessionMiddleware(req, res, next));
  
  // Registrar rotas de administração do banco de dados
  app.use('/api/admin/database', adminDatabaseRouter);
  
  // Registrar rota de verificação de sessão
  sessionCheckRoute(app);
  
  // Registrar rotas para servir o arquivo Excel (sem autenticação)
  app.use('/api/dados', excelDataRoutes);
  
  // Registrar rotas para consulta e reagendamento de agendamentos (sem autenticação)
  app.use('/api', appointmentLookupRoutes);
  
  // Rota para buscar o histórico de atendimentos de um cliente específico
  app.get('/api/clients/:clientId/appointments', async (req: Request & { user?: any }, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autorizado" });
      }
      
      const { clientId } = req.params;
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
      }
      
      // Buscar o provedor associado ao usuário logado
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        return res.status(404).json({ error: "Provedor não encontrado" });
      }
      
      const providerId = provider.id;

      // Buscar todos os agendamentos do cliente para este provedor
      const clientAppointments = await db
        .select({
          id: appointments.id,
          date: appointments.date,
          status: appointments.status,
          notes: appointments.notes,
          serviceId: appointments.serviceId,
          paymentAmount: appointments.paymentAmount,
          paymentStatus: appointments.paymentStatus,
          paymentPercentage: appointments.paymentPercentage,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.clientId, parseInt(clientId)),
            eq(appointments.providerId, providerId)
          )
        )
        .orderBy(desc(appointments.date));

      // Buscar os detalhes dos serviços relacionados
      const serviceIds = Array.from(new Set(clientAppointments.map(app => app.serviceId)));
      
      const serviceDetails = await db
        .select({
          id: services.id,
          name: services.name,
          price: services.price,
        })
        .from(services)
        .where(eq(services.providerId, providerId));

      // Mapear os serviços por ID para facilitar o acesso
      const servicesMap = serviceDetails.reduce<Record<number, typeof serviceDetails[0]>>((acc, service) => {
        acc[service.id] = service;
        return acc;
      }, {});

      // Adicionar os detalhes do serviço a cada agendamento
      const appointmentsWithDetails = clientAppointments.map(appointment => {
        const service = servicesMap[appointment.serviceId];
        return {
          ...appointment,
          serviceName: service?.name,
          servicePrice: service?.price,
        };
      });

      res.json(appointmentsWithDetails);
    } catch (error) {
      console.error("Erro ao buscar histórico de atendimentos:", error);
      res.status(500).json({ error: "Erro ao buscar histórico de atendimentos" });
    }
  });
  
  // Rota para buscar informações do provedor logado
  app.get('/api/my-provider', (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  }, async (req: Request, res: Response) => {
    try {
      // Usar getCurrentUserId para considerar simulação de acesso
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      
      // Buscar o provedor associado ao usuário logado (ou simulado)
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provedor não encontrado' });
      }
      
      res.json(provider);
    } catch (error: any) {
      console.error('Erro ao buscar provedor:', error);
      res.status(500).json({ error: 'Falha ao buscar informações do provedor' });
    }
  });
  
  // Rota para buscar configurações do provedor logado
  app.get('/api/my-provider/settings', (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  }, async (req: Request, res: Response) => {
    try {
      // Usar getCurrentUserId para considerar simulação de acesso
      const userId = getCurrentUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      
      // Buscar o provedor associado ao usuário logado (ou simulado)
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provedor não encontrado' });
      }
      
      // Retornar apenas as configurações relevantes para pagamento
      res.json({
        id: provider.id,
        pixEnabled: provider.pixEnabled || false,
        pixMercadoPagoToken: provider.pixMercadoPagoToken ? true : false, // Apenas indicar se existe, não enviar o token
        pixIdentificationNumber: provider.pixIdentificationNumber || null,
        pixPaymentPercentage: provider.pixPaymentPercentage || 100
      });
    } catch (error: any) {
      console.error('Erro ao buscar configurações do provedor:', error);
      res.status(500).json({ error: 'Falha ao buscar configurações do provedor' });
    }
  });
  
  // Rota para gerar um código PIX para pagamento
  app.post('/api/payments/generate-pix', (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  }, async (req: Request, res: Response) => {
    try {
      const { appointmentId, amount } = req.body;
      
      if (!appointmentId || !amount) {
        return res.status(400).json({ error: 'ID do agendamento e valor são obrigatórios' });
      }
      
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      
      // Buscar o provedor associado ao usuário logado
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provedor não encontrado' });
      }
      
      // Verificar se o provedor tem PIX configurado
      if (!provider.pixEnabled || !provider.pixMercadoPagoToken) {
        return res.status(400).json({ 
          error: 'PIX não configurado', 
          message: 'Configure o PIX nas configurações do seu perfil para receber pagamentos.' 
        });
      }
      
      // Buscar o agendamento
      const appointment = await storage.getAppointment(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }
      
      // Verificar se o agendamento pertence ao provedor
      if (appointment.providerId !== provider.id) {
        return res.status(403).json({ error: 'Acesso negado a este agendamento' });
      }
      
      // Buscar o cliente
      const client = await storage.getClient(appointment.clientId);
      
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      
      // Buscar o serviço
      const service = await storage.getService(appointment.serviceId);
      
      if (!service) {
        return res.status(404).json({ error: 'Serviço não encontrado' });
      }
      
      // Calcular o valor restante a ser pago
      let paymentAmount = amount;
      if (appointment.paymentAmount && appointment.paymentAmount > 0) {
        // Se já existe um pagamento parcial, usar o valor restante
        const servicePrice = service.price || 0;
        const remainingAmount = servicePrice - appointment.paymentAmount;
        
        // Usar o valor restante (já em reais, não precisa converter)
        paymentAmount = remainingAmount / 100; // Converter de centavos para reais
        
        console.log(`Valor do serviço: ${servicePrice / 100} reais, Valor já pago: ${appointment.paymentAmount / 100} reais, Valor restante: ${paymentAmount} reais`);
      }
      
      // Gerar o código PIX
      const pixResponse = await paymentService.generatePix({
        appointmentId,
        providerId: provider.id,
        amount: paymentAmount,
        clientName: client.name,
        clientEmail: client.email || 'cliente@example.com',
        serviceDescription: service.name
      });
      
      // Retornar os dados do PIX
      res.json({
        transactionId: pixResponse.transactionId,
        qrCode: pixResponse.qrCode,
        qrCodeBase64: pixResponse.qrCodeBase64,
        expiresAt: pixResponse.expiresAt,
        paymentAmount: Math.round(paymentAmount * 100), // Converter de reais para centavos
        paymentPercentage: provider.pixPaymentPercentage || 100
      });
    } catch (error: any) {
      console.error('Erro ao gerar PIX:', error);
      res.status(500).json({ error: 'Falha ao gerar código PIX', message: error.message });
    }
  });
  
  // Rota para verificar o status de um pagamento
  app.get('/api/payments/:appointmentId/status', (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  }, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'ID de agendamento inválido' });
      }
      
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }
      
      // Buscar o provedor associado ao usuário logado
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        return res.status(404).json({ error: 'Provedor não encontrado' });
      }
      
      // Buscar o agendamento
      const appointment = await storage.getAppointment(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: 'Agendamento não encontrado' });
      }
      
      // Verificar se o agendamento pertence ao provedor
      if (appointment.providerId !== provider.id) {
        return res.status(403).json({ error: 'Acesso negado a este agendamento' });
      }
      
      // Se o agendamento já estiver pago, retornar o status
      if (appointment.paymentStatus === 'paid') {
        return res.json({ paymentStatus: 'paid' });
      }
      
      // Se não requer pagamento, retornar o status
      if (!appointment.requiresPayment) {
        return res.json({ paymentStatus: 'not_required' });
      }
      
      // Se não tiver transação PIX, retornar status pendente sem QR code
      if (!appointment.pixTransactionId) {
        return res.json({ paymentStatus: 'pending' });
      }
      
      // Verificar o status do pagamento no serviço de pagamento
      const paymentStatus = await paymentService.checkPaymentStatus(
        appointment.pixTransactionId || '',
        provider.pixMercadoPagoToken || ''
      );
      
      // Se o pagamento foi confirmado, atualizar o status do agendamento
      if (paymentStatus.paid && appointment.paymentStatus !== 'paid') {
        await paymentService.updateAppointmentPaymentStatus(appointmentId);
      }
      
      // Retornar o status do pagamento com os dados do PIX
      res.json({
        paymentStatus: paymentStatus.paid ? 'paid' : 'pending',
        qrCode: appointment.pixQrCode,
        qrCodeBase64: appointment.pixQrCode, // Usar o mesmo campo para base64
        expiresAt: appointment.pixQrCodeExpiration, // Usar o campo correto para expiração
        paymentAmount: appointment.paymentAmount,
        paymentPercentage: appointment.paymentPercentage
      });
    } catch (error: any) {
      console.error('Erro ao verificar status do pagamento:', error);
      res.status(500).json({ error: 'Falha ao verificar status do pagamento', message: error.message });
    }
  });
  
  // Registrar rotas de configurações do sistema
  app.use('/api/system-settings', systemSettingsRoutes);
  
  // Registrar rotas de manutenção
  app.use('/api/maintenance', maintenanceRoutes);
  
  // Registrar rota de exclusão de agendamentos
  registerAppointmentDeleteRoute(app, storage);
  
  // Registrar rotas de anotações clínicas
  app.use('/api/clinical-notes', clinicalNotesRoutes);
  
  // Rota para verificar todos os pagamentos pendentes do usuário
  app.get("/api/subscription/check-pending-payments", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      
      // Buscar todas as transações pendentes do usuário
      const pendingTransactions = await db.select()
        .from(subscriptionTransactions)
        .where(and(
          eq(subscriptionTransactions.userId, req.user.id),
          eq(subscriptionTransactions.status, 'pending')
        ));
      
      console.log(`Verificando ${pendingTransactions.length} pagamentos pendentes para o usuário ${req.user.id}`);
      
      // Verificar o status de cada transação pendente
      const results = await Promise.all(
        pendingTransactions.map(async (transaction) => {
          try {
            if (transaction.transactionId) {
              const status = await subscriptionService.checkPaymentStatus(transaction.transactionId);
              return {
                transactionId: transaction.transactionId,
                status: status.status,
                updated: status.status !== 'pending'
              };
            }
            return null;
          } catch (error) {
            console.error(`Erro ao verificar transação ${transaction.id}:`, error);
            return null;
          }
        })
      );
      
      // Filtrar resultados nulos
      const validResults = results.filter(Boolean);
      
      // Se algum pagamento foi confirmado, atualizar as informações do usuário
      const confirmedPayments = validResults.filter(r => r && (r.status === 'paid' || r.status === 'confirmed' || r.status === 'approved'));
      
      if (confirmedPayments.length > 0) {
        console.log(`${confirmedPayments.length} pagamentos confirmados para o usuário ${req.user.id}`);
        // O cliente deverá atualizar seus dados após receber esta resposta
      }
      
      return res.json({
        checked: pendingTransactions.length,
        updated: validResults.filter(r => r && r.updated).length,
        confirmed: confirmedPayments.length
      });
    } catch (error: any) {
      console.error("Erro ao verificar pagamentos pendentes:", error);
      return res.status(500).json({ error: error.message || "Falha ao verificar pagamentos pendentes" });
    }
  });
  
  // Rota para obter informações do usuário autenticado
  app.get("/api/user", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Verificar se há simulação ativa
    if (req.session.impersonatedUserId && req.session.originalAdminId) {
      try {
        const impersonatedUser = await storage.getUser(req.session.impersonatedUserId);
        if (impersonatedUser) {
          // Adicionar flag indicando que é uma simulação
          const userWithImpersonationFlag = {
            ...impersonatedUser,
            _isImpersonated: true,
            _originalAdminId: req.session.originalAdminId
          };
          return res.json(userWithImpersonationFlag);
        }
      } catch (error) {
        console.error("Erro ao buscar usuário simulado:", error);
        // Se houver erro, continuar com o usuário original
      }
    }
    
    res.json(req.user);
  });
  
  // Rota para atualizar perfil do usuário
  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const userId = req.user.id;
      const { name, email, currentPassword, newPassword, avatarUrl, hideWhatsappPopup } = req.body;
      
      // Criar objeto com dados a atualizar
      const updateData: Partial<{ 
        name: string, 
        email: string, 
        password: string,
        avatarUrl: string,
        hideWhatsappPopup: boolean
      }> = {};
      
      // Validar e adicionar campos a serem atualizados
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
      if (hideWhatsappPopup !== undefined) updateData.hideWhatsappPopup = hideWhatsappPopup;
      
      // Se está tentando alterar a senha
      if (newPassword && currentPassword) {
        // Buscar o usuário com a senha atual (hash)
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }
        
        // Verificar se a senha atual está correta
        const isPasswordCorrect = await comparePasswords(currentPassword, user.password);
        if (!isPasswordCorrect) {
          return res.status(400).json({ error: "Senha atual incorreta" });
        }
        
        // Hashear a nova senha
        updateData.password = await hashPassword(newPassword);
      }
      
      // Se não há nada para atualizar
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "Nenhuma informação fornecida para atualização" });
      }
      
      // Atualizar usuário
      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao atualizar perfil" });
      }
      
      // Retornar o usuário atualizado (sem a senha)
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      // Se alterou a senha, precisa fazer novo login
      if (updateData.password) {
        // Atualizar a sessão com os novos dados do usuário via login
        req.login(updatedUser, (err) => {
          if (err) {
            console.error("Erro ao atualizar sessão:", err);
          }
          res.status(200).json(userWithoutPassword);
        });
      } else {
        // Se não alterou a senha, apenas atualizar os dados na sessão atual
        if (req.user) {
          Object.assign(req.user, userWithoutPassword);
        }
        res.status(200).json(userWithoutPassword);
      }
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(500).json({ error: "Erro ao atualizar perfil" });
    }
  });

  // Rota para atualizar tipo de conta do usuário
  app.patch("/api/user/account-type", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const { accountType } = req.body;
      // Usar getCurrentUserId para considerar simulação de acesso
      const userId = getCurrentUserId(req);
      
      // Validar o tipo de conta
      if (!accountType || !['individual', 'company'].includes(accountType)) {
        return res.status(400).json({ error: "Tipo de conta inválido. Use 'individual' ou 'company'" });
      }
      
      // Atualizar o tipo de conta do usuário (simulado ou real)
      const updatedUser = await storage.updateUser(userId, { accountType });
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao atualizar tipo de conta" });
      }
      
      // Retornar o usuário atualizado (sem a senha)
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      // Se estamos em simulação, não atualizar a sessão real
      if (req.session.impersonatedUserId && req.session.originalAdminId) {
        // Em simulação, apenas retornar os dados atualizados
        res.status(200).json(userWithoutPassword);
      } else {
        // Atualizar os dados do usuário na sessão atual sem forçar novo login
        if (req.user) {
          req.user.accountType = updatedUser.accountType;
        }
        res.status(200).json(userWithoutPassword);
      }
    } catch (error) {
      console.error("Erro ao atualizar tipo de conta:", error);
      res.status(500).json({ error: "Erro ao atualizar tipo de conta" });
    }
  });
  
  // Rota para upload de imagem em base64
  // Configuração do multer para upload de arquivos
  const avatarStorage = multer.memoryStorage();
  const avatarUpload = multer({
    storage: avatarStorage,
    limits: {
      fileSize: 5 * 1024 * 1024, // limite de 5MB
    },
    fileFilter: (req, file, cb) => {
      // Aceitar apenas arquivos de imagem
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Apenas imagens são permitidas'));
      }
      cb(null, true);
    }
  });

  app.post("/api/user/upload-avatar", avatarUpload.single('avatar'), async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const userId = req.user.id;
      
      // Verificar se o arquivo foi enviado
      if (!req.file) {
        return res.status(400).json({ error: "Dados da imagem não fornecidos" });
      }
      
      // Converter a imagem para base64
      const imageBuffer = req.file.buffer;
      const contentType = req.file.mimetype;
      const imageData = `data:${contentType};base64,${imageBuffer.toString('base64')}`;
      
      // Atualizar o usuário com a URL da imagem
      const updatedUser = await storage.updateUser(userId, { avatarUrl: imageData });
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao atualizar avatar" });
      }
      
      // Atualizar a sessão com os novos dados do usuário via login
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      req.login(updatedUser, (err) => {
        if (err) {
          console.error("Erro ao atualizar sessão:", err);
        }
        
        res.status(200).json({ 
          success: true, 
          avatarUrl: imageData,
          user: userWithoutPassword
        });
      });
    } catch (error) {
      console.error("Erro ao fazer upload do avatar:", error);
      res.status(500).json({ error: "Erro ao processar o upload da imagem" });
    }
  });
  
  // Rota para remover avatar
  app.delete("/api/user/avatar", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const userId = req.user.id;
      
      // Atualizar o usuário para remover o avatar
      const updatedUser = await storage.updateUser(userId, { avatarUrl: null });
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao remover avatar" });
      }
      
      // Atualizar a sessão com os novos dados do usuário via login
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      req.login(updatedUser, (err) => {
        if (err) {
          console.error("Erro ao atualizar sessão:", err);
        }
        
        res.status(200).json({ 
          success: true, 
          user: userWithoutPassword
        });
      });
    } catch (error) {
      console.error("Erro ao remover avatar:", error);
      res.status(500).json({ error: "Erro ao remover a imagem de perfil" });
    }
  });
  
  const httpServer = createServer(app);
  
  // Configuração do WebSocket para atualizações em tempo real
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true,
    // Aumenta o timeout para conexões WebSocket
    perMessageDeflate: {
      zlibDeflateOptions: {
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Outros parâmetros opcionais
      concurrencyLimit: 10, // Limita processamento concorrente
      threshold: 1024 // Mensagens menores que isso não são comprimidas
    }
  });
  
  // Armazenar conexões ativas
  const connectedClients = new Map<WebSocket, { userId?: number, isAlive?: boolean }>();
  
  // Função de heartbeat para verificar conexões ativas
  function heartbeat(this: WebSocket) {
    const client = connectedClients.get(this);
    if (client) {
      client.isAlive = true;
      connectedClients.set(this, client);
    }
  }
  
  // Verificar periodicamente se os clientes estão ativos
  const pingInterval = setInterval(() => {
    let activeCount = 0;
    let terminatedCount = 0;
    
    wss.clients.forEach((ws) => {
      const client = connectedClients.get(ws);
      
      if (!client || client.isAlive === false) {
        // Terminar conexões que não responderam ao ping anterior
        ws.terminate();
        connectedClients.delete(ws);
        terminatedCount++;
        return;
      }
      
      // Marcar como inativo até responder ao próximo ping
      client.isAlive = false;
      connectedClients.set(ws, client);
      
      try {
        // Enviar ping para verificar se está ativo
        ws.ping();
        activeCount++;
      } catch (e) {
        console.error('Erro ao enviar ping:', e);
        ws.terminate();
        connectedClients.delete(ws);
        terminatedCount++;
      }
    });
    
    if (activeCount > 0 || terminatedCount > 0) {
      console.log(`WebSocket heartbeat: ${activeCount} conexões ativas, ${terminatedCount} terminadas`);
    }
  }, 30000); // Verificar a cada 30 segundos
  
  // Limpar o intervalo quando o servidor for fechado
  process.on('SIGINT', () => {
    clearInterval(pingInterval);
    process.exit();
  });
  
  // Configuração específica para Railway
  const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID;
  
  if (isRailway) {
    console.log('🚂 Detectado ambiente Railway - configurando WebSocket para produção');
    
    // Configurações específicas para Railway
    wss.on('connection', (ws: WebSocket, req) => {
      console.log('Nova conexão WebSocket estabelecida no Railway');
      
      // Headers específicos para Railway
      const forwardedFor = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      console.log(`Conexão WebSocket de: ${forwardedFor}`);
      
      // Configurar heartbeat mais agressivo para Railway
      const heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error('Erro ao enviar ping:', error);
            clearInterval(heartbeatInterval);
          }
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 25000); // Ping a cada 25 segundos para Railway
      
      // Inicializar como conexão ativa
      connectedClients.set(ws, { isAlive: true });
      
      // Configurar o heartbeat
      ws.on('pong', heartbeat);
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Se for um ping do cliente (implementação customizada), responder
          if (data.type === 'ping') {
            try {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              return;
            } catch (e) {
              console.error('Erro ao responder ping do cliente:', e);
            }
          }
          
          // Se a mensagem contém uma identificação de usuário, associamos à conexão
          if (data.type === 'identify' && data.userId) {
            console.log(`Cliente WebSocket identificado: usuário ${data.userId}`);
            const existingClient = connectedClients.get(ws) || {};
            connectedClients.set(ws, { ...existingClient, userId: data.userId, isAlive: true });
            
            // Armazenar a conexão WebSocket por usuário para notificações de sessão
            if (!userWebSockets.has(data.userId)) {
              userWebSockets.set(data.userId, new Set());
            }
            userWebSockets.get(data.userId)?.add(ws);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('Erro na conexão WebSocket:', error);
        clearInterval(heartbeatInterval);
        // Remover cliente em caso de erro
        connectedClients.delete(ws);
        try {
          ws.terminate();
        } catch (e) {
          console.error('Erro ao terminar conexão com erro:', e);
        }
      });
      
      ws.on('close', (code, reason) => {
        clearInterval(heartbeatInterval);
        // Remover cliente da lista quando a conexão é fechada
        const client = connectedClients.get(ws);
        if (client && client.userId) {
          // Remover a conexão do mapa de conexões por usuário
          const userSockets = userWebSockets.get(client.userId);
          if (userSockets) {
            userSockets.delete(ws);
            // Se não houver mais conexões para este usuário, remover o conjunto
            if (userSockets.size === 0) {
              userWebSockets.delete(client.userId);
            }
          }
        }
        connectedClients.delete(ws);
        console.log(`Conexão WebSocket fechada: código ${code}, razão: ${reason || 'N/A'}`);
      });
    });
  } else {
    // Configuração padrão para desenvolvimento local
    wss.on('connection', (ws: WebSocket) => {
      console.log('Nova conexão WebSocket estabelecida');
      
      // Inicializar como conexão ativa
      connectedClients.set(ws, { isAlive: true });
      
      // Configurar o heartbeat
      ws.on('pong', heartbeat);
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Se for um ping do cliente (implementação customizada), responder
          if (data.type === 'ping') {
            try {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              return;
            } catch (e) {
              console.error('Erro ao responder ping do cliente:', e);
            }
          }
          
          // Se a mensagem contém uma identificação de usuário, associamos à conexão
          if (data.type === 'identify' && data.userId) {
            console.log(`Cliente WebSocket identificado: usuário ${data.userId}`);
            const existingClient = connectedClients.get(ws) || {};
            connectedClients.set(ws, { ...existingClient, userId: data.userId, isAlive: true });
            
            // Armazenar a conexão WebSocket por usuário para notificações de sessão
            if (!userWebSockets.has(data.userId)) {
              userWebSockets.set(data.userId, new Set());
            }
            userWebSockets.get(data.userId)?.add(ws);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      });
      
      ws.on('error', (error) => {
        console.error('Erro na conexão WebSocket:', error);
        // Remover cliente em caso de erro
        connectedClients.delete(ws);
        try {
          ws.terminate();
        } catch (e) {
          console.error('Erro ao terminar conexão com erro:', e);
        }
      });
      
      ws.on('close', (code, reason) => {
        // Remover cliente da lista quando a conexão é fechada
        const client = connectedClients.get(ws);
        if (client && client.userId) {
          // Remover a conexão do mapa de conexões por usuário
          const userSockets = userWebSockets.get(client.userId);
          if (userSockets) {
            userSockets.delete(ws);
            // Se não houver mais conexões para este usuário, remover o conjunto
            if (userSockets.size === 0) {
              userWebSockets.delete(client.userId);
            }
          }
        }
        connectedClients.delete(ws);
        console.log(`Conexão WebSocket fechada: código ${code}, razão: ${reason || 'N/A'}`);
      });
    });
  }
  
  // Função auxiliar para enviar atualizações em tempo real
  async function broadcastUpdate(type: string, data: any) {
    const message = JSON.stringify({ type, data });
    let sentCount = 0;
    let errorCount = 0;
    
    // Log mais detalhado para Railway
    if (isRailway) {
      console.log(`🚂 [RAILWAY] Broadcastando atualização de tipo ${type} para ${connectedClients.size} clientes conectados`);
      if (type === 'notification_created') {
        console.log(`🚂 [RAILWAY] Notificação ID: ${data.notification?.id}, Usuário: ${data.userId}`);
      } else if (type === 'appointment_created') {
        console.log(`🚂 [RAILWAY] Agendamento criado ID: ${data.id}, Provider: ${data.providerId}`);
      }
    } else {
      console.log(`Broadcastando atualização de tipo ${type} para ${connectedClients.size} clientes:`, 
        type === 'notification_created' ? 
          { notificationId: data.notification?.id, userId: data.userId } : 
          { data: typeof data === 'object' ? 'objeto' : data });
    }
    
    // Buscar informações adicionais para direcionar corretamente as notificações
    let targetUserIds: number[] = [];
    
    // Processar os dados para determinar os destinatários corretos
    if (type === 'notification_created' && data.userId) {
      // Notificações são enviadas apenas para o usuário específico
      targetUserIds.push(data.userId);
      console.log(`Notificação direcionada para o usuário ID: ${data.userId}`);
    } 
    else if (type === 'appointment_created' && data.providerId) {
      // Buscar o userId associado ao providerId
      try {
        // Usar método assíncrono com Promise.resolve para obter o resultado síncrono
        const providerId = Number(data.providerId);
        if (!isNaN(providerId)) {
          const provider = await storage.getProvider(providerId);
          if (provider && provider.userId) {
            targetUserIds.push(provider.userId);
            console.log(`Agendamento direcionado para o provedor ID: ${providerId}, usuário ID: ${provider.userId}`);
          } else {
            console.log(`Provedor não encontrado ou sem userId para providerId: ${providerId}`);
          }
        } else {
          console.log(`ProviderId inválido: ${data.providerId}`);
        }
      } catch (error) {
        console.error(`Erro ao buscar provedor para providerId ${data.providerId}:`, error);
      }
    }
    else if (type === 'appointment_updated' && data.providerId) {
      // Buscar o userId associado ao providerId
      try {
        const providerId = Number(data.providerId);
        if (!isNaN(providerId)) {
          const provider = await storage.getProvider(providerId);
          if (provider && provider.userId) {
            targetUserIds.push(provider.userId);
            console.log(`Atualização de agendamento direcionada para o provedor ID: ${providerId}, usuário ID: ${provider.userId}`);
          }
        }
      } catch (error) {
        console.error(`Erro ao buscar provedor para providerId ${data.providerId}:`, error);
      }
    }
    
    // Enviar a mensagem para os clientes conectados
    connectedClients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Se temos destinatários específicos, verificar se este cliente é um deles
          if (targetUserIds.length > 0) {
            // Garantir que client.userId seja um número para comparação correta
            const clientUserId = typeof client.userId === 'number' ? client.userId : Number(client.userId);
            
            if (!isNaN(clientUserId) && targetUserIds.includes(clientUserId)) {
              console.log(`Enviando mensagem de tipo ${type} para usuário específico ${clientUserId}`);
              ws.send(message);
              sentCount++;
            } else {
              // Não enviar para este cliente, pois não é um destinatário
              console.log(`Ignorando cliente ${client.userId} para mensagem de tipo ${type}`);
            }
          } else {
            // Se não há destinatários específicos, enviar para todos (comportamento padrão)
            console.log(`Enviando mensagem de tipo ${type} para todos os clientes (sem destinatário específico)`);
            ws.send(message);
            sentCount++;
          }
        } catch (error) {
          console.error('Erro ao enviar mensagem WebSocket:', error);
          errorCount++;
          // Marcar para remoção em caso de erro
          try {
            ws.close(1011, 'Erro ao enviar mensagem');
          } catch (e) {
            // Se não conseguir fechar normalmente, tenta terminar abruptamente
            try {
              ws.terminate();
            } catch (e2) {
              console.error('Erro ao terminar conexão problemática:', e2);
            }
          }
          connectedClients.delete(ws);
        }
      }
    });
    
    if (isRailway) {
      console.log(`🚂 [RAILWAY] Broadcast realizado: ${type} - Enviado para ${sentCount} clientes, ${errorCount} erros`);
      if (sentCount === 0 && connectedClients.size > 0) {
        console.log(`🚂 [RAILWAY] ⚠️ ATENÇÃO: Nenhuma mensagem enviada apesar de ter ${connectedClients.size} clientes conectados!`);
        console.log(`🚂 [RAILWAY] Destinatários esperados:`, targetUserIds);
        console.log(`🚂 [RAILWAY] Clientes conectados:`, Array.from(connectedClients.values()).map(c => ({ userId: c.userId, isAlive: c.isAlive })));
      }
    } else {
      console.log(`Broadcast realizado: ${type} - Enviado para ${sentCount} clientes, ${errorCount} erros`);
    }
  }
  
  // Tornar a função broadcastUpdate disponível para outras partes do código
  (global as any).broadcastUpdate = broadcastUpdate;
  
  // Endpoint para verificação de email via POST (usado pelo frontend)
  app.post("/api/verify-email", async (req: Request, res: Response) => {
    try {
      const { email, token } = req.body;
      
      if (!email || !token) {
        return res.status(400).json({ 
          error: "Dados incompletos. Email e token são obrigatórios." 
        });
      }
      
      // Buscar o usuário pelo email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ 
          error: "Usuário não encontrado com o email fornecido." 
        });
      }
      
      // Se o usuário já está verificado
      if (user.isEmailVerified) {
        return res.status(200).json({ 
          message: "Email já verificado anteriormente. Você pode fazer login." 
        });
      }
      
      // Verifica se o token é válido
      if (!verifyToken(user.id, token)) {
        return res.status(400).json({ 
          error: "Token inválido ou expirado. Solicite um novo link de verificação." 
        });
      }
      
      // Atualiza o usuário para marcar o email como verificado
      await storage.updateUser(user.id, {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      });
      
      // Envia um email de boas-vindas
      try {
        await sendWelcomeEmail(user);
      } catch (emailError) {
        console.error("Erro ao enviar email de boas-vindas:", emailError);
        // Não interrompemos o fluxo se falhar o envio do email de boas-vindas
      }
      
      return res.status(200).json({ 
        success: true, 
        message: "Email verificado com sucesso!" 
      });
    } catch (error) {
      console.error("Erro na verificação de email:", error);
      return res.status(500).json({ 
        error: "Erro ao processar a verificação de email. Tente novamente mais tarde." 
      });
    }
  });
  
  // Nova rota para verificação direta via GET (usado pelos links no email)
  app.get("/api/verify-email-direct/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const email = req.query.email as string;
      
      if (!email || !token) {
        return res.status(400).send(`
          <html>
            <head>
              <title>Erro na Verificação</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; margin-bottom: 20px; }
                .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; }
              </style>
            </head>
            <body>
              <h1 class="error">Erro na Verificação</h1>
              <p>Email ou token não fornecidos.</p>
              <a href="/auth" class="btn">Voltar para Login</a>
            </body>
          </html>
        `);
      }
      
      // Buscar o usuário pelo email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).send(`
          <html>
            <head>
              <title>Erro na Verificação</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; margin-bottom: 20px; }
                .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; }
              </style>
            </head>
            <body>
              <h1 class="error">Erro na Verificação</h1>
              <p>Usuário não encontrado com o email fornecido.</p>
              <a href="/auth" class="btn">Voltar para Login</a>
            </body>
          </html>
        `);
      }
      
      // Se o usuário já está verificado
      if (user.isEmailVerified) {
        return res.status(200).send(`
          <html>
            <head>
              <title>Email Já Verificado</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .success { color: #48bb78; margin-bottom: 20px; }
                .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; }
              </style>
            </head>
            <body>
              <h1 class="success">Email Já Verificado</h1>
              <p>Seu email já foi verificado anteriormente. Você pode fazer login na sua conta.</p>
              <a href="/auth" class="btn">Ir para Login</a>
            </body>
          </html>
        `);
      }
      
      // Verifica se o token é válido
      if (user.verificationToken !== token) {
        return res.status(400).send(`
          <html>
            <head>
              <title>Erro na Verificação</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; margin-bottom: 20px; }
                .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; }
              </style>
            </head>
            <body>
              <h1 class="error">Erro na Verificação</h1>
              <p>Token de verificação inválido.</p>
              <a href="/auth" class="btn">Voltar para Login</a>
            </body>
          </html>
        `);
      }
      
      // Verifica se o token expirou
      if (user.verificationTokenExpiry && new Date() > new Date(user.verificationTokenExpiry)) {
        return res.status(400).send(`
          <html>
            <head>
              <title>Erro na Verificação</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; margin-bottom: 20px; }
                .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; }
                .resend { margin-top: 15px; }
              </style>
            </head>
            <body>
              <h1 class="error">Erro na Verificação</h1>
              <p>Token de verificação expirado.</p>
              <a href="/auth" class="btn">Voltar para Login</a>
              <p class="resend">
                <a href="/auth?resend=${encodeURIComponent(email)}">Solicitar novo email de verificação</a>
              </p>
            </body>
          </html>
        `);
      }
      
      // Verificação de expiração já foi feita acima
      
      // Atualiza o usuário para marcar o email como verificado
      const updatedUser = await storage.updateUser(user.id, {
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      });
      
      if (!updatedUser) {
        return res.status(500).send(`
          <html>
            <head>
              <title>Erro na Verificação</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .error { color: #e53e3e; margin-bottom: 20px; }
                .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                      text-decoration: none; border-radius: 5px; display: inline-block; }
              </style>
            </head>
            <body>
              <h1 class="error">Erro na Verificação</h1>
              <p>Falha ao atualizar usuário. Tente novamente.</p>
              <a href="/auth" class="btn">Voltar para Login</a>
            </body>
          </html>
        `);
      }
      
      // Envia um email de boas-vindas
      try {
        await sendWelcomeEmail(user);
      } catch (emailError) {
        console.error("Erro ao enviar email de boas-vindas:", emailError);
        // Não interrompemos o fluxo se falhar o envio do email de boas-vindas
      }
      
      // Responder com HTML de sucesso
      res.status(200).send(`
        <html>
          <head>
            <title>Email Verificado com Sucesso</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: #48bb78; margin-bottom: 20px; }
              .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                    text-decoration: none; border-radius: 5px; display: inline-block; }
            </style>
          </head>
          <body>
            <h1 class="success">Email Verificado com Sucesso!</h1>
            <p>Seu email foi verificado com sucesso. Agora você pode fazer login na sua conta.</p>
            <a href="/auth" class="btn">Ir para Login</a>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Erro na verificação de email:", error);
      res.status(500).send(`
        <html>
          <head>
            <title>Erro na Verificação</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #e53e3e; margin-bottom: 20px; }
              .btn { background-color: #4F46E5; color: white; padding: 10px 20px; 
                    text-decoration: none; border-radius: 5px; display: inline-block; }
            </style>
          </head>
          <body>
            <h1 class="error">Erro na Verificação</h1>
            <p>Ocorreu um erro durante a verificação do seu email. Tente novamente.</p>
            <a href="/auth" class="btn">Voltar para Login</a>
          </body>
        </html>
      `);
    }
  });
  
  // Endpoint para reenviar email de verificação
  app.post("/api/resend-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          error: "Email é obrigatório" 
        });
      }
      
      // Verifica se o serviço de email está configurado
      if (!isEmailServiceConfigured()) {
        return res.status(503).json({
          error: "Serviço de email não configurado. Entre em contato com o administrador."
        });
      }
      
      // Buscar o usuário pelo email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Não revelamos se o email existe ou não por segurança
        return res.status(200).json({ 
          message: "Se o email estiver registrado, um link de verificação será enviado." 
        });
      }
      
      // Se o usuário já está verificado
      if (user.isEmailVerified) {
        return res.status(200).json({ 
          message: "Este email já foi verificado. Você pode fazer login." 
        });
      }
      
      // Gera um novo token
      const token = generateVerificationToken(user.id);
      
      // Atualiza o usuário com o novo token
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 24); // Expira em 24 horas
      
      await storage.updateUser(user.id, {
        verificationToken: token,
        verificationTokenExpiry: expiryDate
      });
      
      // Envia o email de verificação
      const emailSent = await sendVerificationEmail(user, token);
      
      if (!emailSent) {
        return res.status(500).json({
          error: "Falha ao enviar o email de verificação. Tente novamente mais tarde."
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "Um novo link de verificação foi enviado para seu email."
      });
    } catch (error) {
      console.error("Erro ao reenviar verificação:", error);
      return res.status(500).json({
        error: "Erro ao processar a solicitação. Tente novamente mais tarde."
      });
    }
  });
  
  // Função helper para obter o ID do usuário correto (simulado ou real)
  const getCurrentUserId = (req: Request): number => {
    // Se há simulação ativa, usar o ID do usuário simulado
    if (req.session.impersonatedUserId && req.session.originalAdminId) {
      return req.session.impersonatedUserId;
    }
    // Caso contrário, usar o ID do usuário real
    if (!req.user) {
      throw new Error("Usuário não autenticado");
    }
    return req.user.id;
  };

  // Middleware para verificar se o usuário é administrador
  const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Acesso não autorizado. Apenas administradores podem acessar esta rota." });
    }
    
    next();
  };
  
  // Middleware para verificar autenticação e carregar o provider do usuário na requisição
  const loadUserProvider = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      // Busca o provider associado ao usuário atual (considerando simulação)
      const userId = getCurrentUserId(req);
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        // Usuário logado não tem provider associado
        return res.status(404).json({ 
          error: "Perfil de prestador não encontrado", 
          message: "Você não tem um perfil de prestador de serviços configurado."
        });
      }
      
      // Adiciona o provider à requisição para uso nas rotas subsequentes
      (req as any).provider = provider;
      next();
    } catch (error) {
      console.error("Erro ao carregar provider do usuário:", error);
      res.status(500).json({ error: "Erro ao carregar perfil do prestador" });
    }
  };
  
  // Rotas de administração
  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  });
  
  // Rota para limpar o banco de dados (apenas Admin)
  app.post("/api/admin/clear-database", isAdmin, async (req: Request, res: Response) => {
    try {
      console.log("Iniciando limpeza do banco de dados...");
      console.log("IMPORTANTE: Preservando usuários, provedores e planos de assinatura");
      
      // Usar diretamente as funções do Drizzle ORM
      try {
        // Capturar a contagem inicial de planos de assinatura
        const initialPlanCount = await db.select({ count: sql`count(*)` }).from(subscriptionPlans);
        console.log(`INICIAL: ${initialPlanCount[0]?.count || 0} planos de assinatura existentes`);
        
        // Salvar os planos de assinatura existentes antes da limpeza
        const existingPlans = await db.select().from(subscriptionPlans);
        console.log(`Backup de ${existingPlans.length} planos de assinatura realizado`);
        
        // Tabelas que serão limpas em ordem específica para evitar problemas de chave estrangeira
        const tablesToClean = [
          // Primeiro limpar tabelas que dependem de outras
          { name: "notificações", table: notifications },
          { name: "agendamentos", table: appointments },
          { name: "associações entre provedores e clientes", table: providerClients },
          { name: "transações de assinatura", table: subscriptionTransactions },
          // Depois limpar tabelas independentes
          { name: "clientes", table: clients },
          { name: "serviços", table: services },
          { name: "horários de exclusão", table: timeExclusions }
        ];
        
        // Tabelas que serão preservadas explicitamente
        const preservedTables = [
          { name: "usuários", table: users },
          { name: "planos de assinatura", table: subscriptionPlans }
        ];
        
        // Função auxiliar para executar exclusão com tratamento de erro
        const deleteTable = async (tableName: string, table: any) => {
          try {
            console.log(`Limpando ${tableName}...`);
            const result = await db.delete(table);
            console.log(`${tableName} removidos com sucesso. Registros afetados:`, result);
            return true;
          } catch (error) {
            console.error(`ERRO ao limpar ${tableName}:`, error);
            return false;
          }
        };
        
        // Verificar contagem antes da limpeza
        for (const { name, table } of [...tablesToClean, ...preservedTables]) {
          const count = await db.select({ count: sql`count(*)` }).from(table);
          console.log(`Antes da limpeza: ${count[0]?.count || 0} registros em ${name}`);
        }
        
        // Executar as exclusões apenas nas tabelas que devem ser limpas
        for (const { name, table } of tablesToClean) {
          await deleteTable(name, table);
        }
        
        // Verificar contagem após a limpeza
        for (const { name, table } of [...tablesToClean, ...preservedTables]) {
          const count = await db.select({ count: sql`count(*)` }).from(table);
          console.log(`Após limpeza: ${count[0]?.count || 0} registros em ${name}`);
        }
        
        // Verificar especificamente os planos de assinatura para garantir que não foram afetados
        const finalPlanCount = await db.select({ count: sql`count(*)` }).from(subscriptionPlans);
        console.log(`CONFIRMAÇÃO: ${finalPlanCount[0]?.count || 0} planos de assinatura preservados`);
        
        // Verificar se os planos foram preservados
        if (Number(finalPlanCount[0]?.count) !== existingPlans.length) {
          console.error(`ALERTA: Contagem de planos de assinatura mudou! Inicial: ${existingPlans.length}, Final: ${finalPlanCount[0]?.count}`);
          
          // Restaurar os planos de assinatura se foram perdidos
          if (Number(finalPlanCount[0]?.count) < existingPlans.length) {
            console.log("Tentando restaurar planos de assinatura perdidos...");
            
            // Obter os planos atuais para não duplicar
            const currentPlans = await db.select().from(subscriptionPlans);
            const currentPlanIds = currentPlans.map(p => p.id);
            
            // Restaurar apenas os planos que não existem mais
            for (const plan of existingPlans) {
              if (!currentPlanIds.includes(plan.id)) {
                try {
                  await db.insert(subscriptionPlans).values(plan);
                  console.log(`Plano restaurado: ${plan.name} (ID: ${plan.id})`);
                } catch (restoreError) {
                  console.error(`Erro ao restaurar plano ${plan.id}:`, restoreError);
                }
              }
            }
            
            // Verificar novamente após a restauração
            const restoredCount = await db.select({ count: sql`count(*)` }).from(subscriptionPlans);
            console.log(`Após restauração: ${restoredCount[0]?.count || 0} planos de assinatura`);
          }
        }
        
        // Envia notificação em tempo real
        broadcastUpdate('database_cleared', { message: 'Banco de dados limpo com sucesso' });
        
        res.status(200).json({ 
          success: true, 
          message: "Banco de dados limpo com sucesso. As tabelas de usuários e planos de assinatura foram preservadas." 
        });
      } catch (dbError: any) {
        console.error("Erro nas operações do banco:", dbError);
        throw new Error(`Erro nas operações de banco de dados: ${dbError.message || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error("Erro ao limpar banco de dados:", error);
      res.status(500).json({ error: "Falha ao limpar banco de dados" });
    }
  });
  
  // Rotas para gerenciar planos de assinatura
  // Listar todos os planos
  app.get("/api/admin/subscription/plans", isAdmin, async (req: Request, res: Response) => {
    try {
      const plans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.name);
      res.json(plans);
    } catch (error: any) {
      console.error("Erro ao buscar planos de assinatura:", error);
      res.status(500).json({ error: "Falha ao buscar planos de assinatura" });
    }
  });

  // Obter um plano específico
  app.get("/api/admin/subscription/plans/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      
      if (!plan || plan.length === 0) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }
      
      res.json(plan[0]);
    } catch (error: any) {
      console.error("Erro ao buscar plano de assinatura:", error);
      res.status(500).json({ error: "Falha ao buscar plano de assinatura" });
    }
  });

  // Criar novo plano
  app.post("/api/admin/subscription/plans", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, description, durationMonths, price, isActive, accountType } = req.body;
      
      // Validar dados
      if (!name || !durationMonths || price === undefined) {
        return res.status(400).json({ error: "Nome, duração e preço são obrigatórios" });
      }

      // Validar accountType
      if (accountType && !['individual', 'company'].includes(accountType)) {
        return res.status(400).json({ error: 'Tipo de conta inválido. Use "individual" ou "company"' });
      }

      // Verificar se já existe um plano com o mesmo nome
      const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.name, name)).limit(1);
      if (existingPlan && existingPlan.length > 0) {
        return res.status(400).json({ error: "Já existe um plano com este nome" });
      }

      // Inserir novo plano
      const result = await db.insert(subscriptionPlans).values({
        name,
        description: description || null,
        durationMonths: parseInt(durationMonths),
        price: parseInt(price),
        isActive: isActive !== undefined ? isActive : true,
        accountType: accountType || 'individual',
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      res.status(201).json(result[0]);
    } catch (error: any) {
      console.error("Erro ao criar plano de assinatura:", error);
      res.status(500).json({ error: "Falha ao criar plano de assinatura" });
    }
  });

  // Atualizar plano existente
  app.put("/api/admin/subscription/plans/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const { name, description, durationMonths, price, isActive, accountType } = req.body;
      
      // Validar dados
      if (!name || !durationMonths || price === undefined) {
        return res.status(400).json({ error: "Nome, duração e preço são obrigatórios" });
      }

      // Validar accountType se fornecido
      if (accountType && !['individual', 'company'].includes(accountType)) {
        return res.status(400).json({ error: 'Tipo de conta inválido. Use "individual" ou "company"' });
      }

      // Verificar se o plano existe
      const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      if (!existingPlan || existingPlan.length === 0) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }

      // Verificar se já existe outro plano com o mesmo nome (exceto o atual)
      const duplicatePlan = await db.select().from(subscriptionPlans)
        .where(and(eq(subscriptionPlans.name, name), ne(subscriptionPlans.id, planId)))
        .limit(1);
        
      if (duplicatePlan && duplicatePlan.length > 0) {
        return res.status(400).json({ error: "Já existe outro plano com este nome" });
      }

      // Atualizar plano
      const result = await db.update(subscriptionPlans)
        .set({
          name,
          description: description || null,
          durationMonths: parseInt(durationMonths),
          price: parseInt(price),
          isActive: isActive !== undefined ? isActive : true,
          accountType: accountType || existingPlan[0].accountType,
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, planId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Erro ao atualizar plano de assinatura:", error);
      res.status(500).json({ error: "Falha ao atualizar plano de assinatura" });
    }
  });

  // Atualizar apenas o preço do plano
  app.patch("/api/admin/subscription/plans/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      const { price } = req.body;
      if (price === undefined) {
        return res.status(400).json({ error: "Preço é obrigatório" });
      }

      // Verificar se o plano existe
      const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      if (!existingPlan || existingPlan.length === 0) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }

      // Atualizar apenas o preço
      const result = await db.update(subscriptionPlans)
        .set({
          price: parseInt(price),
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, planId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Erro ao atualizar preço do plano:", error);
      res.status(500).json({ error: "Falha ao atualizar preço do plano" });
    }
  });

  // Alternar status ativo/inativo do plano
  app.patch("/api/admin/subscription/plans/:id/toggle-active", isAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      // Verificar se o plano existe e obter status atual
      const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      if (!existingPlan || existingPlan.length === 0) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }

      // Inverter o status atual
      const newStatus = !existingPlan[0].isActive;

      // Atualizar status
      const result = await db.update(subscriptionPlans)
        .set({
          isActive: newStatus,
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, planId))
        .returning();

      res.json(result[0]);
    } catch (error: any) {
      console.error("Erro ao alternar status do plano:", error);
      res.status(500).json({ error: "Falha ao alternar status do plano" });
    }
  });

  // Excluir plano
  app.delete("/api/admin/subscription/plans/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const planId = parseInt(req.params.id);
      if (isNaN(planId)) {
        return res.status(400).json({ error: "ID inválido" });
      }

      // Verificar se o plano existe
      const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      if (!existingPlan || existingPlan.length === 0) {
        return res.status(404).json({ error: "Plano não encontrado" });
      }

      // Verificar se existem transações associadas a este plano
      const transactions = await db.select({ count: sql`count(*)` })
        .from(subscriptionTransactions)
        .where(eq(subscriptionTransactions.planId, planId));
      
      const transactionCount = Number(transactions[0]?.count || 0);
      if (transactionCount > 0) {
        return res.status(400).json({ 
          error: "Não é possível excluir este plano pois existem transações associadas a ele",
          transactionCount: transactionCount
        });
      }

      // Excluir plano
      await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, planId));

      res.json({ success: true, message: "Plano excluído com sucesso" });
    } catch (error: any) {
      console.error("Erro ao excluir plano de assinatura:", error);
      res.status(500).json({ error: "Falha ao excluir plano de assinatura" });
    }
  });

  app.post("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, username, password, role, email } = req.body;
      
      // Validar dados
      if (!name || !username || !password || !role) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }
      
      // Usar o email fornecido ou gerar um temporário baseado no nome de usuário
      const userEmail = email || `${username}@temp.com`;
      
      // Criar o usuário com senha hasheada
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        username,
        email: userEmail,
        password: hashedPassword,
        role,
        isEmailVerified: true, // Usuários criados pelo admin já são verificados
      });
      
      console.log(`Usuário criado pelo administrador: ${username} (${email}). Email já verificado.`);
      
      // Se for um usuário do tipo provider, criar também um provider associado
      if (role === 'provider') {
        try {
          // Gerar um link de agendamento único baseado no nome de usuário
          const bookingLink = username.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Criar provider associado ao usuário
          const provider = await storage.createProvider({
            userId: user.id,
            name: `${name}'s Service`,
            email: userEmail, // Usar o mesmo email do usuário
            phone: "",
            bookingLink,
            workingHoursStart: 8, // Horário padrão de início (8h)
            workingHoursEnd: 18,  // Horário padrão de término (18h)
          });
          
          console.log(`Provider criado para usuário ${user.id} com link de agendamento: ${bookingLink}`);
        } catch (providerError) {
          console.error("Erro ao criar provider para o usuário:", providerError);
          // Não interrompemos o fluxo se falhar a criação do provider
        }
      }
      
      // Retornar o usuário criado (sem a senha)
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  });
  
  // Rota para atualizar um usuário existente (apenas Admin)
  app.put("/api/admin/users/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }
      
      // Impedir alteração do usuário admin principal (ID 1)
      if (id === 1) {
        return res.status(403).json({ error: "Não é permitido modificar o usuário administrador principal" });
      }
      
      // Buscar o usuário existente
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const { name, username, email, password, role } = req.body;
      const updateData: Partial<{ name: string, username: string, email: string, password: string, role: string, isEmailVerified: boolean }> = {
        // Garantir que usuários editados pelo admin permaneçam com email verificado
        isEmailVerified: true
      };
      
      // Validar e adicionar campos a serem atualizados
      if (name) updateData.name = name;
      
      if (username && username !== existingUser.username) {
        // Verificar se o novo nome de usuário já existe
        const existingUsername = await storage.getUserByUsername(username);
        if (existingUsername && existingUsername.id !== id) {
          return res.status(400).json({ error: "Nome de usuário já existe" });
        }
        updateData.username = username;
      }
      
      if (email) updateData.email = email;
      
      if (role) updateData.role = role;
      
      // Se uma nova senha foi fornecida, hashear e atualizar
      if (password) {
        updateData.password = await hashPassword(password);
      }
      
      // Atualizar usuário
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao atualizar usuário" });
      }
      
      // Retornar o usuário atualizado (sem a senha)
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
  });
  
  // Rota para excluir um usuário (apenas Admin)
  app.delete("/api/admin/users/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }
      
      // Impedir exclusão do usuário admin principal (ID 1)
      if (id === 1) {
        return res.status(403).json({ error: "Não é permitido excluir o usuário administrador principal" });
      }
      
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Excluir o usuário
      const success = await storage.deleteUser(id);
      if (!success) {
        return res.status(500).json({ error: "Falha ao excluir usuário" });
      }
      
      res.status(200).json({ success: true, message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ error: "Erro ao excluir usuário" });
    }
  });
  
  // Rota para bloquear/desbloquear usuário (apenas Admin)
  app.patch("/api/admin/users/:id/toggle-active", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }
      
      // Impedir bloqueio do usuário admin principal (ID 1)
      if (id === 1) {
        return res.status(403).json({ error: "Não é permitido bloquear o usuário administrador principal" });
      }
      
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const { active } = req.body;
      if (typeof active !== 'boolean') {
        return res.status(400).json({ error: "O parâmetro 'active' é obrigatório e deve ser um booleano" });
      }
      
      // Atualizar o usuário
      const updatedUser = await storage.updateUser(id, { 
        isActive: active,
        isEmailVerified: true // Garantir que usuários gerenciados pelo admin permaneçam com email verificado
      });
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao atualizar o status do usuário" });
      }
      
      const action = active ? "ativado" : "bloqueado";
      
      // Notificar via WebSocket
      broadcastUpdate('user-updated', updatedUser);
      
      res.status(200).json({ 
        success: true, 
        message: `Usuário ${action} com sucesso`,
        user: updatedUser
      });
    } catch (error) {
      console.error("Erro ao atualizar status do usuário:", error);
      res.status(500).json({ error: "Falha ao atualizar status do usuário" });
    }
  });

  // Rotas para simulação de usuário (impersonation)
  
  // Iniciar simulação de usuário
  app.post("/api/admin/impersonate/:userId", isAdmin, async (req: Request, res: Response) => {
    try {
      const targetUserId = parseInt(req.params.userId);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }

      // Verificar se o usuário alvo existe
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Impedir simulação do próprio admin
      if (targetUserId === req.user?.id) {
        return res.status(400).json({ error: "Não é possível simular seu próprio usuário" });
      }

      // Salvar o ID do admin original na sessão
      if (!req.session.originalAdminId) {
        req.session.originalAdminId = req.user?.id;
      }

      // Definir o usuário simulado na sessão
      req.session.impersonatedUserId = targetUserId;
      
      // Salvar a sessão
      req.session.save((err) => {
        if (err) {
          console.error("Erro ao salvar sessão de simulação:", err);
          return res.status(500).json({ error: "Erro ao iniciar simulação" });
        }

        res.json({ 
          success: true, 
          message: `Simulação iniciada para usuário ${targetUser.name}`,
          impersonatedUser: {
            id: targetUser.id,
            name: targetUser.name,
            username: targetUser.username,
            role: targetUser.role
          }
        });
      });
    } catch (error) {
      console.error("Erro ao iniciar simulação:", error);
      res.status(500).json({ error: "Erro ao iniciar simulação" });
    }
  });

  // Parar simulação de usuário
  app.post("/api/admin/stop-impersonation", isAdmin, async (req: Request, res: Response) => {
    try {
      // Verificar se há uma simulação ativa
      if (!req.session.impersonatedUserId || !req.session.originalAdminId) {
        return res.status(400).json({ error: "Nenhuma simulação ativa" });
      }

      // Limpar dados de simulação da sessão
      delete req.session.impersonatedUserId;
      delete req.session.originalAdminId;
      
      // Salvar a sessão
      req.session.save((err) => {
        if (err) {
          console.error("Erro ao salvar sessão ao parar simulação:", err);
          return res.status(500).json({ error: "Erro ao parar simulação" });
        }

        res.json({ 
          success: true, 
          message: "Simulação encerrada com sucesso"
        });
      });
    } catch (error) {
      console.error("Erro ao parar simulação:", error);
      res.status(500).json({ error: "Erro ao parar simulação" });
    }
  });

  // Verificar status de simulação
  app.get("/api/admin/impersonation-status", isAdmin, async (req: Request, res: Response) => {
    try {
      const isImpersonating = !!(req.session.impersonatedUserId && req.session.originalAdminId);
      
      if (isImpersonating) {
        const impersonatedUser = req.session.impersonatedUserId ? await storage.getUser(req.session.impersonatedUserId) : null;
        const originalAdmin = req.session.originalAdminId ? await storage.getUser(req.session.originalAdminId) : null;
        
        res.json({
          isImpersonating: true,
          impersonatedUser: impersonatedUser ? {
            id: impersonatedUser.id,
            name: impersonatedUser.name,
            username: impersonatedUser.username,
            role: impersonatedUser.role
          } : null,
          originalAdmin: originalAdmin ? {
            id: originalAdmin.id,
            name: originalAdmin.name,
            username: originalAdmin.username
          } : null
        });
      } else {
        res.json({ isImpersonating: false });
      }
    } catch (error) {
      console.error("Erro ao verificar status de simulação:", error);
      res.status(500).json({ error: "Erro ao verificar status de simulação" });
    }
  });
  
  // Rota para gerenciar assinatura de usuário (apenas Admin)
  app.patch("/api/admin/users/:id/subscription", isAdmin, async (req: Request, res: Response) => {
    try {
      console.log("Recebida solicitação para atualizar assinatura:", {
        params: req.params,
        body: req.body
      });
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de usuário inválido" });
      }
      
      // Verificar se o usuário existe
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      const { neverExpires, extensionMonths, specificDate, method } = req.body;
      console.log("Dados extraídos:", { neverExpires, extensionMonths, specificDate, method });
      
      // Validar os dados da assinatura
      if (neverExpires === undefined && method === undefined) {
        return res.status(400).json({ 
          error: "Deve fornecer pelo menos um parâmetro: neverExpires ou método de extensão" 
        });
      }
      
      // Preparar os dados para atualização
      const updateData: Partial<any> = {
        // Garantir que usuários com assinatura gerenciada pelo admin permaneçam com email verificado
        isEmailVerified: true
      };
      
      if (neverExpires !== undefined) {
        updateData.neverExpires = neverExpires;
        
        // Se neverExpires for true, limpar subscriptionExpiry
        if (neverExpires === true) {
          updateData.subscriptionExpiry = null;
        }
      }
      
      if (!neverExpires && method) {
        if (method === 'extension' && extensionMonths !== undefined) {
          // Validar extensionMonths
          const months = parseInt(extensionMonths);
          if (isNaN(months) || months < 1 || months > 36) {
            return res.status(400).json({ 
              error: "Meses de extensão deve ser um número entre 1 e 36" 
            });
          }
          
          // Calcular nova data de expiração
          let baseDate = new Date();
          
          // Se o usuário já tiver uma data de expiração no futuro, usar essa como base
          if (existingUser.subscriptionExpiry) {
            const currentExpiry = new Date(existingUser.subscriptionExpiry);
            if (currentExpiry > baseDate) {
              baseDate = currentExpiry;
            }
          }
          
          // Adicionar os meses de extensão
          const newExpiryDate = new Date(baseDate);
          newExpiryDate.setMonth(newExpiryDate.getMonth() + months);
          
          updateData.subscriptionExpiry = newExpiryDate;
        } 
        else if (method === 'specific_date' && specificDate) {
          // Validar data específica
          const dateObj = new Date(specificDate);
          console.log(`Data específica: ${specificDate}, objeto de data: ${dateObj}, é válida: ${!isNaN(dateObj.getTime())}`);
          
          if (isNaN(dateObj.getTime())) {
            return res.status(400).json({ 
              error: "Data de expiração inválida" 
            });
          }
          
          // Remover completamente verificação de data no passado
          const isInThePast = dateObj < new Date();
          console.log(`A data ${dateObj} está no passado? ${isInThePast}`);
          
          // Definir hora para o final do dia
          dateObj.setHours(23, 59, 59, 999);
          console.log(`Data final configurada: ${dateObj}`);
          
          updateData.subscriptionExpiry = dateObj;
        }
        else {
          return res.status(400).json({ 
            error: "Parâmetros inválidos para o método selecionado" 
          });
        }
      }
      
      // Atualizar o usuário
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(500).json({ error: "Falha ao atualizar a assinatura do usuário" });
      }
      
      // Notificar via WebSocket
      broadcastUpdate('user-updated', updatedUser);
      
      // Retornar o usuário atualizado (sem a senha)
      const { password: _, ...userWithoutPassword } = updatedUser;
      
      res.status(200).json({ 
        success: true, 
        message: `Assinatura atualizada com sucesso`,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error("Erro ao atualizar assinatura do usuário:", error);
      res.status(500).json({ error: "Falha ao atualizar assinatura do usuário" });
    }
  });

  // Provider routes
  app.get("/api/providers", async (req: Request, res: Response) => {
    const providers = await storage.getProviders();
    res.json(providers);
  });
  
  // Rota para criar um novo provider (usado quando usuários precisam criar seu próprio perfil)
  app.post("/api/providers", async (req: Request, res: Response) => {
    try {
      // Verificar autenticação
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Não autenticado" });
      }
      
      // Verificar se o usuário atual já tem um provider
      const existingProvider = await storage.getProviderByUserId(req.user.id);
      if (existingProvider) {
        return res.status(400).json({ 
          error: "Perfil já existe", 
          message: "Você já possui um perfil de prestador configurado",
          provider: existingProvider
        });
      }
      
      // Validar os dados do body
      const providerData = insertProviderSchema.parse({
        ...req.body,
        userId: req.user.id // Garantir que o userId seja o do usuário atual
      });
      
      // Criar o provider
      const newProvider = await storage.createProvider(providerData);
      
      // Opcionalmente criar um serviço de exemplo
      try {
        const exampleService = {
          providerId: newProvider.id,
          name: "Serviço de Exemplo",
          description: "Este é um serviço de exemplo. Edite ou exclua conforme necessário.",
          duration: 60, // 60 minutos
          price: 10000, // R$ 100,00 (em centavos)
          active: true
        };
        
        await storage.createService(exampleService);
        console.log(`Serviço de exemplo criado para novo prestador: ${newProvider.id}`);
      } catch (serviceError) {
        console.error("Erro ao criar serviço de exemplo:", serviceError);
        // Continua mesmo com erro no serviço
      }
      
      // Retornar o provider criado
      res.status(201).json(newProvider);
    } catch (error) {
      console.error('Erro ao criar provider:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      
      res.status(500).json({ message: "Falha ao criar perfil de prestador" });
    }
  });

  app.get("/api/providers/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const provider = await storage.getProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    
    res.json(provider);
  });
  
  // Rota para atualizar as configurações do provedor
  app.patch("/api/providers/:id/settings", async (req: Request, res: Response) => {
    // Verificar autenticação
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const provider = await storage.getProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    
    // Verificar se o usuário tem permissão para editar este provider
    // Usar getCurrentUserId para considerar simulação de acesso
    const userId = getCurrentUserId(req);
    
    // Verificar se o provider pertence ao usuário atual (ou simulado)
    if (provider.userId !== userId) {
      return res.status(403).json({ 
        error: "Acesso não autorizado", 
        message: "Você não tem permissão para editar as configurações deste prestador" 
      });
    }
    
    try {
      // Extrair os campos da requisição
      const { 
        workingHoursStart, 
        workingHoursEnd, 
        workingDays, 
        phone,
        // Campos de configuração PIX
        pixEnabled,
        pixKeyType,
        pixKey,
        pixCompanyName,
        pixRequirePayment,
        pixPaymentPercentage,
        // Templates de mensagens WhatsApp
        whatsappTemplateAppointment
      } = req.body;
      
      // Validar workingHoursStart se fornecido
      if (workingHoursStart !== undefined) {
        if (typeof workingHoursStart !== 'number') {
          return res.status(400).json({ 
            message: "Invalid data type",
            errors: ["workingHoursStart must be a number"]
          });
        }
        
        if (workingHoursStart < 0 || workingHoursStart > 23) {
          return res.status(400).json({ 
            message: "Invalid hour range",
            errors: ["workingHoursStart must be between 0-23"]
          });
        }
      }
      
      // Validar workingHoursEnd se fornecido
      if (workingHoursEnd !== undefined) {
        if (typeof workingHoursEnd !== 'number') {
          return res.status(400).json({ 
            message: "Invalid data type",
            errors: ["workingHoursEnd must be a number"]
          });
        }
        
        if (workingHoursEnd < 1 || workingHoursEnd > 24) {
          return res.status(400).json({ 
            message: "Invalid hour range",
            errors: ["workingHoursEnd must be between 1-24"]
          });
        }
      }
      
      // Validar a relação entre os horários apenas se ambos forem fornecidos
      if (workingHoursStart !== undefined && workingHoursEnd !== undefined) {
        if (workingHoursEnd <= workingHoursStart) {
          return res.status(400).json({ 
            message: "Invalid hour range",
            errors: ["workingHoursEnd must be greater than workingHoursStart"]
          });
        }
      }
      
      // Validar campos do PIX se ele estiver habilitado
      if (pixEnabled === true) {
        if (!pixKeyType || !pixKey) {
          return res.status(400).json({
            message: "Missing PIX configuration",
            errors: ["PIX key type and PIX key are required when PIX is enabled"]
          });
        }
        
        // Validar porcentagem de pagamento se for informada
        if (pixPaymentPercentage !== undefined && 
            (typeof pixPaymentPercentage !== 'number' || 
             pixPaymentPercentage < 1 || 
             pixPaymentPercentage > 100)) {
          return res.status(400).json({
            message: "Invalid payment percentage",
            errors: ["Payment percentage must be a number between 1 and 100"]
          });
        }
      }
      
      // Validação dos dias de trabalho (se fornecido)
      if (workingDays !== undefined) {
        if (typeof workingDays !== 'string') {
          return res.status(400).json({
            message: "Invalid working days format",
            errors: ["workingDays must be a string of comma-separated numbers (1-7)"]
          });
        }
        
        // Verificar se o formato é válido (números de 1 a 7 separados por vírgula)
        const daysArray = workingDays.split(',');
        const isValidFormat = daysArray.every(day => {
          const num = parseInt(day.trim());
          return !isNaN(num) && num >= 1 && num <= 7;
        });
        
        if (!isValidFormat) {
          return res.status(400).json({
            message: "Invalid working days values",
            errors: ["Each day must be a number between 1 and 7 (1=Monday, 7=Sunday)"]
          });
        }
      }
      
      // Preparar o objeto com os dados para atualização
      const providerData: Partial<InsertProvider> = {};
      
      // Adicionar horários apenas se fornecidos
      if (workingHoursStart !== undefined) {
        providerData.workingHoursStart = workingHoursStart;
      }
      
      if (workingHoursEnd !== undefined) {
        providerData.workingHoursEnd = workingHoursEnd;
      }
      
      // Adicionar workingDays ao update se fornecido
      if (workingDays !== undefined) {
        providerData.workingDays = workingDays;
      }
      
      // Adicionar o número de telefone/WhatsApp se fornecido
      if (phone !== undefined) {
        providerData.phone = phone;
      }
      
      // Adicionar configurações de PIX se fornecidas
      if (pixEnabled !== undefined) {
        providerData.pixEnabled = pixEnabled;
        
        // Se o PIX estiver habilitado, salvar as informações relacionadas
        if (pixEnabled === true) {
          if (pixKeyType) providerData.pixKeyType = pixKeyType;
          if (pixKey) providerData.pixKey = pixKey;
          if (pixCompanyName) providerData.pixCompanyName = pixCompanyName;
          if (pixRequirePayment !== undefined) providerData.pixRequirePayment = pixRequirePayment;
          if (pixPaymentPercentage) providerData.pixPaymentPercentage = pixPaymentPercentage;
        }
      }
      
      // Adicionar configurações do Mercado Pago se fornecidas
      if (req.body.pixMercadoPagoToken !== undefined) {
        providerData.pixMercadoPagoToken = req.body.pixMercadoPagoToken;
      }
      
      if (req.body.pixIdentificationNumber !== undefined) {
        providerData.pixIdentificationNumber = req.body.pixIdentificationNumber;
      }
      
      // Adicionar template de mensagem WhatsApp se fornecido
      if (req.body.whatsappTemplateAppointment !== undefined) {
        // Garantir que mesmo que seja uma string vazia, será salvo corretamente
        // Usando type assertion para contornar a limitação do schema de inserção
        (providerData as any).whatsappTemplateAppointment = req.body.whatsappTemplateAppointment;
      }
      
      // Removendo dados sensíveis do log, mas mostrando quais campos estão sendo atualizados
      const fieldsToUpdate = Object.keys(providerData);
      console.log(`Atualizando provedor ${id} com campos:`, fieldsToUpdate);
      
      if (fieldsToUpdate.includes('pixMercadoPagoToken')) {
        console.log("Incluindo token do Mercado Pago na atualização (valor mascarado por segurança)");
      }
      
      if (fieldsToUpdate.includes('pixIdentificationNumber')) {
        console.log("Incluindo CPF/CNPJ na atualização (valor mascarado por segurança)");
      }
      
      const updatedProvider = await storage.updateProvider(id, providerData);
      if (!updatedProvider) {
        return res.status(500).json({ message: "Falha ao atualizar as configurações do provedor" });
      }
      
      console.log("Provider atualizado com sucesso:", {
        id: updatedProvider.id,
        pixEnabled: updatedProvider.pixEnabled,
        hasMercadoPagoToken: !!updatedProvider.pixMercadoPagoToken,
        hasIdentificationNumber: !!updatedProvider.pixIdentificationNumber
      });
      
      res.json(updatedProvider);
    } catch (error) {
      console.error("Error updating provider settings:", error);
      res.status(500).json({ message: "Failed to update provider settings" });
    }
  });

  // Service routes
  app.get("/api/providers/:providerId/services", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const services = await storage.getServices(providerId);
    res.json(services);
  });
  
  // Rota para obter os serviços do profissional autenticado
  app.get("/api/my-services", loadUserProvider, async (req: Request, res: Response) => {
    const provider = (req as any).provider;
    const services = await storage.getServices(provider.id);
    res.json(services);
  });

  app.post("/api/services", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const provider = (req as any).provider;
      
      // Garantir que o serviço está sendo criado para o provider do usuário logado
      const data = insertServiceSchema.parse({
        ...req.body,
        providerId: provider.id // Sobrescrever o providerId com o ID do provider do usuário logado
      });
      
      const service = await storage.createService(data);
      res.status(201).json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", loadUserProvider, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    
    try {
      const provider = (req as any).provider;
      
      // Verifica se o serviço pertence ao provider do usuário
      const existingService = await storage.getService(id);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      if (existingService.providerId !== provider.id) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para editar este serviço" 
        });
      }
      
      // Não permite alterar o providerId
      const data = insertServiceSchema.partial().parse({
        ...req.body,
        providerId: provider.id // Garante que o providerId não é alterado
      });
      
      const service = await storage.updateService(id, data);
      
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.json(service);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid service data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", loadUserProvider, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid service ID" });
    }
    
    try {
      const provider = (req as any).provider;
      
      // Verifica se o serviço pertence ao provider do usuário
      const existingService = await storage.getService(id);
      if (!existingService) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      if (existingService.providerId !== provider.id) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para excluir este serviço" 
        });
      }
      
      const success = await storage.deleteService(id);
      if (!success) {
        return res.status(404).json({ message: "Service not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      res.status(500).json({ message: "Falha ao excluir serviço" });
    }
  });

  // Client routes
  app.get("/api/clients", loadUserProvider, async (req: Request, res: Response) => {
    // Obter somente os clientes associados a este provider
    const provider = (req as any).provider;
    const clients = await storage.getClientsByProvider(provider.id);
    res.json(clients);
  });

  app.get("/api/clients/:id", loadUserProvider, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid client ID" });
    }
    
    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    // Verificar se o cliente pertence a este provider usando a associação direta
    const provider = (req as any).provider;
    const clientBelongsToProvider = await storage.clientBelongsToProvider(provider.id, client.id);
    
    if (!clientBelongsToProvider) {
      return res.status(403).json({ 
        error: "Acesso não autorizado", 
        message: "Você não tem permissão para acessar este cliente" 
      });
    }
    
    res.json(client);
  });

  app.post("/api/clients", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const data = insertClientSchema.parse(req.body);
      const provider = (req as any).provider;
      
      // Check if client already exists with this phone number
      const existingClient = await storage.getClientByPhone(data.phone);
      if (existingClient) {
        console.log(`Cliente existente encontrado pelo telefone: ${data.phone}, ID: ${existingClient.id}`);
        
        // Sempre tenta associar o cliente existente a este provider para garantir
        try {
          // Verifica se já existe associação direta (não usa clientBelongsToProvider)
          const [association] = await db
            .select()
            .from(providerClients)
            .where(
              and(
                eq(providerClients.providerId, provider.id),
                eq(providerClients.clientId, existingClient.id)
              )
            );
            
          if (!association) {
            await storage.associateClientWithProvider(provider.id, existingClient.id);
            console.log(`Cliente existente #${existingClient.id} associado ao provider #${provider.id}`);
          } else {
            console.log(`Cliente #${existingClient.id} já está associado ao provider #${provider.id}`);
          }
        } catch (err) {
          console.error("Erro ao associar cliente existente:", err);
          // Sempre tenta criar a associação, mesmo se houver erro na verificação
          try {
            await storage.associateClientWithProvider(provider.id, existingClient.id);
          } catch (err2) {
            console.error("Segundo erro ao associar cliente:", err2);
          }
        }
        
        return res.json(existingClient);
      }
      
      // Criar o cliente
      const client = await storage.createClient(data);
      console.log(`Novo cliente criado: ${client.name} (ID: ${client.id})`);
      
      // Associar o cliente diretamente ao provider usando a tabela de associação
      // Tenta várias vezes para garantir que a associação seja criada
      let associationSuccess = false;
      for (let attempt = 0; attempt < 3 && !associationSuccess; attempt++) {
        try {
          await storage.associateClientWithProvider(provider.id, client.id);
          console.log(`Novo cliente #${client.id} associado ao provider #${provider.id}`);
          associationSuccess = true;
        } catch (err) {
          console.error(`Erro ao associar cliente ao provider (tentativa ${attempt + 1}):`, err);
          // Pequena pausa antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (!associationSuccess) {
        console.warn(`Não foi possível associar o cliente #${client.id} ao provider #${provider.id} após múltiplas tentativas`);
      }
      
      res.status(201).json(client);
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid client data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create client" });
    }
  });
  
  // Rota para atualizar cliente
  app.put("/api/clients/:id", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID do cliente inválido" });
      }
      
      // Verifica se o cliente existe
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verifica se o cliente pertence a este provider
      const provider = (req as any).provider;
      // Usando associação direta em vez de buscar todos os clientes
      const clientBelongsToProvider = await storage.clientBelongsToProvider(provider.id, client.id);
      
      if (!clientBelongsToProvider) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para atualizar este cliente" 
        });
      }
      
      // Validar dados
      const data = insertClientSchema.partial().parse(req.body);
      
      // Atualizar cliente
      const updatedClient = await storage.updateClient(id, data);
      
      // Responder com o cliente atualizado
      res.json(updatedClient);
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados do cliente inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Falha ao atualizar cliente" });
    }
  });
  
  // Rota para bloquear/desbloquear cliente
  app.patch("/api/clients/:id/block", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID do cliente inválido" });
      }
      
      // Verifica se o cliente existe
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verifica se o cliente pertence a este provider
      const provider = (req as any).provider;
      const clientBelongsToProvider = await storage.clientBelongsToProvider(provider.id, client.id);
      
      if (!clientBelongsToProvider) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para modificar este cliente" 
        });
      }
      
      const { blocked } = req.body;
      if (typeof blocked !== 'boolean') {
        return res.status(400).json({ message: "Parâmetro 'blocked' inválido" });
      }
      
      // Atualiza o status de bloqueio do cliente
      const updatedClient = await storage.updateClient(id, { isBlocked: blocked });
      
      const action = blocked ? "bloqueado" : "desbloqueado";
      res.json({ 
        success: true, 
        message: `Cliente ${action} com sucesso`,
        client: updatedClient
      });
      
      // Enviar atualização via WebSocket
      broadcastUpdate('client-updated', updatedClient);
      
    } catch (error) {
      console.error('Erro ao bloquear/desbloquear cliente:', error);
      res.status(500).json({ message: "Falha ao atualizar status do cliente" });
    }
  });

  // Rota para excluir cliente permanentemente
  app.delete("/api/clients/:id", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID do cliente inválido" });
      }
      
      // Verifica se o cliente existe
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      
      // Verifica se o cliente pertence a este provider
      const provider = (req as any).provider;
      const clientBelongsToProvider = await storage.clientBelongsToProvider(provider.id, client.id);
      
      if (!clientBelongsToProvider) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para excluir este cliente" 
        });
      }
      
      // Verifica se o cliente possui agendamentos futuros
      const currentDate = new Date();
      const futureAppointments = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.clientId, id),
            eq(appointments.providerId, provider.id),
            gt(appointments.date, currentDate),
            sql`${appointments.status} != ${AppointmentStatus.CANCELLED}`
          )
        );
      
      if (futureAppointments.length > 0) {
        return res.status(400).json({ 
          message: "Não é possível excluir um cliente com agendamentos futuros", 
          appointments: futureAppointments.length
        });
      }
      
      // Excluir todos os agendamentos anteriores do cliente com este provider
      await db.delete(appointments)
        .where(
          and(
            eq(appointments.clientId, id),
            eq(appointments.providerId, provider.id)
          )
        );
      
      // Remover a associação entre este provider e o cliente
      await db.delete(providerClients)
        .where(
          and(
            eq(providerClients.clientId, id),
            eq(providerClients.providerId, provider.id)
          )
        );
      
      // Verificar se o cliente ainda está associado a outros providers
      const otherAssociations = await db
        .select()
        .from(providerClients)
        .where(eq(providerClients.clientId, id));
      
      // Se o cliente não está associado a nenhum outro provider, excluí-lo completamente
      if (otherAssociations.length === 0) {
        await db.delete(clients).where(eq(clients.id, id));
        res.json({ success: true, message: "Cliente excluído permanentemente do sistema" });
      } else {
        res.json({ 
          success: true, 
          message: "Cliente removido da sua lista, mas mantido no sistema pois está associado a outros profissionais" 
        });
      }
      
      // Enviar atualização via WebSocket
      broadcastUpdate('client-deleted', { clientId: id, providerId: provider.id });
      
    } catch (error) {
      console.error('Erro ao excluir cliente permanentemente:', error);
      res.status(500).json({ message: "Falha ao excluir cliente" });
    }
  });

  // Employee routes for providers (public route for booking page)
  app.get("/api/providers/:providerId/employees", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    try {
      // Buscar o provider para obter o userId
      const provider = await storage.getProvider(providerId);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      // Buscar funcionários da empresa (usando o userId do provider como companyUserId)
      const employeesResult = await db.select()
        .from(employees)
        .where(and(
          eq(employees.companyUserId, provider.userId),
          eq(employees.isActive, true)
        ))
        .orderBy(employees.name);
      
      res.json(employeesResult);
    } catch (error) {
      console.error("Erro ao buscar funcionários do provider:", error);
      res.status(500).json({ error: "Erro ao buscar funcionários" });
    }
  });

  // Employee services for providers (public route for booking page)
  app.get("/api/providers/:providerId/employees/:employeeId/services", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    const employeeId = parseInt(req.params.employeeId);
    
    if (isNaN(providerId) || isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid provider ID or employee ID" });
    }
    
    try {
      // Buscar o provider para obter o userId
      const provider = await storage.getProvider(providerId);
      if (!provider) {
        return res.status(404).json({ message: "Provider not found" });
      }
      
      // Verificar se o funcionário pertence a este provider
      const [employee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, provider.userId),
          eq(employees.isActive, true)
        ));
        
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      
      // Buscar serviços do funcionário
      const services = await storage.getEmployeeServices(employeeId);
      res.json(services);
    } catch (error) {
      console.error("Erro ao buscar serviços do funcionário:", error);
      res.status(500).json({ error: "Erro ao buscar serviços do funcionário" });
    }
  });

  // Employee routes (para contas do tipo empresa)
  app.get("/api/employees", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      // Obter ID do usuário correto (considerando simulação)
      const userId = getCurrentUserId(req);
      
      // Buscar dados do usuário para verificar tipo de conta
      const user = await storage.getUser(userId);
      if (!user || user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Parâmetro para filtrar apenas funcionários ativos
      const activeOnly = req.query.active === 'true';
      
      // Buscar funcionários da empresa
      const conditions = [eq(employees.companyUserId, userId)];
      
      // Se activeOnly for true, adiciona filtro para funcionários ativos
      if (activeOnly) {
        conditions.push(eq(employees.isActive, true));
      }
      
      const employeesResult = await db.select()
        .from(employees)
        .where(and(...conditions))
        .orderBy(employees.name);
        
      res.json(employeesResult);
    } catch (error) {
      console.error("Erro ao buscar funcionários:", error);
      res.status(500).json({ error: "Erro ao buscar funcionários" });
    }
  });

  app.post("/api/employees", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      // Obter ID do usuário correto (considerando simulação)
      const userId = getCurrentUserId(req);
      
      // Buscar dados do usuário para verificar tipo de conta
      const user = await storage.getUser(userId);
      if (!user || user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Validar dados do funcionário
      const employeeData = insertEmployeeSchema.parse({
        ...req.body,
        companyUserId: userId
      });
      
      // Criar funcionário
      const [newEmployee] = await db.insert(employees)
        .values(employeeData)
        .returning();
        
      res.status(201).json(newEmployee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("Erro ao criar funcionário:", error);
      res.status(500).json({ error: "Erro ao criar funcionário" });
    }
  });

  app.patch("/api/employees/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "ID de funcionário inválido" });
      }
      
      // Obter ID do usuário correto (considerando simulação)
      const userId = getCurrentUserId(req);
      
      // Buscar dados do usuário para verificar tipo de conta
      const user = await storage.getUser(userId);
      if (!user || user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Verificar se o funcionário pertence à empresa do usuário
      const [existingEmployee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, userId)
        ));
        
      if (!existingEmployee) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      
      // Validar dados de atualização (parcial)
      const updateData = insertEmployeeSchema.partial().parse(req.body);
      
      // Atualizar funcionário
      const [updatedEmployee] = await db.update(employees)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(employees.id, employeeId))
        .returning();
        
      res.json(updatedEmployee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      console.error("Erro ao atualizar funcionário:", error);
      res.status(500).json({ error: "Erro ao atualizar funcionário" });
    }
  });

  app.delete("/api/employees/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "ID de funcionário inválido" });
      }
      
      const user = req.user;
      if (user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Verificar se o funcionário pertence à empresa do usuário
      const [existingEmployee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, user.id)
        ));
        
      if (!existingEmployee) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      
      // Verificar se o funcionário tem agendamentos
      const appointmentsCount = await db.select({ count: sql`count(*)` })
        .from(appointments)
        .where(eq(appointments.employeeId, employeeId));
      
      const hasAppointments = Number(appointmentsCount[0]?.count) > 0;
      
      if (hasAppointments) {
        // Se tem agendamentos, apenas desativar (soft delete)
        await db.update(employees)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(employees.id, employeeId));
          
        res.json({ action: "deactivated", message: "Funcionário desativado devido a agendamentos existentes" });
      } else {
        // Se não tem agendamentos, excluir permanentemente
        await db.delete(employees)
          .where(eq(employees.id, employeeId));
          
        res.json({ action: "deleted", message: "Funcionário excluído permanentemente" });
      }
    } catch (error) {
      console.error("Erro ao excluir funcionário:", error);
      res.status(500).json({ error: "Erro ao excluir funcionário" });
    }
  });

  // Rota para reativar funcionário
  app.patch("/api/employees/:id/reactivate", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "ID de funcionário inválido" });
      }
      
      const user = req.user;
      if (user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Verificar se o funcionário pertence à empresa do usuário
      const [existingEmployee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, user.id)
        ));
        
      if (!existingEmployee) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      
      // Reativar funcionário
      const [reactivatedEmployee] = await db.update(employees)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(employees.id, employeeId))
        .returning();
        
      res.json({ 
        action: "reactivated", 
        message: "Funcionário reativado com sucesso",
        employee: reactivatedEmployee 
      });
    } catch (error) {
      console.error("Erro ao reativar funcionário:", error);
      res.status(500).json({ error: "Erro ao reativar funcionário" });
    }
  });

  // Employee Services routes - Associações entre funcionários e serviços
  app.get("/api/employees/:id/services", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "ID de funcionário inválido" });
      }
      
      // Obter ID do usuário correto (considerando simulação)
      const userId = getCurrentUserId(req);
      
      // Buscar dados do usuário (pode ser simulado)
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      if (user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Verificar se o funcionário pertence à empresa do usuário
      const [existingEmployee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, userId)
        ));
        
      if (!existingEmployee) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      
      const services = await storage.getEmployeeServices(employeeId);
      res.json(services);
    } catch (error) {
      console.error("Erro ao buscar serviços do funcionário:", error);
      res.status(500).json({ error: "Erro ao buscar serviços do funcionário" });
    }
  });

  app.post("/api/employees/:id/services", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "ID de funcionário inválido" });
      }
      
      const { serviceIds } = req.body;
      if (!Array.isArray(serviceIds)) {
        return res.status(400).json({ error: "serviceIds deve ser um array" });
      }
      
      // Obter ID do usuário correto (considerando simulação)
      const userId = getCurrentUserId(req);
      
      // Buscar dados do usuário (pode ser simulado)
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      if (user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Verificar se o funcionário pertence à empresa do usuário
      const [existingEmployee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, userId)
        ));
        
      if (!existingEmployee) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      
      // Verificar se todos os serviços pertencem ao provider do usuário
      const provider = await storage.getProviderByUserId(userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider não encontrado" });
      }
      
      for (const serviceId of serviceIds) {
        const service = await storage.getService(serviceId);
        if (!service || service.providerId !== provider.id) {
          return res.status(400).json({ error: `Serviço ${serviceId} não encontrado ou não pertence a você` });
        }
      }
      
      // Definir os serviços do funcionário
      await storage.setEmployeeServices(employeeId, serviceIds);
      
      // Buscar os serviços atualizados
      const updatedServices = await storage.getEmployeeServices(employeeId);
      
      res.json({ 
        success: true, 
        message: "Serviços do funcionário atualizados com sucesso",
        services: updatedServices
      });
    } catch (error) {
      console.error("Erro ao definir serviços do funcionário:", error);
      res.status(500).json({ error: "Erro ao definir serviços do funcionário" });
    }
  });

  // Employee Appointments - Buscar agendamentos de um funcionário específico
  app.get("/api/employees/:id/appointments", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const employeeId = parseInt(req.params.id);
      if (isNaN(employeeId)) {
        return res.status(400).json({ error: "ID de funcionário inválido" });
      }
      
      // Obter ID do usuário correto (considerando simulação)
      const userId = getCurrentUserId(req);
      
      // Buscar dados do usuário (pode ser simulado)
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      if (user.accountType !== 'company') {
        return res.status(403).json({ error: "Acesso restrito a contas do tipo empresa" });
      }
      
      // Verificar se o funcionário pertence à empresa do usuário
      const [existingEmployee] = await db.select()
        .from(employees)
        .where(and(
          eq(employees.id, employeeId),
          eq(employees.companyUserId, userId)
        ));
        
      if (!existingEmployee) {
        return res.status(404).json({ error: "Funcionário não encontrado" });
      }
      
      // Buscar o provider da empresa
      const provider = await storage.getProviderByUserId(userId);
      if (!provider) {
        return res.status(404).json({ error: "Provider não encontrado" });
      }
      
      // Parâmetro opcional de data (últimos X dias)
      const since = req.query.since as string;
      let dateFilter = undefined;
      
      if (since) {
        try {
          dateFilter = new Date(since);
        } catch (error) {
          return res.status(400).json({ error: "Formato de data inválido" });
        }
      }
      
      // Buscar agendamentos do funcionário usando storage
      const allAppointments = await storage.getAppointments(provider.id);
      
      // Filtrar por funcionário e data
      let employeeAppointments = allAppointments.filter((apt: any) => apt.employeeId === employeeId);
      
      if (dateFilter) {
        employeeAppointments = employeeAppointments.filter((apt: any) => 
          new Date(apt.date) >= dateFilter
        );
      }
      
      // Buscar dados dos clientes e serviços para cada agendamento
      const appointmentsWithDetails = await Promise.all(
        employeeAppointments.map(async (apt: any) => {
          const client = await storage.getClient(apt.clientId);
          const service = await storage.getService(apt.serviceId);
          
          // Corrigir o fuso horário da data para exibição correta
          const appointmentDate = new Date(apt.date);
          
          return {
            ...apt,
            dateTime: appointmentDate, // Usar a data corrigida
            date: appointmentDate, // Manter consistência
            client: client ? {
              id: client.id,
              name: client.name,
              phone: client.phone,
              email: client.email
            } : null,
            service: service ? {
              id: service.id,
              name: service.name,
              duration: service.duration,
              price: service.price
            } : null
          };
        })
      );
      
      // Ordenar por data decrescente
      appointmentsWithDetails.sort((a: any, b: any) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      
      res.json(appointmentsWithDetails);
    } catch (error) {
      console.error("Erro ao buscar agendamentos do funcionário:", error);
      res.status(500).json({ error: "Erro ao buscar agendamentos do funcionário" });
    }
  });

  // Rota para obter o provider do usuário logado
  app.get("/api/my-provider", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      // Usar getCurrentUserId para considerar simulação de acesso
      const userId = getCurrentUserId(req);
      const provider = await storage.getProviderByUserId(userId);
      
      if (!provider) {
        return res.status(404).json({ 
          error: "Perfil de prestador não encontrado", 
          message: "Você não tem um perfil de prestador de serviços configurado."
        });
      }
      
      res.json(provider);
    } catch (error) {
      console.error("Erro ao buscar provider do usuário:", error);
      res.status(500).json({ error: "Erro ao buscar perfil do prestador" });
    }
  });
  
  // Rota para obter link de compartilhamento único do usuário
  app.get("/api/my-booking-link", loadUserProvider, async (req: Request, res: Response) => {
    const provider = (req as any).provider;
    
    // Verifica se o provedor já tem um link de agendamento
    if (!provider.bookingLink) {
      // Se não tiver, atualiza o provider com um bookingLink baseado no nome de usuário
      const user = await storage.getUser(provider.userId);
      if (user) {
        // Certifica-se que o username é usado diretamente, sem caminhos
        const bookingLink = user.username.toLowerCase().replace(/^\/booking\//, '');
        await storage.updateProvider(provider.id, { bookingLink });
        provider.bookingLink = bookingLink;
      }
    }
    
    // URL do link de compartilhamento
    // Certifica-se que bookingLink não comece com '/booking/'
    const linkId = provider.bookingLink ? 
      provider.bookingLink.replace(/^\/booking\//, '') : 
      provider.id.toString();
    
    const bookingPath = `/booking/${linkId}`;
    
    res.json({ 
      bookingLink: bookingPath,
      linkId: linkId,
      fullUrl: `${req.protocol}://${req.get('host')}${bookingPath}`
    });
  });
  
  // Rota para buscar um provider pelo bookingLink
  app.get("/api/providers/booking/:linkId", async (req: Request, res: Response) => {
    const { linkId } = req.params;
    
    try {
      console.log(`Buscando provider pelo linkId: ${linkId}`);
      
      // Tenta primeiro buscar pelo bookingLink direto da tabela (mais eficiente)
      let provider = await storage.getProviderByBookingLink(linkId);
      
      // Se não encontrar, tenta como ID numérico (para compatibilidade)
      if (!provider) {
        const id = parseInt(linkId);
        if (!isNaN(id)) {
          provider = await storage.getProvider(id);
        }
      }
      
      // Se ainda não encontrou, tenta buscar pelo nome de usuário
      if (!provider) {
        try {
          provider = await storage.getProviderByUsername(linkId);
        } catch (err) {
          console.log("Erro ao tentar buscar por username:", err);
        }
      }
      
      if (provider) {
        console.log(`Provider encontrado: ${provider.name} (ID: ${provider.id})`);
        
        // Buscar informações do usuário para incluir o avatar
        const user = await storage.getUser(provider.userId);
        if (user) {
          // Adicionar o avatarUrl do usuário ao provider
          const providerWithAvatar = {
            ...provider,
            avatarUrl: user.avatarUrl
          };
          return res.json(providerWithAvatar);
        }
        
        return res.json(provider);
      }
      
      console.log(`Provider não encontrado para linkId: ${linkId}`);
      return res.status(404).json({ error: "Provider não encontrado" });
    } catch (error) {
      console.error("Erro ao buscar provider por link:", error);
      res.status(500).json({ error: "Erro ao buscar dados do profissional" });
    }
  });

  // Appointment routes - Usando middleware para garantir acesso apenas aos próprios dados
  app.get("/api/my-appointments", loadUserProvider, async (req: Request, res: Response) => {
    const provider = (req as any).provider;
    const providerId = provider.id;
    
    console.log(`🔍 API /my-appointments chamada para providerId: ${providerId}`);
    console.log(`🔍 URL completa: ${req.url}`);
    console.log(`🔍 Headers: ${JSON.stringify(req.headers)}`);
    
    // Parse date filter parameters
    const dateParam = req.query.date as string;
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;
    const statusFilter = req.query.status as string;
    
    console.log(`📅 Parâmetros recebidos:`, {
      dateParam,
      startDateParam,
      endDateParam,
      statusFilter
    });
    
    // Determinar se os agendamentos cancelados devem ser incluídos
    // Se o filtro de status for 'cancelled', precisamos incluir agendamentos cancelados
    // Ou se não houver filtro de status, incluímos todos
    const includeCancelled = !statusFilter || statusFilter === 'all' || statusFilter === AppointmentStatus.CANCELLED;
    
    console.log(`🔧 includeCancelled: ${includeCancelled}`);
    
    let appointments;
    
    if (dateParam) {
      // Cria uma data no formato local (baseada no fuso horário do servidor)
      // usando apenas o ano, mês e dia da data recebida
      const [year, month, day] = dateParam.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      console.log(`🔍 Buscando agendamentos para a data: ${date.toISOString()} (data local: ${date.toString()})`);
      appointments = await storage.getAppointmentsByDate(providerId, date, includeCancelled);
      console.log(`📋 Agendamentos encontrados: ${appointments.length}`);
    } else if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      appointments = await storage.getAppointmentsByDateRange(providerId, startDate, endDate, includeCancelled);
    } else {
      appointments = await storage.getAppointments(providerId, includeCancelled);
    }
    
    // Filtrar por status se um status específico foi solicitado (exceto 'all')
    if (statusFilter && statusFilter !== 'all') {
      appointments = appointments.filter(appointment => appointment.status === statusFilter);
    }
    
    // Enriquecer os agendamentos com informações de cliente, serviço e funcionário
    const enrichedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        // Obter cliente
        const client = await storage.getClient(appointment.clientId);
        
        // Obter serviço
        const service = await storage.getService(appointment.serviceId);
        
        // Obter funcionário (se existir)
        let employeeName = null;
        let employeeSpecialty = null;
        if (appointment.employeeId) {
          try {
            const employee = await storage.getEmployee(appointment.employeeId);
            if (employee) {
              employeeName = employee.name;
              employeeSpecialty = employee.specialty;
            }
          } catch (error) {
            console.error(`Erro ao buscar funcionário ${appointment.employeeId}:`, error);
          }
        }
        
        return {
          ...appointment,
          clientName: client?.name || "Cliente não encontrado",
          serviceName: service?.name || "Serviço não encontrado",
          servicePrice: service?.price || 0,
          serviceDuration: service?.duration || 0,
          employeeName: employeeName,
          employeeSpecialty: employeeSpecialty
        };
      })
    );
    
    // Log especial para agendamentos noturnos
    enrichedAppointments.forEach(apt => {
      const aptDate = new Date(apt.date);
      if (aptDate.getHours() >= 21) {
        console.log(`🌙 AGENDAMENTO NOTURNO ENCONTRADO NO SERVIDOR: ${aptDate.getHours()}:${aptDate.getMinutes().toString().padStart(2, '0')} - ${apt.clientName} - Status: ${apt.status}`);
      }
    });
    
    console.log(`✅ Retornando ${enrichedAppointments.length} agendamentos enriquecidos`);
    
    res.json(enrichedAppointments);
  });
  
  // Manter a rota original para compatibilidade com a API pública
  app.get("/api/providers/:providerId/appointments", async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    // Parse date filter parameters
    const dateParam = req.query.date as string;
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;
    const statusFilter = req.query.status as string;
    
    // Determinar se os agendamentos cancelados devem ser incluídos
    // Se o filtro de status for 'cancelled', precisamos incluir agendamentos cancelados
    // Ou se não houver filtro de status, incluímos todos
    const includeCancelled = !statusFilter || statusFilter === 'all' || statusFilter === AppointmentStatus.CANCELLED;
    
    let appointments;
    
    if (dateParam) {
      // Cria uma data no formato local (baseada no fuso horário do servidor)
      // usando apenas o ano, mês e dia da data recebida
      const [year, month, day] = dateParam.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      
      console.log(`Buscando agendamentos para a data: ${date.toISOString()} (data local: ${date.toString()})`);
      appointments = await storage.getAppointmentsByDate(providerId, date, includeCancelled);
    } else if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      appointments = await storage.getAppointmentsByDateRange(providerId, startDate, endDate, includeCancelled);
    } else {
      appointments = await storage.getAppointments(providerId, includeCancelled);
    }
    
    // Filtrar por status se um status específico foi solicitado (exceto 'all')
    if (statusFilter && statusFilter !== 'all') {
      appointments = appointments.filter(appointment => appointment.status === statusFilter);
    }
    
    // Enriquecer os agendamentos com informações de cliente, serviço e funcionário
    const enrichedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        // Obter cliente
        const client = await storage.getClient(appointment.clientId);
        
        // Obter serviço
        const service = await storage.getService(appointment.serviceId);
        
        // Obter funcionário (se existir)
        let employeeName = null;
        let employeeSpecialty = null;
        if (appointment.employeeId) {
          try {
            const employee = await storage.getEmployee(appointment.employeeId);
            if (employee) {
              employeeName = employee.name;
              employeeSpecialty = employee.specialty;
            }
          } catch (error) {
            console.error(`Erro ao buscar funcionário ${appointment.employeeId}:`, error);
          }
        }
        
        return {
          ...appointment,
          clientName: client?.name || "Cliente não encontrado",
          serviceName: service?.name || "Serviço não encontrado",
          servicePrice: service?.price || 0,
          serviceDuration: service?.duration || 0,
          employeeName: employeeName,
          employeeSpecialty: employeeSpecialty
        };
      })
    );
    
    res.json(enrichedAppointments);
  });

  app.get("/api/appointments/:id", loadUserProvider, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    
    const appointment = await storage.getAppointment(id);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    
    // Verificar se o agendamento pertence ao provider do usuário logado
    const provider = (req as any).provider;
    if (appointment.providerId !== provider.id) {
      return res.status(403).json({ 
        error: "Acesso não autorizado", 
        message: "Você não tem permissão para acessar este agendamento" 
      });
    }
    
    res.json(appointment);
  });

  app.post("/api/appointments", async (req: Request, res: Response) => {
    try {
      console.log("🔥 INICIANDO CRIAÇÃO DE AGENDAMENTO");
      console.log("📋 Dados recebidos:", JSON.stringify(req.body, null, 2));
      console.log("👤 Usuário autenticado:", req.isAuthenticated() ? req.user?.username : 'Não autenticado');
      
      // Tenta processar os dados com o esquema com transformações
      const data = insertAppointmentSchema.parse(req.body);
      console.log("Dados após processamento do schema:", JSON.stringify(data, null, 2));
      
      // Verifica se as datas são válidas
      if (!(data.date instanceof Date) || isNaN(data.date.getTime())) {
        return res.status(400).json({ 
          message: "Data de início inválida",
          details: `Valor recebido: ${JSON.stringify(req.body.date)}`
        });
      }
      
      if (!(data.endTime instanceof Date) || isNaN(data.endTime.getTime())) {
        return res.status(400).json({ 
          message: "Data de término inválida",
          details: `Valor recebido: ${JSON.stringify(req.body.endTime)}`
        });
      }
      
      // Verifica se o serviço existe
      const service = await storage.getService(data.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }
      
      // Verifica se é o próprio usuário do sistema fazendo o agendamento
      let isAvailable = false;
      
      // Se for agendamento pelo sistema, verificamos apenas conflitos de horário
      // ignorando restrições de dias e horários de trabalho
      if (req.isAuthenticated()) {
        console.log(`Verificação para usuário do sistema: ${req.user.username}`);
        
        // Verificar se o usuário autenticado é o proprietário do provider ou um admin
        const userProvider = await storage.getProviderByUserId(req.user.id);
        const isAdmin = req.user.role === 'admin';
        const isProviderOwner = userProvider && userProvider.id === data.providerId;
        
        if (isAdmin || isProviderOwner) {
          console.log(`Usuário autorizado (${isAdmin ? 'admin' : 'proprietário do provider'}), verificando apenas conflitos de horário`);
          
          // Buscar apenas os agendamentos existentes para verificar conflitos
          const appointments = await storage.getAppointmentsByDate(data.providerId, data.date);
          
          // Calcular horário de término para comparação
          const proposedEndTime = new Date(data.date.getTime() + service.duration * 60000);
          
          // Verificar se há conflito com algum agendamento existente
          const hasConflict = appointments.some(appointment => {
            if (appointment.status !== AppointmentStatus.CONFIRMED && 
                appointment.status !== AppointmentStatus.PENDING) {
              return false; // Ignora agendamentos cancelados ou concluídos
            }
            
            const appointmentEndTime = appointment.endTime || 
              new Date(appointment.date.getTime() + service.duration * 60000);
            
            // Verifica sobreposição
            const hasTimeOverlap = !(proposedEndTime <= appointment.date || data.date >= appointmentEndTime);
            
            if (!hasTimeOverlap) {
              return false; // Não há sobreposição de horário
            }
            
            // Se há sobreposição de horário, verificar se é conta empresa com funcionários diferentes
            const user = req.user;
            const isCompanyAccount = user?.accountType === 'company';
            
            console.log(`DEBUG: Verificando conflito para agendamento ${appointment.id}:`);
            console.log(`- Usuário: ${user?.username}, Tipo de conta: ${user?.accountType}`);
            console.log(`- É conta empresa: ${isCompanyAccount}`);
            console.log(`- EmployeeId solicitado: ${data.employeeId}`);
            console.log(`- EmployeeId do agendamento existente: ${appointment.employeeId}`);
            
            if (isCompanyAccount && data.employeeId && appointment.employeeId) {
              if (data.employeeId !== appointment.employeeId) {
                console.log(`Conta empresa: Permitindo agendamento no mesmo horário para funcionário diferente (${data.employeeId} vs ${appointment.employeeId})`);
                return false; // Funcionários diferentes, não há conflito
              } else {
                console.log(`Conta empresa: Conflito detectado - mesmo funcionário (${data.employeeId}) já tem agendamento no horário`);
                return true; // Mesmo funcionário, há conflito
              }
            } else if (isCompanyAccount && (!data.employeeId || !appointment.employeeId)) {
              console.log(`Conta empresa: Conflito detectado - agendamento sem funcionário específico (data.employeeId: ${data.employeeId}, appointment.employeeId: ${appointment.employeeId})`);
              return true; // Sem funcionário específico, há conflito
            } else {
              console.log(`Conta individual: Conflito detectado - horário já ocupado`);
              return true; // Conta individual ou sem funcionário, há conflito
            }
          });
          
          isAvailable = !hasConflict;
          console.log(`Verificação de conflitos por usuário do sistema: ${hasConflict ? 'CONFLITO DETECTADO' : 'NENHUM CONFLITO'}`);
        } else {
          console.log(`Usuário não autorizado para agendamento privilegiado, usando verificação padrão`);
          isAvailable = await storage.checkAvailability(data.providerId, data.date, service.duration, data.employeeId || undefined);
        }
      } else {
        // Cliente normal fazendo agendamento - usa todas as verificações
        isAvailable = await storage.checkAvailability(data.providerId, data.date, service.duration, data.employeeId || undefined);
      }
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Horário indisponível" });
      }
      
      // Calcula o horário de término baseado na duração do serviço
      const endTime = new Date(data.date.getTime() + service.duration * 60000);
      console.log(`Horário calculado para o agendamento: ${data.date.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
      
      // Cria o agendamento com o horário de término explícito
      console.log("💾 Salvando agendamento no banco de dados...");
      const appointment = await storage.createAppointment({
        ...data,
        endTime
      });
      console.log("✅ Agendamento salvo com sucesso! ID:", appointment.id);
      console.log("📅 Detalhes do agendamento salvo:", {
        id: appointment.id,
        date: appointment.date,
        endTime: appointment.endTime,
        status: appointment.status,
        providerId: appointment.providerId,
        clientId: appointment.clientId,
        serviceId: appointment.serviceId,
        employeeId: appointment.employeeId
      });
      
      // Enviar atualização em tempo real via WebSocket
      console.log("📡 Enviando atualização via WebSocket...");
      broadcastUpdate('appointment_created', appointment);
      
      // Criar uma notificação para o prestador de serviço
      const provider = await storage.getProvider(appointment.providerId);
      if (provider && provider.userId) {
        try {
          await storage.createNotification({
            userId: provider.userId,
            title: "Novo agendamento",
            message: `Um novo agendamento foi criado para o serviço #${appointment.serviceId}`,
            type: 'appointment',
            appointmentId: appointment.id
          });
          console.log(`📬 Notificação criada para o usuário ${provider.userId}`);
        } catch (error) {
          console.error("❌ Erro ao criar notificação:", error);
        }
      }
      
      // Aqui enviaríamos uma notificação via WhatsApp
      // Por enquanto, apenas logamos
      console.log(`🎉 Agendamento ${appointment.id} criado com sucesso! Notificação seria enviada.`);
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("❌ ERRO AO CRIAR AGENDAMENTO:", error);
      
      if (error instanceof z.ZodError) {
        console.error("❌ Erro de validação Zod:", error.errors);
        return res.status(400).json({ 
          message: "Dados de agendamento inválidos", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        console.error("❌ Erro específico:", error.message);
        console.error("❌ Stack trace:", error.stack);
        return res.status(400).json({ 
          message: "Erro ao processar agendamento", 
          details: error.message
        });
      }
      
      console.error("❌ Erro desconhecido:", error);
      res.status(500).json({ message: "Falha ao criar agendamento" });
    }
  });

  // Atualizar status de agendamento (somente para o próprio provider)
  app.patch("/api/appointments/:id/status", loadUserProvider, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    
    try {
      const provider = (req as any).provider;
      
      // Busca o agendamento para verificar se pertence ao provider do usuário logado
      const existingAppointment = await storage.getAppointment(id);
      if (!existingAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Verifica se o agendamento pertence ao provider do usuário logado
      if (existingAppointment.providerId !== provider.id) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para atualizar este agendamento" 
        });
      }
      
      const statusSchema = z.object({
        status: z.enum([
          AppointmentStatus.PENDING,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.CANCELLED,
          AppointmentStatus.COMPLETED
        ]),
        cancellationReason: z.string().optional()
      });
      
      const { status, cancellationReason } = statusSchema.parse(req.body);
      const updatedAppointment = await storage.updateAppointmentStatus(id, status, cancellationReason);
      
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_updated', updatedAppointment);
      
      // Aqui enviaríamos uma notificação via WhatsApp sobre a mudança de status
      // Por enquanto, apenas logamos
      console.log(`Enviando atualização em tempo real e notificação WhatsApp para agendamento ${id}: ${status}`);
      
      // Criar uma notificação no sistema para o usuário associado ao prestador
      // Já temos acesso ao provider pelo middleware loadUserProvider
      if (provider && provider.userId) {
        try {
          // Determinar mensagem apropriada baseada no status
          let titleMsg = "Agendamento atualizado";
          let message = `O agendamento #${updatedAppointment.id} foi atualizado para ${status}`;
          
          if (status === AppointmentStatus.CONFIRMED) {
            titleMsg = "Agendamento confirmado";
            message = `O agendamento #${updatedAppointment.id} foi confirmado`;
          } else if (status === AppointmentStatus.CANCELLED) {
            titleMsg = "Agendamento cancelado";
            message = cancellationReason 
              ? `O agendamento #${updatedAppointment.id} foi cancelado. Motivo: ${cancellationReason}`
              : `O agendamento #${updatedAppointment.id} foi cancelado`;
          } else if (status === AppointmentStatus.COMPLETED) {
            titleMsg = "Agendamento concluído";
            message = `O agendamento #${updatedAppointment.id} foi marcado como concluído`;
          }
          
          // Criar a notificação para o usuário
          await storage.createNotification({
            userId: provider.userId,
            title: titleMsg,
            message,
            type: 'appointment',
            appointmentId: updatedAppointment.id
          });
          
          console.log(`Notificação criada para o usuário ${provider.userId}`);
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid status", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appointment status" });
    }
  });

  // Atualizar agendamento completo (somente para o próprio provider)
  app.put("/api/appointments/:id", loadUserProvider, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    console.log(`🔄 PUT /api/appointments/${id} - Iniciando reagendamento`);
    console.log(`📋 Dados recebidos:`, req.body);
    
    if (isNaN(id)) {
      console.log(`❌ ID do agendamento inválido: ${req.params.id}`);
      return res.status(400).json({ message: "Invalid appointment ID" });
    }
    
    try {
      const provider = (req as any).provider;
      console.log(`👤 Provider:`, { id: provider?.id, name: provider?.name });
      
      // Busca o agendamento para verificar se pertence ao provider do usuário logado
      console.log(`🔍 Buscando agendamento ${id}...`);
      const existingAppointment = await storage.getAppointment(id);
      if (!existingAppointment) {
        console.log(`❌ Agendamento ${id} não encontrado`);
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      console.log(`📋 Agendamento encontrado:`, { 
        id: existingAppointment.id, 
        providerId: existingAppointment.providerId,
        date: existingAppointment.date 
      });
      
      // Verifica se o agendamento pertence ao provider do usuário logado
      if (existingAppointment.providerId !== provider.id) {
        console.log(`❌ Acesso negado - Provider do agendamento: ${existingAppointment.providerId}, Provider do usuário: ${provider.id}`);
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para atualizar este agendamento" 
        });
      }
      
      const updateSchema = z.object({
        date: z.string().optional(),
        employeeId: z.number().int().positive().optional(),
        serviceId: z.number().int().positive().optional(),
        notes: z.string().optional()
      });
      
      const updateData = updateSchema.parse(req.body);
      
      // Preparar dados para atualização
      const appointmentUpdate: any = {};
      
      if (updateData.date) {
        const newDate = new Date(updateData.date);
        if (isNaN(newDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }
        appointmentUpdate.date = newDate;
        
        // Se a data mudou, calcular novo endTime baseado na duração do serviço
        const service = await storage.getService(existingAppointment.serviceId);
        if (service) {
          appointmentUpdate.endTime = new Date(newDate.getTime() + service.duration * 60000);
        }
      }
      
      if (updateData.employeeId !== undefined) {
        appointmentUpdate.employeeId = updateData.employeeId;
      }
      
      if (updateData.serviceId !== undefined) {
        appointmentUpdate.serviceId = updateData.serviceId;
        
        // Se o serviço mudou, recalcular endTime
        const newService = await storage.getService(updateData.serviceId);
        if (newService) {
          const appointmentDate = appointmentUpdate.date || existingAppointment.date;
          appointmentUpdate.endTime = new Date(appointmentDate.getTime() + newService.duration * 60000);
        }
      }
      
      if (updateData.notes !== undefined) {
        appointmentUpdate.notes = updateData.notes;
      }
      
      // Atualizar o agendamento
      const updatedAppointment = await storage.updateAppointment(id, appointmentUpdate);
      
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_updated', updatedAppointment);
      
      // Criar notificação no sistema
      if (provider && provider.userId) {
        try {
          await storage.createNotification({
            userId: provider.userId,
            title: "Agendamento reagendado",
            message: `O agendamento #${updatedAppointment.id} foi reagendado com sucesso`,
            type: 'appointment',
            appointmentId: updatedAppointment.id
          });
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating appointment:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // Check availability
  app.get("/api/providers/:providerId/availability", async (req: Request, res: Response) => {
    console.log(`=== VERIFICANDO DISPONIBILIDADE ===`);
    console.log(`Parâmetros recebidos:`, req.params, req.query);
    
    const providerId = parseInt(req.params.providerId);
    if (isNaN(providerId)) {
      console.log(`❌ ID do prestador inválido: ${req.params.providerId}`);
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const dateParam = req.query.date as string;
    const serviceIdParam = req.query.serviceId as string;
    const bySystemUserParam = req.query.bySystemUser as string; // Novo parâmetro para indicar se é feito pelo próprio sistema
    const employeeIdParam = req.query.employeeId as string;
    
    console.log(`Data param: ${dateParam}`);
    console.log(`Service ID param: ${serviceIdParam}`);
    console.log(`By System User param: ${bySystemUserParam}`);
    console.log(`Employee ID param: ${employeeIdParam}`);
    
    if (!dateParam || !serviceIdParam) {
      console.log(`❌ Data ou ID do serviço ausentes`);
      return res.status(400).json({ message: "Date and serviceId are required" });
    }
    
    const date = new Date(dateParam);
    const serviceId = parseInt(serviceIdParam);
    const bySystemUser = bySystemUserParam === 'true';
    const employeeId = employeeIdParam ? parseInt(employeeIdParam) : undefined;
    
    console.log(`Data convertida: ${date.toISOString()} (${date.toLocaleString()})`);
    console.log(`ID do serviço: ${serviceId}`);
    console.log(`Agendamento pelo usuário do sistema: ${bySystemUser}`);
    console.log(`ID do funcionário: ${employeeId}`);
    
    if (isNaN(date.getTime()) || isNaN(serviceId)) {
      console.log(`❌ Data ou ID do serviço inválidos`);
      return res.status(400).json({ message: "Invalid date or service ID" });
    }
    
    const service = await storage.getService(serviceId);
    if (!service) {
      console.log(`❌ Serviço não encontrado: ${serviceId}`);
      return res.status(404).json({ message: "Service not found" });
    }
    
    console.log(`✓ Serviço encontrado: ${service.name}, duração: ${service.duration} minutos`);
    
    // Verificar se é o próprio usuário do sistema fazendo o agendamento
    let isAvailable = false;
    
    // Se for agendamento pelo sistema, verificamos apenas conflitos de horário
    // ignorando restrições de dias de trabalho
    if (bySystemUser && req.isAuthenticated()) {
      console.log(`Verificação para usuário do sistema: ${req.user.username}`);
      
      // Verificar se o usuário autenticado é o proprietário do provider ou um admin
      const userProvider = await storage.getProviderByUserId(req.user.id);
      const isAdmin = req.user.role === 'admin';
      const isProviderOwner = userProvider && userProvider.id === providerId;
      
      if (isAdmin || isProviderOwner) {
        console.log(`Usuário autorizado (${isAdmin ? 'admin' : 'proprietário do provider'}), verificando apenas conflitos de horário`);
        
        // Buscar apenas os agendamentos existentes para verificar conflitos
        const appointments = await storage.getAppointmentsByDate(providerId, date);
        
        // Calcular horário de término para comparação
        const proposedEndTime = new Date(date.getTime() + service.duration * 60000);
        
        // Verificar se há conflito com algum agendamento existente
        const hasConflict = appointments.some(appointment => {
          if (appointment.status !== AppointmentStatus.CONFIRMED && 
              appointment.status !== AppointmentStatus.PENDING) {
            return false; // Ignora agendamentos cancelados ou concluídos
          }
          
          const appointmentEndTime = appointment.endTime || 
            new Date(appointment.date.getTime() + service.duration * 60000);
          
          // Verifica sobreposição
          const hasTimeOverlap = !(proposedEndTime <= appointment.date || date >= appointmentEndTime);
          
          if (!hasTimeOverlap) {
            return false; // Não há sobreposição de horário
          }
          
          // Se há sobreposição de horário, verificar se é conta empresa com funcionários diferentes
          const user = req.user;
          const isCompanyAccount = user?.accountType === 'company';
          
          console.log(`DEBUG: Verificando conflito para agendamento ${appointment.id}:`);
          console.log(`- Usuário: ${user?.username}, Tipo de conta: ${user?.accountType}`);
          console.log(`- É conta empresa: ${isCompanyAccount}`);
          console.log(`- EmployeeId solicitado: ${employeeId}`);
          console.log(`- EmployeeId do agendamento existente: ${appointment.employeeId}`);
          
          if (isCompanyAccount && employeeId && appointment.employeeId) {
            if (employeeId !== appointment.employeeId) {
              console.log(`Conta empresa: Permitindo agendamento no mesmo horário para funcionário diferente (${employeeId} vs ${appointment.employeeId})`);
              return false; // Funcionários diferentes, não há conflito
            } else {
              console.log(`Conta empresa: Conflito detectado - mesmo funcionário (${employeeId}) já tem agendamento no horário`);
              return true; // Mesmo funcionário, há conflito
            }
          } else if (isCompanyAccount && (!employeeId || !appointment.employeeId)) {
            console.log(`Conta empresa: Conflito detectado - agendamento sem funcionário específico (employeeId: ${employeeId}, appointment.employeeId: ${appointment.employeeId})`);
            return true; // Sem funcionário específico, há conflito
          } else {
            console.log(`Conta individual: Conflito detectado - horário já ocupado`);
            return true; // Conta individual ou sem funcionário, há conflito
          }
        });
        
        isAvailable = !hasConflict;
        console.log(`Verificação de conflitos: ${hasConflict ? 'CONFLITO DETECTADO' : 'NENHUM CONFLITO'}`);
      } else {
        console.log(`Usuário não autorizado para agendamento privilegiado, usando verificação padrão`);
        isAvailable = await storage.checkAvailability(providerId, date, service.duration, employeeId);
      }
    } else {
      // Verificação padrão para clientes externos
      isAvailable = await storage.checkAvailability(providerId, date, service.duration, employeeId);
    }
    
    // Verificar horário de almoço do funcionário (se employeeId foi fornecido)
    if (isAvailable && employeeId) {
      console.log(`Verificando horário de almoço para funcionário ${employeeId}`);
      
      try {
        const employee = await db.select()
          .from(employees)
          .where(eq(employees.id, employeeId))
          .limit(1);
        
        if (employee.length > 0) {
          const emp = employee[0];
          
          // Verificar se o horário conflita com o intervalo de almoço
          if (emp.lunchBreakStart && emp.lunchBreakEnd) {
            const [lunchStartHour, lunchStartMin] = emp.lunchBreakStart.split(':').map(Number);
            const [lunchEndHour, lunchEndMin] = emp.lunchBreakEnd.split(':').map(Number);
            
            const requestHour = date.getHours();
            const requestMin = date.getMinutes();
            const requestEndTime = new Date(date.getTime() + service.duration * 60000);
            const requestEndHour = requestEndTime.getHours();
            const requestEndMin = requestEndTime.getMinutes();
            
            // Converte horários para minutos para facilitar comparação
            const lunchStart = lunchStartHour * 60 + lunchStartMin;
            const lunchEnd = lunchEndHour * 60 + lunchEndMin;
            const requestStart = requestHour * 60 + requestMin;
            const requestEnd = requestEndHour * 60 + requestEndMin;
            
            // Verifica se há sobreposição com o horário de almoço
            if (!(requestEnd <= lunchStart || requestStart >= lunchEnd)) {
              console.log(`❌ Horário conflita com intervalo de almoço do funcionário (${emp.lunchBreakStart} - ${emp.lunchBreakEnd})`);
              isAvailable = false;
            } else {
              console.log(`✓ Horário não conflita com intervalo de almoço do funcionário (${emp.lunchBreakStart} - ${emp.lunchBreakEnd})`);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao verificar horário de almoço:", error);
        // Em caso de erro, mantemos a disponibilidade original
      }
    }
    
    console.log(`✓ Resultado da verificação: ${isAvailable ? 'DISPONÍVEL' : 'INDISPONÍVEL'}`);
    
    // Adicionar detalhes no retorno para debug
    res.json({ 
      available: isAvailable,
      date: date.toISOString(),
      localDate: date.toLocaleString(),
      serviceId,
      serviceName: service.name,
      duration: service.duration,
      providerId
    });
  });

  // Booking endpoint (for clients)
  app.post("/api/booking", async (req: Request, res: Response) => {
    try {
      console.log("Recebendo dados de agendamento:", JSON.stringify(req.body, null, 2));
      
      // Valida os dados do formulário
      const bookingData = bookingFormSchema.parse(req.body);
      
      let appointmentDate: Date;
      
      try {
        // Tenta analisar a data e hora com tratamento de erro
        if (bookingData.date.includes('-')) {
          // Formato ISO (YYYY-MM-DD) - criar data no horário local
          const [year, month, day] = bookingData.date.split('-').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
          
          // Criar data em UTC para manter o horário exato selecionado pelo usuário
          // Isso evita a conversão automática de timezone que adiciona +3h
          appointmentDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
          console.log(`Horário selecionado: ${hour}:${minute} (dia ${day}/${month}/${year})`);
          
        } else if (bookingData.date.includes('/')) {
          // Formato BR (DD/MM/YYYY) - criar data no horário local
          const [day, month, year] = bookingData.date.split('/').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
        
          // Criar data em UTC para manter o horário exato selecionado pelo usuário
          // Isso evita a conversão automática de timezone que adiciona +3h
          appointmentDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
          console.log(`Horário selecionado: ${hour}:${minute} (dia ${day}/${month}/${year})`);
          
        } else {
          // Tentar como timestamp ou outro formato - criar data no horário local
          const baseDate = new Date(bookingData.date);
          const [hour, minute] = bookingData.time.split(':').map(Number);
          
          // Criar data em UTC para manter o horário exato selecionado pelo usuário
          // Isso evita a conversão automática de timezone que adiciona +3h
          appointmentDate = new Date(Date.UTC(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate(),
            hour, minute, 0
          ));
          console.log(`Horário selecionado: ${hour}:${minute} (dia ${baseDate.getDate()}/${baseDate.getMonth()+1}/${baseDate.getFullYear()})`);
        }
        
        if (isNaN(appointmentDate.getTime())) {
          throw new Error(`Data inválida após conversão: ${appointmentDate}`);
        }
        
        console.log("Data processada:", appointmentDate.toISOString());
      } catch (error) {
        console.error("Erro ao processar data e hora:", error);
        return res.status(400).json({ 
          message: "Formato de data ou hora inválido", 
          details: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Busca o serviço para calcular horário de término
      const service = await storage.getService(bookingData.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Serviço não encontrado" });
      }
      
      // Calcula o horário de término baseado na duração do serviço
      const endTime = new Date(appointmentDate.getTime() + service.duration * 60000);
      console.log(`Horário calculado para o agendamento: ${appointmentDate.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
      
      // Verifica disponibilidade
      const isAvailable = await storage.checkAvailability(
        service.providerId,
        appointmentDate,
        service.duration
      );
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Horário indisponível" });
      }
      
      // Obtém cliente existente pelo telefone ou cria um novo
      let client = await storage.getClientByPhone(bookingData.phone);
      
      if (!client) {
        // Se o cliente não existe, cria um novo
        client = await storage.createClient({
          name: bookingData.name,
          phone: bookingData.phone,
          email: "",
          notes: bookingData.notes || ""
        });
      } else {
        // Verifica se o cliente está bloqueado
        if (client.isBlocked) {
          return res.status(403).json({ 
            message: "Cliente bloqueado", 
            error: "Este cliente está impedido de realizar agendamentos"
          });
        }
        
        // Se o cliente já existe mas enviou um nome diferente ou notas diferentes,
        // atualiza os dados do cliente para manter o cadastro atualizado
        if (client.name !== bookingData.name || 
            (bookingData.notes && client.notes !== bookingData.notes)) {
          
          console.log(`Cliente já existente com telefone ${bookingData.phone}.`);
          console.log(`Nome no sistema: "${client.name}" - Nome informado: "${bookingData.name}"`);
          
          // Manteremos o telefone original, mas atualizaremos as notas se forem enviadas
          await storage.updateClient(client.id, {
            // Não atualizamos o nome para manter consistência com o cadastro original
            notes: bookingData.notes || client.notes
          });
          
          // Adicionamos uma nota sobre o nome diferente para referência futura
          if (client.name !== bookingData.name) {
            const notaAdicional = client.notes 
              ? `${client.notes}. Cliente também conhecido como: ${bookingData.name}`
              : `Cliente também conhecido como: ${bookingData.name}`;
            
            await storage.updateClient(client.id, {
              notes: notaAdicional
            });
          }
        }
      }
      
      // Verifica se o provedor requer pagamento PIX
      const serviceProvider = await storage.getProvider(service.providerId);
      
      // Configurar dados de pagamento se o provedor tiver PIX habilitado e requerer pagamento
      const requiresPayment = serviceProvider && serviceProvider.pixEnabled && serviceProvider.pixRequirePayment;
      const paymentPercentage = requiresPayment ? (serviceProvider.pixPaymentPercentage || 100) : 0;
      
      // Calcular o valor do pagamento, se aplicável
      const paymentAmount = requiresPayment 
        ? Math.round((service.price * paymentPercentage) / 100) 
        : 0;
      
      console.log(`Verificação de pagamento PIX: ${requiresPayment ? 'Requerido' : 'Não requerido'}`);
      if (requiresPayment) {
        console.log(`Valor a ser pago: ${paymentAmount} (${paymentPercentage}% de ${service.price})`);
      }
      
      // Cria o agendamento
      const appointment = await storage.createAppointment({
        providerId: service.providerId,
        clientId: client.id,
        serviceId: bookingData.serviceId,
        employeeId: bookingData.employeeId || null, // Incluir funcionário se selecionado
        date: appointmentDate,
        endTime: endTime,
        status: AppointmentStatus.PENDING,
        notes: bookingData.notes || "",
        // Informações de pagamento
        requiresPayment: requiresPayment,
        paymentStatus: requiresPayment ? PaymentStatus.PENDING : PaymentStatus.NOT_REQUIRED,
        paymentAmount: paymentAmount,
        paymentPercentage: paymentPercentage
      });
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_created', appointment);
      if (serviceProvider && serviceProvider.userId) {
        try {
          // Formatar a data para o padrão DD/MM/YYYY
          const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          const formattedDate = dateFormatter.format(appointmentDate);
          
          // Criar notificação e obter a notificação criada
          const notification = await storage.createNotification({
            userId: serviceProvider.userId,
            title: "Novo agendamento",
            message: `${client.name} agendou ${service.name} para ${formattedDate}`,
            type: 'appointment',
            appointmentId: appointment.id
          });
          console.log(`Notificação criada para o usuário ${serviceProvider.userId}`, notification);
          
          // Também enviar atualização em tempo real sobre a nova notificação
          broadcastUpdate('notification_created', { notification, userId: serviceProvider.userId });
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
      // Aqui enviaríamos uma confirmação via WhatsApp
      console.log(`Agendamento ${appointment.id} criado com sucesso! Confirmação seria enviada para ${client.phone}.`);
      
      res.status(201).json({
        success: true,
        appointment,
        message: "Agendamento realizado com sucesso! Você receberá uma confirmação por WhatsApp em breve."
      });
    } catch (error) {
      console.error("Erro ao processar agendamento do cliente:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados de agendamento inválidos", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        return res.status(400).json({ 
          message: "Erro ao processar agendamento", 
          details: error.message
        });
      }
      
      res.status(500).json({ message: "Falha ao criar agendamento" });
    }
  });

  // API de notificações
  app.get("/api/notifications", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const userId = getCurrentUserId(req);
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("Erro ao buscar notificações:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/notifications/unread", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const userId = getCurrentUserId(req);
      const notifications = await storage.getUnreadNotifications(userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("Erro ao buscar notificações não lidas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/:id/mark-as-read", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const id = parseInt(req.params.id);
    
    try {
      const notification = await storage.markNotificationAsRead(id);
      if (!notification) {
        return res.status(404).json({ error: "Notificação não encontrada" });
      }
      res.json(notification);
    } catch (error: any) {
      console.error("Erro ao marcar notificação como lida:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications/mark-all-as-read", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const userId = getCurrentUserId(req);
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao marcar todas notificações como lidas:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== Rotas para Exclusão de Horários ==============
  
  // Obter todas as exclusões de horário de um prestador
  app.get("/api/time-exclusions", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const provider = (req as any).provider;
      
      // Buscar todas as exclusões de horário do prestador
      const exclusions = await storage.getTimeExclusions(provider.id);
      
      res.json(exclusions);
    } catch (error) {
      console.error("Erro ao buscar exclusões de horário:", error);
      res.status(500).json({ message: "Erro ao buscar exclusões de horário" });
    }
  });
  
  // Obter exclusões de horário para um dia específico
  app.get("/api/time-exclusions/day/:dayOfWeek", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const provider = (req as any).provider;
      const dayOfWeek = parseInt(req.params.dayOfWeek);
      
      if (isNaN(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
        return res.status(400).json({ message: "Dia da semana inválido. Deve ser um número de 1 a 7." });
      }
      
      // Buscar exclusões para o dia específico
      const exclusions = await storage.getTimeExclusionsByDay(provider.id, dayOfWeek);
      
      res.json(exclusions);
    } catch (error) {
      console.error("Erro ao buscar exclusões de horário para o dia:", error);
      res.status(500).json({ message: "Erro ao buscar exclusões de horário para o dia" });
    }
  });
  
  // Criar uma nova exclusão de horário
  app.post("/api/time-exclusions", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const provider = (req as any).provider;
      
      // Validar os dados recebidos
      // Requisitos: startTime, endTime (formato: "HH:MM")
      const { startTime, endTime, dayOfWeek, name } = req.body;
      
      // Validar formato de hora
      const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/; // Formato HH:MM (00:00 a 23:59)
      
      if (!startTime || !endTime || !timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return res.status(400).json({ message: "Formato de hora inválido. Use o formato HH:MM (24h)" });
      }
      
      // Validar que hora de início é antes da hora de fim
      if (startTime >= endTime) {
        return res.status(400).json({ message: "Hora de início deve ser anterior à hora de término" });
      }
      
      // Validar dia da semana se fornecido (permitindo 0 para 'todos os dias')
      if (dayOfWeek !== undefined && dayOfWeek !== null && 
          (isNaN(Number(dayOfWeek)) || (Number(dayOfWeek) !== 0 && (Number(dayOfWeek) < 1 || Number(dayOfWeek) > 7)))) {
        return res.status(400).json({ message: "Dia da semana inválido. Deve ser um número de 1 a 7, 0 para todos os dias, ou nulo." });
      }
      
      // Criar nova exclusão
      const newExclusion = await storage.createTimeExclusion({
        providerId: provider.id,
        startTime,
        endTime,
        dayOfWeek: dayOfWeek !== undefined && dayOfWeek !== null ? Number(dayOfWeek) : null,
        name: name || `Exclusão ${startTime}-${endTime}`,
        isActive: true
      });
      
      res.status(201).json(newExclusion);
    } catch (error) {
      console.error("Erro ao criar exclusão de horário:", error);
      res.status(500).json({ message: "Erro ao criar exclusão de horário" });
    }
  });
  
  // Atualizar uma exclusão de horário
  app.put("/api/time-exclusions/:id", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const provider = (req as any).provider;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      // Buscar a exclusão para verificar se pertence a este prestador
      const exclusion = await storage.getTimeExclusion(id);
      
      if (!exclusion) {
        return res.status(404).json({ message: "Exclusão de horário não encontrada" });
      }
      
      if (exclusion.providerId !== provider.id) {
        return res.status(403).json({ message: "Você não tem permissão para editar esta exclusão de horário" });
      }
      
      // Validar dados
      const { startTime, endTime, dayOfWeek, name, isActive } = req.body;
      
      const updateData: Partial<InsertTimeExclusion> = {};
      
      // Validar e adicionar campos ao objeto de atualização
      if (startTime !== undefined && endTime !== undefined) {
        const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
        
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
          return res.status(400).json({ message: "Formato de hora inválido. Use o formato HH:MM (24h)" });
        }
        
        if (startTime >= endTime) {
          return res.status(400).json({ message: "Hora de início deve ser anterior à hora de término" });
        }
        
        updateData.startTime = startTime;
        updateData.endTime = endTime;
      } else if (startTime !== undefined || endTime !== undefined) {
        return res.status(400).json({ message: "Hora de início e término devem ser fornecidos juntos" });
      }
      
      if (dayOfWeek !== undefined) {
        if (dayOfWeek === null) {
          updateData.dayOfWeek = null; // Para todos os dias
        } else if (isNaN(Number(dayOfWeek)) || Number(dayOfWeek) < 1 || Number(dayOfWeek) > 7) {
          return res.status(400).json({ message: "Dia da semana inválido. Deve ser um número de 1 a 7, ou nulo para todos os dias." });
        } else {
          updateData.dayOfWeek = Number(dayOfWeek);
        }
      }
      
      if (name !== undefined) {
        updateData.name = name;
      }
      
      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }
      
      // Atualizar a exclusão
      const updatedExclusion = await storage.updateTimeExclusion(id, updateData);
      
      res.json(updatedExclusion);
    } catch (error) {
      console.error("Erro ao atualizar exclusão de horário:", error);
      res.status(500).json({ message: "Erro ao atualizar exclusão de horário" });
    }
  });
  
  // Excluir uma exclusão de horário
  app.delete("/api/time-exclusions/:id", loadUserProvider, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const provider = (req as any).provider;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      // Buscar a exclusão para verificar se pertence a este prestador
      const exclusion = await storage.getTimeExclusion(id);
      
      if (!exclusion) {
        return res.status(404).json({ message: "Exclusão de horário não encontrada" });
      }
      
      if (exclusion.providerId !== provider.id) {
        return res.status(403).json({ message: "Você não tem permissão para excluir esta exclusão de horário" });
      }
      
      // Excluir a exclusão
      await storage.deleteTimeExclusion(id);
      
      res.status(200).json({ message: "Exclusão de horário removida com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir exclusão de horário:", error);
      res.status(500).json({ message: "Erro ao excluir exclusão de horário" });
    }
  });

  // Webhook para receber notificações de pagamento do Mercado Pago
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      console.log("Webhook do Mercado Pago recebido:", JSON.stringify(req.body, null, 2));
      
      // Verificar se é uma notificação de pagamento
      if (req.body.action === 'payment.updated' || req.body.action === 'payment.created') {
        const paymentId = req.body.data?.id;
        if (paymentId) {
          console.log(`Notificação de pagamento recebida para o ID: ${paymentId}`);
          
          // Buscar transações com este ID
          const transactions = await db.select()
            .from(subscriptionTransactions)
            .where(eq(subscriptionTransactions.transactionId, paymentId.toString()));
          
          if (transactions.length > 0) {
            console.log(`Transação encontrada: ${transactions[0].id} para usuário ${transactions[0].userId}`);
            
            // Verificar o status do pagamento
            await subscriptionService.checkPaymentStatus(paymentId.toString());
            console.log(`Status do pagamento verificado para transação ${paymentId}`);
          } else {
            console.log(`Nenhuma transação encontrada para o pagamento ${paymentId}`);
          }
        }
      }
      
      // Sempre retornar 200 para o Mercado Pago
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Erro ao processar webhook do Mercado Pago:", error);
      // Ainda retornamos 200 para o Mercado Pago não tentar novamente
      return res.status(200).json({ received: true, error: true });
    }
  });

  // Rota para verificação de código
  app.post("/api/verify-code", async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ error: "Email e código são obrigatórios" });
      }
      
      // Buscar o usuário pelo email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Não indicamos que o usuário não existe por razões de segurança
        return res.status(400).json({ error: "Código inválido ou expirado" });
      }
      
      // Verificar se o código é válido
      const isValid = verifyToken(user.id, code);
      
      if (!isValid) {
        return res.status(400).json({ error: "Código inválido ou expirado" });
      }
      
      // Marcar o email como verificado
      await storage.updateUser(user.id, { 
        isEmailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null
      });
      
      // Enviar email de boas-vindas após a verificação
      await sendWelcomeEmail(user);
      
      // Iniciar a sessão do usuário (login automático)
      // Atualiza o usuário após a verificação
      const updatedUser = await storage.getUser(user.id);
      
      if (!updatedUser) {
        return res.status(500).json({ error: "Erro ao recuperar dados do usuário" });
      }
      
      // Fazer login automático
      req.login(updatedUser, (err) => {
        if (err) {
          console.error("Erro ao iniciar sessão automática:", err);
          return res.status(200).json({ 
            success: true, 
            message: "Email verificado com sucesso. Por favor, faça login.",
            autoLogin: false
          });
        }
        
        // Retorna sucesso com indicação de login automático
        return res.status(200).json({ 
          success: true, 
          message: "Email verificado com sucesso. Login automático realizado.",
          autoLogin: true,
          user: req.user
        });
      });
    } catch (error) {
      console.error("Erro ao verificar código:", error);
      return res.status(500).json({ error: "Erro ao processar verificação" });
    }
  });
  
  // Rota para reenvio de código de verificação
  app.post("/api/resend-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }
      
      // Buscar o usuário pelo email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // Por razões de segurança, não revelamos se o usuário existe ou não
        return res.status(200).json({
          message: "Se o email existir em nosso sistema, um novo código de verificação será enviado."
        });
      }
      
      // Verificar se o email já está verificado
      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email já foi verificado" });
      }
      
      // Gerar um novo token
      const token = generateVerificationToken(user.id);
      
      // Atualizar o token de verificação no banco de dados
      await storage.updateUser(user.id, {
        verificationToken: token,
        verificationTokenExpiry: new Date(Date.now() + 20 * 60 * 1000) // 20 minutos
      });
      
      // Enviar email com o novo token
      const sent = await sendVerificationEmail(user, token);
      
      if (!sent) {
        return res.status(500).json({ error: "Falha ao enviar email. Tente novamente mais tarde." });
      }
      
      return res.status(200).json({
        message: "Novo código de verificação enviado. Verifique seu email."
      });
    } catch (error) {
      console.error("Erro ao reenviar código de verificação:", error);
      return res.status(500).json({ error: "Erro ao processar reenvio" });
    }
  });

  // Rotas de pagamento PIX
  // Rota para gerar código PIX para um agendamento
  app.post("/api/payments/generate-pix", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const { appointmentId, amount } = req.body;
      
      if (!appointmentId || !amount) {
        return res.status(400).json({ error: "appointmentId e amount são obrigatórios" });
      }

      // Buscar agendamento
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      // Verificar se o usuário é o provedor do agendamento
      const provider = await storage.getProviderByUserId(req.user.id);
      if (!provider || provider.id !== appointment.providerId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      // Buscar cliente 
      const client = await storage.getClient(appointment.clientId);
      if (!client) {
        return res.status(404).json({ error: "Cliente não encontrado" });
      }

      // Buscar serviço
      const service = await storage.getService(appointment.serviceId);
      if (!service) {
        return res.status(404).json({ error: "Serviço não encontrado" });
      }

      // Gerar código PIX
      const pixResponse = await paymentService.generatePix({
        appointmentId,
        providerId: provider.id,
        amount, // Valor já está em reais
        clientName: client.name,
        clientEmail: client.email || 'cliente@example.com',
        serviceDescription: service.name,
        expireInMinutes: 30 // Expira em 30 minutos (mínimo exigido pelo Mercado Pago)
      });

      return res.status(200).json(pixResponse);
    } catch (error: any) {
      console.error("Erro ao gerar código PIX:", error);
      return res.status(500).json({ error: error.message || "Erro ao gerar código PIX" });
    }
  });

  // Rota para verificar status de pagamento
  // Cancelar pagamento e agendamento para clientes
  app.post("/api/payments/:appointmentId/cancel", async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: "ID de agendamento inválido" });
      }

      // Buscar agendamento
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      // Cancelar o agendamento
      const updatedAppointment = await storage.updateAppointmentStatus(
        appointmentId, 
        AppointmentStatus.CANCELLED, 
        "Pagamento cancelado pelo cliente"
      );
      
      if (!updatedAppointment) {
        return res.status(500).json({ error: "Erro ao cancelar agendamento" });
      }

      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_updated', updatedAppointment);
      
      // Criar notificação para o provider
      const notification = await storage.createNotification({
        userId: updatedAppointment.providerId,
        title: "Agendamento cancelado",
        message: `O cliente cancelou o agendamento #${appointmentId} por não realizar o pagamento`,
        type: "appointment",
        appointmentId: appointmentId
      });
      
      // Notificar via WebSocket
      if (notification) {
        broadcastUpdate('notification_created', { 
          notificationId: notification.id, 
          userId: notification.userId 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Agendamento cancelado com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao cancelar agendamento:", error);
      
      // Se for erro de chave estrangeira na tabela de notificações, vamos pular a notificação
      // mas ainda cancelar o agendamento
      if ((error as any)?.constraint === 'notifications_user_id_fkey') {
        return res.status(200).json({ 
          success: true, 
          message: "Agendamento cancelado com sucesso, mas não foi possível criar notificação"
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: (error as Error).message || "Erro ao cancelar agendamento"
      });
    }
  });

  app.get("/api/payments/:appointmentId/status", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const appointmentId = parseInt(req.params.appointmentId);
      
      // Buscar agendamento
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Agendamento não encontrado" });
      }

      // Verificar se o usuário é o provedor do agendamento ou o cliente (no futuro)
      const provider = await storage.getProviderByUserId(req.user.id);
      if (!provider || provider.id !== appointment.providerId) {
        return res.status(403).json({ error: "Acesso negado" });
      }

      if (!appointment.pixTransactionId) {
        return res.status(400).json({ error: "Agendamento não possui pagamento PIX" });
      }

      // Verificar status na API do Mercado Pago
      await paymentService.updateAppointmentPaymentStatus(appointmentId);
      
      // Buscar agendamento atualizado
      const updatedAppointment = await storage.getAppointment(appointmentId);
      
      // Incluir informações de valor e porcentagem quando aplicável
      return res.status(200).json({
        paymentStatus: updatedAppointment?.paymentStatus || 'unknown',
        pixQrCode: updatedAppointment?.pixQrCode,
        pixQrCodeExpiration: updatedAppointment?.pixQrCodeExpiration,
        pixPaymentDate: updatedAppointment?.pixPaymentDate,
        paymentAmount: updatedAppointment?.paymentAmount,
        paymentPercentage: updatedAppointment?.paymentPercentage || 100
      });
    } catch (error: any) {
      console.error("Erro ao verificar status de pagamento:", error);
      return res.status(500).json({ error: error.message || "Erro ao verificar status de pagamento" });
    }
  });

  // Webhook do Mercado Pago para notificações de pagamento
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      console.log("Webhook do Mercado Pago recebido:", req.body);
      
      // Processar webhook
      const success = await paymentService.processWebhook(req.body);
      
      return res.status(success ? 200 : 422).send();
    } catch (error: any) {
      console.error("Erro ao processar webhook:", error);
      return res.status(500).json({ error: error.message || "Erro ao processar webhook" });
    }
  });

  // Rota para obter configurações de pagamento do provider
  app.get("/api/payments/provider-settings", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const provider = await storage.getProviderByUserId(req.user.id);
      if (!provider) {
        return res.status(404).json({ error: "Provedor não encontrado" });
      }

      return res.status(200).json({
        pixEnabled: provider.pixEnabled,
        pixKeyType: provider.pixKeyType,
        pixRequirePayment: provider.pixRequirePayment,
        pixPaymentPercentage: provider.pixPaymentPercentage,
        pixCompanyName: provider.pixCompanyName
      });
    } catch (error: any) {
      console.error("Erro ao obter configurações de pagamento:", error);
      return res.status(500).json({ error: error.message || "Erro ao obter configurações de pagamento" });
    }
  });

  // Rota para atualizar configurações de pagamento do provider
  app.patch("/api/payments/provider-settings", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      // Usar getCurrentUserId para considerar simulação de acesso
      const userId = getCurrentUserId(req);
      const provider = await storage.getProviderByUserId(userId);
      if (!provider) {
        return res.status(404).json({ error: "Provedor não encontrado" });
      }

      const { 
        pixEnabled, 
        pixKeyType, 
        pixKey, 
        pixRequirePayment, 
        pixPaymentPercentage, 
        pixCompanyName 
      } = req.body;

      const updatedProvider = await storage.updateProvider(provider.id, {
        pixEnabled: pixEnabled !== undefined ? pixEnabled : provider.pixEnabled,
        pixKeyType: pixKeyType || provider.pixKeyType,
        pixKey: pixKey || provider.pixKey,
        pixRequirePayment: pixRequirePayment !== undefined ? pixRequirePayment : provider.pixRequirePayment,
        pixPaymentPercentage: pixPaymentPercentage || provider.pixPaymentPercentage,
        pixCompanyName: pixCompanyName || provider.pixCompanyName
      });

      return res.status(200).json({
        pixEnabled: updatedProvider?.pixEnabled,
        pixKeyType: updatedProvider?.pixKeyType,
        pixRequirePayment: updatedProvider?.pixRequirePayment,
        pixPaymentPercentage: updatedProvider?.pixPaymentPercentage,
        pixCompanyName: updatedProvider?.pixCompanyName
      });
    } catch (error: any) {
      console.error("Erro ao atualizar configurações de pagamento:", error);
      return res.status(500).json({ error: error.message || "Erro ao atualizar configurações de pagamento" });
    }
  });

  // Criar instância do serviço de assinatura
  const subscriptionService = new SubscriptionService();
  
  // Rota para obter planos de assinatura
  app.get("/api/subscription/plans", async (req: Request, res: Response) => {
    try {
      const { accountType } = req.query;
      const plans = await subscriptionService.getActivePlans(accountType as string);
      res.json(plans);
    } catch (error: any) {
      console.error("Erro ao buscar planos de assinatura:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar planos de assinatura" });
    }
  });
  
  // Rota para obter informações de usuário público para renovação
  app.get("/api/subscription/user-info", async (req: Request, res: Response) => {
    try {
      // Aceitar username como query param
      const { username } = req.query;
      if (!username) {
        return res.status(400).json({ error: "Nome de usuário é obrigatório" });
      }
      
      // Buscar usuário por username
      const user = await storage.getUserByUsername(username as string);
      if (!user) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }
      
      // Retornar apenas informações públicas
      res.json({
        id: user.id,
        name: user.name,
        username: user.username,
        subscriptionExpiry: user.subscriptionExpiry,
        isExpired: user.subscriptionExpiry && new Date(user.subscriptionExpiry) < new Date()
      });
    } catch (error: any) {
      console.error("Erro ao buscar informações do usuário:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar informações do usuário" });
    }
  });
  
  // Middleware de autenticação
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    next();
  };
  
  // Middleware para processamento de assinatura (aceita usuário expirado)
  const allowExpiredSubscription = (req: Request, res: Response, next: NextFunction) => {
    // Se o usuário tem usuário e senha na requisição, tenta fazer login
    if (req.body.username && req.body.password && !req.isAuthenticated()) {
      passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ error: "Credenciais inválidas" });
        }
        
        // Usuário autenticado, mas não criamos sessão
        req.user = user;
        return next();
      })(req, res, next);
    } else if (req.isAuthenticated()) {
      // Usuário já está autenticado, seguir
      return next();
    } else {
      // Nenhuma credencial fornecida
      return res.status(401).json({ 
        error: "Autenticação necessária", 
        message: "Forneça suas credenciais para renovar a assinatura"
      });
    }
  };

  // Função auxiliar para processar o pagamento de assinatura
  async function processSubscriptionPayment(userId: number, planId: number, userInfo: any, res: Response) {
    try {
      const paymentData = await subscriptionService.generatePayment(userId, planId);
      return res.json(paymentData);
    } catch (error: any) {
      console.error("Erro ao processar pagamento:", error);
      return res.status(500).json({ error: error.message || "Falha ao processar pagamento" });
    }
  }

  // Rota para gerar pagamento de assinatura (permite usuário expirado)
  app.post("/api/subscription/generate-payment", async (req: Request, res: Response) => {
    try {
      console.log("Processando solicitação de renovação:", req.body);
      console.log("Status de autenticação:", req.isAuthenticated() ? "Autenticado" : "Não autenticado");
      if (req.isAuthenticated()) {
        console.log("Usuário autenticado:", req.user.id, req.user.username);
      }
      
      const { planId, username, password, userId: explicitUserId } = req.body;
      if (!planId) {
        return res.status(400).json({ error: "ID do plano é obrigatório" });
      }
      
      // Verificar se temos credenciais para autenticação
      if (username && password && !req.isAuthenticated()) {
        // Autenticar usuário com credenciais
        try {
          const user = await new Promise<any>((resolve, reject) => {
            passport.authenticate('local', (err: Error, user: any) => {
              if (err) reject(err);
              if (!user) reject(new Error("Credenciais inválidas"));
              resolve(user);
            })({ body: { username, password } }, res);
          });
          
          if (user) {
            console.log(`Usuário autenticado via credenciais: ${user.name} (ID: ${user.id})`);
            // Não criar sessão, mas usar as informações para este processo
            return await processSubscriptionPayment(user.id, planId, user, res);
          }
        } catch (error) {
          console.error("Erro na autenticação de credenciais:", error);
        }
      }
      
      // Usar ID explícito do corpo da requisição se fornecido (para renovação de assinatura)
      let userId = explicitUserId;
      let userInfo = null;
      
      // Se não temos ID explícito, usamos o usuário autenticado
      if (!userId && req.isAuthenticated()) {
        userId = req.user.id;
        userInfo = req.user;
        console.log(`Usando usuário autenticado: ${req.user.name} (ID: ${req.user.id})`);
      }
      
      // Se ainda não temos ID mas temos username na URL, buscamos o usuário
      if (!userId && req.query.username) {
        const user = await storage.getUserByUsername(req.query.username as string);
        if (user) {
          userId = user.id;
          userInfo = user;
          console.log(`Usuário identificado pela URL: ${user.name} (ID: ${user.id})`);
        }
      }
      
      // Se ainda não temos ID mas temos username no corpo, buscamos o usuário
      if (!userId && username) {
        const user = await storage.getUserByUsername(username);
        if (user) {
          userId = user.id;
          userInfo = user;
          console.log(`Usuário identificado pelo corpo da requisição: ${user.name} (ID: ${user.id})`);
        }
      }
      
      // Se obtivemos um ID de usuário, prosseguimos com o pagamento
      if (!userId) {
        return res.status(401).json({ 
          error: "Identificação necessária", 
          message: "Não foi possível identificar o usuário para renovação de assinatura. Por favor, faça login ou verifique o link." 
        });
      }
      
      // Gerar o pagamento e retornar
      return await processSubscriptionPayment(userId, planId, userInfo, res);
      
    } catch (error: any) {
      console.error("Erro ao gerar pagamento de assinatura:", error);
      res.status(500).json({ error: error.message || "Falha ao gerar pagamento" });
    }
  });
  
  // Rota para verificar status do pagamento (sem exigir autenticação)
  app.get("/api/subscription/payment-status/:transactionId", async (req: Request, res: Response) => {
    try {
      const { transactionId } = req.params;
      if (!transactionId) {
        return res.status(400).json({ error: "ID da transação é obrigatório" });
      }
      
      // Verificar se temos um username na consulta
      if (req.query.username) {
        const username = req.query.username as string;
        console.log(`Verificando status para transação ${transactionId} com username ${username}`);
        
        // Buscar usuário pelo username
        const user = await storage.getUserByUsername(username);
        if (user) {
          // Log para debug
          console.log(`Usuário encontrado: ${user.name} (ID: ${user.id})`);
        }
      } else {
        console.log(`Verificando status para transação ${transactionId} sem username`);
      }
      
      const statusData = await subscriptionService.checkPaymentStatus(transactionId);
      res.json(statusData);
    } catch (error: any) {
      console.error("Erro ao verificar status do pagamento:", error);
      res.status(500).json({ error: error.message || "Falha ao verificar status do pagamento" });
    }
  });
  
  // Rota para renovação de assinatura expirada
  app.get("/api/subscription/expired", async (req: Request, res: Response) => {
    // Endpoint apenas para verificar se a assinatura expirou e redirecionar
    res.json({
      expired: true,
      renewUrl: '/renew-subscription'
    });
  });
  
  // Rota para obter o histórico de assinaturas do usuário
  app.get("/api/subscription/history", async (req: Request, res: Response) => {
    try {
      // Verificação de autenticação mais robusta
      if (!req.isAuthenticated()) {
        console.log("Usuário não autenticado ao tentar acessar histórico de assinaturas");
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const userId = req.user!.id;
      console.log(`Buscando histórico de assinaturas para usuário ${userId}`);
      
      // Verificar se é para usar dados de fallback (debug)
      const useFallback = req.query.fallback === 'true';
      
      if (!useFallback) {
        try {
          // Usar o serviço de assinaturas para buscar o histórico
          const subscriptionService = new SubscriptionService();
          const transactions = await subscriptionService.getUserSubscriptionHistory(userId);
          
          console.log(`Histórico de assinaturas para o usuário ${userId}: ${transactions.length} transações encontradas`);
          
          if (transactions.length > 0) {
            return res.json(transactions);
          }
          // Se não houver transações, cair no fallback para mostrar algo ao usuário
        } catch (dbError: any) {
          console.error("Erro no banco ao buscar histórico:", dbError);
        }
      }
      
      // Se não temos transações reais, verificar se o usuário é novo e está em período de teste
      try {
        // Buscar o usuário diretamente para verificar quando foi criado
        const userDetails = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        
        // O usuário existe e tem dados para verificar
        if (userDetails && userDetails.length > 0) {
          // Verifica se o usuário tem transações de pagamento reais no sistema
          // (isso indica que não é um usuário em período de teste)
          const paidTransactions = await db.select()
            .from(subscriptionTransactions)
            .where(and(
              eq(subscriptionTransactions.userId, userId),
              eq(subscriptionTransactions.status, "paid")
            ))
            .limit(1);
            
          // Se o usuário já tem transações pagas, não está em período de teste
          if (paidTransactions && paidTransactions.length > 0) {
            console.log(`Usuário ${userId} possui transações pagas, não está em período de teste.`);
          } else {
            // Verificar se é um usuário novo (criado há menos de 7 dias)
            const userCreatedAt = new Date(userDetails[0].createdAt);
            const now = new Date();
            const daysSinceCreation = Math.floor((now.getTime() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
            
            // Se o usuário foi criado há menos de 7 dias e não possui transações reais
            // retornar lista vazia - usuário em período de teste
            if (daysSinceCreation < 7) {
              console.log(`Usuário ${userId} está em período de teste (criado há ${daysSinceCreation} dias). Retornando lista vazia.`);
              return res.json([]);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao verificar período de teste:", error);
        // Se ocorrer erro, continuamos com o fallback
      }
      
      // Se não está em período de teste, usar fallback com dados de exemplo
      console.log("Usando dados de fallback para o histórico");
      
      // Obter os planos para associar aos dados de fallback
      const plans = await db.select().from(subscriptionPlans);
      const plano = plans.find(p => p.id === 1) || {
        id: 1,
        name: "Mensal",
        description: "Plano mensal",
        durationMonths: 1,
        price: 4990,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Datas para os exemplos - usando datas fixas para evitar duplicação
      const hoje = new Date();
      const mesPassado = new Date();
      mesPassado.setMonth(mesPassado.getMonth() - 1);
      
      // Para usuários que não estão em período de teste mas não têm transações reais
      // mostrar apenas UMA transação de exemplo para evitar duplicação
      const fallbackData = [
        {
          id: 1000,
          userId: userId,
          planId: plano.id,
          transactionId: "TX-EXAMPLE-1000",
          paymentMethod: "pix",
          status: "paid",
          amount: plano.price,
          pixQrCode: null,
          pixQrCodeBase64: null,
          pixQrCodeExpiration: null,
          paidAt: mesPassado.toISOString(),
          createdAt: mesPassado.toISOString(),
          plan: plano
        }
      ];
      
      res.json(fallbackData);
    } catch (error: any) {
      console.error("Erro ao buscar histórico de assinaturas:", error);
      res.status(500).json({ message: error.message || "Erro ao buscar histórico de assinaturas" });
    }
  });
  
  // Webhook para receber callbacks do Mercado Pago
  app.post("/api/subscription/webhook", async (req: Request, res: Response) => {
    try {
      console.log("Webhook de assinatura recebido:", JSON.stringify(req.body));
      
      if (req.body.type === 'payment' && req.body.data) {
        await subscriptionService.processPaymentWebhook(req.body);
      }
      
      res.sendStatus(200);
    } catch (error: any) {
      console.error("Erro ao processar webhook de assinatura:", error);
      // Sempre retornar 200 para não retentar
      res.sendStatus(200);
    }
  });
  
  // Rotas de administração para gerenciar planos de assinatura
  app.get("/api/admin/subscription/plans", isAdmin, async (req: Request, res: Response) => {
    try {
      const plans = await subscriptionService.getAllPlans();
      res.json(plans);
    } catch (error: any) {
      console.error("Erro ao buscar planos de assinatura:", error);
      res.status(500).json({ error: error.message || "Falha ao buscar planos de assinatura" });
    }
  });
  
  app.patch("/api/admin/subscription/plans/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { price } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de plano inválido" });
      }
      
      if (typeof price !== "number" || isNaN(price)) {
        return res.status(400).json({ error: "Preço inválido" });
      }
      
      const updatedPlan = await subscriptionService.updatePlanPrice(id, price);
      res.json(updatedPlan);
    } catch (error: any) {
      console.error("Erro ao atualizar preço do plano:", error);
      res.status(500).json({ error: error.message || "Falha ao atualizar preço do plano" });
    }
  });

  return httpServer;
}
