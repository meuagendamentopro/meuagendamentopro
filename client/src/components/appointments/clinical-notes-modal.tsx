import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Appointment, Client, ClinicalNote } from "@shared/schema";
import RichTextEditor from "@/components/ui/rich-text-editor";
import { Loader2 } from "lucide-react";
import { formatDate, formatTime } from "@/lib/dates";

interface ClinicalNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  client: Client | null;
  providerId: number;
  existingNote?: ClinicalNote;
  onSuccess?: () => void;
}

const ClinicalNotesModal: React.FC<ClinicalNotesModalProps> = ({
  isOpen,
  onClose,
  appointment,
  client,
  providerId,
  existingNote,
  onSuccess
}) => {
  const [content, setContent] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const { toast } = useToast();

  // Carregar dados da nota existente, se houver
  useEffect(() => {
    if (existingNote) {
      setContent(existingNote.content);
      setIsPrivate(existingNote.isPrivate);
    } else {
      setContent('');
      setIsPrivate(true);
    }
  }, [existingNote, isOpen]);

  const handleSubmit = async () => {
    if (!appointment || !client) return;
    
    if (!content.trim()) {
      toast({
        title: "Erro",
        description: "O conteúdo da anotação não pode estar vazio.",
        variant: "destructive"
      });
      return;
    }
    
    // Formatar o texto simples para exibição
    const formattedContent = content
      .replace(/\n/g, '<br>')  // Converter quebras de linha em <br>
      .replace(/\s{2,}/g, ' '); // Remover espaços extras

    setIsSubmitting(true);

    try {
      // Se for uma nota existente, atualiza
      if (existingNote) {
        await fetch(`/api/clinical-notes/${existingNote.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: formattedContent,
            isPrivate,
          }),
        });
      } else {
        // Se for uma nova nota, cria
        await fetch('/api/clinical-notes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appointmentId: appointment.id,
            clientId: client.id,
            content: formattedContent,
            isPrivate,
          }),
        });
      }

      toast({
        title: "Anotação salva",
        description: "Sua anotação clínica foi salva com sucesso."
      });

      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
      setContent('');
    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar a anotação clínica.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existingNote ? "Editar Anotação Clínica" : "Nova Anotação Clínica"}
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
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold">Horário:</span> {new Date(appointment.date).getUTCHours().toString().padStart(2, '0')}:{new Date(appointment.date).getUTCMinutes().toString().padStart(2, '0')}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Anotações</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Adicione suas anotações clínicas aqui..."
                height={300}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
              <Label htmlFor="private">Anotação privada (visível apenas para você)</Label>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Anotação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClinicalNotesModal;
