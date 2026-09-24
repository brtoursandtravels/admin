import { useController, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { AdminSelect, type AdminSelectProps } from "./AdminSelect";

/** Keep resets, validation focus, dirty state and saved values in React Hook Form. */
export function FormSelect<T extends FieldValues>({ control, name, ...props }: Omit<AdminSelectProps, "value" | "onValueChange" | "name" | "ref"> & { control: Control<T>; name: FieldPath<T> }) {
  const { field: { ref, value, onChange, onBlur }, fieldState: { invalid } } = useController({ control, name });
  return <AdminSelect {...props} name={name} ref={ref} value={value ?? ""} onValueChange={onChange} onBlur={onBlur} aria-invalid={invalid || undefined} />;
}
