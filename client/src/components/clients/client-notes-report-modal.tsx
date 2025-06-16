import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Client, ClinicalNote } from "@shared/schema";
import { Loader2, Calendar, Clock } from "lucide-react";
import { formatDate, formatTime } from "@/lib/dates";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

// Estender a interface ClinicalNote para incluir informações do agendamento
interface ExtendedClinicalNote extends ClinicalNote {
  appointmentDate?: Date | string;
  appointmentEndTime?: Date | string;
  appointmentStatus?: string;
}

// Tipo para anotações agrupadas por data de agendamento
interface GroupedNotes {
  [key: string]: ExtendedClinicalNote[];
}

interface ClientNotesReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  providerId: number;
}

const ClientNotesReportModal: React.FC<ClientNotesReportModalProps> = ({
  isOpen,
  onClose,
  client,
  providerId
}) => {
  const [notes, setNotes] = useState<ExtendedClinicalNote[]>([]);
  const [groupedNotes, setGroupedNotes] = useState<GroupedNotes>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Carregar todas as anotações do cliente quando o modal for aberto
  useEffect(() => {
    if (isOpen && client) {
      fetchClientNotes();
    }
  }, [isOpen, client]);
  
  // Agrupar anotações por data de agendamento
  useEffect(() => {
    if (notes.length > 0) {
      const grouped = notes.reduce((acc: GroupedNotes, note) => {
        // Usar a data do agendamento como chave para agrupar
        const dateKey = note.appointmentDate ? 
          formatDate(new Date(note.appointmentDate)) : 
          'Sem data de agendamento';
        
        if (!acc[dateKey]) {
          acc[dateKey] = [];
        }
        
        acc[dateKey].push(note);
        return acc;
      }, {});
      
      setGroupedNotes(grouped);
    }
  }, [notes]);

  // Buscar todas as anotações clínicas do cliente
  const fetchClientNotes = async () => {
    if (!client) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/clinical-notes/client/${client.id}?providerId=${providerId}`);
      
      if (!response.ok) {
        throw new Error('Falha ao buscar anotações clínicas');
      }
      
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error('Erro ao buscar anotações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as anotações clínicas deste cliente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar o conteúdo HTML de forma segura
  const renderContent = (content: string) => {
    return { __html: content };
  };
  
  // Obter o status formatado do agendamento
  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    
    const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" }> = {
      confirmed: { label: "Confirmado", variant: "default" },
      completed: { label: "Concluído", variant: "secondary" },
      cancelled: { label: "Cancelado", variant: "destructive" },
      pending: { label: "Pendente", variant: "outline" }
    };
    
    const statusInfo = statusMap[status] || { label: status, variant: "outline" };
    
    return (
      <Badge variant={statusInfo.variant} className="ml-2">
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Relatório de Anotações Clínicas - {client?.name}</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando anotações...</span>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8">
            <p>Nenhuma anotação clínica encontrada para este cliente.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-8">
              {Object.entries(groupedNotes).map(([dateKey, dateNotes]) => (
                <div key={dateKey} className="border rounded-md p-4">
                  {/* Cabeçalho com data do agendamento */}
                  <div className="bg-muted p-3 rounded-t-md -mt-4 -mx-4 mb-4">
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-primary" />
                      <h3 className="font-medium text-lg">{dateKey}</h3>
                      {dateNotes[0].appointmentStatus && getStatusBadge(dateNotes[0].appointmentStatus)}
                    </div>
                    {dateNotes[0].appointmentEndTime && (
                      <div className="flex items-center mt-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-2" />
                        Horário: {new Date(dateNotes[0].appointmentDate || '').getUTCHours().toString().padStart(2, '0')}:{new Date(dateNotes[0].appointmentDate || '').getUTCMinutes().toString().padStart(2, '0')} - {new Date(dateNotes[0].appointmentEndTime).getUTCHours().toString().padStart(2, '0')}:{new Date(dateNotes[0].appointmentEndTime).getUTCMinutes().toString().padStart(2, '0')}
                      </div>
                    )}
                  </div>
                  
                  {/* Lista de anotações para esta data */}
                  <div className="space-y-4">
                    {dateNotes.map((note) => (
                      <div key={note.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-sm text-gray-500">
                            Anotado em: {formatDate(new Date(note.createdAt))} às {new Date(note.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {note.isPrivate && (
                            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                              Privada
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <div dangerouslySetInnerHTML={renderContent(note.content)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ClientNotesReportModal;
