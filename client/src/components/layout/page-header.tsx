import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string | React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, children }) => {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <div className="text-gray-500 mt-1">
            {description}
          </div>
        )}
      </div>
      {children && <div className="mt-4 sm:mt-0">{children}</div>}
    </div>
  );
};

export default PageHeader;
