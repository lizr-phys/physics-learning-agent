export function WorkspaceHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="min-w-0 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">{title}</h1>
      <p className="max-w-prose text-sm leading-6 text-zinc-600">{description}</p>
    </header>
  );
}
