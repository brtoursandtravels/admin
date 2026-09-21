import type { ButtonHTMLAttributes } from "react";
import { Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api";
import { useAuth } from "../auth";
import { ConfirmButton, useToast } from "../ui";

type DeleteButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type" | "children"> & {
  resource: string;
  name: string;
  description?: string;
  label?: string;
  onDelete: () => unknown | Promise<unknown>;
};

/** Confirmation for both saved records and unsaved editor rows. */
export function DeleteButton({ resource, name, description, label = "Delete", onDelete, ...props }: DeleteButtonProps) {
  return (
    <ConfirmButton
      {...props}
      dialogTitle={`${label} ${resource}?`}
      dialogDescription={description ?? `This ${resource} will be permanently deleted. This cannot be undone.`}
      detailText={name}
      confirmText={`${label} ${resource}`}
      cancelText="Cancel"
      onConfirm={onDelete}
    >
      <Trash2 size={14} aria-hidden="true" />
      {label}
    </ConfirmButton>
  );
}

type DeleteRecordButtonProps = Omit<DeleteButtonProps, "onDelete"> & {
  endpoint: string;
  invalidateKeys: readonly string[];
  onDeleted?: () => void;
};

/** Keeps authentication, pending state, cache refresh and feedback in one place. */
export function DeleteRecordButton({ endpoint, invalidateKeys, onDeleted, disabled, ...props }: DeleteRecordButtonProps) {
  const { csrfToken } = useAuth();
  const client = useQueryClient();
  const { notify } = useToast();
  const deletion = useMutation({
    mutationFn: () => apiRequest<void>(endpoint, { method: "DELETE", csrfToken }),
    onSuccess: async () => {
      await Promise.all([...new Set([...invalidateKeys, "dashboard"])].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ));
      notify(`${props.name} deleted.`);
      onDeleted?.();
    },
  });
  return <DeleteButton {...props} disabled={disabled || deletion.isPending} onDelete={() => deletion.mutateAsync()} />;
}
