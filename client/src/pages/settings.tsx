import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import PageHeader from "@/components/layout/page-header";
import { Clock } from "lucide-react";

// Schema para validação do formulário
const settingsFormSchema = z.object({
  workingHoursStart: z.coerce.number().int().min(0).max(23),
  workingHoursEnd: z.coerce.number().int().min(1).max(24),
}).refine(data => data.workingHoursEnd > data.workingHoursStart, {
  message: "O horário de término deve ser maior que o horário de início",
  path: ["workingHoursEnd"]
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar dados do provedor atual (id 1 para demonstração)
  const { data: provider, isLoading } = useQuery({
    queryKey: ["/api/providers/1"],
    queryFn: async ({ queryKey }) => {
      const res = await fetch("/api/providers/1");
      if (!res.ok) throw new Error("Failed to fetch provider data");
      return res.json();
    },
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      workingHoursStart: 8,
      workingHoursEnd: 18,
    },
  });

  // Atualizar o formulário quando os dados do provedor forem carregados
  React.useEffect(() => {
    if (provider) {
      form.reset({
        workingHoursStart: provider.workingHoursStart || 8,
        workingHoursEnd: provider.workingHoursEnd || 18,
      });
    }
  }, [provider, form]);

  // Mutation para atualizar as configurações
  const updateSettings = useMutation({
    mutationFn: async (data: SettingsFormValues) => {
      return apiRequest("PATCH", "/api/providers/1/settings", data);
    },
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas",
        description: "Seus horários de trabalho foram atualizados com sucesso.",
      });
      setIsSubmitting(false);
    },
    onError: (error) => {
      console.error("Erro ao atualizar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar suas configurações.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: SettingsFormValues) => {
    setIsSubmitting(true);
    updateSettings.mutate(data);
  };

  // Gerar opções de horas
  const hourOptions = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerenciar suas preferências e configurações"
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium">Horário de Trabalho</h3>
            <p className="text-sm text-gray-500">
              Defina o horário em que você estará disponível para agendamentos
            </p>
          </div>

          <Separator className="mb-6" />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="workingHoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de início</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              <SelectValue placeholder="Selecione o horário" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hourOptions.slice(0, 24).map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>
                              {`${hour.toString().padStart(2, "0")}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Horário que você começa a atender
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="workingHoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário de término</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-2 text-gray-400" />
                              <SelectValue placeholder="Selecione o horário" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hourOptions.slice(1).map((hour) => (
                            <SelectItem key={hour} value={hour.toString()}>
                              {`${hour.toString().padStart(2, "0")}:00`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Horário que você termina de atender
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;