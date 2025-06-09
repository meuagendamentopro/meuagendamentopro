import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(3, "Por favor, insira seu nome completo com pelo menos 3 caracteres"),
  phone: z.string().min(8, "Por favor, insira um número de telefone válido"),
  countryCode: z.string().default("BR"),
  notes: z.string().optional().default(""),
});

type FormValues = z.infer<typeof formSchema>;

interface ClientFormProps {
  onSubmitValues: (values: { name: string; phone: string; notes: string; countryCode: string }) => void;
  defaultValues?: Partial<FormValues>;
}

const ClientForm: React.FC<ClientFormProps> = ({ onSubmitValues, defaultValues = {} }) => {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues.name || "",
      phone: defaultValues.phone || "",
      countryCode: defaultValues.countryCode || "BR",
      notes: defaultValues.notes || "",
    },
  });

  const onSubmit = (data: FormValues) => {
    onSubmitValues({
      name: data.name,
      phone: data.phone,
      countryCode: data.countryCode,
      notes: data.notes || ""
    });
  };

  // Este ref será usado para expor o formulário ao componente pai
  React.useEffect(() => {
    // Sempre que os valores do formulário mudarem, atualize o callback
    const subscription = form.watch((values) => {
      // Envie os valores para o componente pai, mesmo que incompletos
      // O componente pai vai lidar com a validação
      onSubmitValues({
        name: values.name || "",
        phone: values.phone || "",
        countryCode: values.countryCode || "BR",
        notes: values.notes || "",
      });
    });
    
    return () => subscription.unsubscribe();
  }, [form, onSubmitValues]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl>
                <Input placeholder="Seu nome" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>WhatsApp</FormLabel>
              <FormControl>
                <PhoneInput 
                  placeholder="(00) 00000-0000" 
                  value={field.value}
                  onChange={field.onChange}
                  defaultCountry={form.getValues().countryCode}
                  onCountryChange={(country) => {
                    form.setValue('countryCode', country);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (opcional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Informações adicionais ou pedidos especiais" 
                  className="resize-none" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="pt-2">
          <button type="submit" className="hidden" />
        </div>
      </form>
    </Form>
  );
};

export default ClientForm;
