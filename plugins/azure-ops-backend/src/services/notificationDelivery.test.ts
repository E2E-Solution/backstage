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

import { mockServices } from '@backstage/backend-test-utils';
import type { NotificationService } from '@backstage/plugin-notifications-node';
import {
  IncidentNotificationDeliveryService,
  IncidentNotificationStore,
} from './notificationDelivery';
import type { PendingIncidentNotification } from './store';

const pending: PendingIncidentNotification = {
  id: 'notification-1',
  type: 'fired',
  incident: {
    id: 'alert-1',
    alertRule: 'VM unavailable',
    severity: 'Sev1',
    signalType: 'Metric',
    monitoringService: 'Platform',
    status: 'active',
    firedAt: '2026-07-21T00:00:00.000Z',
    affectedResourceIds: [
      '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
    ],
    summary: 'The VM is unavailable.',
    source: 'azure-monitor',
    lastUpdated: '2026-07-21T00:00:00.000Z',
  },
};

function createStore(
  overrides: Partial<IncidentNotificationStore> = {},
): IncidentNotificationStore {
  return {
    claimPendingIncidentNotifications: jest.fn().mockResolvedValue([]),
    hasPendingIncidentNotifications: jest.fn().mockResolvedValue(false),
    markIncidentNotificationDelivered: jest.fn(),
    releaseIncidentNotification: jest.fn(),
    ...overrides,
  };
}

function createService(
  store: IncidentNotificationStore,
  send: jest.Mock = jest.fn(),
) {
  return new IncidentNotificationDeliveryService({
    store,
    notifications: { send } satisfies NotificationService,
    logger: mockServices.logger.mock(),
    batchSize: 10,
  });
}

describe('IncidentNotificationDeliveryService', () => {
  it('returns a retryable failure for an immediate replay while delivery is leased', async () => {
    const store = createStore({
      hasPendingIncidentNotifications: jest.fn().mockResolvedValue(true),
    });

    await expect(
      createService(store).deliverForIncident({
        incidentId: 'alert-1',
        actor: 'external:azure-monitor-ingress',
        correlationId: 'replay-1',
      }),
    ).rejects.toThrow(/pending or leased/);
  });

  it('releases failed sends and delivers them during scheduled reconciliation', async () => {
    const claim = jest
      .fn()
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([]);
    const release = jest.fn();
    const mark = jest.fn();
    const store = createStore({
      claimPendingIncidentNotifications: claim,
      hasPendingIncidentNotifications: jest.fn().mockResolvedValue(true),
      markIncidentNotificationDelivered: mark,
      releaseIncidentNotification: release,
    });
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('notifications offline'))
      .mockResolvedValue(undefined);
    const service = createService(store, send);

    await expect(
      service.deliverForIncident({
        incidentId: 'alert-1',
        actor: 'external:azure-monitor-ingress',
        correlationId: 'ingress-1',
      }),
    ).rejects.toThrow(/delivery failed/);
    expect(release).toHaveBeenCalledWith(pending.id);

    await expect(service.reconcile()).resolves.toEqual({ delivered: 1 });
    await expect(service.reconcile()).resolves.toEqual({ delivered: 0 });
    expect(mark).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('keeps uncertain sends leased and retries only after they become claimable', async () => {
    const claim = jest
      .fn()
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pending]);
    const mark = jest
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue(undefined);
    const release = jest.fn();
    const store = createStore({
      claimPendingIncidentNotifications: claim,
      hasPendingIncidentNotifications: jest.fn().mockResolvedValue(true),
      markIncidentNotificationDelivered: mark,
      releaseIncidentNotification: release,
    });
    const send = jest.fn();
    const service = createService(store, send);

    await expect(
      service.deliverForIncident({
        incidentId: 'alert-1',
        actor: 'external:azure-monitor-ingress',
        correlationId: 'ingress-1',
      }),
    ).rejects.toThrow(/delivery state is uncertain/);
    expect(release).not.toHaveBeenCalled();
    await expect(service.reconcile()).resolves.toEqual({ delivered: 0 });
    await expect(service.reconcile()).resolves.toEqual({ delivered: 1 });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('never duplicates a durably delivered notification', async () => {
    const claim = jest
      .fn()
      .mockResolvedValueOnce([pending])
      .mockResolvedValueOnce([]);
    const mark = jest.fn();
    const store = createStore({
      claimPendingIncidentNotifications: claim,
      markIncidentNotificationDelivered: mark,
    });
    const send = jest.fn();
    const service = createService(store, send);

    await expect(
      service.deliverForIncident({
        incidentId: 'alert-1',
        actor: 'external:azure-monitor-ingress',
        correlationId: 'ingress-1',
      }),
    ).resolves.toEqual({ delivered: 1 });
    await expect(service.reconcile()).resolves.toEqual({ delivered: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledTimes(1);
  });
});
