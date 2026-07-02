import { Loader2 } from "lucide-react";

type LoadingAnswerProps = {
  label?: string;
};

export function LoadingAnswer({ label = "Generating answer..." }: LoadingAnswerProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
