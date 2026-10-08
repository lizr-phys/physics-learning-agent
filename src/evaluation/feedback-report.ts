type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null;
  return { samples: sorted.length, p50: percentile(0.5), p95: percentile(0.95) };
}

/** Explicit export only. Whitelisted aggregates exclude identities and learning text. */
export function buildPilotFeedbackReport(input: unknown, now = new Date()) {
  const snapshot = object(object(input).data ?? input);
  const messages = list(snapshot.sessions).flatMap(session => list(object(session).messages)).map(object).filter(message => message.role === "assistant");
  const feedback = messages.map(message => object(message.feedback)).filter(value => ["helpful", "needs-improvement"].includes(String(value.verdict)));
  const practice = list(snapshot.practiceHistory).map(object);
  const recordedAttempts = [...messages, ...practice].flatMap(record => [...list(record.generationAttempts), record.generation]).map(object).filter(value => ["complete", "truncated", "interrupted", "cancelled", "error"].includes(String(value.terminal)));
  const attempts = new Map<string, RecordValue>();
  recordedAttempts.forEach((value, index) => {
    const id = typeof value.requestId === "string" ? value.requestId : `legacy-${index}`;
    const previous = attempts.get(id);
    if (!previous || (number(value.durationMs) ?? -1) >= (number(previous.durationMs) ?? -1)) attempts.set(id, value);
  });
  const diagnostics = [...attempts.values()];
  const completed = diagnostics.filter(value => value.terminal === "complete").length;
  const helpful = feedback.filter(value => value.verdict === "helpful").length;
  const retrieval: Record<string, number> = {};
  for (const status of ["disabled", "unauthenticated", "no_match", "retrieved", "failed"]) retrieval[status] = messages.filter(message => message.retrievalStatus === status).length;
  const issues: Record<string, number> = {};
  for (const issue of ["unclear", "formula-error", "citation-error", "other"]) issues[issue] = feedback.filter(value => value.issue === issue).length;
  const assessed = practice.flatMap(item => Object.values(object(item.problemAssessments))).map(object).filter(value => ["solved", "needs-work"].includes(String(value.status)));
  const durations = diagnostics.map(value => number(value.durationMs)).filter((value): value is number => value !== undefined);
  const firstTokens = diagnostics.map(value => number(value.firstTokenMs)).filter((value): value is number => value !== undefined);
  const usage = diagnostics.map(value => object(value.usage));
  const reportedUsage = usage.filter(value => number(value.totalTokens) !== undefined || number(value.outputTokens) !== undefined);
  const outputUsage = usage.map(value => number(value.outputTokens)).filter((value): value is number => value !== undefined);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    evidence: "Exported local records; feedback and self-assessment are not physics validation.",
    answers: { recorded: messages.length, feedbackResponses: feedback.length, helpful, needsImprovement: feedback.length - helpful, helpfulFraction: feedback.length ? helpful / feedback.length : null, issues },
    generations: { recorded: diagnostics.length, completed, completionFraction: diagnostics.length ? completed / diagnostics.length : null,
      terminals: Object.fromEntries(["complete", "truncated", "interrupted", "cancelled", "error"].map(terminal => [terminal, diagnostics.filter(value => value.terminal === terminal).length])),
      durationMs: distribution(durations), firstTokenMs: distribution(firstTokens),
      usageReportedTasks: reportedUsage.length,
      outputUsageReportedTasks: outputUsage.length,
      reportedOutputTokens: outputUsage.length ? outputUsage.reduce((sum, value) => sum + value, 0) : null,
      cost: null, costNote: "Prices and billing are not inferred from missing usage or local feedback.",
    },
    personalRetrieval: retrieval,
    practice: { storedSets: practice.length, completeSets: practice.filter(item => item.status === "complete").length, assessedProblems: assessed.length,
      solved: assessed.filter(value => value.status === "solved").length, needsWork: assessed.filter(value => value.status === "needs-work").length },
    humanPhysicsReview: { status: "not_performed", samples: 0 },
  };
}
