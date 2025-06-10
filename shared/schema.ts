import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex, time, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// Usuários do sistema (para autenticação)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").default("provider").notNull(), // 'admin' ou 'provider'
  accountType: text("account_type").default("individual").notNull(), // 'individual' ou 'company'
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").default(true).notNull(), // Para bloquear acesso ao sistema
  isEmailVerified: boolean("is_email_verified").default(false).notNull(), // Indica se o email foi verificado
  verificationToken: text("verification_token"), // Token para verificação de email (opcional)
  verificationTokenExpiry: timestamp("verification_token_expiry"), // Data de expiração do token
  subscriptionExpiry: timestamp("subscription_expiry"), // Data de expiração da assinatura (null para admin ou assinatura sem expiração)
  neverExpires: boolean("never_expires").default(false), // Para assinaturas que nunca expiram
  hideWhatsappPopup: boolean("hide_whatsapp_popup").default(false).notNull(), // Preferência para não mostrar popup do WhatsApp
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    usernameIdx: uniqueIndex("username_idx").on(table.username),
    emailIdx: uniqueIndex("email_idx").on(table.email),
  }
});

// Schema de inserção para usuários
export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  username: true,
  email: true,
  password: true,
  role: true,
  accountType: true,
  avatarUrl: true,
  isActive: true,
  isEmailVerified: true,
  verificationToken: true,
  verificationTokenExpiry: true,
  subscriptionExpiry: true,
  neverExpires: true,
  hideWhatsappPopup: true,
});

// Provider/Professional model (vinculado a um usuário)
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  bookingLink: text("booking_link").unique(),
  avatarUrl: text("avatar_url"),
  workingHoursStart: integer("working_hours_start").default(8), // Horário de início em horas (padrão: 8h)
  workingHoursEnd: integer("working_hours_end").default(18),    // Horário de término em horas (padrão: 18h) 
  workingDays: text("working_days").default("1,2,3,4,5").notNull(), // Dias de trabalho (1=Segunda, 7=Domingo), padrão: segunda a sexta
  // Configurações de pagamento PIX
  pixEnabled: boolean("pix_enabled").default(false).notNull(),  // Habilitar pagamento via PIX
  pixKeyType: text("pix_key_type"),  // Tipo de chave PIX: CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA
  pixKey: text("pix_key"),           // Chave PIX do provedor
  pixRequirePayment: boolean("pix_require_payment").default(false).notNull(), // Se o pagamento é obrigatório para confirmar agendamento
  pixPaymentPercentage: integer("pix_payment_percentage").default(100), // Percentual do valor a ser pago (padrão: 100%)
  pixCompanyName: text("pix_company_name"), // Nome que aparecerá no pagamento
  pixMerchantId: text("pix_merchant_id"),   // ID do mercador na API de pagamento (se aplicável)
  pixWebhookSecret: text("pix_webhook_secret"), // Segredo para validação de webhooks
  pixMercadoPagoToken: text("pix_mercadopago_token"), // Token de acesso do Mercado Pago específico do provedor
  pixIdentificationNumber: text("pix_identification_number"), // Número de CPF/CNPJ para identificação no Mercado Pago
  // Templates de mensagens WhatsApp
  whatsappTemplateAppointment: text("whatsapp_template_appointment"), // Template para mensagem de confirmação de agendamento
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relações entre tabelas
// Tabela para faixas de horário de exclusão (como horário de almoço)
export const timeExclusions = pgTable("time_exclusions", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: 'cascade' }),
  startTime: text("start_time").notNull(), // Formato: "HH:MM"
  endTime: text("end_time").notNull(),     // Formato: "HH:MM"
  dayOfWeek: integer("day_of_week"),      // Dia específico da semana (1-7, null para todos os dias)
  name: text("name"),                     // Descrição opcional (ex: "Almoço", "Pausa")
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTimeExclusionSchema = createInsertSchema(timeExclusions).pick({
  providerId: true,
  startTime: true,
  endTime: true,
  dayOfWeek: true,
  name: true,
  isActive: true,
});

export const providersRelations = relations(providers, ({ one, many }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id]
  }),
  timeExclusions: many(timeExclusions)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  provider: one(providers, {
    fields: [users.id],
    references: [providers.userId]
  }),
  subscriptionTransactions: many(subscriptionTransactions)
}));

export const insertProviderSchema = createInsertSchema(providers).pick({
  userId: true,
  name: true,
  email: true,
  phone: true,
  bookingLink: true,
  avatarUrl: true,
  workingHoursStart: true,
  workingHoursEnd: true,
  workingDays: true,
  // Campos de pagamento PIX
  pixEnabled: true,
  pixKeyType: true,
  pixKey: true,
  pixRequirePayment: true,
  pixPaymentPercentage: true,
  pixCompanyName: true,
  pixMerchantId: true,
  pixWebhookSecret: true,
  pixMercadoPagoToken: true,
  pixIdentificationNumber: true,
});

// Service model
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull(), // in minutes
  price: integer("price").notNull(), // in cents
  active: boolean("active").notNull().default(true),
});

export const insertServiceSchema = createInsertSchema(services).pick({
  providerId: true,
  name: true,
  description: true,
  duration: true,
  price: true,
  active: true,
});

// Client model
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(), // Para soft delete
  isBlocked: boolean("is_blocked").default(false).notNull(), // Para bloquear agendamentos
});

export const insertClientSchema = createInsertSchema(clients).pick({
  name: true,
  phone: true,
  email: true,
  notes: true,
  active: true,
  isBlocked: true,
});

// Tabela de associação entre providers e clients
export const providerClients = pgTable("provider_clients", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: 'cascade' }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Criamos um schema simples para inserção na tabela de associação
export const insertProviderClientSchema = createInsertSchema(providerClients).pick({
  providerId: true,
  clientId: true,
});

// O tipo ProviderClient está definido abaixo nas exportações de tipos

// Funcionários (para contas do tipo empresa)
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  companyUserId: integer("company_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(), // Especialidade do funcionário
  lunchBreakStart: text("lunch_break_start").notNull(), // ex: "12:00"
  lunchBreakEnd: text("lunch_break_end").notNull(), // ex: "13:00"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmployeeSchema = createInsertSchema(employees).pick({
  companyUserId: true,
  name: true,
  specialty: true,
  lunchBreakStart: true,
  lunchBreakEnd: true,
  isActive: true,
});

// Tabela de associação entre funcionários e serviços
export const employeeServices = pgTable("employee_services", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: 'cascade' }),
  serviceId: integer("service_id").notNull().references(() => services.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEmployeeServiceSchema = createInsertSchema(employeeServices).pick({
  employeeId: true,
  serviceId: true,
});

// Relations para employees
export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(users, {
    fields: [employees.companyUserId],
    references: [users.id]
  }),
  appointments: many(appointments),
  employeeServices: many(employeeServices)
}));

// Relations para employeeServices
export const employeeServicesRelations = relations(employeeServices, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeServices.employeeId],
    references: [employees.id]
  }),
  service: one(services, {
    fields: [employeeServices.serviceId],
    references: [services.id]
  })
}));

// Appointment status enum
export const AppointmentStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

// Status de pagamento
export const PaymentStatus = {
  NOT_REQUIRED: "not_required", // Pagamento não é necessário
  PENDING: "pending",          // Aguardando pagamento
  CONFIRMED: "confirmed",      // Pagamento confirmado
  FAILED: "failed",            // Falha no pagamento
  REFUNDED: "refunded",        // Pagamento reembolsado
} as const;

// Appointment model
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  clientId: integer("client_id").notNull(),
  serviceId: integer("service_id").notNull(),
  employeeId: integer("employee_id").references(() => employees.id), // Para contas empresa: funcionário responsável
  date: timestamp("date").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default(AppointmentStatus.PENDING),
  notes: text("notes"),
  cancellationReason: text("cancellation_reason"),
  // Campos para pagamento PIX
  requiresPayment: boolean("requires_payment").default(false).notNull(),
  paymentStatus: text("payment_status").default(PaymentStatus.NOT_REQUIRED),
  paymentAmount: integer("payment_amount"), // Valor em centavos
  paymentPercentage: integer("payment_percentage"), // Percentual do valor total
  pixTransactionId: text("pix_transaction_id"), // ID da transação PIX
  pixQrCode: text("pix_qr_code"), // QR Code para pagamento
  pixQrCodeExpiration: timestamp("pix_qr_code_expiration"), // Expiração do QR Code
  pixPaymentDate: timestamp("pix_payment_date"), // Data do pagamento
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Definindo um esquema de inserção de agendamento com validações adicionais
// Modificado para aceitar strings ISO
export const insertAppointmentSchema = createInsertSchema(appointments, {
  date: z.union([
    z.date(),
    z.string().transform((str) => {
      // Se for uma string ISO sem hora (formato YYYY-MM-DD),
      // cria a data no fuso horário local
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = str.split('-').map(Number);
        return new Date(year, month - 1, day); // mês em JS é 0-indexado
      }
      
      // Para strings com horário, interpretar como horário local (não UTC)
      // Se a string termina com 'Z' ou tem offset (+/-), é UTC/timezone específico
      if (str.includes('Z') || str.match(/[+-]\d{2}:\d{2}$/)) {
        return new Date(str);
      }
      
      // Se não tem timezone, assumir que é horário local
      // Converter para formato que o JavaScript interpreta como local
      const localDate = new Date(str.replace('T', ' '));
      
      // Se ainda for inválido, tentar parsing manual
      if (isNaN(localDate.getTime())) {
        // Formato: YYYY-MM-DDTHH:mm:ss ou YYYY-MM-DD HH:mm:ss
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
        if (match) {
          const [, year, month, day, hour, minute, second] = match;
          return new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hour), 
            parseInt(minute), 
            parseInt(second || '0')
          );
        }
      }
      
      return localDate;
    })
  ]),
  endTime: z.union([
    z.date(),
    z.string().transform((str) => {
      // Se for uma string ISO sem hora (formato YYYY-MM-DD),
      // cria a data no fuso horário local
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = str.split('-').map(Number);
        return new Date(year, month - 1, day); // mês em JS é 0-indexado
      }
      
      // Para strings com horário, interpretar como horário local (não UTC)
      // Se a string termina com 'Z' ou tem offset (+/-), é UTC/timezone específico
      if (str.includes('Z') || str.match(/[+-]\d{2}:\d{2}$/)) {
        return new Date(str);
      }
      
      // Se não tem timezone, assumir que é horário local
      // Converter para formato que o JavaScript interpreta como local
      const localDate = new Date(str.replace('T', ' '));
      
      // Se ainda for inválido, tentar parsing manual
      if (isNaN(localDate.getTime())) {
        // Formato: YYYY-MM-DDTHH:mm:ss ou YYYY-MM-DD HH:mm:ss
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/);
        if (match) {
          const [, year, month, day, hour, minute, second] = match;
          return new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hour), 
            parseInt(minute), 
            parseInt(second || '0')
          );
        }
      }
      
      return localDate;
    })
  ])
})
  .pick({
    providerId: true,
    clientId: true,
    serviceId: true,
    employeeId: true,
    date: true,
    endTime: true,
    status: true,
    notes: true,
    // Campos de pagamento PIX
    requiresPayment: true,
    paymentStatus: true,
    paymentAmount: true,
    paymentPercentage: true,
    pixTransactionId: true,
    pixQrCode: true,
    pixQrCodeExpiration: true,
    pixPaymentDate: true,
  })
  .transform((data) => {
    // Garantir que status e notes nunca são undefined
    return {
      ...data,
      status: data.status || AppointmentStatus.PENDING,
      notes: data.notes || null,
    };
  });

// Frontend schemas para o formulário de agendamento
export const bookingFormSchema = z.object({
  name: z.string().min(3, "Nome é obrigatório"),
  phone: z.string().min(10, "Telefone é obrigatório"),
  notes: z.string().optional(),
  serviceId: z.number().int().positive("Selecione um serviço"),
  employeeId: z.number().int().positive().optional(), // Para contas empresa: funcionário selecionado
  date: z.string().refine(
    (date) => {
      try {
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      } catch {
        return false;
      }
    },
    { message: "Data inválida" }
  ),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Horário inválido"),
});

// Deixa estas linhas vazias para remover as duplicações

// Tabela de planos de assinatura
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),             // Nome do plano (ex: Mensal, Trimestral, Anual)
  description: text("description"),         // Descrição opcional do plano
  durationMonths: integer("duration_months").notNull(), // Duração em meses
  price: integer("price").notNull(),        // Preço em centavos
  isActive: boolean("is_active").default(true).notNull(), // Se o plano está ativo para compra
  accountType: text("account_type").notNull().default("individual"), // Tipo de conta: "individual" ou "company"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema de inserção para planos de assinatura
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).pick({
  name: true,
  description: true,
  durationMonths: true,
  price: true,
  isActive: true,
});

// Tabela de transações de assinatura
export const subscriptionTransactions = pgTable("subscription_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  transactionId: text("transaction_id"), // ID da transação de pagamento
  paymentMethod: text("payment_method").notNull().default("pix"), // Método de pagamento
  status: text("status").notNull().default("pending"), // pending, paid, failed, cancelled
  amount: integer("amount").notNull(), // Valor pago em centavos
  pixQrCode: text("pix_qr_code"), // QR Code PIX (se aplicável)
  pixQrCodeBase64: text("pix_qr_code_base64"), // QR Code PIX em Base64 (se aplicável)
  pixQrCodeExpiration: timestamp("pix_qr_code_expiration"), // Expiração do QR Code
  paidAt: timestamp("paid_at"), // Data do pagamento
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema de inserção para transações de assinatura
export const insertSubscriptionTransactionSchema = createInsertSchema(subscriptionTransactions).pick({
  userId: true,
  planId: true,
  transactionId: true,
  paymentMethod: true,
  status: true,
  amount: true,
  pixQrCode: true,
  pixQrCodeBase64: true,
  pixQrCodeExpiration: true,
  paidAt: true,
});

// Relações para as transações de assinatura
export const subscriptionTransactionsRelations = relations(subscriptionTransactions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionTransactions.userId],
    references: [users.id]
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptionTransactions.planId],
    references: [subscriptionPlans.id]
  })
}));

// Tabela de anotações clínicas para psicólogos
export const clinicalNotes = pgTable("clinical_notes", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id, { onDelete: 'cascade' }),
  providerId: integer("provider_id").notNull().references(() => providers.id, { onDelete: 'cascade' }),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: 'cascade' }),
  content: text("content").notNull(), // Conteúdo formatado em HTML
  isPrivate: boolean("is_private").default(true).notNull(), // Se a anotação é privada ou pode ser compartilhada
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema de inserção para anotações clínicas
export const insertClinicalNoteSchema = createInsertSchema(clinicalNotes).pick({
  appointmentId: true,
  providerId: true,
  clientId: true,
  content: true,
  isPrivate: true,
});

// Relações para as anotações clínicas
export const clinicalNotesRelations = relations(clinicalNotes, ({ one }) => ({
  appointment: one(appointments, {
    fields: [clinicalNotes.appointmentId],
    references: [appointments.id]
  }),
  provider: one(providers, {
    fields: [clinicalNotes.providerId],
    references: [providers.id]
  }),
  client: one(clients, {
    fields: [clinicalNotes.clientId],
    references: [clients.id]
  })
}));

// Tabela de notificações para alertar os profissionais sobre novos agendamentos
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("appointment"),  // Tipo de notificação (appointment, system, etc)
  isRead: boolean("is_read").notNull().default(false),
  appointmentId: integer("appointment_id").references(() => appointments.id, { onDelete: 'set null' }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema de inserção para notificações
export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  title: true,
  message: true,
  type: true,
  appointmentId: true,
});

// Relations para notificações
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  }),
  appointment: one(appointments, {
    fields: [notifications.appointmentId],
    references: [appointments.id]
  })
}));

// Tabela de configurações do sistema
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  siteName: text("site_name").default("Meu Agendamento PRO"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#0891b2"),
  trialPeriodDays: integer("trial_period_days").default(3).notNull(), // Período de teste em dias para novos usuários
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema de inserção para configurações do sistema
export const insertSystemSettingsSchema = createInsertSchema(systemSettings).pick({
  siteName: true,
  logoUrl: true,
  faviconUrl: true,
  primaryColor: true,
  trialPeriodDays: true,
});

// Relations para appointments
export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  provider: one(providers, {
    fields: [appointments.providerId],
    references: [providers.id],
  }),
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
  notifications: many(notifications)
}));

// Relations para services
export const servicesRelations = relations(services, ({ one, many }) => ({
  provider: one(providers, {
    fields: [services.providerId],
    references: [providers.id],
  }),
  appointments: many(appointments)
}));

// Relations para a tabela de associação provider-client
export const providerClientsRelations = relations(providerClients, ({ one }) => ({
  provider: one(providers, {
    fields: [providerClients.providerId],
    references: [providers.id]
  }),
  client: one(clients, {
    fields: [providerClients.clientId],
    references: [clients.id]
  })
}));

// Relations para providers (adicionando a relação com clients)
export const providersClientsRelation = relations(providers, ({ many }) => ({
  providerClients: many(providerClients)
}));

// Relations para clients
export const clientsRelations = relations(clients, ({ many }) => ({
  appointments: many(appointments),
  providerClients: many(providerClients)
}));

// Schema de login (para autenticação)
export const loginSchema = z.object({
  username: z.string()
    .trim()
    .toLowerCase()
    .min(4, "Nome de usuário deve ter no mínimo 4 caracteres")
    .max(16, "Nome de usuário deve ter no máximo 16 caracteres")
    .regex(/^[a-z0-9]+$/, "Nome de usuário deve conter apenas letras minúsculas e números, sem espaços"),
  password: z.string().min(6, "Senha é obrigatória")
});

// Função auxiliar para validar nomes de usuário
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < 4 || trimmed.length > 16) return false;
  return /^[a-z0-9]+$/.test(trimmed);
}

// Schema de registro para novos usuários
export const registerSchema = z.object({
  name: z.string().min(3, "Nome completo é obrigatório"),
  username: z.string()
    .min(4, "Nome de usuário deve ter no mínimo 4 caracteres")
    .max(16, "Nome de usuário deve ter no máximo 16 caracteres")
    .regex(/^[a-z0-9]+$/, "Nome de usuário deve conter apenas letras minúsculas e números, sem espaços"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirmação de senha é obrigatória")
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Provider = typeof providers.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type ProviderClient = typeof providerClients.$inferSelect;
export type InsertProviderClient = z.infer<typeof insertProviderClientSchema>;

export type TimeExclusion = typeof timeExclusions.$inferSelect;
export type InsertTimeExclusion = z.infer<typeof insertTimeExclusionSchema>;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;

export type SubscriptionTransaction = typeof subscriptionTransactions.$inferSelect;
export type InsertSubscriptionTransaction = z.infer<typeof insertSubscriptionTransactionSchema>;

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;

export type SystemSettings = typeof systemSettings.$inferSelect;
export type InsertSystemSettings = typeof systemSettings.$inferInsert;

export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type InsertClinicalNote = typeof clinicalNotes.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type EmployeeService = typeof employeeServices.$inferSelect;
export type InsertEmployeeService = z.infer<typeof insertEmployeeServiceSchema>;
