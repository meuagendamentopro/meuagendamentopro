import React from "react";
import { Check } from "lucide-react";
import { cn, formatCurrency, formatDuration } from "@/lib/utils";
import { Service } from "@shared/schema";

interface ServiceSelectorProps {
  services: Service[];
  selectedServiceId: number | null;
  onSelect: (serviceId: number) => void;
  isLoading?: boolean;
}

const ServiceSelector: React.FC<ServiceSelectorProps> = ({ 
  services, 
  selectedServiceId, 
  onSelect, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 flex flex-col animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="flex justify-between mt-1">
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center p-4 border border-dashed rounded-lg">
        <p className="text-gray-500">Nenhum serviço disponível</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {services.map((service) => (
        <button
          key={service.id}
          type="button"
          className={cn(
            "relative border rounded-lg p-4 flex flex-col text-left transition-colors",
            selectedServiceId === service.id
              ? "border-primary-500 bg-primary-50"
              : "border-gray-200 hover:border-primary-500 hover:bg-primary-50"
          )}
          onClick={() => onSelect(service.id)}
        >
          {selectedServiceId === service.id && (
            <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center text-white">
              <Check className="h-4 w-4" />
            </span>
          )}
          <span className="text-sm font-medium text-gray-800">{service.name}</span>
          <div className="mt-1 flex justify-between">
            <span className="text-xs text-gray-500">{formatDuration(service.duration)}</span>
            <span className="text-sm font-medium text-gray-900">{formatCurrency(service.price)}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ServiceSelector;
