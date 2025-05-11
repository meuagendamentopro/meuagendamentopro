import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, children, icon }) => {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center">
        {icon && (
          <div className="mr-4 p-2 bg-primary-50 rounded-lg text-primary">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <div className="text-gray-500 mt-1">
              {description}
            </div>
          )}
        </div>
      </div>
      {children && <div className="mt-4 sm:mt-0">{children}</div>}
    </div>
  );
};

export { PageHeader };
export default PageHeader;
