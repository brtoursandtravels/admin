import { Children, Fragment, isValidElement, useRef, useState, type ComponentPropsWithRef, type ReactNode } from "react";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type Option = { value: string; label: string; disabled?: boolean };
type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type === Fragment) return readOptions(child.props.children);
    if (child.type !== "option") return [];
    const label = Children.toArray(child.props.children).join("");
    return [{ value: String(child.props.value ?? label), label, disabled: child.props.disabled }];
  });
}

export type AdminSelectProps = Omit<ComponentPropsWithRef<"button">, "children" | "value" | "defaultValue" | "onChange" | "type"> & {
  children: ReactNode;
  value?: string | number;
  onValueChange: (value: string) => void;
  placeholder?: string;
};

/** Shared single-choice menu. Native option children keep values and labels together. */
export function AdminSelect({ children, value = "", onValueChange, placeholder = "Choose an option", name, disabled, className = "", ref, ...triggerProps }: AdminSelectProps) {
  const options = readOptions(children);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const selected = options.find(option => option.value === String(value));

  return (
    <Select.Root
      value={selected ? `option:${selected.value}` : ""}
      onValueChange={next => {
        // Ignore the native form bridge resetting while async options mount.
        // An intentional empty choice is represented by the "option:" item.
        if (next.startsWith("option:")) onValueChange(next.slice("option:".length));
      }}
      disabled={disabled}
      onOpenChange={open => {
        // Native modal dialogs live in the top layer; their menus must stay inside it.
        if (open) setPortalContainer(trigger.current?.closest("dialog") ?? null);
      }}
    >
      <Select.Trigger
        {...triggerProps}
        ref={node => {
          trigger.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={`admin-control admin-select-trigger ${className}`}
        disabled={disabled}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="admin-select-chevron"><ChevronDown size={16} aria-hidden="true" /></Select.Icon>
      </Select.Trigger>
      {name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
      <Select.Portal container={portalContainer}>
        <Select.Content className="admin-select-menu" position="popper" sideOffset={6} collisionPadding={12} onEscapeKeyDown={event => event.stopPropagation()}>
          <Select.ScrollUpButton className="admin-select-scroll"><ChevronUp size={16} aria-hidden="true" /></Select.ScrollUpButton>
          <Select.Viewport className="admin-select-options">
            {options.map(option => (
              <Select.Item className="admin-select-option" key={option.value} value={`option:${option.value}`} disabled={option.disabled} textValue={option.label}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="admin-select-check"><Check size={16} aria-hidden="true" /></Select.ItemIndicator>
              </Select.Item>
            ))}
            {!options.length ? <div className="admin-select-empty">No options available</div> : null}
          </Select.Viewport>
          <Select.ScrollDownButton className="admin-select-scroll"><ChevronDown size={16} aria-hidden="true" /></Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
