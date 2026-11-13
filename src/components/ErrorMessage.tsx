import { AlertCircle } from "lucide-react";
import Link from "next/link";

type ErrorMessageProps = {
  message: string;
};

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <div role="alert" className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
      <AlertCircle aria-hidden="true" className="mt-1 shrink-0" size={16} />
      <div className="min-w-0 break-words">
        <p>{message}</p>
        {message.includes("API Settings") ? <Link href="/settings/api" className="mt-1 inline-block font-medium underline underline-offset-2">Open API Settings</Link> : null}
      </div>
    </div>
  );
}
