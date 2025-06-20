/**
 * Serviço para gerenciar assinaturas e pagamentos teste
 */
import { db, dbWithQueries } from './db';
import { subscriptionPlans, subscriptionTransactions, users } from '../shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { PaymentService } from './payment-service';
import { storage } from './storage';
import { User } from '../shared/schema';
import * as emailService from './email-service';

// Instância do serviço de pagamento
const paymentService = new PaymentService();

export class SubscriptionService {
  constructor() {
    // Inicializar o verificador de pagamentos pendentes
    this.startPaymentStatusChecker();
  }
  
  /**
   * Inicia o verificador periódico de status de pagamentos pendentes
   */
  private startPaymentStatusChecker() {
    // Verificar pagamentos pendentes a cada 5 minutos
    setInterval(async () => {
      try {
        console.log('Verificando pagamentos pendentes...');
        const pendingTransactions = await db.select()
          .from(subscriptionTransactions)
          .where(eq(subscriptionTransactions.status, 'pending'));
        
        console.log(`Encontrados ${pendingTransactions.length} pagamentos pendentes para verificação`);
        
        // Verificar cada transação pendente
        for (const transaction of pendingTransactions) {
          try {
            if (transaction.transactionId) {
              console.log(`Verificando status do pagamento ${transaction.transactionId}...`);
              await this.checkPaymentStatus(transaction.transactionId);
            }
          } catch (error) {
            console.error(`Erro ao verificar transação ${transaction.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar pagamentos pendentes:', error);
      }
    }, 5 * 60 * 1000); // 5 minutos
  }
  
  /**
   * Busca o histórico de assinaturas de um usuário
   */
  async getUserSubscriptionHistory(userId: number) {
    try {
      // Buscar todas as transações do usuário
      const transactions = await db.select()
        .from(subscriptionTransactions)
        .where(eq(subscriptionTransactions.userId, userId))
        .orderBy(desc(subscriptionTransactions.createdAt));

      // Se não houver transações, retornar lista vazia
      if (transactions.length === 0) {
        return [];
      }
      
      // Buscar todos os planos
      const plans = await db.select().from(subscriptionPlans);
      
      // Associar os planos às transações
      const history = transactions.map(transaction => {
        const plan = plans.find(p => p.id === transaction.planId);
        return {
          ...transaction,
          plan: plan || {
            id: transaction.planId,
            name: "Plano não encontrado",
            description: "",
            durationMonths: 1,
            price: transaction.amount,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        };
      });
      
      return history;
    } catch (error) {
      console.error(`Erro ao buscar histórico de assinaturas do usuário ${userId}:`, error);
      throw new Error('Não foi possível buscar o histórico de assinaturas');
    }
  }
  /**
   * Busca todos os planos de assinatura ativos
   * @param accountType - Filtrar por tipo de conta: 'individual', 'company' ou undefined para todos
   */
  async getActivePlans(accountType?: string) {
    try {
      // Construir condições WHERE
      const conditions = [eq(subscriptionPlans.isActive, true)];
      
      // Filtrar por tipo de conta se especificado
      if (accountType && ['individual', 'company'].includes(accountType)) {
        conditions.push(eq(subscriptionPlans.accountType, accountType));
      }
      
      const plans = await db.select()
        .from(subscriptionPlans)
        .where(and(...conditions))
        .orderBy(subscriptionPlans.price);
      
      return plans;
    } catch (error) {
      console.error('Erro ao buscar planos de assinatura:', error);
      throw new Error('Não foi possível buscar os planos de assinatura');
    }
  }
  
  /**
   * Busca um plano específico por ID
   */
  async getPlanById(id: number) {
    try {
      const [plan] = await db.select()
        .from(subscriptionPlans)
        .where(and(
          eq(subscriptionPlans.id, id),
          eq(subscriptionPlans.isActive, true)
        ));
      
      return plan;
    } catch (error) {
      console.error(`Erro ao buscar plano ${id}:`, error);
      throw new Error('Não foi possível buscar o plano de assinatura');
    }
  }
  
  /**
   * Busca todos os planos de assinatura (incluindo inativos) para o admin
   */
  async getAllPlans() {
    try {
      const plans = await db.select()
        .from(subscriptionPlans)
        .orderBy(subscriptionPlans.price);
      
      return plans;
    } catch (error) {
      console.error('Erro ao buscar todos os planos de assinatura:', error);
      throw new Error('Não foi possível buscar os planos de assinatura');
    }
  }
  
  /**
   * Atualiza o preço de um plano de assinatura
   */
  async updatePlanPrice(id: number, price: number) {
    try {
      if (price < 0) {
        throw new Error('O preço não pode ser negativo');
      }
      
      const [updatedPlan] = await db.update(subscriptionPlans)
        .set({ 
          price,
          updatedAt: new Date()
        })
        .where(eq(subscriptionPlans.id, id))
        .returning();
      
      return updatedPlan;
    } catch (error) {
      console.error(`Erro ao atualizar preço do plano ${id}:`, error);
      throw new Error('Não foi possível atualizar o preço do plano');
    }
  }
  
  /**
   * Gera um pagamento PIX para a renovação de assinatura
   */
  async generatePayment(userId: number, planId: number) {
    try {
      // Buscar usuário
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }
      
      // Buscar plano
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plano não encontrado ou inativo');
      }
      
      // Buscar ou criar provider padrão para processamento do pagamento
      const adminUser = await storage.getUserByUsername('admin');
      if (!adminUser) {
        throw new Error('Usuário admin não encontrado para processamento do pagamento');
      }
      
      const adminProvider = await storage.getProviderByUserId(adminUser.id);
      if (!adminProvider) {
        throw new Error('Provider do admin não encontrado para processamento do pagamento');
      }
      
      // Gerar o pagamento PIX usando o serviço de pagamento
      const pixResponse = await paymentService.generatePix({
        appointmentId: 0, // Não é um agendamento
        providerId: adminProvider.id,
        amount: plan.price / 100, // Converter de centavos para reais
        clientName: user.name,
        clientEmail: user.email,
        serviceDescription: `Assinatura ${plan.name} - ${plan.durationMonths} mês(es)`
      });
      
      // Salvar a transação no banco de dados
      const [transaction] = await db.insert(subscriptionTransactions)
        .values({
          userId: userId,
          planId: planId,
          amount: plan.price,
          transactionId: pixResponse.transactionId,
          pixQrCode: pixResponse.qrCode,
          pixQrCodeBase64: pixResponse.qrCodeBase64,
          pixQrCodeExpiration: pixResponse.expiresAt,
          paymentMethod: 'pix',
          status: 'pending'
        })
        .returning();
      
      // Enviar email com os dados do pagamento para o usuário
      await this.sendPaymentEmail(user, plan, pixResponse);
      
      return {
        transactionId: pixResponse.transactionId,
        pixQrCode: pixResponse.qrCode,
        pixQrCodeBase64: pixResponse.qrCodeBase64,
        expiresAt: pixResponse.expiresAt
      };
    } catch (error: any) {
      console.error('Erro ao gerar pagamento para assinatura:', error);
      throw new Error(error.message || 'Não foi possível gerar o pagamento');
    }
  }
  
  /**
   * Envia email com os dados do pagamento para o usuário
   */
  private async sendPaymentEmail(user: User, plan: any, pixResponse: any): Promise<boolean> {
    try {
      console.log(`Enviando email de pagamento para ${user.email}...`);
      const result = await emailService.sendPaymentEmail(user, plan, pixResponse);
      
      if (result) {
        console.log(`Email de pagamento enviado com sucesso para ${user.email}`);
      } else {
        console.error(`Falha ao enviar email de pagamento para ${user.email}`);
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao enviar email de pagamento:', error);
      // Não lançamos o erro para não interromper o fluxo principal
      return false;
    }
  }

  /**
   * Verifica o status de um pagamento
   */
  async checkPaymentStatus(transactionId: string) {
    try {
      // Buscar transação
      const [transaction] = await db.select()
        .from(subscriptionTransactions)
        .where(eq(subscriptionTransactions.transactionId, transactionId));
      
      if (!transaction) {
        throw new Error('Transação não encontrada');
      }
      
      // Verificar o status do pagamento via Mercado Pago
      const paymentStatus = await paymentService.checkPaymentStatus(transactionId);
      
      // Se o status mudou, atualizar na base
      if (transaction.status !== paymentStatus.status) {
        await this.updateTransactionStatus(transaction.id, paymentStatus.status);
        
        // Se o pagamento foi confirmado, renovar a assinatura
        if (paymentStatus.status === 'paid' || paymentStatus.status === 'confirmed' || paymentStatus.status === 'approved') {
          await this.renewSubscription(transaction.userId, transaction.planId);
        }
      }
      
      return {
        status: paymentStatus.status,
        paidAt: paymentStatus.paid ? new Date() : undefined
      };
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      throw new Error('Não foi possível verificar o status do pagamento');
    }
  }
  
  /**
   * Atualiza o status de uma transação
   */
  private async updateTransactionStatus(transactionId: number, status: string, paidAt?: Date) {
    try {
      const updateData: any = { status };
      
      if (status === 'paid' || status === 'confirmed' || status === 'approved') {
        updateData.paidAt = paidAt || new Date();
        console.log(`Transação ${transactionId} marcada como paga em ${updateData.paidAt}`);
      }
      
      await db.update(subscriptionTransactions)
        .set(updateData)
        .where(eq(subscriptionTransactions.id, transactionId));
    } catch (error) {
      console.error('Erro ao atualizar status da transação:', error);
      throw new Error('Não foi possível atualizar o status da transação');
    }
  }
  
  /**
   * Renova a assinatura do usuário
   */
  async renewSubscription(userId: number, planId: number) {
    try {
      // Buscar usuário
      const user = await storage.getUser(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }
      
      // Buscar plano
      const plan = await this.getPlanById(planId);
      if (!plan) {
        throw new Error('Plano não encontrado');
      }
      
      // Calcular nova data de expiração
      let baseDate = new Date();
      
      // Se o usuário já tiver uma data de expiração no futuro, usar essa como base
      if (user.subscriptionExpiry) {
        const currentExpiry = new Date(user.subscriptionExpiry);
        if (currentExpiry > baseDate) {
          baseDate = currentExpiry;
        }
      }
      
      // Adicionar meses do plano
      const newExpiryDate = new Date(baseDate);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + plan.durationMonths);
      
      // Atualizar data de expiração do usuário
      await storage.updateUser(userId, {
        subscriptionExpiry: newExpiryDate,
        neverExpires: false
      });
      
      return {
        success: true,
        expiryDate: newExpiryDate
      };
    } catch (error) {
      console.error('Erro ao renovar assinatura:', error);
      throw new Error('Não foi possível renovar a assinatura');
    }
  }
  
  /**
   * Processa um webhook de pagamento (callback do Mercado Pago)
   */
  async processPaymentWebhook(data: any) {
    try {
      // Extrair ID da transação do Mercado Pago
      const mpPaymentId = data?.data?.id;
      if (!mpPaymentId) {
        throw new Error('ID de pagamento não encontrado no webhook');
      }
      
      // Verificar status diretamente (sem usar getPaymentDetails que não existe)
      // Buscar transação baseada no ID do webhook
      const [transaction] = await db.select()
        .from(subscriptionTransactions)
        .where(eq(subscriptionTransactions.transactionId, mpPaymentId.toString()));
      
      if (transaction) {
        // Buscar status atual direto do webhook
        const status = data?.action === 'payment.updated' ? 'approved' : 'pending';
        
        // Atualizar status da transação
        await this.updateTransactionStatus(
          transaction.id,
          status === 'approved' ? 'paid' : status,
          status === 'approved' ? new Date() : undefined
        );
        
        // Se o pagamento foi aprovado, renovar a assinatura
        if (status === 'approved') {
          await this.renewSubscription(transaction.userId, transaction.planId);
        }
        
        return {
          success: true,
          status: status,
          transactionId: transaction.id
        };
      }
      
      return {
        success: false,
        message: 'Transação não encontrada'
      };
    } catch (error) {
      console.error('Erro ao processar webhook de pagamento:', error);
      throw new Error('Não foi possível processar o webhook de pagamento');
    }
  }
}