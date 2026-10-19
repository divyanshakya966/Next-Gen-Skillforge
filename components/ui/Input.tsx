import * as React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export function Input({
  className,
  label,
  error,
  helperText,
  leftIcon,
  rightAction,
  id: idProp,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = idProp || generatedId;

  return (
    <div className="space-y-1 w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground mb-1 block"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-stretch w-full">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            leftIcon && 'pl-9',
            rightAction && 'pr-9',
            error && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          {...props}
        />
        {rightAction && (
          <span className="absolute right-1 top-1/2 -translate-y-1/2"> 
            {rightAction}
          </span>
        )}
      </div>
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
