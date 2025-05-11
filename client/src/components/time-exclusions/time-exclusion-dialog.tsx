import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TimeExclusion } from '@shared/schema';
import { useTimeExclusions } from '@/hooks/use-time-exclusions';

interface TimeExclusionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  exclusion: TimeExclusion | null;
  dayOfWeek: number | null;
}

// Estrutura para o formulário
interface FormValues {
  name: string;
  startTime: string;
  endTime: string;
  dayOfWeek: string; // String para o select
}

const DAYS_OF_WEEK = [
  { value: "0", label: "Todos os dias" }, // Mudamos de "" para "0"
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "7", label: "Domingo" },
];

export function TimeExclusionDialog({ 
  isOpen, 
  onClose, 
  exclusion, 
  dayOfWeek 
}: TimeExclusionDialogProps) {
  const { createExclusionMutation, updateExclusionMutation } = useTimeExclusions();
  const isEditing = !!exclusion;

  // Valores default para o formulário
  const defaultValues: FormValues = {
    name: exclusion?.name || "",
    startTime: exclusion?.startTime || "12:00",
    endTime: exclusion?.endTime || "13:00",
    dayOfWeek: exclusion?.dayOfWeek?.toString() || dayOfWeek?.toString() || "0", // Agora usamos "0" para "todos os dias"
  };

  // Inicializar o formulário
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<FormValues>({
    defaultValues,
  });

  // Resetar o formulário quando o diálogo se abre
  React.useEffect(() => {
    if (isOpen) {
      reset(defaultValues);
    }
  }, [isOpen, reset, defaultValues]);

  // Valor atual do campo dayOfWeek
  const selectedDayOfWeek = watch('dayOfWeek');

  // Função para lidar com a mudança do select
  const handleDayOfWeekChange = (value: string) => {
    setValue('dayOfWeek', value);
  };

  // Função para submeter o formulário
  const onSubmit = async (data: FormValues) => {
    try {
      // Verificar os dados
      if (data.startTime >= data.endTime) {
        // Toast de erro
        return;
      }

      // Converter dayOfWeek para number ou null
      // Agora verificamos se é "0" (todos os dias) e definimos como null nesse caso
      const parsedDayOfWeek = data.dayOfWeek !== "0" && data.dayOfWeek !== ""
        ? parseInt(data.dayOfWeek) 
        : null;
        
      // Se o nome estiver vazio, usar "Horário Indisponível" como padrão
      const name = data.name.trim() || "Horário Indisponível";

      // Criar ou atualizar uma exclusão de horário
      if (isEditing && exclusion) {
        // Atualizar
        await updateExclusionMutation.mutateAsync({
          id: exclusion.id,
          data: {
            name: name,
            startTime: data.startTime,
            endTime: data.endTime,
            dayOfWeek: parsedDayOfWeek,
          }
        });
      } else {
        // Criar novo
        await createExclusionMutation.mutateAsync({
          name: name,
          startTime: data.startTime,
          endTime: data.endTime,
          dayOfWeek: parsedDayOfWeek,
        });
      }
      
      // Fechar o diálogo
      onClose();
    } catch (error) {
      console.error("Erro ao salvar exclusão de horário:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Período Indisponível" : "Novo Período Indisponível"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome (opcional)</Label>
            <Input 
              id="name" 
              placeholder="Ex: Almoço, Café, Reunião..."
              {...register('name')}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime" className="flex justify-between">
                Horário Inicial
                {errors.startTime && (
                  <span className="text-sm text-destructive">{errors.startTime.message}</span>
                )}
              </Label>
              <Input 
                id="startTime" 
                type="time"
                {...register('startTime', { 
                  required: "Obrigatório",
                })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime" className="flex justify-between">
                Horário Final
                {errors.endTime && (
                  <span className="text-sm text-destructive">{errors.endTime.message}</span>
                )}
              </Label>
              <Input 
                id="endTime" 
                type="time"
                {...register('endTime', { 
                  required: "Obrigatório",
                })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Dia da Semana</Label>
            <Select 
              value={selectedDayOfWeek} 
              onValueChange={handleDayOfWeekChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o dia" />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day) => (
                  <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              Se "Todos os dias" for selecionado, esta exclusão será aplicada todos os dias da semana.
            </div>
          </div>
          
          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
            >
              {isEditing ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}