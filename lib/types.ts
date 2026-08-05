export type SchemaField = {
  field: string;
  type: string;
  description?: string;
};

export type DatasetMeta = {
  urn: string;
  name: string;
  platform: string;
  layer: "raw" | "staging" | "mart";
  description: string;
  owner: string;
  tags: string[];
  csv: string;
  schema: SchemaField[];
};

export type ConsumerMeta = {
  urn: string;
  name: string;
  type: "ml_model" | "dashboard";
  description: string;
  owner: string;
  tags: string[];
};

export type LineageEdge = { upstream: string; downstream: string };

export type EstateContext = {
  source: "fixture" | "datahub";
  domain: string;
  datasets: DatasetMeta[];
  consumers: ConsumerMeta[];
  edges: LineageEdge[];
  liveError?: string;
};

export type IssueKind = "missing-spike" | "type-drift" | "contract-violation";
export type Severity = "warning" | "serious" | "critical";

export type ColumnIssue = {
  kind: IssueKind;
  severity: Severity;
  message: string;
};

export type Bin = { label: string; count: number };

export type ColumnProfile = {
  field: string;
  declaredType: string;
  observedType: string;
  missingPct: number;
  distinct: number;
  min?: string;
  max?: string;
  histogram?: Bin[];
  topk?: Bin[];
  patternBreakdown?: { isoTimestamp: number; numeric: number; empty: number; other: number };
  issues: ColumnIssue[];
};

export type DatasetProfile = {
  urn: string;
  rows: number;
  columns: ColumnProfile[];
  health: number;
  worst: Severity | "good";
  profiledAt: string;
};

export type WritebackCall = {
  tool: string;
  args: Record<string, unknown>;
};

export type WritebackPlan = {
  urn: string;
  calls: WritebackCall[];
};
