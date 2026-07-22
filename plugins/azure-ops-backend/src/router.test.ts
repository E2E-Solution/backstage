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
  LoggerService,
} from '@backstage/backend-plugin-api';
import {
  mockCredentials,
  mockErrorHandler,
  mockServices,
} from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { ConflictError } from '@backstage/errors';
import express from 'express';
import request from 'supertest';
import type {
  AzureIncident,
  AzureInventoryResource,
} from '@internal/backstage-plugin-azure-ops-common';
import type { NotificationService } from '@backstage/plugin-notifications-node';
import { createRouter } from './router';
import { AzureOpsStore } from './services/store';
import {
  FoundryAnalysisClient,
  FoundryAnalysisService,
} from './services/foundry';
import {
  OrchestratorDispatcher,
  OrchestratorDispatchError,
} from './services/dispatcher';
import { IncidentNotificationDeliveryService } from './services/notificationDelivery';

const reader = {
  refresh: jest.fn(),
  summary: jest.fn(() => ({
    generatedAt: '2026-07-21T00:00:00.000Z',
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
    sources: [],
  })),
  resources: jest.fn((): AzureInventoryResource[] => []),
};
const plans = {
  templates: jest.fn(() => []),
  create: jest.fn(),
};
const store = {} as AzureOpsStore;
const alertTarget =
  '/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/Ops/providers/Microsoft.Compute/virtualMachines/VM-1';

function commonAlert(monitorCondition: 'Fired' | 'Resolved' = 'Fired') {
  return {
    schemaId: 'azureMonitorCommonAlertSchema',
    data: {
      essentials: {
        alertId: 'alert-1',
        alertRule: 'VM unavailable',
        severity: 'Sev1',
        signalType: 'Metric',
        monitorCondition,
        monitoringService: 'Platform',
        alertTargetIDs: [alertTarget],
        firedDateTime: '2026-07-21T00:00:00.000Z',
        ...(monitorCondition === 'Resolved'
          ? { resolvedDateTime: '2026-07-21T00:03:00.000Z' }
          : {}),
        description: 'The VM is unavailable.',
      },
    },
  };
}

async function app(
  result: AuthorizeResult.ALLOW | AuthorizeResult.DENY,
  dispatcherConfigured = false,
  options?: {
    foundryClient?: FoundryAnalysisClient;
    store?: AzureOpsStore;
    credentials?: BackstageCredentials;
    logger?: LoggerService;
    notifications?: NotificationService;
    dispatcher?: OrchestratorDispatcher;
    enabled?: boolean;
    azureMonitorAllowedSubjects?: readonly string[];
    orchestratorCallbackAllowedSubjects?: readonly string[];
  },
) {
  const analysis = new FoundryAnalysisService({
    reader,
    client: options?.foundryClient,
  });
  const incidentStore = options?.store ?? store;
  const logger = options?.logger ?? mockServices.logger.mock();
  const notifications =
    options?.notifications ??
    ({ send: jest.fn() } satisfies NotificationService);
  const router = await createRouter({
    enabled: options?.enabled ?? true,
    httpAuth: mockServices.httpAuth({
      defaultCredentials:
        options?.credentials ?? mockCredentials.user('user:default/operator'),
    }),
    permissions: mockServices.permissions({ result }),
    reader,
    plans,
    store: incidentStore,
    dispatcher:
      options?.dispatcher ??
      ({
        configured: dispatcherConfigured,
        dispatch: jest
          .fn()
          .mockResolvedValue({ orchestrationId: 'orchestration-1' }),
      } satisfies OrchestratorDispatcher),
    analysis,
    notificationDelivery: new IncidentNotificationDeliveryService({
      store: incidentStore,
      logger,
      notifications,
    }),
    azureMonitorAllowedSubjects: options?.azureMonitorAllowedSubjects ?? [
      'external:azure-monitor-ingress',
    ],
    orchestratorCallbackAllowedSubjects:
      options?.orchestratorCallbackAllowedSubjects ?? [
        'external:azure-ops-orchestrator',
      ],
  });
  return express().use(router).use(mockErrorHandler());
}

describe('createRouter', () => {
  it('allows health but denies unauthorized reads', async () => {
    const server = await app(AuthorizeResult.DENY);
    const health = await request(server).get('/health');
    const summary = await request(server).get('/summary');
    const capabilities = await request(server).get('/capabilities');
    const analysis = await request(server)
      .post('/agent/analyze')
      .send({
        question: 'What is wrong?',
        resourceIds: [
          '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
        ],
      });
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok' });
    expect(summary.status).toBe(403);
    expect(capabilities.status).toBe(403);
    expect(analysis.status).toBe(403);
  });

  it('reports configured and unconfigured gated capabilities', async () => {
    const unconfigured = await app(AuthorizeResult.ALLOW);
    const configured = await app(AuthorizeResult.ALLOW, true, {
      foundryClient: { analyze: jest.fn() },
    });

    await expect(
      request(unconfigured).get('/capabilities'),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        foundryConfigured: false,
        orchestratorConfigured: false,
        writesRequireApproval: true,
      },
    });
    await expect(
      request(configured).get('/capabilities'),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        foundryConfigured: true,
        orchestratorConfigured: true,
        writesRequireApproval: true,
      },
    });
  });

  it('audits request and result metadata with the same correlation ID', async () => {
    reader.resources.mockReturnValue([
      {
        id: '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
        name: 'vm-1',
        type: 'microsoft.compute/virtualmachines',
        subscriptionId: '11111111-1111-1111-1111-111111111111',
        health: 'degraded',
        tags: {},
        observedAt: '2026-07-21T00:00:00.000Z',
      },
    ]);
    const recordAnalysisEvent = jest.fn();
    const auditStore = {
      recordAnalysisEvent,
    } as unknown as AzureOpsStore;
    const server = await app(AuthorizeResult.ALLOW, false, {
      store: auditStore,
      foundryClient: {
        analyze: jest.fn().mockResolvedValue(
          JSON.stringify({
            summary: 'The VM is degraded.',
            hypotheses: [
              {
                text: 'Resource health is degraded.',
                confidence: 0.9,
                evidenceIds: ['resource-1'],
              },
            ],
            suggestedTemplateIds: ['virtual-machine.restart'],
            warnings: [],
          }),
        ),
      },
    });

    const response = await request(server)
      .post('/agent/analyze')
      .set('x-correlation-id', 'analysis-test-1')
      .send({
        question: 'What is wrong?',
        resourceIds: [
          '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.correlationId).toBe('analysis-test-1');
    expect(recordAnalysisEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        phase: 'requested',
        correlationId: 'analysis-test-1',
        payload: expect.objectContaining({
          questionLength: 14,
          resourceCount: 1,
        }),
      }),
    );
    expect(recordAnalysisEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        phase: 'completed',
        correlationId: 'analysis-test-1',
        payload: expect.objectContaining({
          hypothesisCount: 1,
          suggestedTemplateIds: ['virtual-machine.restart'],
        }),
      }),
    );
    expect(JSON.stringify(recordAnalysisEvent.mock.calls)).not.toContain(
      'The VM is degraded',
    );
  });

  it('returns an explicit error before creating an execution without a dispatcher', async () => {
    const server = await app(AuthorizeResult.ALLOW);
    const response = await request(server).post(
      '/approvals/00000000-0000-4000-8000-000000000001/execute',
    );
    expect(response.status).toBe(503);
    expect(response.body.error.message).toMatch(/orchestrator endpoint/);
  });

  it('persists accepted orchestration IDs and marks ambiguous dispatch unknown', async () => {
    const execution = {
      id: '00000000-0000-4000-8000-000000000010',
      approvalId: '00000000-0000-4000-8000-000000000001',
      planHash: 'hash',
      correlationId: 'execution-1',
      status: 'dispatching' as const,
      queuedAt: '2026-07-21T00:00:00.000Z',
    };
    const markExecutionDispatched = jest.fn().mockResolvedValue({
      ...execution,
      status: 'running',
      orchestrationId: 'orchestration-1',
    });
    const markExecutionDispatchFailed = jest.fn();
    const createExecution = jest
      .fn()
      .mockResolvedValueOnce(execution)
      .mockRejectedValue(
        new ConflictError('The approval already has an execution'),
      );
    const executionStore = {
      getApproval: jest.fn().mockResolvedValue({ id: execution.approvalId }),
      createExecution,
      markExecutionDispatched,
      markExecutionDispatchFailed,
    } as unknown as AzureOpsStore;
    const dispatch = jest
      .fn()
      .mockResolvedValue({ orchestrationId: 'orchestration-1' });
    const accepted = await app(AuthorizeResult.ALLOW, true, {
      store: executionStore,
      dispatcher: {
        configured: true,
        dispatch,
      },
    });
    const acceptedResponse = await request(accepted).post(
      `/approvals/${execution.approvalId}/execute`,
    );
    expect(acceptedResponse.status).toBe(202);
    expect(acceptedResponse.body).toMatchObject({
      status: 'running',
      orchestrationId: 'orchestration-1',
    });
    expect(markExecutionDispatched).toHaveBeenCalledWith(
      execution.id,
      'orchestration-1',
    );
    await request(accepted)
      .post(`/approvals/${execution.approvalId}/execute`)
      .expect(409);
    expect(dispatch).toHaveBeenCalledTimes(1);

    createExecution.mockResolvedValueOnce(execution);
    const ambiguous = await app(AuthorizeResult.ALLOW, true, {
      store: executionStore,
      dispatcher: {
        configured: true,
        dispatch: jest
          .fn()
          .mockRejectedValue(
            new OrchestratorDispatchError(
              'Durable orchestrator dispatch outcome is unknown',
              'ambiguous',
            ),
          ),
      },
    });
    const ambiguousResponse = await request(ambiguous).post(
      `/approvals/${execution.approvalId}/execute`,
    );
    expect(ambiguousResponse.status).toBe(503);
    expect(markExecutionDispatchFailed).toHaveBeenCalledWith(
      execution.id,
      expect.stringContaining('outcome is unknown'),
      true,
    );
  });

  it('accepts bounded orchestrator callbacks only from service credentials', async () => {
    const applyOrchestratorEvent = jest.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000010',
      status: 'succeeded',
    });
    const callbackStore = {
      applyOrchestratorEvent,
    } as unknown as AzureOpsStore;
    const event = {
      executionId: '00000000-0000-4000-8000-000000000010',
      orchestrationId: 'orchestration-1',
      correlationId: 'execution-1',
      status: 'succeeded',
      message: 'Completed',
    };
    const userServer = await app(AuthorizeResult.ALLOW, false, {
      store: callbackStore,
      credentials: mockCredentials.user(),
    });
    await request(userServer)
      .post('/events/orchestrator')
      .send(event)
      .expect(403);
    expect(applyOrchestratorEvent).not.toHaveBeenCalled();

    const serviceServer = await app(AuthorizeResult.DENY, false, {
      store: callbackStore,
      credentials: mockCredentials.service('external:azure-ops-orchestrator'),
    });
    await request(serviceServer)
      .post('/events/orchestrator')
      .send(event)
      .expect(200);
    expect(applyOrchestratorEvent).toHaveBeenCalledWith({
      event,
      actor: 'external:azure-ops-orchestrator',
    });

    const monitorCredentialServer = await app(AuthorizeResult.DENY, false, {
      store: callbackStore,
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
    });
    await request(monitorCredentialServer)
      .post('/events/orchestrator')
      .send(event)
      .expect(403);

    const failClosedServer = await app(AuthorizeResult.DENY, false, {
      store: callbackStore,
      credentials: mockCredentials.service('external:azure-ops-orchestrator'),
      orchestratorCallbackAllowedSubjects: [],
    });
    await request(failClosedServer)
      .post('/events/orchestrator')
      .send(event)
      .expect(403);
  });

  it('rejects plan creation while Azure Ops is disabled', async () => {
    plans.create.mockClear();
    const server = await app(AuthorizeResult.ALLOW, false, { enabled: false });
    await request(server).post('/plans').send({}).expect(503);
    expect(plans.create).not.toHaveBeenCalled();
  });

  it('accepts Azure Monitor events only from service credentials', async () => {
    const upsertIncident = jest.fn(
      async (input: { incident: AzureIncident }) => ({
        incident: input.incident,
        change: 'created' as const,
      }),
    );
    const markIncidentNotificationDelivered = jest.fn();
    const claimPendingIncidentNotifications = jest.fn(
      async (input: { incidentId?: string }) => [
        {
          id: 'notification-1',
          type: 'fired' as const,
          incident: {
            id: input.incidentId ?? 'alert-1',
            alertRule: 'VM unavailable',
            severity: 'Sev1' as const,
            signalType: 'Metric',
            monitoringService: 'Platform',
            status: 'active' as const,
            firedAt: '2026-07-21T00:00:00.000Z',
            source: 'azure-monitor' as const,
            lastUpdated: '2026-07-21T00:00:00.000Z',
            affectedResourceIds: [alertTarget.toLowerCase()],
            summary: 'The VM is unavailable.',
          },
        },
      ],
    );
    const notifications = { send: jest.fn() };
    const incidentStore = {
      upsertIncident,
      claimPendingIncidentNotifications,
      hasPendingIncidentNotifications: jest.fn().mockResolvedValue(false),
      markIncidentNotificationDelivered,
      releaseIncidentNotification: jest.fn(),
    } as unknown as AzureOpsStore;
    const userServer = await app(AuthorizeResult.ALLOW, false, {
      store: incidentStore,
      credentials: mockCredentials.user('user:default/operator'),
      notifications,
    });
    const userResponse = await request(userServer)
      .post('/events/azure-monitor')
      .send(commonAlert());
    expect(userResponse.status).toBe(403);
    expect(upsertIncident).not.toHaveBeenCalled();

    const serviceServer = await app(AuthorizeResult.DENY, false, {
      store: incidentStore,
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
      notifications,
    });
    const serviceResponse = await request(serviceServer)
      .post('/events/azure-monitor')
      .set('x-correlation-id', 'monitor-1')
      .send(commonAlert());
    expect(serviceResponse.status).toBe(201);
    expect(serviceResponse.body).toMatchObject({
      change: 'created',
      notificationSent: true,
      incident: {
        status: 'active',
        affectedResourceIds: [
          '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
        ],
      },
    });
    expect(upsertIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'external:azure-monitor-ingress',
        correlationId: 'monitor-1',
      }),
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipients: { type: 'broadcast' },
        payload: expect.objectContaining({
          title: 'Sev1: VM unavailable',
          link: '/azure-ops/status',
        }),
      }),
    );
    expect(markIncidentNotificationDelivered).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notification-1' }),
    );

    const orchestratorCredentialServer = await app(
      AuthorizeResult.DENY,
      false,
      {
        store: incidentStore,
        credentials: mockCredentials.service('external:azure-ops-orchestrator'),
        notifications,
      },
    );
    await request(orchestratorCredentialServer)
      .post('/events/azure-monitor')
      .send(commonAlert())
      .expect(403);

    const failClosedServer = await app(AuthorizeResult.DENY, false, {
      store: incidentStore,
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
      azureMonitorAllowedSubjects: [],
      notifications,
    });
    await request(failClosedServer)
      .post('/events/azure-monitor')
      .send(commonAlert())
      .expect(403);
  });

  it('does not notify exact replay and notifies resolution', async () => {
    const notifications = { send: jest.fn() };
    const replayStore = {
      upsertIncident: jest
        .fn()
        .mockResolvedValueOnce({
          incident: { id: 'alert-1' },
          change: 'replay',
        })
        .mockResolvedValueOnce({
          incident: {
            id: 'alert-1',
            alertRule: 'VM unavailable',
            severity: 'Sev1',
            summary: 'Resolved',
            affectedResourceIds: [alertTarget],
          },
          change: 'updated',
        }),
      claimPendingIncidentNotifications: jest
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'notification-2',
            type: 'resolved',
            incident: {
              id: 'alert-1',
              alertRule: 'VM unavailable',
              severity: 'Sev1',
              signalType: 'Metric',
              monitoringService: 'Platform',
              status: 'resolved',
              firedAt: '2026-07-21T00:00:00.000Z',
              resolvedAt: '2026-07-21T00:03:00.000Z',
              summary: 'Resolved',
              affectedResourceIds: [alertTarget],
              source: 'azure-monitor',
              lastUpdated: '2026-07-21T00:03:00.000Z',
            },
          },
        ]),
      hasPendingIncidentNotifications: jest.fn().mockResolvedValue(false),
      markIncidentNotificationDelivered: jest.fn(),
      releaseIncidentNotification: jest.fn(),
    } as unknown as AzureOpsStore;
    const server = await app(AuthorizeResult.DENY, false, {
      store: replayStore,
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
      notifications,
    });

    expect(
      (await request(server).post('/events/azure-monitor').send(commonAlert()))
        .body,
    ).toMatchObject({ change: 'replay', notificationSent: false });
    expect(notifications.send).not.toHaveBeenCalled();

    await request(server)
      .post('/events/azure-monitor')
      .send(commonAlert('Resolved'))
      .expect(200);
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          title: 'Resolved: VM unavailable',
        }),
      }),
    );
  });

  it('returns a retryable failure when a replay notification is already leased', async () => {
    const notifications = { send: jest.fn() };
    const replayStore = {
      upsertIncident: jest.fn(async (input: { incident: AzureIncident }) => ({
        incident: input.incident,
        change: 'replay' as const,
      })),
      claimPendingIncidentNotifications: jest.fn().mockResolvedValue([]),
      hasPendingIncidentNotifications: jest.fn().mockResolvedValue(true),
      markIncidentNotificationDelivered: jest.fn(),
      releaseIncidentNotification: jest.fn(),
    } as unknown as AzureOpsStore;
    const server = await app(AuthorizeResult.DENY, false, {
      store: replayStore,
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
      notifications,
    });

    const response = await request(server)
      .post('/events/azure-monitor')
      .send(commonAlert());
    expect(response.status).toBe(503);
    expect(response.body.error.message).toMatch(/pending or leased/);
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('retries pending notification delivery and suppresses it after success', async () => {
    const logger = mockServices.logger.mock();
    let delivered = false;
    const incidentStore = {
      upsertIncident: jest.fn(async (input: { incident: AzureIncident }) => {
        return {
          incident: input.incident,
          change: 'replay' as const,
        };
      }),
      claimPendingIncidentNotifications: jest.fn(
        async (input: { incidentId?: string }) =>
          delivered
            ? []
            : [
                {
                  id: 'notification-1',
                  type: 'fired' as const,
                  incident: {
                    id: input.incidentId ?? 'alert-1',
                    alertRule: 'VM unavailable',
                    severity: 'Sev1',
                    signalType: 'Metric',
                    monitoringService: 'Platform',
                    status: 'active' as const,
                    firedAt: '2026-07-21T00:00:00.000Z',
                    affectedResourceIds: [alertTarget],
                    summary: 'The VM is unavailable.',
                    source: 'azure-monitor' as const,
                    lastUpdated: '2026-07-21T00:00:00.000Z',
                  },
                },
              ],
      ),
      hasPendingIncidentNotifications: jest.fn(async () => !delivered),
      markIncidentNotificationDelivered: jest.fn(async () => {
        delivered = true;
      }),
      releaseIncidentNotification: jest.fn(),
    } as unknown as AzureOpsStore;
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('notifications offline'))
      .mockResolvedValue(undefined);
    const server = await app(AuthorizeResult.DENY, false, {
      store: incidentStore,
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
      logger,
      notifications: { send },
    });

    const response = await request(server)
      .post('/events/azure-monitor')
      .send(commonAlert());
    expect(response.status).toBe(503);
    expect(response.body.error.message).toMatch(/incident was persisted/);
    expect(incidentStore.upsertIncident).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('delivery failed'),
      expect.any(Error),
    );

    const recovered = await request(server)
      .post('/events/azure-monitor')
      .send(commonAlert());
    expect(recovered.status).toBe(200);
    expect(recovered.body.notificationSent).toBe(true);

    const replay = await request(server)
      .post('/events/azure-monitor')
      .send(commonAlert());
    expect(replay.status).toBe(200);
    expect(replay.body.notificationSent).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed alert payloads and target IDs explicitly', async () => {
    const server = await app(AuthorizeResult.DENY, false, {
      credentials: mockCredentials.service('external:azure-monitor-ingress'),
    });
    const wrongSchema = await request(server)
      .post('/events/azure-monitor')
      .send({ ...commonAlert(), schemaId: 'wrong' });
    expect(wrongSchema.status).toBe(400);

    const malformedTarget = commonAlert();
    malformedTarget.data.essentials.alertTargetIDs = ['/invalid'];
    const malformed = await request(server)
      .post('/events/azure-monitor')
      .send(malformedTarget);
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.message).toMatch(/Malformed Azure Monitor/);
  });

  it('bounds incident list filters and applies azureOps.read', async () => {
    const listIncidents = jest.fn().mockResolvedValue([]);
    const incidentStore = { listIncidents } as unknown as AzureOpsStore;
    const server = await app(AuthorizeResult.ALLOW, false, {
      store: incidentStore,
    });
    await request(server)
      .get('/incidents?status=active&severity=Sev0&limit=20')
      .expect(200);
    expect(listIncidents).toHaveBeenCalledWith({
      status: 'active',
      severity: 'Sev0',
      limit: 20,
    });
    await request(server).get('/incidents?limit=201').expect(400);
    expect(listIncidents).toHaveBeenCalledTimes(1);

    const denied = await app(AuthorizeResult.DENY, false, {
      store: incidentStore,
    });
    await request(denied).get('/incidents').expect(403);
  });
});
