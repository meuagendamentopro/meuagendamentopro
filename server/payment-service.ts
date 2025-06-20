/**
 * Serviço de pagamento PIX usando Mercado Pago
 */
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from './db';
import { providers, appointments, subscriptionTransactions, PaymentStatus } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';

// Não usamos mais um token global, cada usuário deve configurar seu próprio token
const defaultAccessToken = '';

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
   * Busca o provedor administrador com token do Mercado Pago configurado
   */
  async getAdminProvider() {
    try {
      // Buscar o primeiro provedor que tenha token do Mercado Pago configurado
      const providersList = await db.select()
        .from(providers)
        .where(eq(providers.pixEnabled, true));
      
      // Encontrar o primeiro provedor com token configurado
      const adminProvider = providersList.length > 0 ? providersList[0] : null;
      
      if (!adminProvider) {
        console.warn('Nenhum provedor com token do Mercado Pago encontrado');
        return null;
      }
      
      return adminProvider;
    } catch (error) {
      console.error('Erro ao buscar provedor com token do Mercado Pago:', error);
      return null;
    }
  }
  
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

      // Obter token do Mercado Pago específico do provider
      const accessToken = provider.pixMercadoPagoToken;
      if (!accessToken) {
        throw new Error('Token do Mercado Pago não configurado. Configure o token nas configurações de PIX do seu perfil.');
      }
      
      // Verificar se o token parece válido (começa com APP_USR-)
      if (!accessToken.startsWith('APP_USR-')) {
        console.warn(`Token do Mercado Pago para o provider ${provider.id} não parece válido (não começa com APP_USR-)`);
      }
      
      // Criar cliente do Mercado Pago com o token específico
      const paymentClient = getMercadoPagoClient(accessToken);

      // Criar preferência de pagamento
      // Ajustar a expiração - Mercado Pago exige tempo mínimo de 30 minutos e máximo de 30 dias
      const expiration = new Date();
      // Definindo expiração para 30 minutos (mínimo recomendado)
      expiration.setMinutes(expiration.getMinutes() + 30);
      
      // O Mercado Pago exige um formato específico para a data de expiração
      // Precisamos usar uma data fixa no futuro para evitar problemas de formatação
      
      // Ajustar o valor com base na porcentagem configurada pelo provedor
      // A porcentagem deve ser aplicada ao valor total, não reduzir o valor
      // Por exemplo, se o valor é 1.00 e a porcentagem é 50%, o valor deve ser 0.50
      const paymentPercentage = provider.pixPaymentPercentage || 100;
      
      // Se a porcentagem for 100%, não há ajuste necessário
      const adjustedAmount = params.amount;
      
      console.log(`Valor original: ${params.amount}, Porcentagem: ${paymentPercentage}%, Valor a ser cobrado: ${adjustedAmount}`);

      // Usar número de CPF/CNPJ do provider se disponível
      const identificationNumber = provider.pixIdentificationNumber || "12345678909";

      // O Mercado Pago espera um número com 2 casas decimais (ponto como separador decimal)
      // Converter para o formato correto com precisão de 2 casas decimais
      const formattedAmount = parseFloat(adjustedAmount.toFixed(2));
      
      console.log(`Valor formatado para API: ${formattedAmount} (tipo: ${typeof formattedAmount})`);
      
      // Criar pagamento - usando o formato documentado pelo Mercado Pago
      // https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix
      // Calcular uma data 2 horas no futuro para a expiração do PIX
      // Mercado Pago exige mínimo de 30 min, mas vamos dar margem de segurança
      // Nota: O tempo padrão de expiração do Mercado Pago é 24 horas,
      // conforme visto na resposta: "date_of_expiration": "2025-05-13T19:34:40.000-04:00"
      // Isso é mais do que o tempo de 2 horas que originalmente pretendíamos configurar
      
      console.log("Usando tempo de expiração padrão do Mercado Pago (24 horas)");
      
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
        // Removendo campo de expiração como solução temporária
        // O Mercado Pago usará seu padrão (24 horas)
        // date_of_expiration: isoDateString,
        
        // A URL de notificação é obrigatória e deve ser uma URL válida acessível pela internet
        // Em ambiente de desenvolvimento, usamos uma URL fixa para o Mercado Pago
        notification_url: 'https://meuagendamento.replit.app/api/payments/webhook'
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

      // Extrair a data de expiração do resultado ou usar o padrão de 30 min
      let expiresAt = new Date();
      if (result.date_of_expiration) {
        try {
          expiresAt = new Date(result.date_of_expiration);
          console.log("Usando data de expiração retornada pelo Mercado Pago:", expiresAt);
        } catch (error) {
          // Se não conseguir converter a data, usar o padrão
          expiresAt.setMinutes(expiresAt.getMinutes() + 30);
          console.log("Usando data de expiração padrão (30 min):", expiresAt);
        }
      } else {
        // Se não tiver data de expiração na resposta, usar o padrão
        expiresAt.setMinutes(expiresAt.getMinutes() + 30);
        console.log("Usando data de expiração padrão (30 min):", expiresAt);
      }
      
      const response: PixResponse = {
        transactionId: result.id.toString(),
        qrCode: result.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64 || '',
        expiresAt: expiresAt
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
      console.log(`Verificando status de pagamento para transação ID: ${transactionId}`);
      
      // Criar cliente do Mercado Pago com o token específico do usuário
      const accessToken = providerToken;
      if (!accessToken) {
        console.error("Token do Mercado Pago não configurado para o usuário. Tentando verificar status do pagamento de outra forma.");
        
        // Buscar a transação para verificar o status atual
        try {
          const [transaction] = await db.select()
            .from(subscriptionTransactions)
            .where(eq(subscriptionTransactions.transactionId, transactionId));
          
          if (!transaction) {
            console.error(`Transação ${transactionId} não encontrada`);
            return { status: 'error', paid: false };
          }
          
          // Se a transação já está marcada como paga, retornar esse status
          if (transaction.status === 'paid' || transaction.status === 'confirmed' || transaction.status === 'approved') {
            console.log(`Transação ${transactionId} já está marcada como paga`);
            return { status: transaction.status, paid: true };
          }
          
          // Verificar se o pagamento expirou
          if (transaction.pixQrCodeExpiration) {
            const expirationDate = new Date(transaction.pixQrCodeExpiration);
            const now = new Date();
            
            if (now > expirationDate) {
              console.log(`Pagamento expirado para transação ${transactionId}. Data de expiração: ${expirationDate.toISOString()}`);
              
              // Atualizar o status para expirado se ainda estiver pendente
              if (transaction.status === 'pending') {
                await db.update(subscriptionTransactions)
                  .set({ status: 'expired' })
                  .where(eq(subscriptionTransactions.id, transaction.id));
              }
              
              return { status: 'expired', paid: false };
            }
          }
          
          // Tentar obter o token do administrador para verificar o pagamento
          const adminProvider = await this.getAdminProvider();
          if (adminProvider && adminProvider.pixMercadoPagoToken) {
            console.log(`Usando token do administrador para verificar pagamento ${transactionId}`);
            // Chamar a função novamente com o token do administrador
            return await this.checkPaymentStatus(transactionId, adminProvider.pixMercadoPagoToken);
          }
        } catch (err) {
          console.error('Erro ao verificar status do pagamento:', err);
        }
        
        // Se não for possível verificar o status, manter como pendente
        return { status: 'pending', paid: false };
      }
      
      // Verificar se o token parece válido
      if (!accessToken.startsWith('APP_USR-')) {
        console.warn(`Token do Mercado Pago não parece válido (não começa com APP_USR-)`);
      }
      
      const paymentClient = getMercadoPagoClient(accessToken);
      
      const result = await paymentClient.get({ id: parseInt(transactionId) });
      
      console.log(`Resposta do Mercado Pago para status do pagamento:`, JSON.stringify({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
        payment_method_id: result.payment_method_id,
        payment_type_id: result.payment_type_id,
        date_approved: result.date_approved,
        date_created: result.date_created,
        date_last_updated: result.date_last_updated,
        date_of_expiration: result.date_of_expiration
      }, null, 2));
      
      let status = 'pending';
      let paid = false;

      if (result.status === 'approved') {
        status = 'confirmed';
        paid = true;
      } else if (result.status && ['rejected', 'cancelled', 'refunded', 'cancelled'].includes(result.status)) {
        status = 'failed';
      }

      console.log(`Status processado: ${status}, Pago: ${paid}`);
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

      // Vamos primeiro verificar se temos um token de acesso válido para consultar os detalhes do pagamento
      // Como não sabemos qual provider está associado ao pagamento ainda, vamos tentar encontrar
      // o agendamento primeiro usando o ID da transação
      let paymentAppointment = null;
      let paymentProvider = null;
      let accessToken = null;
      
      try {
        // Tentar encontrar o agendamento pelo ID da transação
        const [foundAppointment] = await db.select()
          .from(appointments)
          .where(eq(appointments.pixTransactionId, webhookData.data.id.toString()));
        
        if (foundAppointment) {
          paymentAppointment = foundAppointment;
          
          // Buscar o provider para obter o token
          const provider = await storage.getProvider(foundAppointment.providerId);
          if (provider && provider.pixMercadoPagoToken) {
            paymentProvider = provider;
            accessToken = provider.pixMercadoPagoToken;
            console.log(`Token encontrado para o provider ID: ${provider.id}`);
          } else {
            console.error(`Token do Mercado Pago não configurado para o provider ID: ${foundAppointment.providerId}`);
            return false;
          }
        } else {
          console.error(`Não foi possível encontrar um agendamento com o ID de transação: ${webhookData.data.id}`);
          return false;
        }
      } catch (error) {
        console.error('Erro ao buscar agendamento e provider:', error);
        return false;
      }
      
      const paymentClient = getMercadoPagoClient(accessToken);
      const result = await paymentClient.get({ id: webhookData.data.id });
      
      console.log('Detalhes do pagamento webhook:', JSON.stringify({
        id: result.id,
        status: result.status,
        status_detail: result.status_detail,
        payment_method_id: result.payment_method_id,
        payment_type_id: result.payment_type_id,
        transaction_amount: result.transaction_amount,
        date_approved: result.date_approved,
        date_created: result.date_created,
        date_last_updated: result.date_last_updated,
        date_of_expiration: result.date_of_expiration
      }, null, 2));
      
      if (!result.id) {
        console.log('ID da transação não encontrado na resposta');
        return false;
      }
      
      const transactionId = result.id.toString();

      // Já temos o agendamento, não precisamos buscá-lo novamente
      // Apenas verificar se o ID da transação corresponde
      if (paymentAppointment.pixTransactionId !== transactionId) {
        console.log(`ID da transação não corresponde: ${paymentAppointment.pixTransactionId} vs ${transactionId}`);
        return false;
      }

      console.log(`Agendamento encontrado: #${paymentAppointment.id}, status atual: ${paymentAppointment.paymentStatus}`);

      // Atualizar status do agendamento
      const updated = await this.updateAppointmentPaymentStatus(paymentAppointment.id);
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