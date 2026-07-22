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

import { ResponseError } from '@backstage/errors';
import type { FetchApi } from '@backstage/frontend-plugin-api';
import type {
  AzureApprovalRequest,
  AzureAnalysisRequest,
  AzureAnalysisResponse,
  AzureExecutionRecord,
  AzureIncident,
  AzureIncidentFilters,
  AzureInventoryResource,
  AzureOperationPlan,
  AzureOpsSummary,
  AzureOpsCapabilities,
} from '@internal/backstage-plugin-azure-ops-common';
import type {
  AzureOperationTemplate,
  AzureOpsApi,
  AzureResourceFilters,
} from './AzureOpsApi';

const baseUrl = 'plugin://azure-ops';

export class AzureOpsClient implements AzureOpsApi {
  public constructor(private readonly fetchApi: FetchApi) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchApi.fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      throw await ResponseError.fromResponse(response);
    }
    return response.json() as Promise<T>;
  }

  async getCapabilities(): Promise<AzureOpsCapabilities> {
    return this.request('/capabilities');
  }

  async analyze(input: AzureAnalysisRequest): Promise<AzureAnalysisResponse> {
    return this.request('/agent/analyze', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async getSummary(): Promise<AzureOpsSummary> {
    return this.request('/summary');
  }

  async getIncidents(filters: AzureIncidentFilters): Promise<AzureIncident[]> {
    const query = new URLSearchParams({ limit: String(filters.limit) });
    if (filters.status) {
      query.set('status', filters.status);
    }
    if (filters.severity) {
      query.set('severity', filters.severity);
    }
    const result = await this.request<{ items: AzureIncident[] }>(
      `/incidents?${query}`,
    );
    return result.items;
  }

  async getResources(
    filters: AzureResourceFilters,
  ): Promise<AzureInventoryResource[]> {
    const query = new URLSearchParams({ limit: String(filters.limit) });
    if (filters.subscription) {
      query.set('subscription', filters.subscription);
    }
    if (filters.type) {
      query.set('type', filters.type);
    }
    if (filters.health) {
      query.set('health', filters.health);
    }
    const result = await this.request<{ items: AzureInventoryResource[] }>(
      `/resources?${query}`,
    );
    return result.items;
  }

  async getOperationTemplates(): Promise<AzureOperationTemplate[]> {
    const result = await this.request<{ items: AzureOperationTemplate[] }>(
      '/operations/templates',
    );
    return result.items;
  }

  async createPlan(input: {
    templateId: AzureOperationPlan['templateId'];
    resourceId: string;
    parameters: Record<string, unknown>;
  }): Promise<AzureOperationPlan> {
    return this.request('/plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async requestApproval(planId: string): Promise<AzureApprovalRequest> {
    return this.request('/approvals', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  async getApprovals(): Promise<AzureApprovalRequest[]> {
    const result = await this.request<{ items: AzureApprovalRequest[] }>(
      '/approvals',
    );
    return result.items;
  }

  async decideApproval(
    id: string,
    action: 'approve' | 'reject' | 'cancel',
    reason?: string,
  ): Promise<AzureApprovalRequest> {
    return this.request(`/approvals/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  }

  async executeApproval(id: string): Promise<AzureExecutionRecord> {
    return this.request(`/approvals/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
    });
  }

  async getExecutions(): Promise<AzureExecutionRecord[]> {
    const result = await this.request<{ items: AzureExecutionRecord[] }>(
      '/executions',
    );
    return result.items;
  }
}
