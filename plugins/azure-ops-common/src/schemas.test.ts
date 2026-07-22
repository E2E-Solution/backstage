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
  azureAgentRecommendationSchema,
  azureAnalysisRequestSchema,
  azureMonitorCommonAlertSchema,
  azureOrchestratorEventSchema,
} from './schemas';

const resourceId =
  '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1';

describe('Azure Ops schemas', () => {
  it('trims and bounds analysis input to canonical resource IDs', () => {
    expect(
      azureAnalysisRequestSchema.parse({
        question: ' What is wrong? ',
        resourceIds: [resourceId],
      }),
    ).toEqual({
      question: 'What is wrong?',
      resourceIds: [resourceId],
    });
    expect(
      azureAnalysisRequestSchema.safeParse({
        question: 'x'.repeat(2001),
        resourceIds: [resourceId],
      }).success,
    ).toBe(false);
    expect(
      azureAnalysisRequestSchema.safeParse({
        question: 'What is wrong?',
        resourceIds: [resourceId.replace('resourcegroups', 'resourceGroups')],
      }).success,
    ).toBe(false);
  });

  it('strictly validates recommendation output', () => {
    expect(
      azureAgentRecommendationSchema.safeParse({
        summary: 'A summary',
        hypotheses: [],
        suggestedTemplateIds: [],
        warnings: [],
        extra: true,
      }).success,
    ).toBe(false);
  });

  it('strictly validates bounded Azure Monitor common alerts', () => {
    const alert = {
      schemaId: 'azureMonitorCommonAlertSchema',
      data: {
        essentials: {
          alertId: '/subscriptions/example/providers/microsoft.alerts/1',
          alertRule: 'VM unavailable',
          severity: 'Sev1',
          signalType: 'Metric',
          monitorCondition: 'Fired',
          monitoringService: 'Platform',
          alertTargetIDs: [resourceId],
          firedDateTime: '2026-07-21T00:00:00.000Z',
          description: 'The VM is unavailable.',
        },
        alertContext: { ignored: 'not part of the persisted incident' },
        customProperties: { routingKey: 'operations' },
      },
    };

    expect(azureMonitorCommonAlertSchema.parse(alert)).toEqual(alert);
    expect(
      azureMonitorCommonAlertSchema.safeParse({
        ...alert,
        schemaId: 'Microsoft.Insights/activityLogs',
      }).success,
    ).toBe(false);
    expect(
      azureMonitorCommonAlertSchema.safeParse({
        ...alert,
        data: {
          ...alert.data,
          essentials: {
            ...alert.data.essentials,
            alertTargetIDs: Array.from({ length: 51 }, () => resourceId),
          },
        },
      }).success,
    ).toBe(false);
    expect(
      azureMonitorCommonAlertSchema.safeParse({
        ...alert,
        data: {
          ...alert.data,
          essentials: {
            ...alert.data.essentials,
            unexpected: 'secret',
          },
        },
      }).success,
    ).toBe(false);
    expect(
      azureMonitorCommonAlertSchema.safeParse({
        ...alert,
        data: {
          ...alert.data,
          essentials: {
            ...alert.data.essentials,
            monitorCondition: 'Resolved',
          },
        },
      }).success,
    ).toBe(false);
  });

  it('strictly validates bounded orchestrator callbacks', () => {
    const event = {
      executionId: '00000000-0000-4000-8000-000000000001',
      orchestrationId: 'instance-1',
      correlationId: 'correlation-1',
      status: 'succeeded',
      message: 'Completed',
    };
    expect(azureOrchestratorEventSchema.parse(event)).toEqual(event);
    expect(
      azureOrchestratorEventSchema.safeParse({
        ...event,
        message: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      azureOrchestratorEventSchema.safeParse({
        ...event,
        status: 'queued',
      }).success,
    ).toBe(false);
    expect(
      azureOrchestratorEventSchema.safeParse({
        ...event,
        correlationId: 'not allowed!',
      }).success,
    ).toBe(false);
  });
});
