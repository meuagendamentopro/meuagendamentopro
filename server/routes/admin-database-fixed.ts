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
    const { name, username, email, password, role, isActive } = req.body;
    
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
        .where(eq(users.username, username))
        .where(ne(users.id, userId))
        .limit(1);
      
      if (usernameInUse && usernameInUse.length > 0) {
        return res.status(400).json({ error: 'Nome de usuário já está em uso' });
      }
    }
    
    // Verificar se o email já está em uso por outro usuário
    if (email) {
      const emailInUse = await db.select().from(users)
        .where(eq(users.email, email))
        .where(ne(users.id, userId))
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

// Exportar o router
export default router;
