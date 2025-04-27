import { pgTable, text, serial, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from 'drizzle-orm';

// Usuários do sistema (para autenticação)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("provider").notNull(), // 'admin' ou 'provider'
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    usernameIdx: uniqueIndex("username_idx").on(table.username),
  }
});

// Schema de inserção para usuários
export const insertUserSchema = createInsertSchema(users).pick({
  name: true,
  username: true,
  password: true,
  role: true,
  avatarUrl: true,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relações entre tabelas
export const providersRelations = relations(providers, ({ one }) => ({
  user: one(users, {
    fields: [providers.userId],
    references: [users.id]
  })
}));

export const usersRelations = relations(users, ({ one }) => ({
  provider: one(providers, {
    fields: [users.id],
    references: [providers.userId]
  })
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

// Appointment status enum
export const AppointmentStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

// Appointment model
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull(),
  clientId: integer("client_id").notNull(),
  serviceId: integer("service_id").notNull(),
  date: timestamp("date").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default(AppointmentStatus.PENDING),
  notes: text("notes"),
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
      
      // Caso contrário, usa a data com a hora especificada (com cuidado para o fuso horário)
      const date = new Date(str);
      return date;
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
      
      // Caso contrário, usa a data com a hora especificada (com cuidado para o fuso horário)
      const date = new Date(str);
      return date;
    })
  ])
})
  .pick({
    providerId: true,
    clientId: true,
    serviceId: true,
    date: true,
    endTime: true,
    status: true,
    notes: true,
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
  username: z.string().min(3, "Nome de usuário é obrigatório"),
  password: z.string().min(6, "Senha é obrigatória")
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

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
