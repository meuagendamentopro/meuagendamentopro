import express from "express";
import { z } from "zod";
import { clinicalNotesService } from "../clinical-notes-service";
import { requireAuth } from "../middleware/auth-middleware";
import { insertClinicalNoteSchema } from "@shared/schema";

const router = express.Router();

// Middleware para garantir que o usuário esteja autenticado
router.use(requireAuth);

// Esquema de validação para criação de anotação clínica
const createNoteSchema = insertClinicalNoteSchema.extend({
  content: z.string().min(1, "O conteúdo da anotação é obrigatório"),
});

// Esquema de validação para atualização de anotação clínica
const updateNoteSchema = z.object({
  content: z.string().min(1, "O conteúdo da anotação é obrigatório").optional(),
  isPrivate: z.boolean().optional(),
});

// Criar uma nova anotação clínica
router.post("/", async (req, res) => {
  try {
    if (!req.user || !req.user.providerId) {
      return res.status(403).json({ error: "Acesso negado: Usuário não é um provedor" });
    }
    
    const providerId = req.user.providerId;

    // Validar os dados de entrada
    const validatedData = createNoteSchema.parse({
      ...req.body,
      providerId,
    });

    const newNote = await clinicalNotesService.createClinicalNote(validatedData);
    res.status(201).json(newNote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Erro ao criar anotação clínica:", error);
    res.status(500).json({ error: "Erro ao criar anotação clínica" });
  }
});

// Atualizar uma anotação clínica existente
router.put("/:id", async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    
    if (!req.user || !req.user.providerId) {
      return res.status(403).json({ error: "Acesso negado: Usuário não é um provedor" });
    }
    
    const providerId = req.user.providerId;

    // Validar os dados de entrada
    const validatedData = updateNoteSchema.parse(req.body);

    const updatedNote = await clinicalNotesService.updateClinicalNote(noteId, providerId, validatedData);
    res.json(updatedNote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Erro ao atualizar anotação clínica:", error);
    res.status(500).json({ error: "Erro ao atualizar anotação clínica" });
  }
});

// Obter uma anotação clínica específica
router.get("/:id", async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    
    if (!req.user || !req.user.providerId) {
      return res.status(403).json({ error: "Acesso negado: Usuário não é um provedor" });
    }
    
    const providerId = req.user.providerId;

    const note = await clinicalNotesService.getClinicalNote(noteId, providerId);
    
    if (!note) {
      return res.status(404).json({ error: "Anotação não encontrada" });
    }
    
    res.json(note);
  } catch (error) {
    console.error("Erro ao buscar anotação clínica:", error);
    res.status(500).json({ error: "Erro ao buscar anotação clínica" });
  }
});

// Obter todas as anotações clínicas para um agendamento específico
router.get("/appointment/:appointmentId", async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    
    if (!req.user || !req.user.providerId) {
      return res.status(403).json({ error: "Acesso negado: Usuário não é um provedor" });
    }
    
    const providerId = req.user.providerId;

    const notes = await clinicalNotesService.getClinicalNotesByAppointment(appointmentId, providerId);
    res.json(notes);
  } catch (error) {
    console.error("Erro ao buscar anotações clínicas do agendamento:", error);
    res.status(500).json({ error: "Erro ao buscar anotações clínicas do agendamento" });
  }
});

// Obter todas as anotações clínicas de um agendamento
router.get(
  '/clinical-notes/appointment/:appointmentId',
  requireAuth,
  async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.appointmentId);
      const providerId = req.user?.providerId;
      
      if (!providerId) {
        return res.status(403).json({ error: 'Acesso negado: ID do provedor não encontrado' });
      }

      const notes = await clinicalNotesService.getClinicalNotesByAppointment(appointmentId, providerId);
      res.json(notes);
    } catch (error) {
      console.error('Erro ao buscar anotações clínicas:', error);
      res.status(500).json({ error: 'Erro ao buscar anotações clínicas' });
    }
  }
);

// Obter todas as anotações clínicas de um cliente
router.get(
  '/clinical-notes/client/:clientId',
  requireAuth,
  async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const providerId = req.user?.providerId;
      
      if (!providerId) {
        return res.status(403).json({ error: 'Acesso negado: ID do provedor não encontrado' });
      }

      const notes = await clinicalNotesService.getClinicalNotesByClient(clientId, providerId);
      res.json(notes);
    } catch (error) {
      console.error('Erro ao buscar anotações clínicas do cliente:', error);
      res.status(500).json({ error: 'Erro ao buscar anotações clínicas do cliente' });
    }
  }
);

// Obter todas as anotações clínicas para um cliente específico
router.get("/client/:clientId", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (!req.user || !req.user.providerId) {
      return res.status(403).json({ error: "Acesso negado: Usuário não é um provedor" });
    }
    
    const providerId = req.user.providerId;

    const notes = await clinicalNotesService.getClinicalNotesByClient(clientId, providerId);
    res.json(notes);
  } catch (error) {
    console.error("Erro ao buscar anotações clínicas do cliente:", error);
    res.status(500).json({ error: "Erro ao buscar anotações clínicas do cliente" });
  }
});

// Excluir uma anotação clínica
router.delete("/:id", async (req, res) => {
  try {
    const noteId = parseInt(req.params.id);
    
    if (!req.user || !req.user.providerId) {
      return res.status(403).json({ error: "Acesso negado: Usuário não é um provedor" });
    }
    
    const providerId = req.user.providerId;

    await clinicalNotesService.deleteClinicalNote(noteId, providerId);
    res.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir anotação clínica:", error);
    res.status(500).json({ error: "Erro ao excluir anotação clínica" });
  }
});

export default router;
