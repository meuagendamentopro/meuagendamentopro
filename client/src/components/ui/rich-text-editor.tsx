import React from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  height = 300,
  placeholder = 'Adicione suas anotações clínicas aqui...'
}) => {
  return (
    <textarea
      className="w-full p-3 border rounded-md outline-none resize-none"
      style={{ height: `${height}px` }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir="ltr"
    />
  );
};

export default RichTextEditor;
