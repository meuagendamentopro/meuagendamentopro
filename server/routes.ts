import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { 
  insertServiceSchema, 
  insertClientSchema, 
  insertAppointmentSchema, 
  bookingFormSchema,
  AppointmentStatus,
  services,
  clients,
  providerClients,
  appointments,
  notifications,
  InsertProvider
} from "@shared/schema";
import { z } from "zod";
import { setupAuth, hashPassword } from "./auth";
import { WebSocketServer, WebSocket } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  // Configurar autenticação
  setupAuth(app);
  
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
      connectedClients.delete(ws);
      console.log(`Conexão WebSocket fechada: código ${code}, razão: ${reason || 'N/A'}`);
    });
  });
  
  // Função auxiliar para enviar atualizações em tempo real
  function broadcastUpdate(type: string, data: any) {
    const message = JSON.stringify({ type, data });
    let sentCount = 0;
    let errorCount = 0;
    
    connectedClients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          sentCount++;
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
    
    console.log(`Broadcast realizado: ${type} - Enviado para ${sentCount} clientes, ${errorCount} erros`);
  }
  
  // Tornar a função broadcastUpdate disponível para outras partes do código
  (global as any).broadcastUpdate = broadcastUpdate;
  
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
      // Busca o provider associado ao usuário atual
      const provider = await storage.getProviderByUserId(req.user.id);
      
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
      
      // Usar diretamente as funções do Drizzle ORM
      try {
        console.log("Limpando notificações...");
        await db.delete(notifications);
        console.log("Notificações removidas com sucesso");
        
        console.log("Limpando agendamentos...");
        await db.delete(appointments);
        console.log("Agendamentos removidos com sucesso");
        
        console.log("Limpando associações entre provedores e clientes...");
        await db.delete(providerClients);
        console.log("Associações entre provedores e clientes removidas com sucesso");
        
        console.log("Limpando clientes...");
        await db.delete(clients);
        console.log("Clientes removidos com sucesso");
        
        console.log("Limpando serviços...");
        await db.delete(services);
        console.log("Serviços removidos com sucesso");
        
        // Envia notificação em tempo real
        broadcastUpdate('database_cleared', { message: 'Banco de dados limpo com sucesso' });
        
        res.status(200).json({ 
          success: true, 
          message: "Banco de dados limpo com sucesso. Todas as tabelas exceto usuários e provedores foram limpas." 
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
  
  app.post("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, username, password, role } = req.body;
      
      // Validar dados
      if (!name || !username || !password || !role) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Nome de usuário já existe" });
      }
      
      // Criar o usuário com senha hasheada
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        name,
        username,
        password: hashedPassword,
        role,
      });
      
      // Se for um usuário do tipo provider, criar também um provider associado
      if (role === 'provider') {
        try {
          // Gerar um link de agendamento único baseado no nome de usuário
          const bookingLink = username.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Criar provider associado ao usuário
          const provider = await storage.createProvider({
            userId: user.id,
            name: `${name}'s Service`,
            email: `${username}@example.com`, // Email temporário baseado no nome de usuário
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
      
      const { name, username, password, role } = req.body;
      const updateData: Partial<{ name: string, username: string, password: string, role: string }> = {};
      
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

  // Provider routes
  app.get("/api/providers", async (req: Request, res: Response) => {
    const providers = await storage.getProviders();
    res.json(providers);
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
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid provider ID" });
    }
    
    const provider = await storage.getProvider(id);
    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }
    
    try {
      // Validar os campos de horário de trabalho
      const { workingHoursStart, workingHoursEnd, workingDays } = req.body;
      
      if (workingHoursStart === undefined || workingHoursEnd === undefined) {
        return res.status(400).json({ 
          message: "Missing required fields",
          errors: ["workingHoursStart and workingHoursEnd are required"]
        });
      }
      
      if (typeof workingHoursStart !== 'number' || typeof workingHoursEnd !== 'number') {
        return res.status(400).json({ 
          message: "Invalid data types",
          errors: ["workingHoursStart and workingHoursEnd must be numbers"]
        });
      }
      
      if (workingHoursStart < 0 || workingHoursStart > 23 || workingHoursEnd < 1 || workingHoursEnd > 24) {
        return res.status(400).json({ 
          message: "Invalid hour range",
          errors: ["workingHoursStart must be between 0-23 and workingHoursEnd must be between 1-24"]
        });
      }
      
      if (workingHoursEnd <= workingHoursStart) {
        return res.status(400).json({ 
          message: "Invalid hour range",
          errors: ["workingHoursEnd must be greater than workingHoursStart"]
        });
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
      
      // Agora temos um método específico no storage para atualizar o provedor
      const providerData: Partial<InsertProvider> = {
        workingHoursStart,
        workingHoursEnd
      };
      
      // Adicionar workingDays ao update se fornecido
      if (workingDays !== undefined) {
        providerData.workingDays = workingDays;
      }
      
      const updatedProvider = await storage.updateProvider(id, providerData);
      if (!updatedProvider) {
        return res.status(500).json({ message: "Falha ao atualizar as configurações do provedor" });
      }
      
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
        
        // Associar cliente existente a este provider, se ainda não estiver associado
        try {
          const belongsToProvider = await storage.clientBelongsToProvider(provider.id, existingClient.id);
          if (!belongsToProvider) {
            await storage.associateClientWithProvider(provider.id, existingClient.id);
            console.log(`Cliente existente #${existingClient.id} associado ao provider #${provider.id}`);
          } else {
            console.log(`Cliente #${existingClient.id} já está associado ao provider #${provider.id}`);
          }
        } catch (err) {
          console.error("Erro ao associar cliente existente:", err);
        }
        
        return res.json(existingClient);
      }
      
      // Criar o cliente
      const client = await storage.createClient(data);
      console.log(`Novo cliente criado: ${client.name} (ID: ${client.id})`);
      
      // Associar o cliente diretamente ao provider usando a tabela de associação
      try {
        await storage.associateClientWithProvider(provider.id, client.id);
        console.log(`Novo cliente #${client.id} associado ao provider #${provider.id}`);
      } catch (err) {
        console.error("Erro ao associar cliente ao provider:", err);
        // Não falha a operação se a associação não for criada, apenas loga o erro
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
  
  // Rota para excluir cliente (implementada como soft delete)
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
      // Usando associação direta em vez de buscar todos os clientes
      const clientBelongsToProvider = await storage.clientBelongsToProvider(provider.id, client.id);
      
      if (!clientBelongsToProvider) {
        return res.status(403).json({ 
          error: "Acesso não autorizado", 
          message: "Você não tem permissão para excluir este cliente" 
        });
      }
      
      // Verificar se o cliente possui agendamentos
      const appointments = await storage.getAppointments(provider.id);
      const hasAppointments = appointments.some(a => a.clientId === id);
      
      if (hasAppointments) {
        // Implementar soft delete - atualiza o cliente com flag desativado 
        const updatedClient = await storage.updateClient(id, { 
          notes: `[DESATIVADO] ${client.notes || ''}`,
          // Se tivermos um campo 'active' no futuro, poderíamos usar aqui
        });
        
        return res.json({ 
          message: "Cliente marcado como desativado pois possui agendamentos", 
          client: updatedClient 
        });
      }
      
      // Se não tiver agendamentos, poderia implementar hard delete no futuro
      // Por enquanto, apenas marca como desativado
      const updatedClient = await storage.updateClient(id, { 
        notes: `[DESATIVADO] ${client.notes || ''}`,
      });
      
      res.json({ 
        message: "Cliente desativado com sucesso",
        client: updatedClient
      });
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      res.status(500).json({ message: "Falha ao excluir cliente" });
    }
  });

  // Rota para obter o provider do usuário logado
  app.get("/api/my-provider", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    
    try {
      const provider = await storage.getProviderByUserId(req.user.id);
      
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
        const bookingLink = user.username.toLowerCase();
        await storage.updateProvider(provider.id, { bookingLink });
        provider.bookingLink = bookingLink;
      }
    }
    
    // URL do link de compartilhamento
    const bookingPath = `/booking/${provider.bookingLink || provider.id}`;
    
    res.json({ 
      bookingLink: bookingPath,
      linkId: provider.bookingLink || provider.id.toString(),
      fullUrl: `${req.protocol}://${req.get('host')}${bookingPath}`
    });
  });
  
  // Rota para buscar um provider pelo bookingLink
  app.get("/api/providers/booking/:linkId", async (req: Request, res: Response) => {
    const { linkId } = req.params;
    
    try {
      console.log(`Buscando provider pelo linkId: ${linkId}`);
      
      // Tenta primeiro buscar pelo bookingLink (prioridade)
      const providers = await storage.getProviders();
      let provider = providers.find(p => p.bookingLink === linkId);
      
      // Se não encontrar pelo bookingLink, tenta como ID numérico (para compatibilidade)
      if (!provider) {
        const id = parseInt(linkId);
        if (!isNaN(id)) {
          provider = await storage.getProvider(id);
        }
      }
      
      if (provider) {
        console.log(`Provider encontrado: ${provider.name} (ID: ${provider.id})`);
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
    
    // Parse date filter parameters
    const dateParam = req.query.date as string;
    const startDateParam = req.query.startDate as string;
    const endDateParam = req.query.endDate as string;
    
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
      appointments = await storage.getAppointmentsByDate(providerId, date);
    } else if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      appointments = await storage.getAppointmentsByDateRange(providerId, startDate, endDate);
    } else {
      appointments = await storage.getAppointments(providerId);
    }
    
    // Enriquecer os agendamentos com informações de cliente e serviço
    const enrichedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        // Obter cliente
        const client = await storage.getClient(appointment.clientId);
        
        // Obter serviço
        const service = await storage.getService(appointment.serviceId);
        
        return {
          ...appointment,
          clientName: client?.name || "Cliente não encontrado",
          serviceName: service?.name || "Serviço não encontrado",
          servicePrice: service?.price || 0,
          serviceDuration: service?.duration || 0
        };
      })
    );
    
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
      appointments = await storage.getAppointmentsByDate(providerId, date);
    } else if (startDateParam && endDateParam) {
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }
      appointments = await storage.getAppointmentsByDateRange(providerId, startDate, endDate);
    } else {
      appointments = await storage.getAppointments(providerId);
    }
    
    // Enriquecer os agendamentos com informações de cliente e serviço
    const enrichedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        // Obter cliente
        const client = await storage.getClient(appointment.clientId);
        
        // Obter serviço
        const service = await storage.getService(appointment.serviceId);
        
        return {
          ...appointment,
          clientName: client?.name || "Cliente não encontrado",
          serviceName: service?.name || "Serviço não encontrado",
          servicePrice: service?.price || 0,
          serviceDuration: service?.duration || 0
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
      console.log("Criando agendamento com dados:", JSON.stringify(req.body, null, 2));
      
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
      
      // Verifica disponibilidade
      const isAvailable = await storage.checkAvailability(
        data.providerId, 
        data.date, 
        service.duration
      );
      
      if (!isAvailable) {
        return res.status(409).json({ message: "Horário indisponível" });
      }
      
      // Calcula o horário de término baseado na duração do serviço
      const endTime = new Date(data.date.getTime() + service.duration * 60000);
      console.log(`Horário calculado para o agendamento: ${data.date.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`);
      
      // Cria o agendamento com o horário de término explícito
      const appointment = await storage.createAppointment({
        ...data,
        endTime
      });
      
      // Enviar atualização em tempo real via WebSocket
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
          console.log(`Notificação criada para o usuário ${provider.userId}`);
        } catch (error) {
          console.error("Erro ao criar notificação:", error);
        }
      }
      
      // Aqui enviaríamos uma notificação via WhatsApp
      // Por enquanto, apenas logamos
      console.log(`Agendamento ${appointment.id} criado com sucesso! Notificação seria enviada.`);
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      
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
        ])
      });
      
      const { status } = statusSchema.parse(req.body);
      const updatedAppointment = await storage.updateAppointmentStatus(id, status);
      
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
            message = `O agendamento #${updatedAppointment.id} foi cancelado`;
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
    
    console.log(`Data param: ${dateParam}`);
    console.log(`Service ID param: ${serviceIdParam}`);
    
    if (!dateParam || !serviceIdParam) {
      console.log(`❌ Data ou ID do serviço ausentes`);
      return res.status(400).json({ message: "Date and serviceId are required" });
    }
    
    const date = new Date(dateParam);
    const serviceId = parseInt(serviceIdParam);
    
    console.log(`Data convertida: ${date.toISOString()} (${date.toLocaleString()})`);
    console.log(`ID do serviço: ${serviceId}`);
    
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
    
    const isAvailable = await storage.checkAvailability(providerId, date, service.duration);
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
          // Formato ISO (YYYY-MM-DD) - usando Date.UTC para garantir consistência no fuso horário
          const [year, month, day] = bookingData.date.split('-').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
          
          // Usamos diretamente o horário informado, sem nenhuma compensação
          // Como queremos trabalhar com o horário de Brasília (GMT-3)
          appointmentDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
          console.log(`Usando horário de Brasília: ${hour}:${minute} (dia ${day}/${month}/${year})`);
          
        } else if (bookingData.date.includes('/')) {
          // Formato BR (DD/MM/YYYY) - usando Date.UTC para garantir consistência no fuso horário
          const [day, month, year] = bookingData.date.split('/').map(Number);
          const [hour, minute] = bookingData.time.split(':').map(Number);
        
          if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(minute)) {
            throw new Error(`Valores inválidos: ano=${year}, mês=${month}, dia=${day}, hora=${hour}, minuto=${minute}`);
          }
        
          // Usamos diretamente o horário informado, sem nenhuma compensação
          // Como queremos trabalhar com o horário de Brasília (GMT-3)
          appointmentDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
          console.log(`Usando horário de Brasília: ${hour}:${minute} (dia ${day}/${month}/${year})`);
          
        } else {
          // Tentar como timestamp ou outro formato - usando UTC para consistência
          const baseDate = new Date(bookingData.date);
          const [hour, minute] = bookingData.time.split(':').map(Number);
          
          // Usamos diretamente o horário informado, sem nenhuma compensação
          // Como queremos trabalhar com o horário de Brasília (GMT-3)
          appointmentDate = new Date(Date.UTC(
            baseDate.getFullYear(),
            baseDate.getMonth(),
            baseDate.getDate(),
            hour, minute, 0
          ));
          console.log(`Usando horário de Brasília: ${hour}:${minute} (dia ${baseDate.getDate()}/${baseDate.getMonth()+1}/${baseDate.getFullYear()})`);
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
      
      // Cria o agendamento
      const appointment = await storage.createAppointment({
        providerId: service.providerId,
        clientId: client.id,
        serviceId: bookingData.serviceId,
        date: appointmentDate,
        endTime: endTime,
        status: AppointmentStatus.PENDING,
        notes: bookingData.notes || ""
      });
      
      // Enviar atualização em tempo real via WebSocket
      broadcastUpdate('appointment_created', appointment);
      
      // Criar uma notificação para o prestador de serviço
      const provider = await storage.getProvider(service.providerId);
      if (provider && provider.userId) {
        try {
          await storage.createNotification({
            userId: provider.userId,
            title: "Novo agendamento",
            message: `${client.name} agendou ${service.name} para ${appointmentDate.toLocaleString('pt-BR')}`,
            type: 'appointment',
            appointmentId: appointment.id
          });
          console.log(`Notificação criada para o usuário ${provider.userId}`);
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

  return httpServer;
}
