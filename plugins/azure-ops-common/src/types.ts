/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { AzureOperationTemplateId } from './constants';

/** @public */
export type AzureScopeType = 'subscription' | 'resource-group' | 'resource';

/** @public */
export interface AzureResourceRef {
  id: string;
  scopeType: AzureScopeType;
  subscriptionId: string;
  resourceGroup?: string;
  providerNamespace?: string;
  resourceType?: string;
  resourceName?: string;
}

/** @public */
export type AzureOperationalHealth =
  | 'available'
  | 'degraded'
  | 'unavailable'
  | 'unknown';

/** @public */
export type AzureDataSource =
  | 'resource-graph'
  | 'resource-manager'
  | 'azure-monitor'
  | 'resource-health'
  | 'service-health'
  | 'activity-log'
  | 'policy'
  | 'advisor';

/** @public */
export interface AzureSourceFreshness {
  source: AzureDataSource;
  observedAt: string;
  status: 'fresh' | 'stale' | 'partial' | 'unavailable';
  message?: string;
}

/** @public */
export interface AzureInventoryResource {
  id: string;
  name: string;
  type: string;
  subscriptionId: string;
  resourceGroup?: string;
  location?: string;
  kind?: string;
  provisioningState?: string;
  powerState?: string;
  health: AzureOperationalHealth;
  tags: Record<string, string>;
  observedAt: string;
}

/** @public */
export interface AzureOpsSummary {
  generatedAt: string;
  resources: {
    total: number;
    available: number;
    degraded: number;
    unavailable: number;
    unknown: number;
  };
  alerts: {
    active: number;
    critical: number;
  };
  policy: {
    compliant: number;
    nonCompliant: number;
    unknown: number;
  };
  advisor: {
    highImpact: number;
    total: number;
  };
  sources: AzureSourceFreshness[];
}

/** @public */
export type AzureOperationRisk = 'low' | 'medium' | 'high' | 'critical';

/** @public */
export interface AzureOperationPlanStep {
  sequence: number;
  action: string;
  resourceId: string;
  description: string;
  expectedState?: string;
}

/** @public */
export interface AzureOperationPlan {
  id: string;
  templateId: AzureOperationTemplateId;
  templateVersion: number;
  resourceId: string;
  requestedBy: string;
  risk: AzureOperationRisk;
  parameters: Record<string, unknown>;
  preconditions: string[];
  steps: AzureOperationPlanStep[];
  rollback: string;
  createdAt: string;
  expiresAt: string;
  observedResourceVersion?: string;
  hash: string;
}

/** @public */
export type AzureApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'canceled';

/** @public */
export interface AzureApprovalRequest {
  id: string;
  plan: AzureOperationPlan;
  status: AzureApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
}

/** @public */
export type AzureExecutionStatus =
  | 'dispatching'
  | 'running'
  | 'unknown'
  | 'succeeded'
  | 'failed'
  | 'canceled';

/** @public */
export interface AzureExecutionRecord {
  id: string;
  approvalId: string;
  planHash: string;
  correlationId: string;
  orchestrationId?: string;
  status: AzureExecutionStatus;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  message?: string;
}

/** @public */
export interface AzureEvidenceItem {
  id: string;
  source: AzureDataSource;
  observedAt: string;
  title: string;
  summary: string;
  resourceId?: string;
}

/** @public */
export interface AzureEvidenceBundle {
  id: string;
  generatedAt: string;
  resourceIds: string[];
  items: AzureEvidenceItem[];
}

/** @public */
export interface AzureAgentRecommendation {
  summary: string;
  hypotheses: Array<{
    text: string;
    confidence: number;
    evidenceIds: string[];
  }>;
  suggestedTemplateIds: AzureOperationTemplateId[];
  warnings: string[];
}

/** @public */
export interface AzureAnalysisRequest {
  question: string;
  resourceIds: string[];
}

/** @public */
export interface AzureAnalysisResponse {
  correlationId: string;
  evidence: AzureEvidenceBundle;
  recommendation: AzureAgentRecommendation;
}

/** @public */
export interface AzureOpsCapabilities {
  foundryConfigured: boolean;
  orchestratorConfigured: boolean;
  writesRequireApproval: true;
}

/** @public */
export type AzureIncidentSeverity = 'Sev0' | 'Sev1' | 'Sev2' | 'Sev3' | 'Sev4';

/** @public */
export type AzureIncidentStatus = 'active' | 'resolved';

/** @public */
export interface AzureIncident {
  id: string;
  alertRule: string;
  severity: AzureIncidentSeverity;
  signalType: string;
  monitoringService: string;
  status: AzureIncidentStatus;
  firedAt: string;
  resolvedAt?: string;
  affectedResourceIds: string[];
  summary: string;
  source: 'azure-monitor';
  lastUpdated: string;
}

/** @public */
export interface AzureIncidentFilters {
  status?: AzureIncidentStatus;
  severity?: AzureIncidentSeverity;
  limit: number;
}
