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

import type { AzureMonitorCommonAlert } from '@internal/backstage-plugin-azure-ops-common';
import { normalizeAzureMonitorIncident } from './incidents';

const target =
  '/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/Ops/providers/Microsoft.Compute/virtualMachines/VM-1';

function alert(
  monitorCondition: 'Fired' | 'Resolved',
): AzureMonitorCommonAlert {
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
        alertTargetIDs: [target, target.toLocaleLowerCase('en-US')],
        firedDateTime: '2026-07-21T00:00:00.000Z',
        resolvedDateTime:
          monitorCondition === 'Resolved'
            ? '2026-07-21T00:03:00.000Z'
            : undefined,
        description: 'The VM is unavailable.',
      },
    },
  };
}

describe('normalizeAzureMonitorIncident', () => {
  it('normalizes Fired and Resolved alerts with canonical target IDs', () => {
    expect(normalizeAzureMonitorIncident(alert('Fired'))).toEqual({
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
    });
    expect(normalizeAzureMonitorIncident(alert('Resolved'))).toMatchObject({
      status: 'resolved',
      resolvedAt: '2026-07-21T00:03:00.000Z',
      lastUpdated: '2026-07-21T00:03:00.000Z',
    });
  });

  it('explicitly rejects malformed targets and invalid resolution order', () => {
    const malformed = alert('Fired');
    malformed.data.essentials.alertTargetIDs = ['/not-an-azure-resource'];
    expect(() => normalizeAzureMonitorIncident(malformed)).toThrow(
      /Malformed Azure Monitor target resource ID/,
    );

    const invalidResolution = alert('Resolved');
    invalidResolution.data.essentials.resolvedDateTime =
      '2026-07-20T23:59:00.000Z';
    expect(() => normalizeAzureMonitorIncident(invalidResolution)).toThrow(
      /cannot precede/,
    );
  });
});
