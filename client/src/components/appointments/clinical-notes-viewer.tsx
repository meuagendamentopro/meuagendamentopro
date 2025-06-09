import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Appointment, Client, ClinicalNote } from "@shared/schema";
import { Loader2, Edit, Trash2, AlertCircle } from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/dates";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ClinicalNotesModal from "./clinical-notes-modal";

interface ClinicalNotesViewerProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  client: Client | null;
  providerId: number;
}

const ClinicalNotesViewer: React.FC<ClinicalNotesViewerProps> = ({
  isOpen,
  onClose,
  appointment,
  client,
  providerId
}) => {
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const { toast } = useToast();

  const fetchNotes = async () => {
    if (!appointment) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/clinical-notes/appointment/${appointment.id}`);
      
      if (!response.ok) {
        throw new Error('Falha ao buscar anotações clínicas');
      }
      
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Erro ao buscar anotações:', error);
      setError('Não foi possível carregar as anotações clínicas. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && appointment) {
      fetchNotes();
    }
  }, [isOpen, appointment]);

  const handleEdit = (note: ClinicalNote) => {
    setSelectedNote(note);
    setIsEditModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    
    try {
      const response = await fetch(`/api/clinical-notes/${selectedNote.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Falha ao excluir anotação clínica');
      }
      
      toast({
        title: "Anotação excluída",
        description: "A anotação clínica foi excluída com sucesso."
      });
      
      fetchNotes();
    } catch (error) {
      console.error('Erro ao excluir anotação:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a anotação clínica.",
        variant: "destructive"
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setSelectedNote(null);
    }
  };

  const confirmDelete = (note: ClinicalNote) => {
    setSelectedNote(note);
    setIsDeleteDialogOpen(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Anotações Clínicas
            </DialogTitle>
          </DialogHeader>

          {appointment && client ? (
            <div className="space-y-6 py-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">Cliente:</span> {client.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">Data:</span> {formatDate(new Date(appointment.date))}
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                  <p className="text-destructive">{error}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={fetchNotes}
                  >
                    Tentar novamente
                  </Button>
                </div>
              ) : notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <p className="text-muted-foreground">Nenhuma anotação clínica encontrada para este agendamento.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      setSelectedNote(null);
                      setIsEditModalOpen(true);
                    }}
                  >
                    Adicionar anotação
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div 
                      key={note.id} 
                      className="border rounded-md p-4 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="text-sm text-muted-foreground">
                          {formatRelativeTime(new Date(note.createdAt))}
                          {note.isPrivate && (
                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                              Privado
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 flex items-center"
                            onClick={() => handleEdit(note)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 flex items-center"
                            onClick={() => confirmDelete(note)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: note.content }}
                      />
                    </div>
                  ))}
                  
                  <div className="flex justify-center mt-6">
                    <Button
                      onClick={() => {
                        setSelectedNote(null);
                        setIsEditModalOpen(true);
                      }}
                    >
                      Adicionar nova anotação
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de edição */}
      {isEditModalOpen && (
        <ClinicalNotesModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          appointment={appointment}
          client={client}
          providerId={providerId}
          existingNote={selectedNote || undefined}
          onSuccess={fetchNotes}
        />
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anotação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta anotação clínica? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex justify-between">
            <AlertDialogCancel className="mr-2">
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Excluir anotação
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClinicalNotesViewer;
