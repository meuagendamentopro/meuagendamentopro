import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Image, Wrench, Users } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaintenanceSettings } from "./maintenance-settings";
import { Separator } from "@/components/ui/separator";

export default function SystemSettings() {
  const { toast } = useToast();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [trialPeriodDays, setTrialPeriodDays] = useState<number>(3);
  const [isSavingTrialPeriod, setIsSavingTrialPeriod] = useState<boolean>(false);

  // Consulta para buscar as configurações do sistema
  const { data: systemSettings, isLoading } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const response = await fetch('/api/system-settings');
      if (!response.ok) {
        throw new Error('Erro ao buscar configurações do sistema');
      }
      return response.json();
    },
  });

  // Mutation para atualizar o período de teste
  const updateTrialPeriodMutation = useMutation({
    mutationFn: async (days: number) => {
      const response = await fetch('/api/system-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trialPeriodDays: days }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao atualizar período de teste');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Período de teste atualizado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      setIsSavingTrialPeriod(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
      setIsSavingTrialPeriod(false);
    },
  });
  
  // Mutation para fazer upload do logo
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/system-settings/upload-logo', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload do logo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Logo atualizado com sucesso!",
      });
      setLogoFile(null);
      setPreviewUrl(null);
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: `Erro: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Função para lidar com a seleção de arquivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Criar URL para preview
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
    }
  };

  // Função para fazer upload do logo
  const handleLogoUpload = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };

  // Limpar URLs de objeto ao desmontar o componente
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);
  
  // Atualizar o estado local quando as configurações do sistema forem carregadas
  useEffect(() => {
    if (systemSettings?.trialPeriodDays) {
      setTrialPeriodDays(systemSettings.trialPeriodDays);
    }
  }, [systemSettings]);
  
  // Função para salvar o período de teste
  const handleSaveTrialPeriod = () => {
    setIsSavingTrialPeriod(true);
    updateTrialPeriodMutation.mutate(trialPeriodDays);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações do Sistema</CardTitle>
        <CardDescription>
          Gerencie as configurações visuais e de manutenção do sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="appearance" className="space-y-4">
          <TabsList>
            <TabsTrigger value="appearance">
              <Image className="h-4 w-4 mr-2" />
              Aparência
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <Wrench className="h-4 w-4 mr-2" />
              Manutenção
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Logo do Sistema</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Faça upload de uma imagem para ser usada como logo do sistema. Formatos suportados: JPEG, PNG, GIF, SVG e WebP.
              </p>

              <div className="flex flex-col space-y-4">
                {/* Exibir logo atual */}
                {systemSettings?.logoUrl && (
                  <div className="mb-4">
                    <Label className="mb-2 block">Logo Atual</Label>
                    <div className="border rounded p-4 inline-block">
                      <img 
                        src={systemSettings.logoUrl} 
                        alt="Logo atual" 
                        className="h-12 object-contain" 
                        onError={(e) => {
                          console.error('Erro ao carregar imagem:', systemSettings.logoUrl);
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevenir loop infinito
                          target.src = '/placeholder-logo.png'; // Imagem de fallback
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-2">URL: {systemSettings.logoUrl}</p>
                    </div>
                  </div>
                )}

                {/* Preview do novo logo */}
                {previewUrl && (
                  <div className="mb-4">
                    <Label className="mb-2 block">Preview do Novo Logo</Label>
                    <div className="border rounded p-4 inline-block">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="h-12 object-contain" 
                      />
                    </div>
                  </div>
                )}

                {/* Input para selecionar arquivo */}
                <div className="flex items-center gap-4">
                  <div>
                    <Label htmlFor="logo-upload" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                      <Upload className="mr-2 h-4 w-4" />
                      Selecionar arquivo
                    </Label>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>

                  {logoFile && (
                    <Button 
                      onClick={handleLogoUpload}
                      disabled={uploadLogoMutation.isPending}
                    >
                      {uploadLogoMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Image className="mr-2 h-4 w-4" />
                          Salvar Logo
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Configurações de Usuários</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure parâmetros relacionados aos usuários do sistema.  
              </p>
              
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="trial-period" className="text-base font-medium">Período de Teste (dias)</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Defina quantos dias de teste um novo usuário recebe ao se cadastrar.
                  </p>
                  <div className="flex items-center gap-4">
                    <Input
                      id="trial-period"
                      type="number"
                      min="1"
                      max="90"
                      value={trialPeriodDays}
                      onChange={(e) => setTrialPeriodDays(parseInt(e.target.value) || 3)}
                      className="w-24"
                    />
                    <Button 
                      onClick={handleSaveTrialPeriod}
                      disabled={isSavingTrialPeriod}
                    >
                      {isSavingTrialPeriod ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="maintenance" className="space-y-6">
            <MaintenanceSettings />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
