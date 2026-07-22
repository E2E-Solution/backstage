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
  BackstageCredentials,
  HttpAuthService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import {
  InputError,
  NotAllowedError,
  ServiceUnavailableError,
} from '@backstage/errors';
import {
  AzureOperationalHealth,
  azureOrchestratorEventSchema,
  azureIncidentSeveritySchema,
  azureIncidentStatusSchema,
  azureAnalysisRequestSchema,
  azureMonitorCommonAlertSchema,
  azureOperationPlanRequestSchema,
  azureOpsApprovePermission,
  azureOpsAuditPermission,
  azureOpsCancelPermission,
  azureOpsExecutePermission,
  azureOpsProposePermission,
  azureOpsReadPermission,
  azureOpsRequestApprovalPermission,
} from '@internal/backstage-plugin-azure-ops-common';
import {
  AuthorizeResult,
  BasicPermission,
} from '@backstage/plugin-permission-common';
import express from 'express';
import Router from 'express-promise-router';
import { randomUUID } from 'node:crypto';
import { z } from 'zod/v3';
import { AzureOpsReader } from './services/inventory';
import {
  OrchestratorDispatcher,
  OrchestratorDispatchError,
} from './services/dispatcher';
import { PlanService } from './services/planning';
import { AzureOpsStore } from './services/store';
import { FoundryAnalysisService } from './services/foundry';
import { normalizeAzureMonitorIncident } from './services/incidents';
import { IncidentNotificationDeliveryService } from './services/notificationDelivery';

const resourcesQuerySchema = z.object({
  subscription: z.string().uuid().optional(),
  type: z.string().min(1).max(200).optional(),
  health: z
    .enum(['available', 'degraded', 'unavailable', 'unknown'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
const incidentsQuerySchema = z
  .object({
    status: azureIncidentStatusSchema.optional(),
    severity: azureIncidentSeveritySchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();
const approvalRequestSchema = z.object({
  planId: z.string().uuid(),
});
const decisionSchema = z.object({
  reason: z.string().trim().min(1).max(1000).optional(),
});
const correlationPattern = /^[a-zA-Z0-9._:-]{1,128}$/;

function parse<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new InputError(result.error.message);
  }
  return result.data;
}

function actor(credentials: BackstageCredentials): string {
  const principal = credentials.principal;
  if (
    typeof principal === 'object' &&
    principal !== null &&
    'type' in principal &&
    principal.type === 'user' &&
    'userEntityRef' in principal &&
    typeof principal.userEntityRef === 'string'
  ) {
    return principal.userEntityRef;
  }
  throw new NotAllowedError('Azure Ops write routes require a user principal');
}

function serviceActor(
  credentials: BackstageCredentials,
  allowedSubjects: readonly string[],
  endpoint: string,
): string {
  const principal = credentials.principal;
  if (
    typeof principal === 'object' &&
    principal !== null &&
    'type' in principal &&
    principal.type === 'service' &&
    'subject' in principal &&
    typeof principal.subject === 'string'
  ) {
    if (allowedSubjects.includes(principal.subject)) {
      return principal.subject;
    }
    throw new NotAllowedError(
      `The service principal is not allowed to call the Azure Ops ${endpoint} endpoint`,
    );
  }
  throw new NotAllowedError(
    'Azure Ops event ingestion requires a service principal',
  );
}

function correlationId(req: express.Request): string {
  const value = req.header('x-correlation-id');
  return value && correlationPattern.test(value) ? value : randomUUID();
}

export async function createRouter(options: {
  enabled: boolean;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  reader: AzureOpsReader;
  plans: PlanService;
  store: AzureOpsStore;
  dispatcher: OrchestratorDispatcher;
  analysis: FoundryAnalysisService;
  notificationDelivery: IncidentNotificationDeliveryService;
  azureMonitorAllowedSubjects: readonly string[];
  orchestratorCallbackAllowedSubjects: readonly string[];
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json({ limit: '32kb' }));

  const authorize = async (
    req: express.Request,
    permission: BasicPermission,
  ) => {
    const credentials = await options.httpAuth.credentials(req, {
      allow: ['user', 'service'],
    });
    const [decision] = await options.permissions.authorize([{ permission }], {
      credentials,
    });
    if (decision.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError(`Permission '${permission.name}' is required`);
    }
    return credentials;
  };

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/summary', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    res.json(options.reader.summary());
  });

  router.get('/capabilities', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    res.json({
      foundryConfigured: options.analysis.configured,
      orchestratorConfigured: options.dispatcher.configured,
      writesRequireApproval: true,
    });
  });

  router.get('/resources', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    const filters = parse(resourcesQuerySchema, req.query);
    res.json({
      items: options.reader.resources({
        ...filters,
        health: filters.health as AzureOperationalHealth | undefined,
      }),
    });
  });

  router.post('/events/azure-monitor', async (req, res) => {
    const credentials = await options.httpAuth.credentials(req, {
      allow: ['service'],
    });
    const input = parse(azureMonitorCommonAlertSchema, req.body);
    const incident = normalizeAzureMonitorIncident(input);
    const eventActor = serviceActor(
      credentials,
      options.azureMonitorAllowedSubjects,
      'Azure Monitor ingress',
    );
    const eventCorrelationId = correlationId(req);
    const result = await options.store.upsertIncident({
      incident,
      actor: eventActor,
      correlationId: eventCorrelationId,
    });

    const delivery = await options.notificationDelivery.deliverForIncident({
      incidentId: result.incident.id,
      actor: eventActor,
      correlationId: eventCorrelationId,
    });

    res.status(result.change === 'created' ? 201 : 200).json({
      incident: result.incident,
      change: result.change,
      notificationSent: delivery.delivered > 0,
    });
  });

  router.post('/events/orchestrator', async (req, res) => {
    const credentials = await options.httpAuth.credentials(req, {
      allow: ['service'],
    });
    const event = parse(azureOrchestratorEventSchema, req.body);
    res.json(
      await options.store.applyOrchestratorEvent({
        event,
        actor: serviceActor(
          credentials,
          options.orchestratorCallbackAllowedSubjects,
          'orchestrator callback',
        ),
      }),
    );
  });

  router.get('/incidents', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    const filters = parse(incidentsQuerySchema, req.query);
    res.json({ items: await options.store.listIncidents(filters) });
  });

  router.get('/operations/templates', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    res.json({ items: options.plans.templates() });
  });

  router.post('/plans', async (req, res) => {
    const credentials = await authorize(req, azureOpsProposePermission);
    if (!options.enabled) {
      throw new ServiceUnavailableError('Azure Ops is disabled');
    }
    const input = parse(azureOperationPlanRequestSchema, req.body);
    const plan = options.plans.create({
      ...input,
      requestedBy: actor(credentials),
    });
    await options.store.savePlan(plan, correlationId(req));
    res.status(201).json(plan);
  });

  router.post('/agent/analyze', async (req, res) => {
    const credentials = await authorize(req, azureOpsProposePermission);
    if (!options.enabled) {
      throw new ServiceUnavailableError('Azure Ops is disabled');
    }
    const input = parse(azureAnalysisRequestSchema, req.body);
    const requestActor = actor(credentials);
    const requestCorrelationId = correlationId(req);
    res.setHeader('x-correlation-id', requestCorrelationId);
    await options.store.recordAnalysisEvent({
      phase: 'requested',
      actor: requestActor,
      correlationId: requestCorrelationId,
      payload: {
        resourceIds: input.resourceIds,
        resourceCount: input.resourceIds.length,
        questionLength: input.question.length,
      },
    });
    try {
      const result = await options.analysis.analyze(input);
      await options.store.recordAnalysisEvent({
        phase: 'completed',
        actor: requestActor,
        correlationId: requestCorrelationId,
        payload: {
          evidenceBundleId: result.evidence.id,
          evidenceIds: result.evidence.items.map(item => item.id),
          hypothesisCount: result.recommendation.hypotheses.length,
          suggestedTemplateIds: result.recommendation.suggestedTemplateIds,
          warningCount: result.recommendation.warnings.length,
        },
      });
      res.json({ correlationId: requestCorrelationId, ...result });
    } catch (error) {
      await options.store.recordAnalysisEvent({
        phase: 'failed',
        actor: requestActor,
        correlationId: requestCorrelationId,
        payload: {
          resourceCount: input.resourceIds.length,
          errorType: error instanceof Error ? error.name : 'Error',
        },
      });
      throw error;
    }
  });

  router.post('/approvals', async (req, res) => {
    const credentials = await authorize(req, azureOpsRequestApprovalPermission);
    if (!options.enabled) {
      throw new ServiceUnavailableError('Azure Ops is disabled');
    }
    const input = parse(approvalRequestSchema, req.body);
    const approval = await options.store.createApproval({
      planId: input.planId,
      actor: actor(credentials),
      correlationId: correlationId(req),
    });
    res.status(201).json(approval);
  });

  router.get('/approvals', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    res.json({ items: await options.store.listApprovals() });
  });

  const decisionRoute = (
    path: string,
    permission: BasicPermission,
    decision: 'approved' | 'rejected' | 'canceled',
  ) => {
    router.post(path, async (req, res) => {
      const credentials = await authorize(req, permission);
      if (!options.enabled) {
        throw new ServiceUnavailableError('Azure Ops is disabled');
      }
      const input = parse(decisionSchema, req.body);
      res.json(
        await options.store.decide({
          id: req.params.id,
          actor: actor(credentials),
          decision,
          reason: input.reason,
          correlationId: correlationId(req),
        }),
      );
    });
  };
  decisionRoute(
    '/approvals/:id/approve',
    azureOpsApprovePermission,
    'approved',
  );
  decisionRoute('/approvals/:id/reject', azureOpsApprovePermission, 'rejected');
  decisionRoute('/approvals/:id/cancel', azureOpsCancelPermission, 'canceled');

  router.post('/approvals/:id/execute', async (req, res) => {
    const credentials = await authorize(req, azureOpsExecutePermission);
    if (!options.enabled) {
      throw new ServiceUnavailableError('Azure Ops is disabled');
    }
    if (!options.dispatcher.configured) {
      throw new ServiceUnavailableError(
        'No durable Azure Ops orchestrator endpoint is configured',
      );
    }
    const approval = await options.store.getApproval(req.params.id);
    const execution = await options.store.createExecution({
      approvalId: req.params.id,
      actor: actor(credentials),
      correlationId: correlationId(req),
    });
    let accepted;
    try {
      accepted = await options.dispatcher.dispatch(execution, approval);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await options.store.markExecutionDispatchFailed(
        execution.id,
        message.slice(0, 2000),
        !(error instanceof OrchestratorDispatchError) ||
          error.outcome === 'ambiguous',
      );
      throw error;
    }
    const running = await options.store.markExecutionDispatched(
      execution.id,
      accepted.orchestrationId,
    );
    res.status(202).json(running);
  });

  router.get('/executions', async (req, res) => {
    await authorize(req, azureOpsReadPermission);
    res.json({ items: await options.store.listExecutions() });
  });

  router.get('/audit', async (req, res) => {
    await authorize(req, azureOpsAuditPermission);
    res.json({ items: await options.store.listAudit() });
  });

  return router;
}
