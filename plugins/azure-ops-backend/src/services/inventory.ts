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

import {
  AzureInventoryResource,
  AzureOperationalHealth,
  AzureOpsSummary,
  AzureSourceFreshness,
  normalizeAzureResourceId,
  parseAzureResourceId,
} from '@internal/backstage-plugin-azure-ops-common';
import { ResourceGraphGateway } from './resourceGraph';

const inventoryQuery = `Resources
| project id, name, type, subscriptionId, resourceGroup, location, kind, tags,
    provisioningState=tostring(properties.provisioningState),
    powerState=tostring(properties.extended.instanceView.powerState.code)`;
const healthQuery = `HealthResources
| where type =~ 'microsoft.resourcehealth/availabilitystatuses'
| project id=tostring(properties.targetResourceId),
    availabilityState=tostring(properties.availabilityState)`;
const alertsQuery = `AlertsManagementResources
| where type =~ 'microsoft.alertsmanagement/alerts'
| where tostring(properties.essentials.monitorCondition) =~ 'Fired'
| project severity=tostring(properties.essentials.severity)`;
const policyQuery = `PolicyResources
| where type =~ 'microsoft.policyinsights/policystates'
| project complianceState=tostring(properties.complianceState)`;
const advisorQuery = `AdvisorResources
| where type =~ 'microsoft.advisor/recommendations'
| project impact=tostring(properties.impact)`;

type Row = Record<string, unknown>;

function row(value: unknown): Row | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Row)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function tagsValue(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      typeof item === 'string' ? [[key, item]] : [],
    ),
  );
}

function normalizeHealth(value: unknown): AzureOperationalHealth {
  switch (stringValue(value)?.toLowerCase()) {
    case 'available':
      return 'available';
    case 'degraded':
      return 'degraded';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'unknown';
  }
}

export function normalizeInventoryRows(
  values: unknown[],
  observedAt: string,
): AzureInventoryResource[] {
  return values.flatMap(value => {
    const item = row(value);
    const id = stringValue(item?.id);
    const name = stringValue(item?.name);
    const type = stringValue(item?.type);
    if (!id || !name || !type) {
      return [];
    }
    const parsed = parseAzureResourceId(id);
    if (!parsed || parsed.scopeType !== 'resource') {
      return [];
    }
    return [
      {
        id: parsed.id,
        name,
        type: type.toLowerCase(),
        subscriptionId: parsed.subscriptionId,
        resourceGroup:
          stringValue(item?.resourceGroup)?.toLowerCase() ??
          parsed.resourceGroup,
        location: stringValue(item?.location),
        kind: stringValue(item?.kind),
        provisioningState: stringValue(item?.provisioningState),
        powerState: stringValue(item?.powerState),
        health: 'unknown' as const,
        tags: tagsValue(item?.tags),
        observedAt,
      },
    ];
  });
}

export interface ResourceFilters {
  subscription?: string;
  type?: string;
  health?: AzureOperationalHealth;
  limit: number;
}

export interface AzureOpsReader {
  refresh(): Promise<void>;
  summary(): AzureOpsSummary;
  resources(filters: ResourceFilters): AzureInventoryResource[];
}

interface CachedData {
  summary: AzureOpsSummary;
  resources: AzureInventoryResource[];
}

function unavailableData(message: string): CachedData {
  const generatedAt = new Date().toISOString();
  return {
    resources: [],
    summary: {
      generatedAt,
      resources: {
        total: 0,
        available: 0,
        degraded: 0,
        unavailable: 0,
        unknown: 0,
      },
      alerts: { active: 0, critical: 0 },
      policy: { compliant: 0, nonCompliant: 0, unknown: 0 },
      advisor: { highImpact: 0, total: 0 },
      sources: [
        {
          source: 'resource-graph',
          observedAt: generatedAt,
          status: 'unavailable',
          message,
        },
      ],
    },
  };
}

export class DefaultAzureOpsReader implements AzureOpsReader {
  private cache: CachedData;

  constructor(
    private readonly options: {
      enabled: boolean;
      subscriptions: string[];
      gateway: ResourceGraphGateway;
    },
  ) {
    this.cache = unavailableData(
      options.enabled
        ? 'Inventory has not been refreshed'
        : 'Azure Ops is disabled',
    );
  }

  summary(): AzureOpsSummary {
    return this.cache.summary;
  }

  resources(filters: ResourceFilters): AzureInventoryResource[] {
    return this.cache.resources
      .filter(
        resource =>
          (!filters.subscription ||
            resource.subscriptionId === filters.subscription.toLowerCase()) &&
          (!filters.type || resource.type === filters.type.toLowerCase()) &&
          (!filters.health || resource.health === filters.health),
      )
      .slice(0, filters.limit);
  }

  async refresh(): Promise<void> {
    if (!this.options.enabled) {
      this.cache = unavailableData('Azure Ops is disabled');
      return;
    }
    if (this.options.subscriptions.length === 0) {
      this.cache = unavailableData('No Azure subscriptions are allowlisted');
      return;
    }

    const observedAt = new Date().toISOString();
    let resources: AzureInventoryResource[];
    let inventoryPartial = false;
    let inventoryMessage: string | undefined;
    try {
      const result = await this.options.gateway.query(
        inventoryQuery,
        this.options.subscriptions,
      );
      resources = normalizeInventoryRows(result.rows, observedAt);
      inventoryPartial = result.partial;
      inventoryMessage = result.message;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failureMessage = `Inventory query failed: ${message}`;
      if (this.hasSuccessfulRefresh) {
        this.cache = {
          resources: this.cache.resources,
          summary: {
            ...this.cache.summary,
            sources: this.cache.summary.sources.map(source => ({
              ...source,
              status:
                source.source === 'resource-graph'
                  ? ('unavailable' as const)
                  : ('stale' as const),
              message: failureMessage,
            })),
          },
        };
      } else {
        this.cache = unavailableData(failureMessage);
      }
      return;
    }

    const sources: AzureSourceFreshness[] = [
      {
        source: 'resource-graph',
        observedAt,
        status: inventoryPartial ? 'partial' : 'fresh',
        message: inventoryMessage,
      },
    ];
    const query = async (
      source: AzureSourceFreshness['source'],
      text: string,
    ): Promise<unknown[]> => {
      try {
        const result = await this.options.gateway.query(
          text,
          this.options.subscriptions,
        );
        sources.push({
          source,
          observedAt,
          status: result.partial ? 'partial' : 'fresh',
          message: result.message,
        });
        return result.rows;
      } catch (error) {
        sources.push({
          source,
          observedAt,
          status: 'partial',
          message: error instanceof Error ? error.message : String(error),
        });
        return [];
      }
    };

    const [healthRows, alertRows, policyRows, advisorRows] = await Promise.all([
      query('resource-health', healthQuery),
      query('azure-monitor', alertsQuery),
      query('policy', policyQuery),
      query('advisor', advisorQuery),
    ]);
    const healthById = new Map<string, AzureOperationalHealth>();
    for (const value of healthRows) {
      const item = row(value);
      const id = stringValue(item?.id);
      if (id) {
        healthById.set(
          normalizeAzureResourceId(id),
          normalizeHealth(item?.availabilityState),
        );
      }
    }
    resources = resources.map(resource => ({
      ...resource,
      health: healthById.get(resource.id) ?? 'unknown',
    }));

    const count = (health: AzureOperationalHealth) =>
      resources.filter(resource => resource.health === health).length;
    const severities = alertRows.map(value =>
      stringValue(row(value)?.severity)?.toLowerCase(),
    );
    const policyStates = policyRows.map(value =>
      stringValue(row(value)?.complianceState)?.toLowerCase(),
    );
    const impacts = advisorRows.map(value =>
      stringValue(row(value)?.impact)?.toLowerCase(),
    );
    this.cache = {
      resources,
      summary: {
        generatedAt: observedAt,
        resources: {
          total: resources.length,
          available: count('available'),
          degraded: count('degraded'),
          unavailable: count('unavailable'),
          unknown: count('unknown'),
        },
        alerts: {
          active: alertRows.length,
          critical: severities.filter(value => value === 'sev0').length,
        },
        policy: {
          compliant: policyStates.filter(value => value === 'compliant').length,
          nonCompliant: policyStates.filter(value => value === 'noncompliant')
            .length,
          unknown: policyStates.filter(
            value => value !== 'compliant' && value !== 'noncompliant',
          ).length,
        },
        advisor: {
          total: advisorRows.length,
          highImpact: impacts.filter(value => value === 'high').length,
        },
        sources,
      },
    };
    this.hasSuccessfulRefresh = true;
  }

  private hasSuccessfulRefresh = false;
}
