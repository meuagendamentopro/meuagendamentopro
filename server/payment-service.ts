/**
 * Serviço de pagamento PIX usando Mercado Pago
 */
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from './db';
import { providers, appointments, PaymentStatus } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';

// Token global fallback para compatibilidade
const defaultAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN as string;

// Função para obter uma instância do Mercado Pago com o token apropriado
const getMercadoPagoClient = (accessToken: string) => {
  const config = new MercadoPagoConfig({ accessToken });
  return new Payment(config);
};

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

      // Obter token do Mercado Pago específico do provider ou usar o global
      const accessToken = provider.pixMercadoPagoToken || defaultAccessToken;
      if (!accessToken) {
        throw new Error('Token do Mercado Pago não configurado. Configure nas configurações de PIX.');
      }
      
      // Criar cliente do Mercado Pago com o token específico
      const paymentClient = getMercadoPagoClient(accessToken);

      // Criar preferência de pagamento
      const expiration = new Date();
      expiration.setMinutes(expiration.getMinutes() + (params.expireInMinutes || 60));
      
      // Ajustar o valor com base na porcentagem configurada pelo provedor
      const paymentPercentage = provider.pixPaymentPercentage || 100;
      // Calcular o valor ajustado com base na porcentagem
      const adjustedAmount = (params.amount * paymentPercentage) / 100;
      
      console.log(`Valor original: ${params.amount}, Porcentagem: ${paymentPercentage}%, Valor ajustado: ${adjustedAmount}`);

      // Usar número de CPF/CNPJ do provider se disponível
      const identificationNumber = provider.pixIdentificationNumber || "12345678909";

      // O Mercado Pago espera um número com 2 casas decimais (ponto como separador decimal)
      // Converter para o formato correto com precisão de 2 casas decimais
      const formattedAmount = parseFloat(adjustedAmount.toFixed(2));
      
      console.log(`Valor formatado para API: ${formattedAmount} (tipo: ${typeof formattedAmount})`);
      
      // Criar pagamento - usando o formato documentado pelo Mercado Pago
      const paymentData = {
        transaction_amount: formattedAmount,
        description: `Agendamento: ${params.serviceDescription}`,
        payment_method_id: 'pix',
        payer: {
          email: params.clientEmail || 'cliente@example.com',
          first_name: params.clientName.split(' ')[0],
          last_name: params.clientName.split(' ').slice(1).join(' ') || 'Sobrenome',
          identification: {
            type: "CPF", 
            number: identificationNumber
          }
        },
        date_of_expiration: expiration.toISOString(),
        notification_url: `${process.env.APP_URL || 'https://meuagendamento.replit.app'}/api/payments/webhook`
      };

      console.log("Enviando requisição para Mercado Pago:", JSON.stringify(paymentData, null, 2));
      
      let result: any;
      
      try {
        console.log("Token do Mercado Pago (últimos 6 caracteres):", 
          accessToken.length > 10 ? "..." + accessToken.substring(accessToken.length - 6) : "Token inválido");
        
        result = await paymentClient.create({ body: paymentData });
        
        console.log("Resposta do Mercado Pago:", JSON.stringify({
          id: result.id,
          status: result.status,
          hasQrCode: !!result.point_of_interaction?.transaction_data?.qr_code,
          qrCodeLength: result.point_of_interaction?.transaction_data?.qr_code?.length || 0,
          tokenType: accessToken.substring(0, 7), // Verificar se começa com APP_USR
          transaction_amount: result.transaction_amount,
          transaction_details: result.transaction_details
        }, null, 2));
        
        if (!result.id) {
          console.error("Erro: Sem ID na resposta do Mercado Pago");
          throw new Error('Falha ao gerar pagamento PIX: Sem ID na resposta');
        }
        
        if (!result.point_of_interaction?.transaction_data?.qr_code) {
          console.error("Erro: QR code ausente na resposta do Mercado Pago:", JSON.stringify(result, null, 2));
          throw new Error('Falha ao gerar QR code PIX');
        }
      } catch (error: any) {
        console.error("Erro ao comunicar-se com Mercado Pago:", error.message, error.stack);
        if (error.cause) {
          console.error("Causa do erro:", JSON.stringify(error.cause, null, 2));
        }
        throw new Error(`Falha na integração com Mercado Pago: ${error.message}`);
      }

      console.log("Gerando resposta PIX com base em:", {
        qr_code: typeof result.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: typeof result.point_of_interaction.transaction_data.qr_code_base64
      });

      const response: PixResponse = {
        transactionId: result.id.toString(),
        qrCode: result.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64 || '',
        expiresAt: expiration
      };
      
      console.log("QR code no response:", response.qrCode ? `Presente (${response.qrCode.length} caracteres)` : "Ausente");

      // Atualizar o agendamento com as informações de pagamento
      // Converter para centavos (valor inteiro) ao salvar no banco
      const amountInCents = Math.round(adjustedAmount * 100);
      
      await db.update(appointments)
        .set({
          requiresPayment: true,
          paymentStatus: PaymentStatus.PENDING,
          paymentAmount: amountInCents, // Valor em centavos (inteiro)
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
  async checkPaymentStatus(transactionId: string, providerToken?: string): Promise<{ status: string; paid: boolean }> {
    try {
      // Criar cliente do Mercado Pago com o token específico ou o padrão
      const accessToken = providerToken || defaultAccessToken;
      const paymentClient = getMercadoPagoClient(accessToken);
      
      const result = await paymentClient.get({ id: parseInt(transactionId) });
      
      let status = 'pending';
      let paid = false;

      if (result.status === 'approved') {
        status = 'confirmed';
        paid = true;
      } else if (result.status && ['rejected', 'cancelled', 'refunded'].includes(result.status)) {
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
      
      // Buscar o provider para obter o token específico
      const provider = await storage.getProvider(appointment.providerId);
      // Garantir que o token não seja null (apenas undefined ou string)
      const providerToken = provider?.pixMercadoPagoToken || undefined;

      // Verificar status do pagamento com o token do provider se disponível
      const paymentStatus = await this.checkPaymentStatus(appointment.pixTransactionId, providerToken);
      
      // Atualizar o status no banco de dados
      if (paymentStatus.paid) {
        // Primeiro vamos verificar se o cliente existe na tabela de clientes e criá-lo se necessário
        // Isso garante que só registramos clientes com pagamento confirmado
        
        // Verificar se o agendamento tem ID de cliente temporário (valor 0)
        // e criar cliente real se necessário
        if (appointment.clientId === 0) {
          // Obter dados do cliente do appointment
          const appointmentData = await storage.getAppointment(appointmentId);
          
          if (appointmentData) {
            // Verificar se temos os dados do cliente armazenados nos metadados
            const clientName = appointmentData.clientName;
            const clientPhone = appointmentData.clientPhone;
            
            // Só criar cliente se tivermos nome e telefone
            if (clientName && clientPhone) {
              console.log(`Criando cliente confirmado para agendamento ${appointmentId}`);
              
              // Criar o cliente para persistir no banco
              const newClient = await storage.createClient({
                name: clientName,
                phone: clientPhone,
                email: appointmentData.clientEmail || "",
                notes: appointmentData.clientNotes || ""
              });
              
              // Atualizar o agendamento com o ID correto do cliente
              await db.update(appointments)
                .set({ clientId: newClient.id })
                .where(eq(appointments.id, appointmentId));
                
              console.log(`Cliente ${newClient.id} criado e vinculado ao agendamento ${appointmentId}`);
            }
          }
        }
      
        // Atualizar status de pagamento
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
      console.log('Recebido webhook do Mercado Pago:', JSON.stringify(webhookData, null, 2));
      
      // Verificar se é um evento de pagamento
      if (webhookData.type !== 'payment' || !webhookData.data || !webhookData.data.id) {
        console.log('Evento de webhook ignorado (não é pagamento):', webhookData.type);
        return false;
      }

      console.log(`Processando notificação de pagamento ID: ${webhookData.data.id}`);

      // Usar o token global para obter detalhes do pagamento
      const paymentClient = getMercadoPagoClient(defaultAccessToken);
      const result = await paymentClient.get({ id: webhookData.data.id });
      
      console.log('Detalhes do pagamento:', JSON.stringify({
        id: result.id,
        status: result.status,
        payment_method_id: result.payment_method_id,
        transaction_amount: result.transaction_amount,
        date_approved: result.date_approved,
        date_created: result.date_created
      }, null, 2));
      
      if (!result.id) {
        console.log('ID da transação não encontrado na resposta');
        return false;
      }
      
      const transactionId = result.id.toString();

      // Buscar agendamento pelo ID de transação
      const [appointment] = await db.select()
        .from(appointments)
        .where(eq(appointments.pixTransactionId, transactionId));

      if (!appointment) {
        console.log('Agendamento não encontrado para transação:', transactionId);
        return false;
      }

      console.log(`Agendamento encontrado: #${appointment.id}, status atual: ${appointment.paymentStatus}`);

      // Atualizar status do agendamento
      const updated = await this.updateAppointmentPaymentStatus(appointment.id);
      console.log(`Status de pagamento atualizado: ${updated ? 'sucesso' : 'sem alterações'}`);
      
      return updated;
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      return false;
    }
  }
}

// Instância do serviço de pagamento
export const paymentService = new PaymentService();