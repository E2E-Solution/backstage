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

import { createHash, randomUUID } from 'node:crypto';
import { InputError } from '@backstage/errors';
import {
  AzureOperationPlan,
  AzureOperationRisk,
  AzureOperationTemplateId,
  azureOperationTemplateIds,
  parseAzureResourceId,
} from '@internal/backstage-plugin-azure-ops-common';
import { z } from 'zod/v3';

interface OperationDefinition {
  title: string;
  resourceTypes: string[];
  risk: AzureOperationRisk;
  action: string;
  expectedState: string;
  preconditions: string[];
  rollback: string;
  parameters: z.ZodType<Record<string, unknown>>;
}

const none = z.object({}).strict();
const nodeCount = z
  .object({
    nodePoolName: z.string().min(1).max(63),
    count: z.number().int().min(0).max(1000),
  })
  .strict();
const deployment = z
  .object({
    namespace: z.string().min(1).max(63),
    deployment: z.string().min(1).max(253),
  })
  .strict();
const deploymentScale = deployment
  .extend({ replicas: z.number().int().min(0).max(1000) })
  .strict();
const revision = z
  .object({ revisionName: z.string().min(1).max(128) })
  .strict();
const traffic = z
  .object({
    weights: z
      .record(z.number().int().min(0).max(100))
      .refine(
        weights =>
          Object.values(weights).reduce((sum, value) => sum + value, 0) === 100,
        'Traffic weights must total 100',
      ),
  })
  .strict();
const scale = z
  .object({
    minReplicas: z.number().int().min(0).max(300),
    maxReplicas: z.number().int().min(1).max(300),
  })
  .strict()
  .refine(value => value.minReplicas <= value.maxReplicas, {
    message: 'minReplicas must not exceed maxReplicas',
  });
const remediation = z
  .object({
    assignmentId: z.string().min(1),
    locationFilters: z.array(z.string()).max(20).optional(),
  })
  .strict();

const vm = ['microsoft.compute/virtualmachines'];
const web = ['microsoft.web/sites'];
const aks = ['microsoft.containerservice/managedclusters'];
const containerApp = ['microsoft.app/containerapps'];

function definition(
  title: string,
  resourceTypes: string[],
  risk: AzureOperationRisk,
  action: string,
  expectedState: string,
  rollback: string,
  parameters: z.ZodType<Record<string, unknown>> = none,
): OperationDefinition {
  return {
    title,
    resourceTypes,
    risk,
    action,
    expectedState,
    parameters,
    preconditions: [
      'The target resource still exists and its type matches this template.',
      'The approved plan hash and target resource ID are unchanged.',
      'The durable orchestrator revalidates Azure authorization and current resource state.',
    ],
    rollback,
  };
}

export const operationDefinitions: Record<
  AzureOperationTemplateId,
  OperationDefinition
> = {
  'virtual-machine.start': definition(
    'Start virtual machine',
    vm,
    'medium',
    'start',
    'running',
    'Deallocate the virtual machine if startup causes an incident.',
  ),
  'virtual-machine.restart': definition(
    'Restart virtual machine',
    vm,
    'high',
    'restart',
    'running',
    'No direct rollback; restore service using the documented workload recovery procedure.',
  ),
  'virtual-machine.deallocate': definition(
    'Deallocate virtual machine',
    vm,
    'high',
    'deallocate',
    'deallocated',
    'Start the virtual machine.',
  ),
  'app-service.start': definition(
    'Start App Service',
    web,
    'medium',
    'start',
    'running',
    'Stop the App Service.',
  ),
  'app-service.stop': definition(
    'Stop App Service',
    web,
    'high',
    'stop',
    'stopped',
    'Start the App Service.',
  ),
  'app-service.restart': definition(
    'Restart App Service',
    web,
    'high',
    'restart',
    'running',
    'No direct rollback; redeploy or restore the previous known-good release.',
  ),
  'function-app.start': definition(
    'Start function app',
    web,
    'medium',
    'start',
    'running',
    'Stop the function app.',
  ),
  'function-app.stop': definition(
    'Stop function app',
    web,
    'high',
    'stop',
    'stopped',
    'Start the function app.',
  ),
  'function-app.restart': definition(
    'Restart function app',
    web,
    'high',
    'restart',
    'running',
    'No direct rollback; redeploy or restore the previous known-good release.',
  ),
  'logic-app.trigger.enable': definition(
    'Enable Logic App trigger',
    ['microsoft.logic/workflows/triggers'],
    'medium',
    'enable-trigger',
    'enabled',
    'Disable the trigger.',
  ),
  'logic-app.trigger.disable': definition(
    'Disable Logic App trigger',
    ['microsoft.logic/workflows/triggers'],
    'high',
    'disable-trigger',
    'disabled',
    'Enable the trigger.',
  ),
  'aks.cluster.start': definition(
    'Start AKS cluster',
    aks,
    'high',
    'start',
    'running',
    'Stop the AKS cluster if startup causes an incident.',
  ),
  'aks.cluster.stop': definition(
    'Stop AKS cluster',
    aks,
    'critical',
    'stop',
    'stopped',
    'Start the AKS cluster.',
  ),
  'aks.node-pool.scale': definition(
    'Scale AKS node pool',
    aks,
    'high',
    'scale-node-pool',
    'requested node count',
    'Scale the node pool to its recorded previous count.',
    nodeCount,
  ),
  'kubernetes.deployment.restart': definition(
    'Restart Kubernetes deployment',
    aks,
    'high',
    'restart-deployment',
    'rollout complete',
    'Roll back the deployment revision.',
    deployment,
  ),
  'kubernetes.deployment.scale': definition(
    'Scale Kubernetes deployment',
    aks,
    'high',
    'scale-deployment',
    'requested replica count',
    'Scale the deployment to its recorded previous replica count.',
    deploymentScale,
  ),
  'container-app.revision.activate': definition(
    'Activate Container App revision',
    containerApp,
    'medium',
    'activate-revision',
    'active',
    'Deactivate the revision and restore the previous active revision.',
    revision,
  ),
  'container-app.traffic.update': definition(
    'Update Container App traffic',
    containerApp,
    'high',
    'update-traffic',
    'requested traffic weights',
    'Restore the recorded previous traffic weights.',
    traffic,
  ),
  'container-app.scale.update': definition(
    'Update Container App scale',
    containerApp,
    'high',
    'update-scale',
    'requested scale bounds',
    'Restore the recorded previous scale bounds.',
    scale,
  ),
  'policy.remediation.create': definition(
    'Create policy remediation',
    ['microsoft.authorization/policyassignments'],
    'critical',
    'create-remediation',
    'remediation queued',
    'Stop the remediation task and review resources already changed.',
    remediation,
  ),
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

export function calculatePlanHash(plan: AzureOperationPlan): string {
  const payload = {
    templateId: plan.templateId,
    templateVersion: plan.templateVersion,
    resourceId: plan.resourceId,
    requestedBy: plan.requestedBy,
    risk: plan.risk,
    parameters: plan.parameters,
    preconditions: plan.preconditions,
    steps: plan.steps,
    rollback: plan.rollback,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    observedResourceVersion: plan.observedResourceVersion,
  };
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}

export interface PlanService {
  templates(): Array<{
    id: AzureOperationTemplateId;
    title: string;
    risk: AzureOperationRisk;
    resourceTypes: string[];
  }>;
  create(input: {
    templateId: AzureOperationTemplateId;
    resourceId: string;
    parameters: Record<string, unknown>;
    requestedBy: string;
    observedResourceVersion?: string;
  }): AzureOperationPlan;
}

export class DeterministicPlanService implements PlanService {
  constructor(
    private readonly options: {
      enabled?: boolean;
      subscriptions: string[];
      ttlMs: number;
      now?: () => Date;
    },
  ) {}

  templates() {
    return azureOperationTemplateIds.map(id => ({
      id,
      title: operationDefinitions[id].title,
      risk: operationDefinitions[id].risk,
      resourceTypes: operationDefinitions[id].resourceTypes,
    }));
  }

  create(input: {
    templateId: AzureOperationTemplateId;
    resourceId: string;
    parameters: Record<string, unknown>;
    requestedBy: string;
    observedResourceVersion?: string;
  }): AzureOperationPlan {
    if (this.options.enabled === false) {
      throw new InputError('Azure Ops is disabled');
    }
    if (this.options.subscriptions.length === 0) {
      throw new InputError('No Azure subscriptions are allowlisted');
    }
    const resource = parseAzureResourceId(input.resourceId);
    if (
      !resource ||
      resource.scopeType !== 'resource' ||
      !resource.resourceType
    ) {
      throw new InputError('A valid Azure resource ID is required');
    }
    if (!this.options.subscriptions.includes(resource.subscriptionId)) {
      throw new InputError('The target subscription is not allowlisted');
    }
    const template = operationDefinitions[input.templateId];
    if (!template.resourceTypes.includes(resource.resourceType)) {
      throw new InputError(
        `Template '${
          input.templateId
        }' requires resource type ${template.resourceTypes.join(
          ' or ',
        )}, received '${resource.resourceType}'`,
      );
    }
    const parameters = template.parameters.safeParse(input.parameters);
    if (!parameters.success) {
      throw new InputError(parameters.error.message);
    }
    let canonicalParameters = parameters.data;
    if (input.templateId === 'policy.remediation.create') {
      const assignmentId = canonicalParameters.assignmentId;
      const assignment =
        typeof assignmentId === 'string'
          ? parseAzureResourceId(assignmentId)
          : undefined;
      if (
        !assignment ||
        assignment.scopeType !== 'resource' ||
        assignment.resourceType !== 'microsoft.authorization/policyassignments'
      ) {
        throw new InputError(
          'Policy remediation assignmentId must be a valid Microsoft.Authorization/policyAssignments resource ID',
        );
      }
      if (!this.options.subscriptions.includes(assignment.subscriptionId)) {
        throw new InputError(
          'The policy assignment subscription is not allowlisted',
        );
      }
      if (assignment.id !== resource.id) {
        throw new InputError(
          'Policy remediation assignmentId must match the target resource ID',
        );
      }
      canonicalParameters = {
        ...canonicalParameters,
        assignmentId: assignment.id,
      };
    }
    const now = (this.options.now ?? (() => new Date()))();
    const plan: AzureOperationPlan = {
      id: randomUUID(),
      templateId: input.templateId,
      templateVersion: 1,
      resourceId: resource.id,
      requestedBy: input.requestedBy,
      risk: template.risk,
      parameters: canonicalParameters,
      preconditions: template.preconditions,
      steps: [
        {
          sequence: 1,
          action: template.action,
          resourceId: resource.id,
          description: template.title,
          expectedState: template.expectedState,
        },
      ],
      rollback: template.rollback,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.options.ttlMs).toISOString(),
      observedResourceVersion: input.observedResourceVersion,
      hash: '',
    };
    plan.hash = calculatePlanHash(plan);
    return plan;
  }
}
