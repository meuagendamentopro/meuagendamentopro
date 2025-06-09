import React from "react";
import { useImpersonation } from "@/hooks/use-impersonation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, LogOut, AlertTriangle } from "lucide-react";

export function ImpersonationBanner() {
  const { impersonationStatus, stopImpersonation } = useImpersonation();

  if (!impersonationStatus?.isImpersonating) {
    return null;
  }

  return (
    <Alert className="bg-amber-50 border-amber-200 mb-4">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-amber-600" />
          <span className="text-amber-800">
            <strong>Modo Simulação:</strong> Você está visualizando o sistema como{" "}
            <strong>{impersonationStatus.impersonatedUser?.name}</strong> (
            {impersonationStatus.impersonatedUser?.username})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={stopImpersonation}
          className="ml-4 border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da Simulação
        </Button>
      </AlertDescription>
    </Alert>
  );
} 