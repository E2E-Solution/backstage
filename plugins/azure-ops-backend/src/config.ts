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

import { RootConfigService } from '@backstage/backend-plugin-api';
import { readDurationFromConfig } from '@backstage/config';
import { durationToMilliseconds, HumanDuration } from '@backstage/types';
import { InputError } from '@backstage/errors';

const subscriptionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AzureOpsConfig {
  enabled: boolean;
  subscriptions: string[];
  refreshFrequency: HumanDuration;
  refreshTimeout: HumanDuration;
  resourceGraphMaxPages: number;
  planTtlMs: number;
  maxResourceCount: number;
  managedIdentityClientId?: string;
  servicePrincipal?: AzureServicePrincipalConfig;
  orchestratorEndpoint?: string;
  orchestratorAudience?: string;
  orchestratorManagedIdentityClientId?: string;
  azureMonitorAllowedSubjects: string[];
  orchestratorCallbackAllowedSubjects: string[];
  foundry?: {
    projectEndpoint: string;
    promptAgentName: string;
    managedIdentityClientId?: string;
  };
}

export interface AzureServicePrincipalConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

function readAllowedSubjects(
  root: ReturnType<RootConfigService['getOptionalConfig']>,
  key: string,
): string[] {
  const configured = root?.getOptionalStringArray(key);
  if (!configured) {
    return [];
  }
  if (configured.length < 1 || configured.length > 50) {
    throw new InputError(
      `azureOps.${key} must contain between 1 and 50 service subjects`,
    );
  }
  const normalized = configured.map(value => value.trim());
  if (
    normalized.some(value => value.length < 1 || value.length > 256) ||
    new Set(normalized).size !== normalized.length
  ) {
    throw new InputError(
      `azureOps.${key} must contain unique nonempty service subjects of at most 256 characters`,
    );
  }
  return normalized;
}

function readFoundryConfig(
  root: ReturnType<RootConfigService['getOptionalConfig']>,
) {
  const projectEndpoint = root
    ?.getOptionalString('foundry.projectEndpoint')
    ?.trim();
  const promptAgentName = root
    ?.getOptionalString('foundry.promptAgentName')
    ?.trim();
  if (Boolean(projectEndpoint) !== Boolean(promptAgentName)) {
    throw new InputError(
      'azureOps.foundry.projectEndpoint and azureOps.foundry.promptAgentName must be configured together',
    );
  }
  if (!projectEndpoint || !promptAgentName) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(projectEndpoint);
  } catch {
    throw new InputError(
      'azureOps.foundry.projectEndpoint must be a valid HTTPS Foundry project endpoint',
    );
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname.toLowerCase().endsWith('.services.ai.azure.com') ||
    !/^\/api\/projects\/[^/]+\/?$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new InputError(
      'azureOps.foundry.projectEndpoint must match https://<resource>.services.ai.azure.com/api/projects/<project>',
    );
  }

  return {
    projectEndpoint: url.toString().replace(/\/$/, ''),
    promptAgentName,
    managedIdentityClientId: root?.getOptionalString(
      'foundry.managedIdentityClientId',
    ),
  };
}

function readServicePrincipalConfig(
  root: ReturnType<RootConfigService['getOptionalConfig']>,
): AzureServicePrincipalConfig | undefined {
  const keys = ['tenantId', 'clientId', 'clientSecret'] as const;
  const configured = keys.map(
    key => root?.has(`servicePrincipal.${key}`) ?? false,
  );
  if (!configured.some(Boolean)) {
    return undefined;
  }
  if (!configured.every(Boolean)) {
    throw new InputError(
      'azureOps.servicePrincipal must define tenantId, clientId, and clientSecret together',
    );
  }

  const tenantId = root!.getString('servicePrincipal.tenantId').trim();
  const clientId = root!.getString('servicePrincipal.clientId').trim();
  const clientSecret = root!.getString('servicePrincipal.clientSecret').trim();
  if (!tenantId || !clientId || !clientSecret) {
    throw new InputError(
      'azureOps.servicePrincipal tenantId, clientId, and clientSecret must all be nonempty',
    );
  }
  if (!subscriptionPattern.test(tenantId)) {
    throw new InputError(
      'azureOps.servicePrincipal.tenantId must be a valid UUID',
    );
  }
  if (!subscriptionPattern.test(clientId)) {
    throw new InputError(
      'azureOps.servicePrincipal.clientId must be a valid UUID',
    );
  }
  return { tenantId, clientId, clientSecret };
}

function readOrchestratorConfig(
  root: ReturnType<RootConfigService['getOptionalConfig']>,
) {
  const endpoint = root?.getOptionalString('orchestrator.endpoint')?.trim();
  const audience = root?.getOptionalString('orchestrator.audience')?.trim();
  if (Boolean(endpoint) !== Boolean(audience)) {
    throw new InputError(
      'azureOps.orchestrator.endpoint and azureOps.orchestrator.audience must be configured together',
    );
  }
  if (!endpoint || !audience) {
    return undefined;
  }

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new InputError(
      'azureOps.orchestrator.endpoint must be a valid HTTPS URL',
    );
  }
  if (
    endpointUrl.protocol !== 'https:' ||
    endpointUrl.username ||
    endpointUrl.password ||
    endpointUrl.search ||
    endpointUrl.hash
  ) {
    throw new InputError(
      'azureOps.orchestrator.endpoint must be a valid HTTPS URL without credentials, query parameters, or fragments',
    );
  }

  let audienceUrl: URL;
  try {
    audienceUrl = new URL(audience);
  } catch {
    throw new InputError(
      'azureOps.orchestrator.audience must be a valid HTTPS or api application ID URI',
    );
  }
  if (
    !['https:', 'api:'].includes(audienceUrl.protocol) ||
    !audienceUrl.hostname ||
    audienceUrl.username ||
    audienceUrl.password ||
    audienceUrl.search ||
    audienceUrl.hash ||
    audience.endsWith('/.default')
  ) {
    throw new InputError(
      'azureOps.orchestrator.audience must be a valid HTTPS or api application ID URI without credentials, query parameters, fragments, or /.default',
    );
  }

  return {
    endpoint: endpointUrl.toString(),
    audience: audience.replace(/\/+$/, ''),
    managedIdentityClientId: root
      ?.getOptionalString('orchestrator.managedIdentityClientId')
      ?.trim(),
  };
}

export function readAzureOpsConfig(config: RootConfigService): AzureOpsConfig {
  const root = config.getOptionalConfig('azureOps');
  const subscriptions = root?.getOptionalStringArray('subscriptions') ?? [];
  const invalid = subscriptions.find(value => !subscriptionPattern.test(value));
  if (invalid) {
    throw new InputError(`Invalid Azure subscription ID '${invalid}'`);
  }
  const enabled = root?.getOptionalBoolean('enabled') ?? false;
  if (enabled && subscriptions.length === 0) {
    throw new InputError(
      'azureOps.enabled is true, but azureOps.subscriptions is empty',
    );
  }

  const refreshFrequency = root?.has('refresh.frequency')
    ? readDurationFromConfig(root, { key: 'refresh.frequency' })
    : { minutes: 5 };
  const refreshTimeout = root?.has('refresh.timeout')
    ? readDurationFromConfig(root, { key: 'refresh.timeout' })
    : { seconds: 45 };
  const planTtl = root?.has('plans.ttl')
    ? readDurationFromConfig(root, { key: 'plans.ttl' })
    : { minutes: 30 };
  const planTtlMs = durationToMilliseconds(planTtl);
  const maxResourceCount =
    root?.getOptionalNumber('plans.maxResourceCount') ?? 20;
  const resourceGraphMaxPages =
    root?.getOptionalNumber('refresh.maxPages') ?? 100;
  if (planTtlMs <= 0 || maxResourceCount < 1 || maxResourceCount > 100) {
    throw new InputError(
      'azureOps plan TTL must be positive and maxResourceCount must be between 1 and 100',
    );
  }
  if (
    !Number.isInteger(resourceGraphMaxPages) ||
    resourceGraphMaxPages < 1 ||
    resourceGraphMaxPages > 500
  ) {
    throw new InputError(
      'azureOps.refresh.maxPages must be an integer between 1 and 500',
    );
  }
  const orchestrator = readOrchestratorConfig(root);
  const azureMonitorAllowedSubjects = readAllowedSubjects(
    root,
    'ingress.azureMonitor.allowedSubjects',
  );
  const orchestratorCallbackAllowedSubjects = readAllowedSubjects(
    root,
    'orchestrator.callbackAllowedSubjects',
  );
  if (orchestrator && orchestratorCallbackAllowedSubjects.length === 0) {
    throw new InputError(
      'azureOps.orchestrator.callbackAllowedSubjects must be configured when the orchestrator endpoint is configured',
    );
  }

  return {
    enabled,
    subscriptions: subscriptions.map(value => value.toLowerCase()),
    refreshFrequency,
    refreshTimeout,
    resourceGraphMaxPages,
    planTtlMs,
    maxResourceCount,
    managedIdentityClientId: root?.getOptionalString(
      'managedIdentity.clientId',
    ),
    servicePrincipal: readServicePrincipalConfig(root),
    orchestratorEndpoint: orchestrator?.endpoint,
    orchestratorAudience: orchestrator?.audience,
    orchestratorManagedIdentityClientId: orchestrator?.managedIdentityClientId,
    azureMonitorAllowedSubjects,
    orchestratorCallbackAllowedSubjects,
    foundry: readFoundryConfig(root),
  };
}
