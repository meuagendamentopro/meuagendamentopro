import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TimeExclusion } from '@shared/schema';
import { useTimeExclusions } from '@/hooks/use-time-exclusions';
import { useToast } from '@/hooks/use-toast';

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
  { value: "0", label: "Todos os dias" },
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
  const { toast } = useToast();
  const isEditing = !!exclusion;
  
  // Estado local para os campos do formulário
  const [nameValue, setNameValue] = useState("");
  const [startTimeValue, setStartTimeValue] = useState("12:00");
  const [endTimeValue, setEndTimeValue] = useState("13:00");
  const [dayOfWeekValue, setDayOfWeekValue] = useState("0");

  // Inicializar valores quando o diálogo abre
  useEffect(() => {
    if (isOpen) {
      setNameValue(exclusion?.name || "");
      setStartTimeValue(exclusion?.startTime || "12:00");
      setEndTimeValue(exclusion?.endTime || "13:00");
      setDayOfWeekValue(exclusion?.dayOfWeek?.toString() || dayOfWeek?.toString() || "0");
    }
  }, [isOpen, exclusion, dayOfWeek]);

  // Valores default para o formulário
  const defaultValues: FormValues = {
    name: "",
    startTime: "12:00",
    endTime: "13:00",
    dayOfWeek: "0",
  };

  // Inicializar o formulário
  const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset, setValue } = useForm<FormValues>({
    defaultValues,
  });

  // Função para submeter o formulário
  const onSubmit = async (data: FormValues) => {
    try {
      // Verificar os dados
      if (data.startTime >= data.endTime) {
        toast({
          title: "Erro",
          description: "O horário final deve ser após o horário inicial",
          variant: "destructive"
        });
        return;
      }

      // Converter dayOfWeek para number ou null
      const parsedDayOfWeek = data.dayOfWeek !== "0" && data.dayOfWeek !== ""
        ? parseInt(data.dayOfWeek) 
        : null;
        
      // Se o nome estiver vazio, usar "Horário Indisponível" como padrão
      const name = data.name.trim() || "Horário Indisponível";

      console.log("Enviando dados:", {
        name,
        startTime: data.startTime,
        endTime: data.endTime,
        dayOfWeek: parsedDayOfWeek
      });

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
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar a exclusão de horário",
        variant: "destructive"
      });
    }
  };

  // Atualizar valores do formulário quando componente monta
  useEffect(() => {
    if (isOpen) {
      // Reset com valores atualizados
      reset({
        name: nameValue,
        startTime: startTimeValue,
        endTime: endTimeValue,
        dayOfWeek: dayOfWeekValue,
      });
    }
  }, [isOpen, nameValue, startTimeValue, endTimeValue, dayOfWeekValue, reset]);

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
              defaultValue={nameValue}
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
                defaultValue={startTimeValue}
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
                defaultValue={endTimeValue}
                {...register('endTime', { 
                  required: "Obrigatório",
                })}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Dia da Semana</Label>
            <Controller
              name="dayOfWeek"
              control={control}
              defaultValue={dayOfWeekValue}
              render={({ field }) => (
                <Select 
                  defaultValue={field.value}
                  onValueChange={field.onChange}
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
              )}
            />
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