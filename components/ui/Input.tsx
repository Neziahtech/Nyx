import { forwardRef, type InputHTMLAttributes } from "react";

/** Labelled text input with blush focus ring and inline error support. */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className = "", id, ...rest },
  ref
) {
  const inputId = id ?? `input-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        ref={ref}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-dim/60 focus:ring-2 focus:ring-blush-400 ${
          error ? "border-danger" : "border-blush-200"
        } ${className}`}
        {...rest}
      />
      {hint && !error && <p className="text-xs text-dim">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
});
