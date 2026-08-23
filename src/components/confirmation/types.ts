export type ConfirmVariant = "modal" | "sheet";

export interface ConfirmOptions {
  variant: ConfirmVariant;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
}

export interface NotifyUndoOptions {
  message: string;
  undoLabel: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
}

export interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  notifyUndo: (options: NotifyUndoOptions) => void;
}
