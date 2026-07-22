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

import { renderInTestApp } from '@backstage/frontend-test-utils';
import { screen } from '@testing-library/react';
import type { AzureOpsApi } from '../../api';
import { Status } from './Status';

const summary = {
  generatedAt: '2026-07-21T00:00:00.000Z',
  resources: {
    total: 0,
    available: 0,
    degraded: 0,
    unavailable: 0,
    unknown: 0,
  },
  alerts: { active: 1, critical: 0 },
  policy: { compliant: 0, nonCompliant: 0, unknown: 0 },
  advisor: { highImpact: 0, total: 0 },
  sources: [],
};

function api(overrides?: Partial<AzureOpsApi>): AzureOpsApi {
  return {
    getCapabilities: jest.fn(),
    analyze: jest.fn(),
    getSummary: jest.fn().mockResolvedValue(summary),
    getIncidents: jest.fn().mockResolvedValue([]),
    getResources: jest.fn().mockResolvedValue([]),
    getOperationTemplates: jest.fn(),
    createPlan: jest.fn(),
    requestApproval: jest.fn(),
    getApprovals: jest.fn(),
    decideApproval: jest.fn(),
    executeApproval: jest.fn(),
    getExecutions: jest.fn(),
    ...overrides,
  };
}

describe('Status', () => {
  it('renders active and resolved Azure Monitor incidents', async () => {
    const resourceId =
      '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1';
    await renderInTestApp(
      <Status
        api={api({
          getIncidents: jest.fn().mockResolvedValue([
            {
              id: 'alert-1',
              alertRule: 'VM unavailable',
              severity: 'Sev1',
              signalType: 'Metric',
              monitoringService: 'Platform',
              status: 'active',
              firedAt: '2026-07-21T00:00:00.000Z',
              affectedResourceIds: [resourceId],
              summary: 'The VM is unavailable.',
              source: 'azure-monitor',
              lastUpdated: '2026-07-21T00:00:00.000Z',
            },
            {
              id: 'alert-2',
              alertRule: 'CPU high',
              severity: 'Sev2',
              signalType: 'Metric',
              monitoringService: 'Platform',
              status: 'resolved',
              firedAt: '2026-07-20T23:00:00.000Z',
              resolvedAt: '2026-07-21T00:02:00.000Z',
              affectedResourceIds: [resourceId],
              summary: 'CPU returned to normal.',
              source: 'azure-monitor',
              lastUpdated: '2026-07-21T00:02:00.000Z',
            },
          ]),
        })}
      />,
    );

    expect(await screen.findByText('VM unavailable')).toBeInTheDocument();
    expect(screen.getByText('CPU high')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('resolved')).toBeInTheDocument();
    expect(screen.getByText('Sev1')).toBeInTheDocument();
    expect(screen.getAllByText('azure-monitor')).toHaveLength(2);
    expect(screen.getAllByText(resourceId)).toHaveLength(2);
  });

  it('shows incident API errors instead of fallback content', async () => {
    await renderInTestApp(
      <Status
        api={api({
          getIncidents: jest
            .fn()
            .mockRejectedValue(new Error('Incident API unavailable')),
        })}
      />,
    );

    expect(
      await screen.findAllByText(/Incident API unavailable/),
    ).not.toHaveLength(0);
    expect(
      screen.queryByText(/No Azure Monitor incidents/),
    ).not.toBeInTheDocument();
  });
});
