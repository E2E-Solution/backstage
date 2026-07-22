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

import { TestDatabases } from '@backstage/backend-test-utils';
import { mockServices } from '@backstage/backend-test-utils';
import { DeterministicPlanService } from './planning';
import { AzureOpsStore } from './store';

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });
const subscription = '11111111-1111-1111-1111-111111111111';
const resourceId = `/subscriptions/${subscription}/resourceGroups/demo/providers/Microsoft.Compute/virtualMachines/vm1`;

describe('AzureOpsStore', () => {
  it('enforces approval transitions, self-approval, and expiry', async () => {
    let now = new Date('2026-07-21T00:00:00.000Z');
    const knex = await databases.init('SQLITE_3');
    const store = await AzureOpsStore.create({
      database: mockServices.database({
        knex,
        migrations: { skip: false },
      }),
      now: () => now,
    });
    const plan = new DeterministicPlanService({
      subscriptions: [subscription],
      ttlMs: 60_000,
      now: () => now,
    }).create({
      templateId: 'virtual-machine.start',
      resourceId,
      parameters: {},
      requestedBy: 'user:default/alice',
    });
    await store.savePlan(plan);
    const approval = await store.createApproval({
      planId: plan.id,
      actor: 'user:default/alice',
    });
    await expect(
      store.decide({
        id: approval.id,
        actor: 'user:default/alice',
        decision: 'approved',
      }),
    ).rejects.toThrow(/cannot approve their own/);
    await expect(
      store.decide({
        id: approval.id,
        actor: 'user:default/bob',
        decision: 'approved',
      }),
    ).resolves.toMatchObject({ status: 'approved' });
    await expect(
      store.decide({
        id: approval.id,
        actor: 'user:default/bob',
        decision: 'rejected',
      }),
    ).rejects.toThrow(/Cannot transition/);

    const expiringPlan = {
      ...plan,
      id: '00000000-0000-4000-8000-000000000001',
    };
    await store.savePlan(expiringPlan);
    const expiringApproval = await store.createApproval({
      planId: expiringPlan.id,
      actor: 'user:default/alice',
    });
    now = new Date('2026-07-21T00:02:00.000Z');
    await expect(
      store.decide({
        id: expiringApproval.id,
        actor: 'user:default/bob',
        decision: 'approved',
      }),
    ).rejects.toThrow(/expired/);
  });

  it('serializes approval decisions and enforces one approval and execution', async () => {
    const now = new Date('2026-07-21T00:00:00.000Z');
    const knex = await databases.init('SQLITE_3');
    const store = await AzureOpsStore.create({
      database: mockServices.database({
        knex,
        migrations: { skip: false },
      }),
      now: () => now,
    });
    const plan = new DeterministicPlanService({
      enabled: true,
      subscriptions: [subscription],
      ttlMs: 60_000,
      now: () => now,
    }).create({
      templateId: 'virtual-machine.start',
      resourceId,
      parameters: {},
      requestedBy: 'user:default/alice',
    });
    await store.savePlan(plan);

    const approvals = await Promise.allSettled([
      store.createApproval({
        planId: plan.id,
        actor: 'user:default/alice',
      }),
      store.createApproval({
        planId: plan.id,
        actor: 'user:default/alice',
      }),
    ]);
    expect(
      approvals.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      approvals.filter(result => result.status === 'rejected'),
    ).toHaveLength(1);
    const approval = (
      approvals.find(
        result => result.status === 'fulfilled',
      ) as PromiseFulfilledResult<
        Awaited<ReturnType<typeof store.createApproval>>
      >
    ).value;

    const decisions = await Promise.allSettled([
      store.decide({
        id: approval.id,
        actor: 'user:default/bob',
        decision: 'approved',
      }),
      store.decide({
        id: approval.id,
        actor: 'user:default/charlie',
        decision: 'rejected',
      }),
    ]);
    expect(
      decisions.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      decisions.filter(result => result.status === 'rejected'),
    ).toHaveLength(1);

    const executionPlan = {
      ...plan,
      id: '00000000-0000-4000-8000-000000000004',
    };
    await store.savePlan(executionPlan);
    const executionApproval = await store.createApproval({
      planId: executionPlan.id,
      actor: 'user:default/alice',
    });
    await store.decide({
      id: executionApproval.id,
      actor: 'user:default/bob',
      decision: 'approved',
    });
    const executions = await Promise.allSettled([
      store.createExecution({
        approvalId: executionApproval.id,
        actor: 'user:default/operator',
        correlationId: 'execution-1',
      }),
      store.createExecution({
        approvalId: executionApproval.id,
        actor: 'user:default/operator',
        correlationId: 'execution-2',
      }),
    ]);
    expect(
      executions.filter(result => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      executions.filter(result => result.status === 'rejected'),
    ).toHaveLength(1);
    await expect(
      store.decide({
        id: executionApproval.id,
        actor: 'user:default/alice',
        decision: 'canceled',
      }),
    ).rejects.toThrow(/after execution/);
  });

  it('persists orchestration IDs and guards callback state transitions', async () => {
    const now = new Date('2026-07-21T00:00:00.000Z');
    const knex = await databases.init('SQLITE_3');
    const store = await AzureOpsStore.create({
      database: mockServices.database({
        knex,
        migrations: { skip: false },
      }),
      now: () => now,
    });
    const plan = new DeterministicPlanService({
      subscriptions: [subscription],
      ttlMs: 60_000,
      now: () => now,
    }).create({
      templateId: 'virtual-machine.start',
      resourceId,
      parameters: {},
      requestedBy: 'user:default/alice',
    });
    await store.savePlan(plan);
    const approval = await store.createApproval({
      planId: plan.id,
      actor: 'user:default/alice',
    });
    await store.decide({
      id: approval.id,
      actor: 'user:default/bob',
      decision: 'approved',
    });
    const dispatching = await store.createExecution({
      approvalId: approval.id,
      actor: 'user:default/operator',
      correlationId: 'execution-correlation',
    });
    const running = await store.markExecutionDispatched(
      dispatching.id,
      'orchestration-1',
    );
    expect(running).toMatchObject({
      status: 'running',
      orchestrationId: 'orchestration-1',
    });
    await expect(store.getExecution(dispatching.id)).resolves.toMatchObject({
      status: 'running',
      orchestrationId: 'orchestration-1',
    });

    const event = {
      executionId: dispatching.id,
      orchestrationId: 'orchestration-1',
      correlationId: 'execution-correlation',
      status: 'succeeded' as const,
      message: 'Completed',
    };
    await expect(
      store.applyOrchestratorEvent({
        event,
        actor: 'external:azure-ops-orchestrator',
      }),
    ).resolves.toMatchObject({ status: 'succeeded', message: 'Completed' });
    await expect(
      store.applyOrchestratorEvent({
        event: { ...event, status: 'failed' },
        actor: 'external:azure-ops-orchestrator',
      }),
    ).rejects.toThrow(/Terminal execution/);
    await expect(
      store.applyOrchestratorEvent({
        event: { ...event, orchestrationId: 'wrong' },
        actor: 'external:azure-ops-orchestrator',
      }),
    ).rejects.toThrow(/identifiers do not match/);

    const reconciliationPlan = {
      ...plan,
      id: '00000000-0000-4000-8000-000000000005',
    };
    await store.savePlan(reconciliationPlan);
    const reconciliationApproval = await store.createApproval({
      planId: reconciliationPlan.id,
      actor: 'user:default/alice',
    });
    await store.decide({
      id: reconciliationApproval.id,
      actor: 'user:default/bob',
      decision: 'approved',
    });
    const ambiguous = await store.createExecution({
      approvalId: reconciliationApproval.id,
      actor: 'user:default/operator',
      correlationId: 'ambiguous-correlation',
    });
    await expect(
      store.markExecutionDispatchFailed(
        ambiguous.id,
        'Dispatch outcome unknown',
        true,
      ),
    ).resolves.toMatchObject({ status: 'unknown', completedAt: undefined });
    await expect(
      store.applyOrchestratorEvent({
        event: {
          executionId: ambiguous.id,
          orchestrationId: 'reconciled-orchestration',
          correlationId: 'ambiguous-correlation',
          status: 'running',
        },
        actor: 'external:azure-ops-orchestrator',
      }),
    ).resolves.toMatchObject({
      status: 'running',
      orchestrationId: 'reconciled-orchestration',
    });
  });

  it('upserts incidents idempotently, filters them, and appends safe audit metadata', async () => {
    let now = new Date('2026-07-21T00:05:00.000Z');
    const knex = await databases.init('SQLITE_3');
    const store = await AzureOpsStore.create({
      database: mockServices.database({
        knex,
        migrations: { skip: false },
      }),
      now: () => now,
    });
    const activeIncident = {
      id: 'alert-1',
      alertRule: 'VM unavailable',
      severity: 'Sev1' as const,
      signalType: 'Metric',
      monitoringService: 'Platform',
      status: 'active' as const,
      firedAt: '2026-07-21T00:00:00.000Z',
      affectedResourceIds: [resourceId.toLocaleLowerCase('en-US')],
      summary: 'The VM is unavailable.',
      source: 'azure-monitor' as const,
      lastUpdated: '2026-07-21T00:00:00.000Z',
    };

    const created = await store.upsertIncident({
      incident: activeIncident,
      actor: 'external:azure-monitor-ingress',
      correlationId: 'incident-1',
    });
    expect(created).toMatchObject({
      change: 'created',
    });
    const [createdNotification] = await store.claimPendingIncidentNotifications(
      {
        incidentId: activeIncident.id,
        limit: 10,
      },
    );
    expect(createdNotification).toMatchObject({
      type: 'fired',
      incident: activeIncident,
    });
    await expect(
      store.claimPendingIncidentNotifications({
        incidentId: activeIncident.id,
        limit: 10,
      }),
    ).resolves.toEqual([]);
    await expect(
      store.hasPendingIncidentNotifications(activeIncident.id),
    ).resolves.toBe(true);
    await store.releaseIncidentNotification(createdNotification.id);
    const recovered = await store.upsertIncident({
      incident: activeIncident,
      actor: 'external:azure-monitor-ingress',
      correlationId: 'incident-replay',
    });
    expect(recovered).toMatchObject({
      change: 'replay',
    });
    const [recoveredNotification] =
      await store.claimPendingIncidentNotifications({
        incidentId: activeIncident.id,
        limit: 10,
      });
    expect(recoveredNotification).toMatchObject({
      id: createdNotification.id,
      type: 'fired',
    });
    await store.markIncidentNotificationDelivered({
      id: createdNotification.id,
      actor: 'external:azure-monitor-ingress',
      correlationId: 'incident-replay',
    });
    await expect(
      store.upsertIncident({
        incident: activeIncident,
        actor: 'external:azure-monitor-ingress',
        correlationId: 'incident-replay-after-delivery',
      }),
    ).resolves.toMatchObject({ change: 'replay' });
    await expect(
      store.hasPendingIncidentNotifications(activeIncident.id),
    ).resolves.toBe(false);

    const resolvedIncident = {
      ...activeIncident,
      status: 'resolved' as const,
      resolvedAt: '2026-07-21T00:03:00.000Z',
      lastUpdated: '2026-07-21T00:03:00.000Z',
    };
    await expect(
      store.upsertIncident({
        incident: resolvedIncident,
        actor: 'external:azure-monitor-ingress',
        correlationId: 'incident-2',
      }),
    ).resolves.toMatchObject({
      change: 'updated',
    });
    const [resolutionNotification] =
      await store.claimPendingIncidentNotifications({
        incidentId: activeIncident.id,
        limit: 10,
      });
    expect(resolutionNotification).toMatchObject({ type: 'resolved' });
    now = new Date('2026-07-21T00:11:00.000Z');
    await expect(
      store.claimPendingIncidentNotifications({ limit: 10 }),
    ).resolves.toEqual([resolutionNotification]);
    await expect(
      store.listIncidents({
        status: 'resolved',
        severity: 'Sev1',
        limit: 1,
      }),
    ).resolves.toEqual([resolvedIncident]);

    const audit = await store.listAudit();
    expect(audit.map(event => event.eventType)).toEqual([
      'incident.updated',
      'incident.replay',
      'incident.notification-delivered',
      'incident.replay',
      'incident.created',
    ]);
    expect(audit[0].payload).toEqual({
      incidentId: 'alert-1',
      status: 'resolved',
      severity: 'Sev1',
      source: 'azure-monitor',
      resourceCount: 1,
    });
    expect(JSON.stringify(audit)).not.toContain('The VM is unavailable');
  });
});
