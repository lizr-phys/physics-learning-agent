import { AlertCircle } from "lucide-react";

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="flex gap-2 rounded-md border border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-800">
      <AlertCircle className="mt-0.5 shrink-0" size={16} />
      <span>{message}</span>
    </div>
  );
}
