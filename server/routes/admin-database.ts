import { Router } from 'express';
import { db } from '../db';
import { users, providers, clients, services, appointments, notifications, subscriptionPlans, subscriptionTransactions } from '@shared/schema';
import { hashPassword } from '../auth';
import { eq, ne } from 'drizzle-orm';

const router = Router();

// Middleware para verificar se o usuário é admin
function isAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem acessar esta área.' });
  }
  
  next();
}

// Aplicar middleware de admin em todas as rotas
router.use(isAdmin);

// ===== USUÁRIOS =====
// Listar todos os usuários
router.get('/users', async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(users.id);
    
    // Remover senhas dos resultados
    const usersWithoutPasswords = allUsers.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    res.json(usersWithoutPasswords);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Obter um usuário específico
router.get('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user || user.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Remover senha do resultado
    const { password, ...userWithoutPassword } = user[0];
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Adicionar um novo usuário
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, isActive } = req.body;
    // Normalizar o nome de usuário para letras minúsculas
    const username = req.body.username.toLowerCase();
    
    // Verificar se o usuário já existe
    const existingUser = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ error: 'Nome de usuário já está em uso' });
    }
    
    // Verificar se o email já existe
    const existingEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }
    
    // Hash da senha
    const hashedPassword = await hashPassword(password);
    
    // Inserir o novo usuário
    const newUser = await db.insert(users).values({
      name,
      username,
      email,
      password: hashedPassword,
      role: role || 'provider',
      isActive: isActive !== undefined ? isActive : true,
      isEmailVerified: false,
    }).returning();
    
    // Remover senha do resultado
    const { password: _, ...userWithoutPassword } = newUser[0];
    
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Atualizar um usuário existente
router.put('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { name, username, email, password, role, isActive } = req.body;
    
    // Verificar se o usuário existe
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser || existingUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se o username já está em uso por outro usuário
    if (username) {
      const usernameInUse = await db.select().from(users)
        .where(
          // Combinando as condições com AND lógico
          eq(users.username, username) && ne(users.id, userId)
        )
        .limit(1);
      
      if (usernameInUse && usernameInUse.length > 0) {
        return res.status(400).json({ error: 'Nome de usuário já está em uso' });
      }
    }
    
    // Verificar se o email já está em uso por outro usuário
    if (email) {
      const emailInUse = await db.select().from(users)
        .where(
          // Combinando as condições com AND lógico
          eq(users.email, email) && ne(users.id, userId)
        )
        .limit(1);
      
      if (emailInUse && emailInUse.length > 0) {
        return res.status(400).json({ error: 'Email já está em uso' });
      }
    }
    
    // Preparar dados para atualização
    const updateData: any = {};
    if (name) updateData.name = name;
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Se uma senha foi fornecida, hash e adicione aos dados de atualização
    if (password) {
      updateData.password = await hashPassword(password);
    }
    
    // Atualizar o usuário
    const updatedUser = await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    // Remover senha do resultado
    const { password: _, ...userWithoutPassword } = updatedUser[0];
    
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Excluir um usuário
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Verificar se o usuário existe
    const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existingUser || existingUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Não permitir excluir o próprio usuário
    if (req.user && req.user.id === userId) {
      return res.status(400).json({ error: 'Não é possível excluir o próprio usuário' });
    }
    
    // Excluir o usuário
    await db.delete(users).where(eq(users.id, userId));
    
    res.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// ===== PRESTADORES =====
// Listar todos os prestadores
router.get('/providers', async (req, res) => {
  try {
    const allProviders = await db.select().from(providers).orderBy(providers.id);
    res.json(allProviders);
  } catch (error) {
    console.error('Erro ao buscar prestadores:', error);
    res.status(500).json({ error: 'Erro ao buscar prestadores' });
  }
});

// Obter um prestador específico
router.get('/providers/:id', async (req, res) => {
  try {
    const providerId = parseInt(req.params.id);
    const provider = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    
    if (!provider || provider.length === 0) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }
    
    res.json(provider[0]);
  } catch (error) {
    console.error('Erro ao buscar prestador:', error);
    res.status(500).json({ error: 'Erro ao buscar prestador' });
  }
});

// Adicionar um novo prestador
router.post('/providers', async (req, res) => {
  try {
    const { userId, name, email, phone, bookingLink, workingHoursStart, workingHoursEnd } = req.body;
    
    // Validar dados
    if (!userId || !name || !email) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Verificar se o usuário existe
    const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userExists || userExists.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se já existe um prestador com este userId
    const existingProvider = await db.select().from(providers).where(eq(providers.userId, userId)).limit(1);
    if (existingProvider && existingProvider.length > 0) {
      return res.status(400).json({ error: 'Este usuário já está associado a um prestador' });
    }
    
    // Criar o prestador
    const newProvider = await db.insert(providers).values({
      userId,
      name,
      email,
      phone: phone || '',
      bookingLink: bookingLink || '',
      workingHoursStart: workingHoursStart || 8,
      workingHoursEnd: workingHoursEnd || 18,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    res.status(201).json(newProvider[0]);
  } catch (error) {
    console.error('Erro ao criar prestador:', error);
    res.status(500).json({ error: 'Erro ao criar prestador' });
  }
});

// Atualizar um prestador existente
router.put('/providers/:id', async (req, res) => {
  try {
    const providerId = parseInt(req.params.id);
    const { name, email, phone, bookingLink, workingHoursStart, workingHoursEnd } = req.body;
    
    // Verificar se o prestador existe
    const existingProvider = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    if (!existingProvider || existingProvider.length === 0) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }
    
    // Atualizar o prestador
    const updatedProvider = await db.update(providers)
      .set({
        name: name || existingProvider[0].name,
        email: email || existingProvider[0].email,
        phone: phone !== undefined ? phone : existingProvider[0].phone,
        bookingLink: bookingLink !== undefined ? bookingLink : existingProvider[0].bookingLink,
        workingHoursStart: workingHoursStart !== undefined ? workingHoursStart : existingProvider[0].workingHoursStart,
        workingHoursEnd: workingHoursEnd !== undefined ? workingHoursEnd : existingProvider[0].workingHoursEnd,
        updatedAt: new Date()
      })
      .where(eq(providers.id, providerId))
      .returning();
    
    res.json(updatedProvider[0]);
  } catch (error) {
    console.error('Erro ao atualizar prestador:', error);
    res.status(500).json({ error: 'Erro ao atualizar prestador' });
  }
});

// Excluir um prestador
router.delete('/providers/:id', async (req, res) => {
  try {
    const providerId = parseInt(req.params.id);
    
    // Verificar se o prestador existe
    const existingProvider = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    if (!existingProvider || existingProvider.length === 0) {
      return res.status(404).json({ error: 'Prestador não encontrado' });
    }
    
    // Excluir o prestador
    await db.delete(providers).where(eq(providers.id, providerId));
    
    res.json({ message: 'Prestador excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir prestador:', error);
    res.status(500).json({ error: 'Erro ao excluir prestador' });
  }
});

// ===== CLIENTES =====
// Listar todos os clientes
router.get('/clients', async (req, res) => {
  try {
    const allClients = await db.select().from(clients).orderBy(clients.id);
    res.json(allClients);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// Obter um cliente específico
router.get('/clients/:id', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const client = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    
    if (!client || client.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    res.json(client[0]);
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
});

// Adicionar um novo cliente
router.post('/clients', async (req, res) => {
  try {
    const { name, email, phone, notes, active, isBlocked } = req.body;
    
    // Validar dados
    if (!name || !phone) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Criar o cliente
    const newClient = await db.insert(clients).values({
      name,
      phone,
      email: email || null,
      notes: notes || null,
      active: active !== undefined ? active : true,
      isBlocked: isBlocked !== undefined ? isBlocked : false
    }).returning();
    
    res.status(201).json(newClient[0]);
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// Atualizar um cliente existente
router.put('/clients/:id', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { name, email, phone, notes, active, isBlocked } = req.body;
    
    // Verificar se o cliente existe
    const existingClient = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    // Atualizar o cliente
    const updatedClient = await db.update(clients)
      .set({
        name: name || existingClient[0].name,
        email: email !== undefined ? email : existingClient[0].email,
        phone: phone !== undefined ? phone : existingClient[0].phone,
        notes: notes !== undefined ? notes : existingClient[0].notes,
        active: active !== undefined ? active : existingClient[0].active,
        isBlocked: isBlocked !== undefined ? isBlocked : existingClient[0].isBlocked
      })
      .where(eq(clients.id, clientId))
      .returning();
    
    res.json(updatedClient[0]);
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// Excluir um cliente
router.delete('/clients/:id', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    
    // Verificar se o cliente existe
    const existingClient = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!existingClient || existingClient.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    // Excluir o cliente
    await db.delete(clients).where(eq(clients.id, clientId));
    
    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
});

// ===== SERVIÇOS =====
// Listar todos os serviços
router.get('/services', async (req, res) => {
  try {
    const allServices = await db.select().from(services).orderBy(services.id);
    res.json(allServices);
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

// Obter um serviço específico
router.get('/services/:id', async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    
    if (!service || service.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    
    res.json(service[0]);
  } catch (error) {
    console.error('Erro ao buscar serviço:', error);
    res.status(500).json({ error: 'Erro ao buscar serviço' });
  }
});

// Adicionar um novo serviço
router.post('/services', async (req, res) => {
  try {
    const { providerId, name, description, duration, price, active } = req.body;
    
    // Validar dados
    if (!providerId || !name || !duration || price === undefined) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Verificar se o prestador existe
    const providerExists = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    if (!providerExists || providerExists.length === 0) {
      return res.status(400).json({ error: 'Prestador não encontrado' });
    }
    
    // Criar o serviço
    const newService = await db.insert(services).values({
      providerId,
      name,
      description: description || null,
      duration,
      price,
      active: active !== undefined ? active : true
    }).returning();
    
    res.status(201).json(newService[0]);
  } catch (error) {
    console.error('Erro ao criar serviço:', error);
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

// Atualizar um serviço existente
router.put('/services/:id', async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const { name, description, duration, price, active } = req.body;
    
    // Verificar se o serviço existe
    const existingService = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    if (!existingService || existingService.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    
    // Atualizar o serviço
    const updatedService = await db.update(services)
      .set({
        name: name || existingService[0].name,
        description: description !== undefined ? description : existingService[0].description,
        duration: duration !== undefined ? duration : existingService[0].duration,
        price: price !== undefined ? price : existingService[0].price,
        active: active !== undefined ? active : existingService[0].active
      })
      .where(eq(services.id, serviceId))
      .returning();
    
    res.json(updatedService[0]);
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error);
    res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
});

// Excluir um serviço
router.delete('/services/:id', async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    
    // Verificar se o serviço existe
    const existingService = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
    if (!existingService || existingService.length === 0) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    
    // Excluir o serviço
    await db.delete(services).where(eq(services.id, serviceId));
    
    res.json({ message: 'Serviço excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir serviço:', error);
    res.status(500).json({ error: 'Erro ao excluir serviço' });
  }
});

// ===== AGENDAMENTOS =====
// Listar todos os agendamentos
router.get('/appointments', async (req, res) => {
  try {
    const allAppointments = await db.select().from(appointments).orderBy(appointments.date);
    res.json(allAppointments);
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamentos' });
  }
});

// Obter um agendamento específico
router.get('/appointments/:id', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const appointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    
    if (!appointment || appointment.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    res.json(appointment[0]);
  } catch (error) {
    console.error('Erro ao buscar agendamento:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamento' });
  }
});

// Adicionar um novo agendamento
router.post('/appointments', async (req, res) => {
  try {
    const { 
      providerId, 
      clientId, 
      serviceId, 
      date, 
      startTime, 
      endTime, 
      status, 
      notes,
      paymentStatus,
      paymentAmount,
      paymentMethod
    } = req.body;
    
    // Validar dados
    if (!providerId || !clientId || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Verificar se o prestador existe
    const providerExists = await db.select().from(providers).where(eq(providers.id, providerId)).limit(1);
    if (!providerExists || providerExists.length === 0) {
      return res.status(400).json({ error: 'Prestador não encontrado' });
    }
    
    // Verificar se o cliente existe
    const clientExists = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!clientExists || clientExists.length === 0) {
      return res.status(400).json({ error: 'Cliente não encontrado' });
    }
    
    // Verificar se o serviço existe (se fornecido)
    if (serviceId) {
      const serviceExists = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
      if (!serviceExists || serviceExists.length === 0) {
        return res.status(400).json({ error: 'Serviço não encontrado' });
      }
    }
    
    // Criar o agendamento
    const appointmentDate = new Date(date);
    const endTimeDate = new Date(endTime);
    const newAppointment = await db.insert(appointments).values({
      providerId,
      clientId,
      serviceId: serviceId || null,
      date: appointmentDate,
      endTime: endTimeDate,
      status: status || 'pending',
      notes: notes || null,
      paymentStatus: paymentStatus || 'not_required',
      paymentAmount: paymentAmount || null,
      requiresPayment: false
    }).returning();
    
    res.status(201).json(newAppointment[0]);
  } catch (error) {
    console.error('Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// Atualizar um agendamento existente
router.put('/appointments/:id', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const { 
      providerId, 
      clientId, 
      serviceId, 
      date, 
      startTime, 
      endTime, 
      status, 
      notes,
      paymentStatus,
      paymentAmount,
      paymentMethod
    } = req.body;
    
    // Verificar se o agendamento existe
    const existingAppointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!existingAppointment || existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Preparar os dados para atualização
    const updateData: any = {};
    
    if (providerId !== undefined) updateData.providerId = providerId;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (serviceId !== undefined) updateData.serviceId = serviceId;
    if (date !== undefined) updateData.date = new Date(date);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentAmount !== undefined) updateData.paymentAmount = paymentAmount;
    if (req.body.requiresPayment !== undefined) updateData.requiresPayment = req.body.requiresPayment;
    if (req.body.cancellationReason !== undefined) updateData.cancellationReason = req.body.cancellationReason;
    
    // Atualizar o agendamento
    const updatedAppointment = await db.update(appointments)
      .set(updateData)
      .where(eq(appointments.id, appointmentId))
      .returning();
    
    res.json(updatedAppointment[0]);
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

// Excluir um agendamento
router.delete('/appointments/:id', async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    
    // Verificar se o agendamento existe
    const existingAppointment = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
    if (!existingAppointment || existingAppointment.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Excluir o agendamento
    await db.delete(appointments).where(eq(appointments.id, appointmentId));
    
    res.json({ message: 'Agendamento excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error);
    res.status(500).json({ error: 'Erro ao excluir agendamento' });
  }
});

// ===== PLANOS DE ASSINATURA =====
// Listar todos os planos de assinatura
router.get('/subscription-plans', async (req, res) => {
  try {
    const allPlans = await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.id);
    res.json(allPlans);
  } catch (error) {
    console.error('Erro ao buscar planos de assinatura:', error);
    res.status(500).json({ error: 'Erro ao buscar planos de assinatura' });
  }
});

// Obter um plano de assinatura específico
router.get('/subscription-plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    
    if (!plan || plan.length === 0) {
      return res.status(404).json({ error: 'Plano de assinatura não encontrado' });
    }
    
    res.json(plan[0]);
  } catch (error) {
    console.error('Erro ao buscar plano de assinatura:', error);
    res.status(500).json({ error: 'Erro ao buscar plano de assinatura' });
  }
});

// Adicionar um novo plano de assinatura
router.post('/subscription-plans', async (req, res) => {
  try {
    const { name, description, price, durationMonths, isActive, accountType } = req.body;
    
    // Validar dados
    if (!name || !price || !durationMonths) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Validar accountType
    if (accountType && !['individual', 'company'].includes(accountType)) {
      return res.status(400).json({ error: 'Tipo de conta inválido. Use "individual" ou "company"' });
    }
    
    // Criar o plano de assinatura
    const newPlan = await db.insert(subscriptionPlans).values({
      name,
      description: description || null,
      price,
      durationMonths,
      isActive: isActive !== undefined ? isActive : true,
      accountType: accountType || 'individual',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    res.status(201).json(newPlan[0]);
  } catch (error) {
    console.error('Erro ao criar plano de assinatura:', error);
    res.status(500).json({ error: 'Erro ao criar plano de assinatura' });
  }
});

// Atualizar um plano de assinatura existente
router.put('/subscription-plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const { name, description, price, durationMonths, isActive, accountType } = req.body;
    
    // Verificar se o plano existe
    const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    if (!existingPlan || existingPlan.length === 0) {
      return res.status(404).json({ error: 'Plano de assinatura não encontrado' });
    }
    
    // Validar accountType se fornecido
    if (accountType && !['individual', 'company'].includes(accountType)) {
      return res.status(400).json({ error: 'Tipo de conta inválido. Use "individual" ou "company"' });
    }
    
    // Atualizar o plano
    const updatedPlan = await db.update(subscriptionPlans)
      .set({
        name: name || existingPlan[0].name,
        description: description !== undefined ? description : existingPlan[0].description,
        price: price !== undefined ? price : existingPlan[0].price,
        durationMonths: durationMonths !== undefined ? durationMonths : existingPlan[0].durationMonths,
        isActive: isActive !== undefined ? isActive : existingPlan[0].isActive,
        accountType: accountType || existingPlan[0].accountType,
        updatedAt: new Date()
      })
      .where(eq(subscriptionPlans.id, planId))
      .returning();
    
    res.json(updatedPlan[0]);
  } catch (error) {
    console.error('Erro ao atualizar plano de assinatura:', error);
    res.status(500).json({ error: 'Erro ao atualizar plano de assinatura' });
  }
});

// Excluir um plano de assinatura
router.delete('/subscription-plans/:id', async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    
    // Verificar se o plano existe
    const existingPlan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    if (!existingPlan || existingPlan.length === 0) {
      return res.status(404).json({ error: 'Plano de assinatura não encontrado' });
    }
    
    // Excluir o plano
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
    
    res.json({ message: 'Plano de assinatura excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir plano de assinatura:', error);
    res.status(500).json({ error: 'Erro ao excluir plano de assinatura' });
  }
});

// ===== TRANSAÇÕES DE ASSINATURA =====
// Listar todas as transações de assinatura
router.get('/subscription-transactions', async (req, res) => {
  try {
    const allTransactions = await db.select().from(subscriptionTransactions).orderBy(subscriptionTransactions.id);
    res.json(allTransactions);
  } catch (error) {
    console.error('Erro ao buscar transações de assinatura:', error);
    res.status(500).json({ error: 'Erro ao buscar transações de assinatura' });
  }
});

// Obter uma transação de assinatura específica
router.get('/subscription-transactions/:id', async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const transaction = await db.select().from(subscriptionTransactions).where(eq(subscriptionTransactions.id, transactionId)).limit(1);
    
    if (!transaction || transaction.length === 0) {
      return res.status(404).json({ error: 'Transação de assinatura não encontrada' });
    }
    
    res.json(transaction[0]);
  } catch (error) {
    console.error('Erro ao buscar transação de assinatura:', error);
    res.status(500).json({ error: 'Erro ao buscar transação de assinatura' });
  }
});

// Adicionar uma nova transação de assinatura
router.post('/subscription-transactions', async (req, res) => {
  try {
    const { userId, planId, amount, status, paymentMethod, transactionId, pixQrCode, pixQrCodeBase64, pixQrCodeExpiration } = req.body;
    
    // Validar dados
    if (!userId || !planId || !amount || !status) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }
    
    // Verificar se o usuário existe
    const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userExists || userExists.length === 0) {
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }
    
    // Verificar se o plano existe
    const planExists = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
    if (!planExists || planExists.length === 0) {
      return res.status(400).json({ error: 'Plano de assinatura não encontrado' });
    }
    
    // Criar a transação
    const newTransaction = await db.insert(subscriptionTransactions).values({
      userId,
      planId,
      amount,
      status,
      paymentMethod: paymentMethod || 'pix',
      transactionId: transactionId || null,
      pixQrCode: pixQrCode || null,
      pixQrCodeBase64: pixQrCodeBase64 || null,
      pixQrCodeExpiration: pixQrCodeExpiration || null,
      paidAt: status === 'completed' ? new Date() : null,
      createdAt: new Date()
    }).returning();
    
    // Se a transação for bem-sucedida, atualizar a data de expiração da assinatura do usuário
    if (status === 'completed') {
      const durationMonths = planExists[0].durationMonths;
      let expiryDate = new Date();
      
      // Se o usuário já tem uma assinatura ativa, estender a partir da data atual de expiração
      if (userExists[0].subscriptionExpiry && new Date(userExists[0].subscriptionExpiry) > new Date()) {
        expiryDate = new Date(userExists[0].subscriptionExpiry);
      }
      
      // Adicionar a duração do plano à data de expiração (em meses)
      expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
      
      // Atualizar o usuário
      await db.update(users)
        .set({
          subscriptionExpiry: expiryDate,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    }
    
    res.status(201).json(newTransaction[0]);
  } catch (error) {
    console.error('Erro ao criar transação de assinatura:', error);
    res.status(500).json({ error: 'Erro ao criar transação de assinatura' });
  }
});

// Atualizar uma transação de assinatura existente
router.put('/subscription-transactions/:id', async (req, res) => {
  try {
    const transactionId = parseInt(req.params.id);
    const { status, paymentMethod, pixQrCode, pixQrCodeBase64, pixQrCodeExpiration, paidAt } = req.body;
    
    // Verificar se a transação existe
    const existingTransaction = await db.select().from(subscriptionTransactions).where(eq(subscriptionTransactions.id, transactionId)).limit(1);
    if (!existingTransaction || existingTransaction.length === 0) {
      return res.status(404).json({ error: 'Transação de assinatura não encontrada' });
    }
    
    // Atualizar a transação
    const updatedTransaction = await db.update(subscriptionTransactions)
      .set({
        status: status || existingTransaction[0].status,
        paymentMethod: paymentMethod !== undefined ? paymentMethod : existingTransaction[0].paymentMethod,
        pixQrCode: pixQrCode !== undefined ? pixQrCode : existingTransaction[0].pixQrCode,
        pixQrCodeBase64: pixQrCodeBase64 !== undefined ? pixQrCodeBase64 : existingTransaction[0].pixQrCodeBase64,
        pixQrCodeExpiration: pixQrCodeExpiration !== undefined ? pixQrCodeExpiration : existingTransaction[0].pixQrCodeExpiration,
        paidAt: paidAt !== undefined ? paidAt : (status === 'completed' && existingTransaction[0].status !== 'completed' ? new Date() : existingTransaction[0].paidAt)
      })
      .where(eq(subscriptionTransactions.id, transactionId))
      .returning();
    
    // Se o status foi alterado para 'completed', atualizar a data de expiração da assinatura do usuário
    if (status === 'completed' && existingTransaction[0].status !== 'completed') {
      const userId = existingTransaction[0].userId;
      const planId = existingTransaction[0].planId;
      
      // Buscar o usuário e o plano
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const plan = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
      
      if (user && user.length > 0 && plan && plan.length > 0) {
        const durationMonths = plan[0].durationMonths;
        let expiryDate = new Date();
        
        // Se o usuário já tem uma assinatura ativa, estender a partir da data atual de expiração
        if (user[0].subscriptionExpiry && new Date(user[0].subscriptionExpiry) > new Date()) {
          expiryDate = new Date(user[0].subscriptionExpiry);
        }
        
        // Adicionar a duração do plano à data de expiração (em meses)
        expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
        
        // Atualizar o usuário
        await db.update(users)
          .set({
            subscriptionExpiry: expiryDate,
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));
      }
    }
    
    res.json(updatedTransaction[0]);
  } catch (error) {
    console.error('Erro ao atualizar transação de assinatura:', error);
    res.status(500).json({ error: 'Erro ao atualizar transação de assinatura' });
  }
});

// Exportar o router
export default router;
