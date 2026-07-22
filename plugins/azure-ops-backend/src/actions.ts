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

import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { PermissionsService } from '@backstage/backend-plugin-api';
import {
  AuthorizeResult,
  BasicPermission,
} from '@backstage/plugin-permission-common';
import {
  azureIncidentSeveritySchema,
  azureIncidentStatusSchema,
  azureOperationTemplateIds,
  azureOpsProposePermission,
  azureOpsReadPermission,
} from '@internal/backstage-plugin-azure-ops-common';
import { NotAllowedError } from '@backstage/errors';
import { AzureOpsReader } from './services/inventory';
import { PlanService } from './services/planning';
import { AzureOpsStore } from './services/store';

export function registerAzureOpsActions(options: {
  actionsRegistry: ActionsRegistryService;
  permissions: PermissionsService;
  reader: AzureOpsReader;
  plans: PlanService;
  store: AzureOpsStore;
}): void {
  const check = async (
    permission: BasicPermission,
    credentials: Parameters<PermissionsService['authorize']>[1]['credentials'],
  ) => {
    const [decision] = await options.permissions.authorize([{ permission }], {
      credentials,
    });
    if (decision.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError(`Permission '${permission.name}' is required`);
    }
  };

  options.actionsRegistry.register({
    name: 'summary',
    title: 'Read Azure operations summary',
    description:
      'Returns cached Azure inventory, health, alerts, policy, and Advisor counts with source freshness.',
    attributes: { destructive: false, readOnly: true, idempotent: true },
    schema: {
      input: z => z.object({}),
      output: z => z.object({ summary: z.unknown() }),
    },
    action: async ({ credentials }) => {
      await check(azureOpsReadPermission, credentials);
      return { output: { summary: options.reader.summary() } };
    },
  });

  options.actionsRegistry.register({
    name: 'list-incidents',
    title: 'List Azure Monitor incidents',
    description:
      'Lists normalized Azure Monitor incidents using bounded status and severity filters.',
    attributes: { destructive: false, readOnly: true, idempotent: true },
    schema: {
      input: z =>
        z.object({
          status: azureIncidentStatusSchema.optional(),
          severity: azureIncidentSeveritySchema.optional(),
          limit: z.number().int().min(1).max(200).default(100),
        }),
      output: z => z.object({ items: z.array(z.unknown()) }),
    },
    action: async ({ input, credentials }) => {
      await check(azureOpsReadPermission, credentials);
      return { output: { items: await options.store.listIncidents(input) } };
    },
  });

  options.actionsRegistry.register({
    name: 'list-resources',
    title: 'List Azure resources',
    description:
      'Lists cached allowlisted Azure resources using bounded filters.',
    attributes: { destructive: false, readOnly: true, idempotent: true },
    schema: {
      input: z =>
        z.object({
          subscription: z.string().uuid().optional(),
          type: z.string().max(200).optional(),
          health: z
            .enum(['available', 'degraded', 'unavailable', 'unknown'])
            .optional(),
          limit: z.number().int().min(1).max(500).default(100),
        }),
      output: z => z.object({ items: z.array(z.unknown()) }),
    },
    action: async ({ input, credentials }) => {
      await check(azureOpsReadPermission, credentials);
      return { output: { items: options.reader.resources(input) } };
    },
  });

  options.actionsRegistry.register({
    name: 'create-plan',
    title: 'Create deterministic Azure operation plan',
    description:
      'Creates and persists a deterministic plan for an allowlisted operation; it does not execute Azure writes.',
    attributes: { destructive: false, readOnly: false, idempotent: false },
    schema: {
      input: z =>
        z.object({
          templateId: z.enum(azureOperationTemplateIds),
          resourceId: z.string().min(1),
          parameters: z.record(z.unknown()).default({}),
        }),
      output: z => z.object({ plan: z.unknown() }),
    },
    action: async ({ input, credentials }) => {
      await check(azureOpsProposePermission, credentials);
      const principal = credentials.principal;
      if (
        typeof principal !== 'object' ||
        principal === null ||
        !('type' in principal) ||
        principal.type !== 'user' ||
        !('userEntityRef' in principal) ||
        typeof principal.userEntityRef !== 'string'
      ) {
        throw new NotAllowedError('Plan creation requires a user principal');
      }
      const plan = options.plans.create({
        ...input,
        requestedBy: principal.userEntityRef,
      });
      await options.store.savePlan(plan);
      return { output: { plan } };
    },
  });
}
