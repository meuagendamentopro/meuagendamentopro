import React from "react";
import { cn } from "@/lib/utils";

interface TimeSelectorProps {
  availableTimes: string[];
  selectedTime: string;
  onChange: (time: string) => void;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({ 
  availableTimes, 
  selectedTime, 
  onChange 
}) => {
  if (!availableTimes || availableTimes.length === 0) {
    return (
      <div className="text-center p-4 border border-dashed rounded-lg">
        <p className="text-gray-500">Nenhum horário disponível para esta data</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {availableTimes.map((time) => {
        const isSelected = time === selectedTime;
        
        return (
          <button
            key={time}
            type="button"
            className={cn(
              "py-2 px-4 border rounded-md shadow-sm text-sm font-medium",
              isSelected
                ? "border-primary-500 text-primary-700 bg-primary-50"
                : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
            )}
            onClick={() => onChange(time)}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
};

export default TimeSelector;
