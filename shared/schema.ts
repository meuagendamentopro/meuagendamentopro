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

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  providerId: true,
  clientId: true,
  serviceId: true,
  date: true,
  endTime: true,
  status: true,
  notes: true,
});

// Frontend schemas
export const bookingFormSchema = z.object({
  name: z.string().min(3, "Nome é obrigatório"),
  phone: z.string().min(10, "Telefone é obrigatório"),
  notes: z.string().optional(),
  serviceId: z.number(),
  date: z.string(),
  time: z.string(),
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
