import { useState, useEffect } from "react";
import { useMaintenance } from "@/contexts/maintenance-context";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, addHours, startOfToday, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon, Clock } from "lucide-react";

interface MaintenanceSettingsProps {
  className?: string;
}

export function MaintenanceSettings({ className }: MaintenanceSettingsProps) {
  const { 
    isMaintenance, 
    message, 
    estimatedReturn, 
    enableMaintenance, 
    disableMaintenance, 
    isLoading 
  } = useMaintenance();
  
  const [showSettings, setShowSettings] = useState(false);
  const [customMessage, setCustomMessage] = useState(message || '');
  const [returnDate, setReturnDate] = useState<Date | undefined>(
    estimatedReturn ? parseISO(estimatedReturn) : addHours(new Date(), 1)
  );
  const [time, setTime] = useState<string>(
    estimatedReturn 
      ? format(parseISO(estimatedReturn), 'HH:mm')
      : format(addHours(new Date(), 1), 'HH:mm')
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Mostrar configurações se estiver em manutenção
  useEffect(() => {
    if (isMaintenance) {
      setShowSettings(true);
    }
  }, [isMaintenance]);

  // Sincroniza o estado local quando as props mudam
  useEffect(() => {
    setCustomMessage(message || '');
    if (estimatedReturn) {
      setReturnDate(parseISO(estimatedReturn));
      setTime(format(parseISO(estimatedReturn), 'HH:mm'));
    } else {
      const defaultDate = addHours(new Date(), 1);
      setReturnDate(defaultDate);
      setTime(format(defaultDate, 'HH:mm'));
    }
  }, [message, estimatedReturn]);

  const saveMaintenanceSettings = async () => {
    try {
      const selectedDateTime = returnDate ? new Date(returnDate) : addHours(new Date(), 1);
      const [hours, minutes] = time.split(':').map(Number);
      selectedDateTime.setHours(hours, minutes, 0, 0);
      
      // Se a data/hora for no passado, adiciona 1 dia
      if (isBefore(selectedDateTime, new Date())) {
        selectedDateTime.setDate(selectedDateTime.getDate() + 1);
      }
      
      await enableMaintenance(
        customMessage || 'Estamos em manutenção. Volte em breve!',
        selectedDateTime.toISOString()
      );
      
      // Atualiza o estado local
      setShowSettings(true);
    } catch (error) {
      console.error('Erro ao salvar configurações de manutenção:', error);
      throw error; // Propaga o erro para ser tratado pelo chamador
    }
  };

  const handleDisableMaintenance = async () => {
    try {
      await disableMaintenance();
      setShowSettings(false);
    } catch (error) {
      console.error('Erro ao desativar modo de manutenção:', error);
    }
  };

  const handleToggleSettings = () => {
    if (isMaintenance) {
      // Se estiver em manutenção, desativa
      handleDisableMaintenance();
    } else if (showSettings) {
      // Se estiver mostrando configurações, oculta
      setShowSettings(false);
    } else {
      // Se não estiver em manutenção e não estiver mostrando configurações, mostra
      setShowSettings(true);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setReturnDate(date);
    setIsDatePickerOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTime(e.target.value);
  };

  // Formata a data para exibição
  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return 'Selecione uma data';
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="border rounded-lg p-6 bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Modo de Manutenção</h3>
            <p className="text-sm text-muted-foreground">
              {isMaintenance 
                ? 'O modo de manutenção está ativo. Apenas administradores podem acessar o sistema.'
                : 'O modo de manutenção está desativado. O sistema está acessível a todos os usuários.'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="maintenance-mode"
              checked={isMaintenance || showSettings}
              onCheckedChange={handleToggleSettings}
              disabled={isLoading}
              className={isMaintenance ? "bg-primary" : showSettings ? "bg-amber-400" : ""}
            />
            <Label htmlFor="maintenance-mode" className="cursor-pointer">
              {isMaintenance ? 'Ativo' : showSettings ? 'Configurando' : 'Inativo'}
            </Label>
          </div>
        </div>

        {(showSettings || isMaintenance) && (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maintenance-message">Mensagem de Manutenção</Label>
              <Textarea
                id="maintenance-message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Informe uma mensagem para ser exibida durante a manutenção"
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Previsão de Retorno</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !returnDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {returnDate ? formatDisplayDate(returnDate) : <span>Selecione uma data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={returnDate || startOfToday()}
                        onSelect={handleDateSelect}
                        initialFocus
                        locale={ptBR}
                        disabled={(date) => isBefore(date, startOfToday())}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Input
                    type="time"
                    value={time}
                    onChange={handleTimeChange}
                    className="pl-10"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Esta é uma previsão que será exibida aos usuários. O sistema não será desativado automaticamente.
              </p>
            </div>

            <div className="pt-2">
              <Button 
                onClick={saveMaintenanceSettings}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
