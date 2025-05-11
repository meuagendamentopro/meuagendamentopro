import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import ServiceForm from "@/components/services/service-form";
import PageHeader from "@/components/layout/page-header";
import { Service } from "@shared/schema";

const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h${mins > 0 ? ` ${mins}min` : ""}`;
};

const formatCurrency = (cents: number) => {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
};

const ServicesPage: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const { toast } = useToast();
  
  // Buscar informações do provider logado
  const { data: provider, isLoading: isLoadingProvider } = useQuery({
    queryKey: ['/api/my-provider'],
    queryFn: async () => {
      const res = await fetch('/api/my-provider');
      if (!res.ok) throw new Error('Failed to fetch provider');
      return res.json();
    }
  });

  // Fetch services usando my-services para o provider logado
  const { data: services, isLoading: isLoadingServices } = useQuery({
    queryKey: ['/api/my-services'],
    queryFn: async () => {
      const res = await fetch('/api/my-services');
      if (!res.ok) throw new Error('Failed to fetch services');
      return res.json();
    },
    // Só busca os serviços após ter as informações do provider
    enabled: !!provider
  });

  const handleAddService = () => {
    setEditingService(null);
    setIsDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  // Mutação para criar ou atualizar serviço
  const serviceMutation = useMutation({
    mutationFn: async (serviceData: any) => {
      if (editingService) {
        return apiRequest("PATCH", `/api/services/${editingService.id}`, serviceData);
      } else {
        return apiRequest("POST", "/api/services", serviceData);
      }
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
      toast({
        title: editingService ? "Serviço atualizado" : "Serviço criado",
        description: editingService
          ? "O serviço foi atualizado com sucesso."
          : "O serviço foi criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o serviço. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para ativar/desativar serviço
  const toggleActiveMutation = useMutation({
    mutationFn: async (service: Service) => {
      return apiRequest("PATCH", `/api/services/${service.id}`, {
        active: !service.active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
      toast({
        title: "Status atualizado",
        description: "O status do serviço foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do serviço.",
        variant: "destructive",
      });
    },
  });

  // Mutação para excluir serviço
  const deleteMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      return apiRequest("DELETE", `/api/services/${serviceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-services'] });
      toast({
        title: "Serviço excluído",
        description: "O serviço foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o serviço.",
        variant: "destructive",
      });
    },
  });

  const handleToggleActive = (service: Service) => {
    toggleActiveMutation.mutate(service);
  };

  const handleDeleteService = (serviceId: number) => {
    deleteMutation.mutate(serviceId);
  };

  const isLoading = isLoadingProvider || isLoadingServices;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Serviços" 
        description="Gerencie os serviços oferecidos"
      >
        <Button onClick={handleAddService} disabled={!provider}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar serviço
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">Carregando serviços...</div>
          ) : !services || services.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 mb-4">Você ainda não tem serviços cadastrados</p>
              <Button onClick={handleAddService} disabled={!provider}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar serviço
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Nome</TableHead>
                    <TableHead className="whitespace-nowrap">Descrição</TableHead>
                    <TableHead className="whitespace-nowrap">Duração</TableHead>
                    <TableHead className="whitespace-nowrap">Preço</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service: Service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {service.description || "-"}
                      </TableCell>
                      <TableCell>{formatDuration(service.duration)}</TableCell>
                      <TableCell>{formatCurrency(service.price)}</TableCell>
                      <TableCell>
                        <Switch 
                          checked={service.active}
                          onCheckedChange={() => handleToggleActive(service)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditService(service)}
                          className="mr-2"
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Excluir</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir serviço</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o serviço "{service.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => handleDeleteService(service.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar serviço" : "Adicionar serviço"}
            </DialogTitle>
            <DialogDescription>
              {editingService
                ? "Atualize as informações do serviço abaixo."
                : "Preencha as informações do novo serviço."}
            </DialogDescription>
          </DialogHeader>
          <ServiceForm
            providerId={provider.id}
            service={editingService}
            onComplete={() => {
              serviceMutation.mutate(form.getValues());
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicesPage;