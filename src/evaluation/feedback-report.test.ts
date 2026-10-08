import { describe, expect, it } from "vitest";
import { buildPilotFeedbackReport } from "./feedback-report";

describe("consented pilot report", () => {
  it("counts practice attempts with chat while retaining an output-usage denominator", () => {
    const report = buildPilotFeedbackReport({sessions:[{messages:[{role:"assistant",generation:{requestId:"shared",terminal:"complete",usage:{totalTokens:18}}}]}],
      practiceHistory:[{status:"interrupted",generationAttempts:[{requestId:"shared",terminal:"complete",usage:{totalTokens:18}},{requestId:"practice-retry",terminal:"interrupted",usage:{outputTokens:12}}]}]});
    expect(report.generations.recorded).toBe(2);
    expect(report.generations.outputUsageReportedTasks).toBe(1);
    expect(report.generations.reportedOutputTokens).toBe(12);
    const totalOnly = buildPilotFeedbackReport({sessions:[{messages:[{role:"assistant",generation:{terminal:"complete",usage:{totalTokens:18}}}]}]});
    expect(totalOnly.generations.usageReportedTasks).toBe(1);
    expect(totalOnly.generations.reportedOutputTokens).toBeNull();
  });
  it("counts retained request attempts once and keeps unknown usage unknown", () => {
    const report = buildPilotFeedbackReport({sessions:[{messages:[{role:"assistant",generation:{requestId:"r2",terminal:"complete"},generationAttempts:[
      {requestId:"r1",terminal:"interrupted"},{requestId:"r2",terminal:"complete"},{requestId:"r2",terminal:"complete"},
    ]}]}]});
    expect(report.generations.recorded).toBe(2);
    expect(report.generations.completed).toBe(1);
    expect(report.generations.usageReportedTasks).toBe(0);
    expect(report.generations.reportedOutputTokens).toBeNull();
  });
  it("does not replace a retained final attempt with a stale diagnostic snapshot", () => {
    const report = buildPilotFeedbackReport({sessions:[{messages:[{role:"assistant",
      generation:{requestId:"retry",terminal:"interrupted",durationMs:20},
      generationAttempts:[{requestId:"retry",terminal:"complete",durationMs:400,firstTokenMs:30,usage:{outputTokens:50}}],
    }]}]});
    expect(report.generations.completed).toBe(1);
    expect(report.generations.reportedOutputTokens).toBe(50);
    expect(report.generations.durationMs.p50).toBe(400);
  });
  it("reports denominators and missing measurements without fabricating quality or costs", () => {
    const empty = buildPilotFeedbackReport({sessions:[],practiceHistory:[]});
    expect(empty.answers.helpfulFraction).toBeNull();
    expect(empty.generations.durationMs).toEqual({samples:0,p50:null,p95:null});
    expect(empty.generations.reportedOutputTokens).toBeNull();
    expect(empty.humanPhysicsReview.status).toBe("not_performed");
    expect(empty.generations.cost).toBeNull();
  });
  it("aggregates task feedback while excluding keys, private sources and user content", () => {
    const report = buildPilotFeedbackReport({userId:"private-account",apiKey:"sk-secret",sessions:[{title:"Private title",messages:[
      {role:"assistant",content:"Private physical answer",sources:[{content:"Private lecture"}],feedback:{verdict:"helpful"},retrievalStatus:"retrieved",generation:{terminal:"complete",durationMs:800,firstTokenMs:100,usage:{outputTokens:20}}},
      {role:"assistant",content:"Other private answer",feedback:{verdict:"needs-improvement",issue:"formula-error"},generation:{terminal:"interrupted",durationMs:1500}},
    ]}],practiceHistory:[{content:"Private problems",status:"complete",problemAssessments:{"stable-id":{status:"needs-work",draft:"Private attempt"}}}]});
    expect(report.answers.helpfulFraction).toBe(0.5);
    expect(report.generations.completionFraction).toBe(0.5);
    expect(report.generations.durationMs).toEqual({samples:2,p50:800,p95:1500});
    expect(report.generations.usageReportedTasks).toBe(1);
    expect(report.practice.needsWork).toBe(1);
    expect(JSON.stringify(report)).not.toMatch(/private|sk-secret|lecture|draft|account/i);
  });
});
