import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, PlusCircle, X, Edit, AlertCircle } from 'lucide-react';
import { useTimeExclusions } from '@/hooks/use-time-exclusions';
import { TimeExclusionDialog } from './time-exclusion-dialog';
import { TimeExclusion } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TimeExclusionManager() {
  const { 
    timeExclusions, 
    isLoading, 
    isDialogOpen, 
    editingExclusion, 
    selectedDayOfWeek,
    openCreateDialog, 
    openEditDialog, 
    closeDialog,
    deleteExclusionMutation 
  } = useTimeExclusions();

  // Estado para o dialog de confirmação de exclusão
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [exclusionToDelete, setExclusionToDelete] = React.useState<TimeExclusion | null>(null);

  // Função para abrir o dialog de confirmação de exclusão
  const openDeleteDialog = (exclusion: TimeExclusion) => {
    setExclusionToDelete(exclusion);
    setIsDeleteDialogOpen(true);
  };

  // Função para excluir a exclusão
  const handleDelete = () => {
    if (exclusionToDelete) {
      deleteExclusionMutation.mutate(exclusionToDelete.id);
    }
    setIsDeleteDialogOpen(false);
  };

  // Agrupar exclusões por dia da semana
  const exclusionsByDay = React.useMemo(() => {
    const grouped: Record<string, TimeExclusion[]> = {
      'all': [],
      '1': [],
      '2': [],
      '3': [],
      '4': [],
      '5': [],
      '6': [],
      '7': [],
    };

    timeExclusions?.forEach(exclusion => {
      const key = exclusion.dayOfWeek?.toString() || 'all';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(exclusion);
    });

    return grouped;
  }, [timeExclusions]);

  // Função para obter o nome do dia da semana
  const getDayName = (dayKey: string) => {
    const days: Record<string, string> = {
      'all': 'Todos os dias',
      '1': 'Segunda-feira',
      '2': 'Terça-feira',
      '3': 'Quarta-feira',
      '4': 'Quinta-feira',
      '5': 'Sexta-feira',
      '6': 'Sábado',
      '7': 'Domingo',
    };
    return days[dayKey] || 'Desconhecido';
  };

  // Função para formatar a hora (07:30, 08:00, etc.)
  const formatTime = (time: string) => {
    return time;
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure horários que você não estará disponível para atendimento, como almoço, pausas, reuniões, etc.
        </p>
        <Button 
          onClick={() => openCreateDialog()} 
          className="flex items-center gap-1"
        >
          <PlusCircle className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {/* Lista de exclusões */}
      <div className="space-y-4">
        {Object.entries(exclusionsByDay).map(([dayKey, exclusions]) => 
          exclusions.length > 0 && (
            <div key={dayKey} className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Badge variant="outline" className="font-normal">
                  {getDayName(dayKey)}
                </Badge>
              </h3>
              <div className="space-y-2">
                {exclusions.map((exclusion) => (
                  <Card key={exclusion.id} className="p-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{exclusion.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(exclusion.startTime)} - {formatTime(exclusion.endTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => openEditDialog(exclusion)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive" 
                        onClick={() => openDeleteDialog(exclusion)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        )}

        {/* Mensagem quando não há exclusões */}
        {!Object.values(exclusionsByDay).some(arr => arr.length > 0) && (
          <div className="p-4 border rounded-md flex flex-col items-center justify-center text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum período indisponível configurado</p>
              <p className="text-sm text-muted-foreground">
                Adicione períodos em que você não estará disponível para atendimento.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialog para criar/editar exclusão */}
      <TimeExclusionDialog
        isOpen={isDialogOpen}
        onClose={closeDialog}
        exclusion={editingExclusion}
        dayOfWeek={selectedDayOfWeek}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {exclusionToDelete?.name}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}