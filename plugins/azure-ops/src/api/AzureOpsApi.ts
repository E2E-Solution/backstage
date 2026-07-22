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

import type {
  AzureApprovalRequest,
  AzureAnalysisRequest,
  AzureAnalysisResponse,
  AzureExecutionRecord,
  AzureIncident,
  AzureIncidentFilters,
  AzureInventoryResource,
  AzureOperationalHealth,
  AzureOperationPlan,
  AzureOperationRisk,
  AzureOperationTemplateId,
  AzureOpsSummary,
  AzureOpsCapabilities,
} from '@internal/backstage-plugin-azure-ops-common';

export interface AzureOperationTemplate {
  id: AzureOperationTemplateId;
  title: string;
  risk: AzureOperationRisk;
  resourceTypes: string[];
}

export interface AzureResourceFilters {
  subscription?: string;
  type?: string;
  health?: AzureOperationalHealth;
  limit: number;
}

export interface AzureOpsApi {
  getCapabilities(): Promise<AzureOpsCapabilities>;
  analyze(input: AzureAnalysisRequest): Promise<AzureAnalysisResponse>;
  getSummary(): Promise<AzureOpsSummary>;
  getIncidents(filters: AzureIncidentFilters): Promise<AzureIncident[]>;
  getResources(
    filters: AzureResourceFilters,
  ): Promise<AzureInventoryResource[]>;
  getOperationTemplates(): Promise<AzureOperationTemplate[]>;
  createPlan(input: {
    templateId: AzureOperationTemplateId;
    resourceId: string;
    parameters: Record<string, unknown>;
  }): Promise<AzureOperationPlan>;
  requestApproval(planId: string): Promise<AzureApprovalRequest>;
  getApprovals(): Promise<AzureApprovalRequest[]>;
  decideApproval(
    id: string,
    action: 'approve' | 'reject' | 'cancel',
    reason?: string,
  ): Promise<AzureApprovalRequest>;
  executeApproval(id: string): Promise<AzureExecutionRecord>;
  getExecutions(): Promise<AzureExecutionRecord[]>;
}
