import nodemailer from 'nodemailer';
import { type User } from '@shared/schema';

// Verificando se as variáveis de ambiente estão presentes
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.warn('AVISO: Variáveis de ambiente GMAIL_USER e/ou GMAIL_APP_PASSWORD não encontradas.');
  console.warn('O serviço de email não funcionará corretamente.');
}

// Criando o transporter do Nodemailer com as credenciais do Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

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
  
  // Define a validade do token (24 horas)
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
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
        baseUrl = `https://${process.env.REPL_ID}-00-${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        console.log(`Usando URL Replit para emails: ${baseUrl}`);
      } else {
        baseUrl = 'http://localhost:5000';
        console.log('Usando URL localhost para emails');
      }
    } else {
      // Em produção, tenta usar o domínio Replit
      if (process.env.REPL_ID) {
        // Mesmo em produção, o URL do Replit é o mesmo formato
        baseUrl = `https://${process.env.REPL_ID}-00-${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      } else {
        // Fallback para localhost se não conseguirmos determinar o URL do Replit
        baseUrl = 'http://localhost:5000';
      }
      console.log(`Definindo URL base para emails: ${baseUrl}`);
    }
  }
  const verificationUrl = `${baseUrl}/verify-email/${token}?email=${encodeURIComponent(user.email)}`;
  
  // Template do email
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Confirme seu Email</h2>
      <p>Olá ${user.name},</p>
      <p>Obrigado por se cadastrar no Meu Agendamento! Para completar seu cadastro, por favor clique no link abaixo para confirmar seu endereço de email:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          Confirmar meu email
        </a>
      </div>
      <p>Ou copie e cole o link abaixo no seu navegador:</p>
      <p style="word-break: break-all; font-size: 14px; color: #4F46E5;">${verificationUrl}</p>
      <p>Este link é válido por 24 horas. Se você não solicitou esta verificação, por favor ignore este email.</p>
      <p>Atenciosamente,<br>Equipe Meu Agendamento</p>
    </div>
  `;

  try {
    // Envia o email
    await transporter.sendMail({
      from: `"Meu Agendamento" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: 'Confirmação de Email - Meu Agendamento',
      html,
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error);
    return false;
  }
}

/**
 * Envia um email de boas-vindas ao usuário após a verificação do email
 * @param user Usuário para quem o email será enviado
 * @returns true se o email foi enviado com sucesso, false caso contrário
 */
export async function sendWelcomeEmail(user: User): Promise<boolean> {
  // Template do email
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333; text-align: center;">Bem-vindo ao Meu Agendamento!</h2>
      <p>Olá ${user.name},</p>
      <p>Seu email foi verificado com sucesso e sua conta está pronta para uso!</p>
      <p>Agora você pode acessar nossa plataforma e começar a gerenciar seus agendamentos de forma eficiente.</p>
      <p>Atenciosamente,<br>Equipe Meu Agendamento</p>
    </div>
  `;

  try {
    // Envia o email
    await transporter.sendMail({
      from: `"Meu Agendamento" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: 'Bem-vindo ao Meu Agendamento!',
      html,
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de boas-vindas:', error);
    return false;
  }
}

/**
 * Verifica se o serviço de email está configurado corretamente
 * @returns true se o serviço estiver configurado, false caso contrário
 */
export function isEmailServiceConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
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
      <p>Atenciosamente,<br>Equipe Meu Agendamento</p>
    </div>
  `;

  try {
    // Envia o email
    await transporter.sendMail({
      from: `"Meu Agendamento" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: 'Redefinição de Senha - Meu Agendamento',
      html,
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao enviar email de redefinição de senha:', error);
    return false;
  }
}