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

import { DefaultAzureOpsReader } from './inventory';
import { ResourceGraphGateway } from './resourceGraph';

const subscription = '11111111-1111-1111-1111-111111111111';
const resourceId = `/subscriptions/${subscription}/resourceGroups/demo/providers/Microsoft.Compute/virtualMachines/vm1`;
const complete = (rows: unknown[]) => ({ rows, partial: false });

describe('DefaultAzureOpsReader', () => {
  it('reports disabled data as unavailable without querying Azure', async () => {
    const gateway: ResourceGraphGateway = { query: jest.fn() };
    const reader = new DefaultAzureOpsReader({
      enabled: false,
      subscriptions: [subscription],
      gateway,
    });
    await reader.refresh();
    expect(reader.summary()).toMatchObject({
      resources: { total: 0, unknown: 0 },
      sources: [
        {
          status: 'unavailable',
          message: 'Azure Ops is disabled',
        },
      ],
    });
    expect(gateway.query).not.toHaveBeenCalled();
  });

  it('normalizes rows, preserves unknown health, and exposes partial failures', async () => {
    const gateway: ResourceGraphGateway = {
      query: jest
        .fn()
        .mockResolvedValueOnce(
          complete([
            {
              id: resourceId,
              name: 'vm1',
              type: 'Microsoft.Compute/virtualMachines',
              tags: { owner: 'team-a', invalid: 3 },
            },
            { id: 'bad', name: 'bad', type: 'type' },
          ]),
        )
        .mockRejectedValueOnce(new Error('health table unavailable'))
        .mockResolvedValueOnce(complete([{ severity: 'Sev0' }]))
        .mockResolvedValueOnce(complete([{ complianceState: 'NonCompliant' }]))
        .mockResolvedValueOnce(complete([{ impact: 'High' }])),
    };
    const reader = new DefaultAzureOpsReader({
      enabled: true,
      subscriptions: [subscription],
      gateway,
    });
    await reader.refresh();

    expect(reader.resources({ limit: 10 })).toEqual([
      expect.objectContaining({
        id: resourceId.toLowerCase(),
        type: 'microsoft.compute/virtualmachines',
        health: 'unknown',
        tags: { owner: 'team-a' },
      }),
    ]);
    expect(reader.summary()).toMatchObject({
      resources: { total: 1, unknown: 1 },
      alerts: { active: 1, critical: 1 },
      policy: { nonCompliant: 1 },
      advisor: { total: 1, highImpact: 1 },
      sources: expect.arrayContaining([
        expect.objectContaining({
          source: 'resource-health',
          status: 'partial',
          message: 'health table unavailable',
        }),
      ]),
    });
  });

  it('applies resource filters and limits', async () => {
    const gateway: ResourceGraphGateway = {
      query: jest
        .fn()
        .mockResolvedValueOnce(
          complete([
            {
              id: resourceId,
              name: 'vm1',
              type: 'Microsoft.Compute/virtualMachines',
            },
            {
              id: resourceId.replace('vm1', 'vm2'),
              name: 'vm2',
              type: 'Microsoft.Compute/virtualMachines',
            },
          ]),
        )
        .mockResolvedValueOnce(
          complete([{ id: resourceId, availabilityState: 'Available' }]),
        )
        .mockResolvedValue(complete([])),
    };
    const reader = new DefaultAzureOpsReader({
      enabled: true,
      subscriptions: [subscription],
      gateway,
    });
    await reader.refresh();
    expect(
      reader.resources({
        type: 'MICROSOFT.COMPUTE/VIRTUALMACHINES',
        health: 'available',
        limit: 1,
      }),
    ).toEqual([expect.objectContaining({ name: 'vm1' })]);
    expect(reader.resources({ subscription: 'bad', limit: 10 })).toEqual([]);
  });

  it('keeps partial inventory and retains a stale prior cache on total failure', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: resourceId,
            name: 'vm1',
            type: 'Microsoft.Compute/virtualMachines',
          },
        ],
        partial: true,
        message: 'page 12 failed',
      })
      .mockResolvedValue(complete([]));
    const reader = new DefaultAzureOpsReader({
      enabled: true,
      subscriptions: [subscription],
      gateway: { query },
    });

    await reader.refresh();
    expect(reader.summary().sources[0]).toMatchObject({
      source: 'resource-graph',
      status: 'partial',
      message: 'page 12 failed',
    });
    expect(reader.resources({ limit: 10 })).toHaveLength(1);

    query.mockRejectedValueOnce(new Error('resource graph offline'));
    await reader.refresh();
    expect(reader.resources({ limit: 10 })).toHaveLength(1);
    expect(reader.summary().sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'resource-graph',
          status: 'unavailable',
          message: 'Inventory query failed: resource graph offline',
        }),
        expect.objectContaining({ status: 'stale' }),
      ]),
    );
  });
});
