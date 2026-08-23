import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils/cn";

const CONTROL = cn(
  "w-full rounded-[var(--radius-control)] border border-border bg-surface px-3.5",
  "text-foreground placeholder:text-foreground-subtle",
  "transition-colors focus:border-brand focus:outline-none",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70",
  "aria-[invalid=true]:border-danger",
);

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("text-foreground text-sm font-medium", className)} {...props}>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "min-h-24 py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CONTROL, "h-11 pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "border-border-strong size-5 shrink-0 rounded accent-[var(--brand)]",
        "focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export type FieldProps = {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string | string[];
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Envelope de campo com rotulo, dica e erro.
 *
 * O erro fica sempre logo abaixo do controle e com `role="alert"`: num
 * formulario preenchido as pressas, erro no topo da pagina passa batido.
 */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-danger ml-0.5">*</span> : null}
        </Label>
      ) : null}

      {children}

      {message ? (
        <p role="alert" className="text-danger text-sm font-medium">
          {message}
        </p>
      ) : hint ? (
        <p className="text-foreground-muted text-sm">{hint}</p>
      ) : null}
    </div>
  );
}

export function Fieldset({
  legend,
  description,
  children,
  className,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-4", className)}>
      <div>
        <legend className="text-foreground text-base font-semibold">{legend}</legend>
        {description ? <p className="text-foreground-muted text-sm">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}
