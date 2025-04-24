import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InsertService, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  duration: z.coerce.number().min(1, "Duração deve ser maior que zero"),
  price: z.coerce.number().min(0, "Preço deve ser maior ou igual a zero"),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface ServiceFormProps {
  providerId?: number;
  service?: Service | null;
  onComplete?: () => void;
}

const ServiceForm: React.FC<ServiceFormProps> = ({ providerId, service, onComplete }) => {
  const { toast } = useToast();
  const isEditing = !!service;

  // Initialize form with default values or service values if editing
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: service?.name || "",
      description: service?.description || "",
      duration: service?.duration || 30,
      price: service ? service.price / 100 : 0, // Convert cents to reais for form display
      active: service?.active ?? true,
    },
  });

  // Update form when service changes
  useEffect(() => {
    if (service) {
      form.reset({
        name: service.name,
        description: service.description || "",
        duration: service.duration,
        price: service.price / 100, // Convert cents to reais for form display
        active: service.active,
      });
    }
  }, [service, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      // Verifica se temos o provider ID
      if (!providerId && !service?.providerId) {
        toast({
          title: "Erro",
          description: "Não foi possível identificar o prestador de serviços associado. Por favor, tente novamente.",
          variant: "destructive",
        });
        return;
      }
      
      // Convert price from reais to cents
      const servicePriceInCents = Math.round(data.price * 100);

      // Prepare service data
      const serviceData: Partial<InsertService> = {
        providerId: providerId || service?.providerId, // Use o providerId do service caso o direto seja undefined
        name: data.name,
        description: data.description || "",
        duration: data.duration,
        price: servicePriceInCents,
        active: data.active,
      };

      if (isEditing && service) {
        // Update existing service
        await apiRequest("PUT", `/api/services/${service.id}`, serviceData);
        toast({
          title: "Serviço atualizado",
          description: "O serviço foi atualizado com sucesso.",
        });
      } else {
        // Create new service
        await apiRequest("POST", "/api/services", serviceData);
        toast({
          title: "Serviço criado",
          description: "O serviço foi criado com sucesso.",
        });
      }

      // Reset form and call onComplete callback
      form.reset();
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Error saving service:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o serviço. Por favor, tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do serviço</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Corte Masculino" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (opcional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descreva os detalhes do serviço" 
                  className="resize-none" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (minutos)</FormLabel>
                <FormControl>
                  <Input type="number" min="1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço (R$)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    placeholder="0.00" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Serviço ativo</FormLabel>
                <div className="text-sm font-normal text-muted-foreground">
                  Desative para ocultar este serviço do agendamento online
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {isEditing ? "Salvar alterações" : "Criar serviço"}
        </Button>
      </form>
    </Form>
  );
};

export default ServiceForm;
