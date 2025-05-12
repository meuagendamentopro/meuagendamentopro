/**
 * Serviço de pagamento PIX usando Mercado Pago
 */
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from './db';
import { providers, appointments, PaymentStatus } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';

// Configurar o SDK do Mercado Pago
const mercadopago = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN as string 
});
const payment = new Payment(mercadopago);

interface GeneratePixParams {
  appointmentId: number;
  providerId: number;
  amount: number;
  clientName: string;
  clientEmail: string;
  serviceDescription: string;
  expireInMinutes?: number;
}

interface PixResponse {
  transactionId: string;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: Date;
}

export class PaymentService {
  /**
   * Gera um código PIX para pagamento
   */
  async generatePix(params: GeneratePixParams): Promise<PixResponse> {
    try {
      // Buscar configurações do provedor
      const provider = await storage.getProvider(params.providerId);
      if (!provider) {
        throw new Error('Provedor não encontrado');
      }

      // Criar preferência de pagamento
      const expiration = new Date();
      expiration.setMinutes(expiration.getMinutes() + (params.expireInMinutes || 60));
      
      // Ajustar o valor com base na porcentagem configurada pelo provedor
      const paymentPercentage = provider.pixPaymentPercentage || 100;
      const adjustedAmount = Math.round((params.amount * paymentPercentage) / 100);

      // Criar pagamento
      const paymentData = {
        transaction_amount: adjustedAmount / 100, // Converter centavos para reais
        description: `Agendamento: ${params.serviceDescription}`,
        payment_method_id: 'pix',
        payer: {
          email: params.clientEmail || 'cliente@example.com',
          first_name: params.clientName.split(' ')[0],
          last_name: params.clientName.split(' ').slice(1).join(' ') || ' ',
        },
        date_of_expiration: expiration.toISOString()
      };

      const result = await payment.create({ body: paymentData });
      
      if (!result.id || !result.point_of_interaction?.transaction_data?.qr_code) {
        throw new Error('Falha ao gerar QR code PIX');
      }

      const response: PixResponse = {
        transactionId: result.id.toString(),
        qrCode: result.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64 || '',
        expiresAt: expiration
      };

      // Atualizar o agendamento com as informações de pagamento
      await db.update(appointments)
        .set({
          requiresPayment: true,
          paymentStatus: PaymentStatus.PENDING,
          paymentAmount: adjustedAmount,
          paymentPercentage: paymentPercentage,
          pixTransactionId: response.transactionId,
          pixQrCode: response.qrCode,
          pixQrCodeExpiration: response.expiresAt
        })
        .where(eq(appointments.id, params.appointmentId));

      return response;
    } catch (error) {
      console.error('Erro ao gerar PIX:', error);
      throw new Error('Não foi possível gerar o código PIX. Verifique as configurações de pagamento.');
    }
  }

  /**
   * Verifica o status de um pagamento PIX
   */
  async checkPaymentStatus(transactionId: string): Promise<{ status: string; paid: boolean }> {
    try {
      const payment = await mercadopago.payment.get(parseInt(transactionId));
      
      let status = 'pending';
      let paid = false;

      if (payment.body.status === 'approved') {
        status = 'confirmed';
        paid = true;
      } else if (['rejected', 'cancelled', 'refunded'].includes(payment.body.status)) {
        status = 'failed';
      }

      return { status, paid };
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      return { status: 'error', paid: false };
    }
  }

  /**
   * Atualiza o status de pagamento de um agendamento
   */
  async updateAppointmentPaymentStatus(appointmentId: number): Promise<boolean> {
    try {
      // Buscar o agendamento
      const [appointment] = await db.select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId));

      if (!appointment || !appointment.pixTransactionId) {
        return false;
      }

      // Verificar status do pagamento
      const paymentStatus = await this.checkPaymentStatus(appointment.pixTransactionId);
      
      // Atualizar o status no banco de dados
      if (paymentStatus.paid) {
        await db.update(appointments)
          .set({
            paymentStatus: PaymentStatus.CONFIRMED,
            pixPaymentDate: new Date()
          })
          .where(eq(appointments.id, appointmentId));
        
        // Se confirmado e o status do agendamento ainda é pendente, atualizar para confirmado
        if (appointment.status === 'pending') {
          await db.update(appointments)
            .set({ status: 'confirmed' })
            .where(eq(appointments.id, appointmentId));
        }
        
        return true;
      } else if (paymentStatus.status === 'failed') {
        await db.update(appointments)
          .set({ paymentStatus: PaymentStatus.FAILED })
          .where(eq(appointments.id, appointmentId));
      }
      
      return false;
    } catch (error) {
      console.error('Erro ao atualizar status de pagamento:', error);
      return false;
    }
  }

  /**
   * Processa webhook de pagamento do Mercado Pago
   */
  async processWebhook(webhookData: any): Promise<boolean> {
    try {
      // Verificar se é um evento de pagamento
      if (webhookData.type !== 'payment' || !webhookData.data || !webhookData.data.id) {
        console.log('Evento de webhook ignorado (não é pagamento):', webhookData.type);
        return false;
      }

      // Buscar detalhes do pagamento
      const payment = await mercadopago.payment.get(webhookData.data.id);
      const transactionId = payment.body.id.toString();

      // Buscar agendamento pelo ID de transação
      const [appointment] = await db.select()
        .from(appointments)
        .where(eq(appointments.pixTransactionId, transactionId));

      if (!appointment) {
        console.log('Agendamento não encontrado para transação:', transactionId);
        return false;
      }

      // Atualizar status do agendamento
      return await this.updateAppointmentPaymentStatus(appointment.id);
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      return false;
    }
  }
}

// Instância do serviço de pagamento
export const paymentService = new PaymentService();