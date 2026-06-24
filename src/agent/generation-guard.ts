export type ActiveGenerationDescriptor = {
  sessionId: string;
  assistantMessageId: string;
  requestId: string;
};

export function matchesGeneration(
  active: ActiveGenerationDescriptor | null | undefined,
  target: ActiveGenerationDescriptor,
) {
  return Boolean(
    active &&
      active.sessionId === target.sessionId &&
      active.assistantMessageId === target.assistantMessageId &&
      active.requestId === target.requestId,
  );
}

export function canApplyGenerationUpdate(options: {
  active: ActiveGenerationDescriptor | null | undefined;
  target: ActiveGenerationDescriptor;
  sessionExists: boolean;
}) {
  return options.sessionExists && matchesGeneration(options.active, options.target);
}
