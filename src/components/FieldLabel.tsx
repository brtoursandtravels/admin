import type { ReactNode } from "react";

/** Keep the required marker beside the label without changing its accessible name. */
export function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return <span>{children}{required ? <span className="ml-1 text-admin-negative" data-required-marker aria-hidden="true" title="Required">*</span> : null}</span>;
}
