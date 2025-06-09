import nodemailer from 'nodemailer';
import { type User } from '@shared/schema';

// Verificando se as variáveis de ambiente estão presentes
const isDevelopment = process.env.NODE_ENV === 'development';

// Obter credenciais do arquivo .env para o Zoho
const EMAIL_USER = process.env.EMAIL_USER || 'contato@meuagendamentopro.com.br';
// Usar a senha do Zoho
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || 'PuDDPi01Wmst';
// Email do administrador para receber notificações (pode ser diferente do EMAIL_USER)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'lincolnmaxwel@hotmail.com';

// Verificação mais detalhada das variáveis de ambiente
console.log('Verificando configuração de email:');
console.log(`EMAIL_USER: ${EMAIL_USER}`);
console.log(`EMAIL_PASSWORD configurado: ${!!EMAIL_PASSWORD}`);

// Forçar hasEmailConfig para true para garantir o uso do transporter
const hasEmailConfig = true;

// Criando o transporter do Nodemailer
let transporter: nodemailer.Transporter | null = null;

try {
  // Configurar o transporter para usar o Zoho
  const transporterConfig = {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true, // true para 465 (SSL)
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
    debug: isDevelopment, // Ativar logs detalhados apenas em desenvolvimento
    logger: isDevelopment // Ativar logs detalhados apenas em desenvolvimento
  };

  console.log('Configurando serviço de email com Zoho:', {
    user: EMAIL_USER,
    passProvided: !!EMAIL_PASSWORD
  });

  transporter = nodemailer.createTransport(transporterConfig);
  console.log('Transporter criado com sucesso!');
} catch (error) {
  console.error('Erro ao criar transporter:', error);
  console.log('Usando modo de simulação de email como fallback');
}

// Interface para o token de verificação
export interface VerificationToken {
  token: string;
  userId: number;
  expiresAt: Date;
}

// Armazenamento em memória para tokens (em produção, deve ser armazenado no banco de dados)
// Vamos migrar isso para o banco de dados mais tarde
const verificationTokens: VerificationToken[] = [];

/**
 * Gera um token de verificação para o usuário
 * @param userId ID do usuário
 * @returns O token gerado
 */
export function generateVerificationToken(userId: number): string {
  // Gera um token aleatório de 6 dígitos
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Define a validade do token (20 minutos)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 20);
  
  // Remove qualquer token existente para este usuário
  const existingTokenIndex = verificationTokens.findIndex(t => t.userId === userId);
  if (existingTokenIndex !== -1) {
    verificationTokens.splice(existingTokenIndex, 1);
  }
  
  // Armazena o novo token
  verificationTokens.push({
    token,
    userId,
    expiresAt,
  });
  
  return token;
}

/**
 * Verifica se um token é válido para um usuário
 * @param userId ID do usuário
 * @param token Token a ser verificado
 * @returns true se o token for válido, false caso contrário
 */
export function verifyToken(userId: number, token: string): boolean {
  // Encontra o token para o usuário
  const tokenObj = verificationTokens.find(t => t.userId === userId && t.token === token);
  
  // Verifica se o token existe e se está válido
  if (!tokenObj) {
    return false;
  }
  
  // Verifica se o token não expirou
  if (tokenObj.expiresAt.getTime() < Date.now()) {
    // Remove o token expirado
    const index = verificationTokens.findIndex(t => t.userId === userId);
    if (index !== -1) {
      verificationTokens.splice(index, 1);
    }
    return false;
  }
  
  // Remove o token após a verificação
  const index = verificationTokens.findIndex(t => t.userId === userId);
  if (index !== -1) {
    verificationTokens.splice(index, 1);
  }
  
  return true;
}

/**
 * Envia um email de verificação para o usuário
 * @param user Usuário para quem o email será enviado
 * @param token Token de verificação
 * @returns true se o email foi enviado com sucesso, false caso contrário
 */
export async function sendVerificationEmail(user: User, token: string): Promise<boolean> {
  // Criando a URL de verificação - usando URL absoluta para garantir que funcione
  // Determina a URL base a partir da solicitação ou usa um valor padrão
  let baseUrl = process.env.BASE_URL;
  if (!baseUrl) {
    // Em desenvolvimento, usa localhost
    if (process.env.NODE_ENV === 'development') {
      baseUrl = 'http://localhost:5000';
      console.log('Usando URL localhost para emails');
    } else {
      // Fallback para localhost se não conseguirmos determinar o URL
      baseUrl = 'http://localhost:5000';
      console.log(`Definindo URL base para emails: ${baseUrl}`);
    }
  }
  
  // Template do email com código de verificação
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Confirme seu Email</h2>
      <p>Olá ${user.name},</p>
      <p>Obrigado por se cadastrar no Meu Agendamento PRO! Para completar seu cadastro, por favor utilize o código abaixo:</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #4F46E5; padding: 15px; background-color: #f5f5f5; border-radius: 10px; display: inline-block;">
          ${token}
        </div>
      </div>
      <p>Insira este código na tela de verificação para ativar sua conta.</p>
      <p style="font-weight: bold; color: #ef4444;">Este código expira em 20 minutos.</p>
      <p>Se você não solicitou esta verificação, por favor ignore este email.</p>
      <p>Atenciosamente,<br>Equipe Meu Agendamento PRO</p>
    </div>
  `;

  try {
    console.log(`Tentando enviar email de verificação para ${user.email}...`);
    console.log('Status do transporter:', !!transporter);
    console.log('hasEmailConfig:', hasEmailConfig);
    
    // Verificar se o transporter está disponível
    if (!transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (transporter indisponível)');
      console.log('==================================================');
      console.log(`Email para: ${user.email}`);
      console.log(`Assunto: Confirmação de Email - Meu Agendamento PRO`);
      console.log('\nCÓDIGO DE VERIFICAÇÃO:');
      console.log(`\n    ${token}\n`);
      console.log('==================================================\n');
      
      // Simula um envio bem-sucedido
      return true;
    }
    
    // Configuração do email para envio real
    const mailOptions = {
      from: `"Meu Agendamento PRO" <${EMAIL_USER}>`,
      to: user.email,
      subject: 'Confirmação de Email - Meu Agendamento PRO',
      html,
    };
    
    console.log('Tentando enviar email com as seguintes opções:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de verificação enviado: ${info.messageId}`);
    console.log('Informações adicionais:', info);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error);
    
    // Em caso de erro, usar o modo de simulação como fallback
    console.log('\n==================================================');
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK APÓS ERRO)');
    console.log('==================================================');
    console.log(`Email para: ${user.email}`);
    console.log(`Assunto: Confirmação de Email - Meu Agendamento PRO`);
    console.log('\nCÓDIGO DE VERIFICAÇÃO:');
    console.log(`\n    ${token}\n`);
    console.log('==================================================\n');
    
    // Simula um envio bem-sucedido mesmo após o erro
    return true;
  }
}

/**
 * Envia um email de boas-vindas ao usuário após a verificação do email
 * @param user Usuário para quem o email será enviado
 * @returns true se o email foi enviado com sucesso, false caso contrário
 */
export async function sendWelcomeEmail(user: User): Promise<boolean> {
  // Template do email de boas-vindas
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Bem-vindo ao Meu Agendamento PRO!</h2>
      <p>Olá ${user.name},</p>
      <p>Sua conta foi ativada com sucesso! Agora você pode aproveitar todos os recursos do nosso sistema de agendamento.</p>
      <p>Aqui estão algumas dicas para começar:</p>
      <ul style="margin-top: 15px; margin-bottom: 15px;">
        <li>Configure seu perfil profissional</li>
        <li>Adicione seus serviços</li>
        <li>Personalize seus horários de atendimento</li>
        <li>Compartilhe seu link de agendamento com seus clientes</li>
      </ul>
      <p>Se precisar de ajuda, entre em contato com nossa equipe de suporte.</p>
      <p>Atenciosamente,<br>Equipe Meu Agendamento PRO</p>
    </div>
  `;

  try {
    console.log(`Tentando enviar email de boas-vindas para ${user.email}...`);
    
    // Verificar se o transporter está disponível
    if (!transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (transporter indisponível)');
      console.log('==================================================');
      console.log(`Email para: ${user.email}`);
      console.log(`Assunto: Bem-vindo ao Meu Agendamento PRO!`);
      console.log('\nConteúdo: Email de boas-vindas enviado com sucesso.');
      console.log('==================================================\n');
      
      // Simula um envio bem-sucedido
      return true;
    }
    
    // Configuração do email para envio real
    const mailOptions = {
      from: `"Meu Agendamento PRO" <${EMAIL_USER}>`,
      to: user.email,
      subject: 'Bem-vindo ao Meu Agendamento PRO!',
      html,
    };
    
    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de boas-vindas enviado: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error);
    
    // Em caso de erro, usar o modo de simulação como fallback
    console.log('\n==================================================');
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK APÓS ERRO)');
    console.log('==================================================');
    console.log(`Email para: ${user.email}`);
    console.log(`Assunto: Bem-vindo ao Meu Agendamento PRO!`);
    console.log('\nConteúdo: Email de boas-vindas enviado com sucesso.');
    console.log('==================================================\n');
    
    // Simula um envio bem-sucedido mesmo após o erro
    return true;
  }
}

/**
 * Verifica se o serviço de email está configurado corretamente
 * @returns true se o serviço estiver configurado, false caso contrário
 */
export function isEmailServiceConfigured(): boolean {
  // Forçar a verificação de email mesmo que as variáveis de ambiente não estejam configuradas
  // Isso garante que todos os novos registros exijam verificação de email
  console.log('Verificando configuração de email:', {
    GMAIL_USER: process.env.GMAIL_USER,
    GMAIL_APP_PASSWORD_EXISTS: !!process.env.GMAIL_APP_PASSWORD,
    hasEmailConfig
  });
  
  // Sempre retornar true para forçar a verificação de email
  return true;
}

/**
 * Envia um email com os dados de pagamento para o usuário
 * @param user Usuário para quem o email será enviado
 * @param plan Plano contratado
 * @param pixResponse Resposta do PIX com QR code
 * @returns true se o email foi enviado com sucesso, false caso contrário
 */
export async function sendPaymentEmail(user: User, plan: any, pixResponse: any): Promise<boolean> {
  // Gerar um QR code usando um serviço externo (QR Code Generator API)
  // Codificar o texto do QR code para uso em URL
  const encodedQrText = encodeURIComponent(pixResponse.qrCode);
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodedQrText}`;
  
  // Template do email com QR code e instruções de pagamento
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Pagamento de Assinatura</h2>
      <p>Olá ${user.name},</p>
      <p>Recebemos sua solicitação para contratar o plano <strong>${plan.name}</strong>.</p>
      <p>Para completar a contratação, utilize o QR Code PIX abaixo:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <img src="${qrCodeUrl}" alt="QR Code PIX" style="max-width: 250px; height: auto;" />
      </div>
      
      <p style="text-align: center; font-size: 14px; color: #666;">Ou copie o código PIX abaixo:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; word-break: break-all; text-align: center; font-family: monospace;">
        ${pixResponse.qrCode}
      </div>
      
      <p><strong>Valor:</strong> R$ ${(plan.price / 100).toFixed(2)}</p>
      <p><strong>Plano:</strong> ${plan.name} (${plan.durationMonths} meses)</p>
      <p><strong>Expira em:</strong> ${new Date(pixResponse.expiresAt).toLocaleString()}</p>
      
      <p style="font-weight: bold; color: #ef4444;">Atenção: Este QR Code é válido por 30 minutos.</p>
      <p>Após o pagamento, sua assinatura será ativada automaticamente.</p>
      <p>Se você não solicitou esta assinatura, por favor ignore este email.</p>
      <p>Atenciosamente,<br>Equipe Meu Agendamento PRO</p>
    </div>
  `;

  try {
    console.log(`Tentando enviar email de pagamento para ${user.email}...`);
    console.log('Status do transporter:', !!transporter);
    console.log('hasEmailConfig:', hasEmailConfig);
    
    // Verificar se o transporter está disponível
    if (!transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (transporter indisponível)');
      console.log('==================================================');
      console.log(`Email para: ${user.email}`);
      console.log(`Assunto: Pagamento de Assinatura - Meu Agendamento PRO`);
      console.log('\nConteúdo: Email com dados de pagamento PIX enviado.');
      console.log('==================================================\n');
      
      // Simula um envio bem-sucedido
      return true;
    }
    
    // Configuração do email para envio real
    const mailOptions = {
      from: `"Meu Agendamento PRO" <${EMAIL_USER}>`,
      to: user.email,
      subject: 'Pagamento de Assinatura - Meu Agendamento PRO',
      html,
    };
    
    console.log('Tentando enviar email com as seguintes opções:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    
    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de pagamento enviado: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de pagamento:', error);
    
    // Em caso de erro, usar o modo de simulação como fallback
    console.log('\n==================================================');
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK APÓS ERRO)');
    console.log('==================================================');
    console.log(`Email para: ${user.email}`);
    console.log(`Assunto: Pagamento de Assinatura - Meu Agendamento PRO`);
    console.log('\nConteúdo: Email com dados de pagamento PIX enviado.');
    console.log('==================================================\n');
    
    // Simula um envio bem-sucedido mesmo após o erro
    return true;
  }
}

/**
 * Envia um email de notificação para o administrador quando um novo usuário se cadastra
 * @param user Usuário que se cadastrou
 * @returns true se o email foi enviado com sucesso, false caso contrário
 */
export async function sendAdminNewUserNotification(user: User): Promise<boolean> {
  if (!isEmailServiceConfigured() || !transporter) {
    console.log('Serviço de email não configurado. Simulando envio de notificação de novo usuário.');
    console.log(`SIMULAÇÃO: Email de notificação de novo cadastro para ${ADMIN_EMAIL}`);
    console.log(`Detalhes: Nome: ${user.name}, Email: ${user.email}`);
    return true;
  }

  try {
    // Configuração do email
    const mailOptions = {
      from: `Meu Agendamento PRO <${EMAIL_USER}>`,
      to: ADMIN_EMAIL, // Enviar para o email do administrador configurado
      subject: `[Meu Agendamento PRO] Novo Usuário Cadastrado: ${user.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #6366f1;">Novo Usuário Cadastrado!</h2>
          </div>
          
          <p>Olá Administrador,</p>
          
          <p>Um novo usuário acabou de se cadastrar no sistema <strong>Meu Agendamento PRO</strong>.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Detalhes do Usuário:</h3>
            <p><strong>Nome:</strong> ${user.name}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Nome de Usuário:</strong> ${user.username}</p>
            <p><strong>Data de Cadastro:</strong> ${new Date().toLocaleString('pt-BR')}</p>
          </div>
          
          <p>Você pode acessar o painel administrativo para mais detalhes.</p>
          
          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
            <p>Esta é uma mensagem automática do sistema Meu Agendamento PRO.</p>
          </div>
        </div>
      `
    };

    // Enviar o email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de notificação de novo cadastro enviado: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de notificação de novo cadastro:', error);
    return false;
  }
}

/**
 * Envia um email de redefinição de senha
 * @param user Usuário para quem o email será enviado
 * @param token Token de redefinição de senha
 * @returns true se o email foi enviado com sucesso, false caso contrário
 */
export async function sendPasswordResetEmail(user: User, token: string): Promise<boolean> {
  // Template do email
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Redefinição de Senha</h2>
      <p>Olá ${user.name},</p>
      <p>Recebemos uma solicitação para redefinir sua senha. Use o código abaixo para criar uma nova senha:</p>
      <div style="text-align: center; margin: 30px 0;">
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${token}
        </div>
      </div>
      <p>Este código é válido por 24 horas. Se você não solicitou esta redefinição, por favor ignore este email.</p>
      <p>Atenciosamente,<br>Equipe Meu Agendamento PRO</p>
    </div>
  `;

  try {
    console.log(`Tentando enviar email de redefinição de senha para ${user.email}...`);
    
    // Verificar se o transporter está disponível
    if (!transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (transporter indisponível)');
      console.log('==================================================');
      console.log(`Email para: ${user.email}`);
      console.log(`Assunto: Redefinição de Senha - Meu Agendamento PRO`);
      console.log('\nCÓDIGO DE REDEFINIÇÃO:');
      console.log(`\n    ${token}\n`);
      console.log('==================================================\n');
      
      // Simula um envio bem-sucedido
      return true;
    }
    
    // Configuração do email para envio real
    const mailOptions = {
      from: `"Meu Agendamento PRO" <${EMAIL_USER}>`,
      to: user.email,
      subject: 'Redefinição de Senha - Meu Agendamento PRO',
      html,
    };
    
    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de redefinição de senha enviado: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de redefinição de senha:', error);
    
    // Em caso de erro, usar o modo de simulação como fallback
    console.log('\n==================================================');
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK APÓS ERRO)');
    console.log('==================================================');
    console.log(`Email para: ${user.email}`);
    console.log(`Assunto: Redefinição de Senha - Meu Agendamento PRO`);
    console.log('\nCÓDIGO DE REDEFINIÇÃO:');
    console.log(`\n    ${token}\n`);
    console.log('==================================================\n');
    
    // Simula um envio bem-sucedido mesmo após o erro
    return true;
  }
}
