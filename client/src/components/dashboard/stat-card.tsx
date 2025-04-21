import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: "primary" | "success" | "warning" | "danger" | "gray";
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color = "primary" }) => {
  const colorClasses = {
    primary: {
      bg: "bg-primary-50",
      text: "text-primary-600",
    },
    success: {
      bg: "bg-success-50",
      text: "text-success-600",
    },
    warning: {
      bg: "bg-warning-50",
      text: "text-warning-600",
    },
    danger: {
      bg: "bg-danger-50",
      text: "text-danger-600",
    },
    gray: {
      bg: "bg-gray-100",
      text: "text-gray-600",
    },
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <div
            className={cn(
              colorClasses[color].bg,
              "flex-shrink-0 rounded-full p-3"
            )}
          >
            <Icon
              className={cn(colorClasses[color].text, "h-5 w-5")}
              aria-hidden="true"
            />
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd>
                <div className="text-lg font-medium text-gray-900">
                  {value}
                </div>
              </dd>
            </dl>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
