import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  specialty?: string;
}

interface EmployeeSelectorProps {
  employees: Employee[];
  selectedEmployee: number | null;
  onSelectEmployee: (employeeId: number) => void;
  onNext: () => void;
}

const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({
  employees,
  selectedEmployee,
  onSelectEmployee,
  onNext,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="mr-2 h-5 w-5" />
          Escolha o profissional
        </CardTitle>
        <p className="text-sm text-gray-600">
          Selecione o profissional que deseja que o atenda
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className={cn(
              "p-4 border rounded-lg cursor-pointer transition-all hover:border-primary-300 hover:bg-primary-50",
              selectedEmployee === employee.id
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200"
            )}
            onClick={() => onSelectEmployee(employee.id)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">{employee.name}</h3>
                {employee.specialty && (
                  <p className="text-sm text-gray-600">{employee.specialty}</p>
                )}
                {employee.position && (
                  <p className="text-xs text-gray-500">{employee.position}</p>
                )}
              </div>
              {selectedEmployee === employee.id && (
                <Check className="h-5 w-5 text-primary-600" />
              )}
            </div>
          </div>
        ))}
        
        {selectedEmployee && (
          <div className="pt-4">
            <Button onClick={onNext} className="w-full">
              Próximo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeSelector; 