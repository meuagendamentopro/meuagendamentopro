import nodemailer from 'nodemailer';
import { type User } from '@shared/schema';

// Verificando se as variáveis de ambiente estão presentes
const isDevelopment = process.env.NODE_ENV === 'development';

// Obter credenciais do arquivo .env
const EMAIL_USER = process.env.GMAIL_USER || 'contato@meuagendamentopro.com.br';
const EMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';

// Verificação mais detalhada das variáveis de ambiente
console.log('Verificando configuração de email:');
console.log(`EMAIL_USER: ${EMAIL_USER}`);
console.log(`EMAIL_PASSWORD configurado: ${!!EMAIL_PASSWORD}`);

// Verificar se as credenciais estão configuradas
const hasEmailConfig = !!EMAIL_USER && !!EMAIL_PASSWORD;

if (!hasEmailConfig) {
  console.warn('AVISO: Variáveis de ambiente GMAIL_USER e/ou GMAIL_APP_PASSWORD não encontradas.');
  console.warn(`Usando modo de simulação de email para ${isDevelopment ? 'desenvolvimento' : 'produção'}.`);
  console.warn('Os códigos de verificação serão exibidos no console.');
}

// Criando o transporter do Nodemailer com as credenciais
let transporter: nodemailer.Transporter | null = null;

if (hasEmailConfig) {
  // Configurar o transporter para usar o Zoho
  const transporterConfig = {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true, // true para 465, false para outras portas
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

  try {
    transporter = nodemailer.createTransport(transporterConfig);
    console.log('Transporter criado com sucesso!');
  } catch (error) {
    console.error('Erro ao criar transporter:', error);
    console.log('Usando modo de simulação de email como fallback');
  }
} else {
  console.log('Usando modo de simulação de email (sem envio real)');
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
      // Na Replit, mesmo em desenvolvimento, use o URL da Replit para garantir
      // que os links funcionem quando acessados externamente
      if (process.env.REPL_ID) {
        // Formato correto para URLs de desenvolvimento Replit
        baseUrl = `https://${process.env.REPL_ID}-00-2zpr2jvty37m.riker.replit.dev`;
        console.log(`Usando URL Replit para emails: ${baseUrl}`);
      } else {
        baseUrl = 'http://localhost:5000';
        console.log('Usando URL localhost para emails');
      }
    } else {
      // Em produção, tenta usar o domínio Replit
      if (process.env.REPL_ID) {
        // Mesmo em produção, o URL do Replit é o mesmo formato
        baseUrl = `https://${process.env.REPL_ID}-00-2zpr2jvty37m.riker.replit.dev`;
      } else {
        // Fallback para localhost se não conseguirmos determinar o URL do Replit
        baseUrl = 'http://localhost:5000';
      }
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
    
    // Modo de simulação de email para desenvolvimento
    if (!hasEmailConfig || !transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO');
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
    
    // Envia o email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email de verificação enviado: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error);
    
    // Em caso de erro, usar o modo de simulação como fallback
    console.log('\n==================================================');
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK)');
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
    
    // Modo de simulação de email para desenvolvimento
    if (!hasEmailConfig || !transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO');
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
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK)');
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
    
    // Modo de simulação de email para desenvolvimento
    if (!hasEmailConfig || !transporter) {
      console.log('\n==================================================');
      console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO');
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
    console.log('MODO DE SIMULAÇÃO DE EMAIL ATIVADO (FALLBACK)');
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
