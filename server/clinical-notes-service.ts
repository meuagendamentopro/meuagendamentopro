import { db } from "./db";
import { clinicalNotes, providers, clients, appointments, type ClinicalNote, type InsertClinicalNote } from "@shared/schema";
import { eq, and } from "drizzle-orm";

class ClinicalNotesService {
  /**
   * Cria uma nova anotação clínica
   */
  async createClinicalNote(data: InsertClinicalNote): Promise<ClinicalNote> {
    try {
      // Verificar se o agendamento existe
      const appointmentExists = await db.query.appointments.findFirst({
        where: eq(appointments.id, data.appointmentId)
      });

      if (!appointmentExists) {
        throw new Error("Agendamento não encontrado");
      }

      // Verificar se o provedor tem permissão para este agendamento
      if (appointmentExists.providerId !== data.providerId) {
        throw new Error("Você não tem permissão para adicionar anotações a este agendamento");
      }

      // Criar a anotação
      const [newNote] = await db.insert(clinicalNotes).values({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      return newNote;
    } catch (error) {
      console.error("Erro ao criar anotação clínica:", error);
      throw error;
    }
  }

  /**
   * Atualiza uma anotação clínica existente
   */
  async updateClinicalNote(id: number, providerId: number, data: Partial<InsertClinicalNote>): Promise<ClinicalNote> {
    try {
      // Verificar se a anotação existe e pertence ao provedor
      const existingNote = await db.query.clinicalNotes.findFirst({
        where: and(
          eq(clinicalNotes.id, id),
          eq(clinicalNotes.providerId, providerId)
        )
      });

      if (!existingNote) {
        throw new Error("Anotação não encontrada ou você não tem permissão para editá-la");
      }

      // Atualizar a anotação
      const [updatedNote] = await db
        .update(clinicalNotes)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(clinicalNotes.id, id))
        .returning();

      return updatedNote;
    } catch (error) {
      console.error("Erro ao atualizar anotação clínica:", error);
      throw error;
    }
  }

  /**
   * Obtém uma anotação clínica específica
   */
  async getClinicalNote(id: number, providerId: number): Promise<ClinicalNote | null> {
    try {
      const note = await db.query.clinicalNotes.findFirst({
        where: and(
          eq(clinicalNotes.id, id),
          eq(clinicalNotes.providerId, providerId)
        )
      });

      return note || null;
    } catch (error) {
      console.error("Erro ao buscar anotação clínica:", error);
      throw error;
    }
  }

  /**
   * Obtém todas as anotações clínicas para um agendamento específico
   */
  async getClinicalNotesByAppointment(appointmentId: number, providerId: number): Promise<ClinicalNote[]> {
    try {
      const notes = await db.query.clinicalNotes.findMany({
        where: and(
          eq(clinicalNotes.appointmentId, appointmentId),
          eq(clinicalNotes.providerId, providerId)
        ),
        orderBy: (clinicalNotes, { desc }) => [desc(clinicalNotes.updatedAt)]
      });

      return notes;
    } catch (error) {
      console.error("Erro ao buscar anotações clínicas do agendamento:", error);
      throw error;
    }
  }

  /**
   * Obter todas as anotações clínicas de um cliente
   */
  async getClinicalNotesByClient(clientId: number, providerId: number) {
    try {
      // Verificar se o cliente existe
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, clientId)
      });

      if (!client) {
        throw new Error('Cliente não encontrado');
      }

      // Buscar todas as anotações clínicas do cliente feitas por este provedor
      const notes = await db.query.clinicalNotes.findMany({
        where: and(
          eq(clinicalNotes.clientId, clientId),
          eq(clinicalNotes.providerId, providerId)
        ),
        orderBy: [clinicalNotes.createdAt]
      });
      
      // Buscar informações dos agendamentos para cada anotação
      const notesWithAppointmentInfo = await Promise.all(
        notes.map(async (note) => {
          const appointment = await db.query.appointments.findFirst({
            where: eq(appointments.id, note.appointmentId)
          });
          
          return {
            ...note,
            appointmentDate: appointment?.date,
            appointmentEndTime: appointment?.endTime,
            appointmentStatus: appointment?.status
          };
        })
      );
      
      // Ordenar por data do agendamento (mais recente primeiro)
      notesWithAppointmentInfo.sort((a, b) => {
        if (!a.appointmentDate || !b.appointmentDate) return 0;
        return new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime();
      });

      return notesWithAppointmentInfo;
    } catch (error) {
      console.error("Erro ao buscar anotações clínicas do cliente:", error);
      throw error;
    }
  }

  /**
   * Exclui uma anotação clínica
   */
  async deleteClinicalNote(id: number, providerId: number): Promise<boolean> {
    try {
      // Verificar se a anotação existe e pertence ao provedor
      const existingNote = await db.query.clinicalNotes.findFirst({
        where: and(
          eq(clinicalNotes.id, id),
          eq(clinicalNotes.providerId, providerId)
        )
      });

      if (!existingNote) {
        throw new Error("Anotação não encontrada ou você não tem permissão para excluí-la");
      }

      // Excluir a anotação
      await db
        .delete(clinicalNotes)
        .where(eq(clinicalNotes.id, id));

      return true;
    } catch (error) {
      console.error("Erro ao excluir anotação clínica:", error);
      throw error;
    }
  }
}

export const clinicalNotesService = new ClinicalNotesService();
