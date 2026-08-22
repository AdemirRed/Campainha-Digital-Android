import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  icon?: string;
  variant?: 'primary' | 'success' | 'outline';
  disabled?: boolean;
}

export function Button({ children, onClick, icon, variant = 'primary', disabled = false }: ButtonProps) {
  const variantClass = `btn-${variant}`;

  return (
    <button
      className={`btn ${variantClass}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export default Button;
