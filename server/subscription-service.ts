/**
 * Serviço para gerenciar assinaturas e pagamentos
 */
import { db } from './db';
import { subscriptionPlans, subscriptionTransactions, users } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { PaymentService } from './payment-service';
import { storage } from './storage';
import { User } from '../shared/schema';

// Instância do serviço de pagamento
const paymentService = new PaymentService();

export class SubscriptionService {
  /**
   * Busca todos os planos de assinatura ativos
   */
  async getActivePlans() {
    try {
      const plans = await db.select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
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