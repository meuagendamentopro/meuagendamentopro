import React from "react";
import { getNextDays, getDayName, isSameDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface DateSelectorProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  disabledDates?: Date[];
}

const DateSelector: React.FC<DateSelectorProps> = ({ 
  selectedDate, 
  onChange, 
  disabledDates = [] 
}) => {
  const nextDays = getNextDays(14);
  
  const handleSelectDate = (date: Date) => {
    if (!isDisabled(date)) {
      onChange(date);
    }
  };
  
  const isDisabled = (date: Date) => {
    return disabledDates.some(disabledDate => isSameDay(date, disabledDate));
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      {nextDays.map((date, index) => {
        const isToday = isSameDay(date, new Date());
        const isSelected = isSameDay(date, selectedDate);
        const disabled = isDisabled(date);
        
        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            className={cn(
              "focus:outline-none border rounded px-3 py-2 flex flex-col items-center",
              isSelected 
                ? "border-primary-500 bg-primary-50" 
                : disabled 
                  ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed" 
                  : "border-gray-200 hover:border-primary-500 hover:bg-primary-50"
            )}
            onClick={() => handleSelectDate(date)}
          >
            <span className="text-xs text-gray-500">
              {isToday ? "Hoje" : getDayName(date)}
            </span>
            <span className="text-sm font-medium">
              {date.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DateSelector;
