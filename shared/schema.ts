import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Provider/Professional model
export const providers = pgTable("providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
});

export const insertProviderSchema = createInsertSchema(providers).pick({
  name: true,
  email: true,
  username: true,
  password: true,
  phone: true,
  avatarUrl: true,
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
});

export const insertClientSchema = createInsertSchema(clients).pick({
  name: true,
  phone: true,
  email: true,
  notes: true,
});

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
export const insertAppointmentSchema = createInsertSchema(appointments)
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
    // Garantir que date e endTime são objetos Date válidos
    const dataWithValidDates = { 
      ...data,
      // Se date já é um objeto Date válido, mantém; se for string, converte para Date
      date: data.date instanceof Date && !isNaN(data.date.getTime()) 
        ? data.date 
        : new Date(data.date),
      // Se endTime já é um objeto Date válido, mantém; se for string, converte para Date
      endTime: data.endTime instanceof Date && !isNaN(data.endTime.getTime()) 
        ? data.endTime 
        : new Date(data.endTime),
    };

    // Validar que ambas as datas são válidas
    if (isNaN(dataWithValidDates.date.getTime())) {
      throw new Error(`Data de início inválida: ${data.date}`);
    }
    if (isNaN(dataWithValidDates.endTime.getTime())) {
      throw new Error(`Data de término inválida: ${data.endTime}`);
    }

    // Garantir que status e notes nunca são undefined
    return {
      ...dataWithValidDates,
      status: dataWithValidDates.status || AppointmentStatus.PENDING,
      notes: dataWithValidDates.notes || null,
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

// Types
export type Provider = typeof providers.$inferSelect;
export type InsertProvider = z.infer<typeof insertProviderSchema>;

export type Service = typeof services.$inferSelect;
export type InsertService = z.infer<typeof insertServiceSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type BookingFormValues = z.infer<typeof bookingFormSchema>;
