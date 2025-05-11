import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { TimeExclusion } from "@shared/schema";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useTimeExclusions() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [editingExclusion, setEditingExclusion] = useState<TimeExclusion | null>(null);
  
  // Buscar todas as exclusões de horário
  const { 
    data: timeExclusions = [], 
    isLoading, 
    refetch,
    isError,
    error 
  } = useQuery<TimeExclusion[]>({
    queryKey: ['/api/time-exclusions'],
    queryFn: async () => {
      console.log('Buscando exclusões de horário');
      const res = await fetch('/api/time-exclusions');
      if (!res.ok) throw new Error('Falha ao buscar exclusões de horário');
      const data = await res.json();
      console.log('Exclusões de horário recebidas:', data);
      return data;
    },
  });

  // Buscar exclusões para um dia específico
  const fetchExclusionsByDay = async (dayOfWeek: number) => {
    console.log(`Buscando exclusões de horário para o dia ${dayOfWeek}`);
    const res = await fetch(`/api/time-exclusions/day/${dayOfWeek}`);
    if (!res.ok) throw new Error(`Falha ao buscar exclusões para o dia ${dayOfWeek}`);
    const data = await res.json();
    console.log(`Exclusões para o dia ${dayOfWeek}:`, data);
    return data;
  };

  // Criar nova exclusão
  const createExclusionMutation = useMutation({
    mutationFn: async (data: {
      startTime: string;
      endTime: string;
      dayOfWeek?: number | null;
      name?: string;
    }) => {
      return apiRequest('POST', '/api/time-exclusions', data);
    },
    onSuccess: () => {
      // Invalidar queries para recarregar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/time-exclusions'] });
      
      toast({
        title: 'Horário excluído',
        description: 'Faixa de horário indisponível criada com sucesso',
      });
      
      // Fechar diálogo e limpar estado de edição
      setIsDialogOpen(false);
      setEditingExclusion(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: `Erro ao criar exclusão: ${error.message || 'Falha na solicitação'}`,
        variant: 'destructive',
      });
    },
  });

  // Atualizar exclusão
  const updateExclusionMutation = useMutation({
    mutationFn: async ({
      id,
      data
    }: {
      id: number;
      data: {
        startTime?: string;
        endTime?: string;
        dayOfWeek?: number | null;
        name?: string;
        isActive?: boolean;
      };
    }) => {
      return apiRequest('PUT', `/api/time-exclusions/${id}`, data);
    },
    onSuccess: () => {
      // Invalidar queries para recarregar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/time-exclusions'] });
      
      toast({
        title: 'Horário atualizado',
        description: 'Faixa de horário indisponível atualizada com sucesso',
      });
      
      // Fechar diálogo e limpar estado de edição
      setIsDialogOpen(false);
      setEditingExclusion(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: `Erro ao atualizar exclusão: ${error.message || 'Falha na solicitação'}`,
        variant: 'destructive',
      });
    },
  });

  // Excluir exclusão
  const deleteExclusionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/time-exclusions/${id}`);
    },
    onSuccess: () => {
      // Invalidar queries para recarregar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/time-exclusions'] });
      
      toast({
        title: 'Exclusão removida',
        description: 'Faixa de horário indisponível removida com sucesso',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: `Erro ao remover exclusão: ${error.message || 'Falha na solicitação'}`,
        variant: 'destructive',
      });
    },
  });

  // Funções auxiliares
  const openCreateDialog = (dayOfWeek: number | null = null) => {
    setSelectedDayOfWeek(dayOfWeek);
    setEditingExclusion(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (exclusion: TimeExclusion) => {
    setEditingExclusion(exclusion);
    setSelectedDayOfWeek(exclusion.dayOfWeek);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingExclusion(null);
  };

  // Criar uma exclusão para todos os dias (dayOfWeek = null)
  const createForAllDays = (data: {
    startTime: string;
    endTime: string;
    name?: string;
  }) => {
    createExclusionMutation.mutate({
      ...data,
      dayOfWeek: null
    });
  };

  // Obter exclusões agrupadas por dia da semana
  const getGroupedExclusions = () => {
    const grouped: { [key: string]: TimeExclusion[] } = {
      all: timeExclusions.filter(ex => ex.dayOfWeek === null),
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };

    // Agrupar exclusões por dia da semana
    timeExclusions.forEach(exclusion => {
      if (exclusion.dayOfWeek !== null) {
        const day = exclusion.dayOfWeek.toString();
        if (!grouped[day]) {
          grouped[day] = [];
        }
        grouped[day].push(exclusion);
      }
    });

    return grouped;
  };

  // Verificar existência de exclusões para um período
  const hasExclusionInRange = (
    date: Date,
    duration: number
  ): boolean => {
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // 1-7 (segunda a domingo)
    
    const startHour = date.getHours();
    const startMinute = date.getMinutes();
    const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
    
    const endDate = new Date(date.getTime() + duration * 60000);
    const endHour = endDate.getHours();
    const endMinute = endDate.getMinutes();
    const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    
    // Verificar exclusões para todos os dias
    const allDaysExclusions = timeExclusions.filter(ex => ex.dayOfWeek === null && ex.isActive);
    for (const exclusion of allDaysExclusions) {
      // Não há sobreposição se um termina antes do outro começar
      const noOverlap = 
        endTime <= exclusion.startTime || 
        startTime >= exclusion.endTime;
      
      if (!noOverlap) {
        return true; // Há exclusão neste período
      }
    }
    
    // Verificar exclusões para o dia específico
    const specificDayExclusions = timeExclusions.filter(ex => ex.dayOfWeek === dayOfWeek && ex.isActive);
    for (const exclusion of specificDayExclusions) {
      // Não há sobreposição se um termina antes do outro começar
      const noOverlap = 
        endTime <= exclusion.startTime || 
        startTime >= exclusion.endTime;
      
      if (!noOverlap) {
        return true; // Há exclusão neste período
      }
    }
    
    return false; // Não há exclusão para este período
  };

  // Desativar temporariamente uma exclusão
  const toggleExclusionStatus = (id: number, currentStatus: boolean) => {
    updateExclusionMutation.mutate({
      id,
      data: { isActive: !currentStatus }
    });
  };

  return {
    timeExclusions,
    isLoading,
    isError,
    error,
    refetch,
    createExclusionMutation,
    updateExclusionMutation,
    deleteExclusionMutation,
    isDialogOpen,
    selectedDayOfWeek,
    editingExclusion,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    createForAllDays,
    getGroupedExclusions,
    hasExclusionInRange,
    toggleExclusionStatus,
    fetchExclusionsByDay
  };
}