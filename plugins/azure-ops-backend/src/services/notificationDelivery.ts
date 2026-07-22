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

import { LoggerService } from '@backstage/backend-plugin-api';
import { ServiceUnavailableError } from '@backstage/errors';
import { NotificationService } from '@backstage/plugin-notifications-node';
import { randomUUID } from 'node:crypto';
import { AzureOpsStore, PendingIncidentNotification } from './store';

export interface IncidentNotificationStore {
  claimPendingIncidentNotifications(options: {
    incidentId?: string;
    limit: number;
  }): Promise<PendingIncidentNotification[]>;
  hasPendingIncidentNotifications(incidentId: string): Promise<boolean>;
  markIncidentNotificationDelivered(options: {
    id: string;
    actor: string;
    correlationId: string;
  }): Promise<void>;
  releaseIncidentNotification(id: string): Promise<void>;
}

export class IncidentNotificationDeliveryService {
  static create(options: {
    store: AzureOpsStore;
    notifications: NotificationService;
    logger: LoggerService;
    batchSize?: number;
  }): IncidentNotificationDeliveryService {
    return new IncidentNotificationDeliveryService(options);
  }

  constructor(
    private readonly options: {
      store: IncidentNotificationStore;
      notifications: NotificationService;
      logger: LoggerService;
      batchSize?: number;
    },
  ) {}

  async deliverForIncident(options: {
    incidentId: string;
    actor: string;
    correlationId: string;
  }): Promise<{ delivered: number }> {
    const claimed = await this.options.store.claimPendingIncidentNotifications({
      incidentId: options.incidentId,
      limit: this.batchSize,
    });
    let delivered = 0;
    for (const notification of claimed) {
      await this.deliver(notification, options.actor, options.correlationId);
      delivered += 1;
    }
    if (
      await this.options.store.hasPendingIncidentNotifications(
        options.incidentId,
      )
    ) {
      throw new ServiceUnavailableError(
        'The incident was persisted, but one or more required operator notifications remain pending or leased',
      );
    }
    return { delivered };
  }

  async reconcile(): Promise<{ delivered: number }> {
    const claimed = await this.options.store.claimPendingIncidentNotifications({
      limit: this.batchSize,
    });
    const failures: Error[] = [];
    let delivered = 0;
    const correlationId = `notification-reconciliation:${randomUUID()}`;
    for (const notification of claimed) {
      try {
        await this.deliver(
          notification,
          'service:azure-ops-notification-reconciler',
          correlationId,
        );
        delivered += 1;
      } catch (error) {
        failures.push(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
    if (failures.length > 0) {
      throw new ServiceUnavailableError(
        `Azure Ops notification reconciliation left ${failures.length} claimed notification(s) pending`,
      );
    }
    return { delivered };
  }

  private get batchSize(): number {
    return Math.min(Math.max(this.options.batchSize ?? 50, 1), 100);
  }

  private async deliver(
    notification: PendingIncidentNotification,
    actor: string,
    correlationId: string,
  ): Promise<void> {
    const resolved = notification.type === 'resolved';
    const conciseRule = notification.incident.alertRule.slice(0, 120);
    const conciseSummary = notification.incident.summary.slice(0, 300);
    try {
      await this.options.notifications.send({
        recipients: { type: 'broadcast' },
        payload: {
          title: resolved
            ? `Resolved: ${conciseRule}`
            : `${notification.incident.severity}: ${conciseRule}`,
          description: `${conciseSummary} Affected Azure resources: ${notification.incident.affectedResourceIds.length}.`,
          link: '/azure-ops/status',
          severity: this.notificationSeverity(
            notification.incident.severity,
            resolved,
          ),
          scope: 'azure-ops',
          topic: 'Azure Monitor',
        },
      });
    } catch (error) {
      try {
        await this.options.store.releaseIncidentNotification(notification.id);
      } catch (releaseError) {
        this.options.logger.error(
          `Azure Monitor notification '${notification.id}' failed and its delivery lease could not be released`,
          releaseError instanceof Error
            ? releaseError
            : { error: String(releaseError) },
        );
      }
      this.options.logger.error(
        `Azure Monitor notification '${notification.id}' delivery failed`,
        error instanceof Error ? error : { error: String(error) },
      );
      throw new ServiceUnavailableError(
        'The incident was persisted, but an operator notification delivery failed',
      );
    }

    try {
      await this.options.store.markIncidentNotificationDelivered({
        id: notification.id,
        actor,
        correlationId,
      });
    } catch (error) {
      this.options.logger.error(
        `Azure Monitor notification '${notification.id}' was sent but its delivery state could not be persisted`,
        error instanceof Error ? error : { error: String(error) },
      );
      throw new ServiceUnavailableError(
        'The operator notification was sent, but its persisted delivery state is uncertain',
      );
    }
  }

  private notificationSeverity(
    severity: 'Sev0' | 'Sev1' | 'Sev2' | 'Sev3' | 'Sev4',
    resolved: boolean,
  ): 'critical' | 'high' | 'normal' | 'low' {
    if (severity === 'Sev0') {
      return 'critical';
    }
    if (severity === 'Sev1') {
      return 'high';
    }
    return resolved ? 'low' : 'normal';
  }
}
