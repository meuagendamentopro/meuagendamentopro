import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Power, AlertTriangle, CheckCircle } from "lucide-react";
import { useMaintenance } from "@/contexts/maintenance-context";
import { useToast } from "@/hooks/use-toast";

export function MaintenanceControl() {
  const { isMaintenance, enableMaintenance, disableMaintenance } = useMaintenance();
  const { toast } = useToast();

  const handleToggleMaintenance = () => {
    if (isMaintenance) {
      disableMaintenance();
      toast({
        title: "Modo de manutenção desativado",
        description: "O sistema está disponível para todos os usuários.",
        variant: "default",
      });
    } else {
      enableMaintenance();
      toast({
        title: "Modo de manutenção ativado",
        description: "Apenas rotas públicas estão disponíveis. Os usuários serão redirecionados para a página de manutenção.",
        variant: "default",
      });
    }
  };

  return (
    <Card className="border-amber-100 bg-amber-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg font-medium text-amber-900">
            Modo de Manutenção
          </CardTitle>
          <CardDescription className="text-amber-800">
            {isMaintenance 
              ? "O sistema está em modo de manutenção" 
              : "O sistema está operando normalmente"}
          </CardDescription>
        </div>
        <div className="p-2 rounded-full bg-amber-100">
          {isMaintenance ? (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          ) : (
            <CheckCircle className="h-6 w-6 text-green-600" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-amber-800">
            {isMaintenance
              ? "Apenas as rotas públicas estão disponíveis. Os usuários serão redirecionados para a página de manutenção ao tentar acessar áreas restritas."
              : "Ative o modo de manutenção para realizar atualizações no sistema sem afetar os usuários."}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span>{isMaintenance ? "Ativo" : "Inativo"}</span>
            </div>
            
            <Button
              variant={isMaintenance ? "default" : "destructive"}
              size="sm"
              onClick={handleToggleMaintenance}
              className="flex items-center gap-2"
            >
              <Power className="h-4 w-4" />
              {isMaintenance ? "Desativar Manutenção" : "Ativar Manutenção"}
            </Button>
          </div>
          
          {isMaintenance && (
            <div className="p-3 bg-amber-100 rounded-md text-amber-800 text-sm">
              <p className="font-medium">Informações importantes:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>As rotas públicas continuarão acessíveis</li>
                <li>Os usuários logados serão redirecionados para a página de manutenção</li>
                <li>Você pode desativar o modo de manutenção a qualquer momento</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
