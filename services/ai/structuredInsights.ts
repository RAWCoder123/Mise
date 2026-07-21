import { z } from "zod";

import type { AiInsight, AiInsightRiskLevel } from "../../types/mise";

export const structuredInsightOutputSchema = z.object({
  title: z.string().min(1).max(96),
  summary: z.string().min(1).max(500),
  recommended_action: z.string().min(1).max(240),
  risk_level: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  affected_workflow: z.enum(["inventory", "ordering", "prep", "sales", "waste", "cost"]),
  evidence: z.array(z.string().min(1).max(180)).max(6)
});

export type StructuredInsightOutput = z.infer<typeof structuredInsightOutputSchema>;

export const structuredInsightJsonSchema = {
  name: "mise_ai_insight",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "summary", "recommended_action", "risk_level", "confidence", "affected_workflow", "evidence"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 96 },
      summary: { type: "string", minLength: 1, maxLength: 500 },
      recommended_action: { type: "string", minLength: 1, maxLength: 240 },
      risk_level: { type: "string", enum: ["low", "medium", "high"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      affected_workflow: { type: "string", enum: ["inventory", "ordering", "prep", "sales", "waste", "cost"] },
      evidence: {
        type: "array",
        maxItems: 6,
        items: { type: "string", minLength: 1, maxLength: 180 }
      }
    }
  }
} as const;

export function parseStructuredInsightOutput(value: unknown) {
  return structuredInsightOutputSchema.parse(value);
}

export function buildAiInsightInput(
  restaurantId: string,
  output: StructuredInsightOutput,
  generatedBy: string | null = "rules_engine"
): Omit<AiInsight, "id" | "created_at"> {
  return {
    restaurant_id: restaurantId,
    source: generatedBy === "openai" ? "openai_structured_output" : "rules_engine",
    schema_version: "mise.ai_insight.v1",
    output,
    risk_level: output.risk_level as AiInsightRiskLevel,
    confidence: output.confidence,
    status: "generated",
    generated_by: generatedBy
  };
}
