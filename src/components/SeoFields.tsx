import type { UseFormRegisterReturn } from "react-hook-form";
import { FieldError } from "../ui";

export function SeoFields({
  titleField, descriptionField, titleValue, descriptionValue,
  fallbackTitle, fallbackDescription, titleError, descriptionError,
}: {
  titleField: UseFormRegisterReturn;
  descriptionField: UseFormRegisterReturn;
  titleValue: string;
  descriptionValue: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  titleError?: string;
  descriptionError?: string;
}) {
  return (
    <fieldset className="col-span-full grid min-w-0 gap-4 rounded-xl border border-admin-border p-4">
      <legend className="px-2 text-sm font-bold text-admin-brand-deep">Search engine details</legend>
      <p className="text-sm text-admin-ink-muted">Set the title and description used in page meta tags and link previews. Leave blank to use the entry’s title and description.</p>
      <label className="grid gap-1.5 text-sm font-bold text-admin-brand-deep">
        Meta Title
        <input className="admin-control" maxLength={70} placeholder={fallbackTitle?.slice(0, 70)} {...titleField} />
        <span className="text-xs font-normal text-admin-ink-subtle">{titleValue.length}/70 characters</span>
        <FieldError message={titleError} />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-admin-brand-deep">
        Meta Description
        <textarea className="admin-control" maxLength={170} rows={3} placeholder={fallbackDescription?.slice(0, 170)} {...descriptionField} />
        <span className="text-xs font-normal text-admin-ink-subtle">{descriptionValue.length}/170 characters</span>
        <FieldError message={descriptionError} />
      </label>
    </fieldset>
  );
}
