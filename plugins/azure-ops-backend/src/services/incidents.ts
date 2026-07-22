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

import { InputError } from '@backstage/errors';
import {
  AzureIncident,
  AzureMonitorCommonAlert,
  parseAzureResourceId,
} from '@internal/backstage-plugin-azure-ops-common';

export function normalizeAzureMonitorIncident(
  alert: AzureMonitorCommonAlert,
): AzureIncident {
  const essentials = alert.data.essentials;
  const affectedResourceIds = [
    ...new Set(
      essentials.alertTargetIDs.map(target => {
        const parsed = parseAzureResourceId(target);
        if (!parsed) {
          throw new InputError(
            `Malformed Azure Monitor target resource ID '${target.slice(
              0,
              200,
            )}'`,
          );
        }
        return parsed.id;
      }),
    ),
  ].sort();
  const resolvedAt =
    essentials.monitorCondition === 'Resolved'
      ? essentials.resolvedDateTime
      : undefined;
  if (
    resolvedAt &&
    Date.parse(resolvedAt) < Date.parse(essentials.firedDateTime)
  ) {
    throw new InputError(
      'Azure Monitor resolvedDateTime cannot precede firedDateTime',
    );
  }
  const status =
    essentials.monitorCondition === 'Resolved' ? 'resolved' : 'active';

  return {
    id: essentials.alertId,
    alertRule: essentials.alertRule,
    severity: essentials.severity,
    signalType: essentials.signalType,
    monitoringService: essentials.monitoringService,
    status,
    firedAt: essentials.firedDateTime,
    resolvedAt,
    affectedResourceIds,
    summary:
      essentials.description ||
      `${essentials.alertRule} is ${
        status === 'active' ? 'active' : 'resolved'
      }.`,
    source: 'azure-monitor',
    lastUpdated: resolvedAt ?? essentials.firedDateTime,
  };
}
