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

import type { AzureOpsReader } from './inventory';
import { FoundryAnalysisClient, FoundryAnalysisService } from './foundry';

const resourceId =
  '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1';

function reader(): AzureOpsReader {
  return {
    refresh: jest.fn(),
    summary: jest.fn(() => ({
      generatedAt: '2026-07-21T00:00:00.000Z',
      resources: {
        total: 1,
        available: 0,
        degraded: 1,
        unavailable: 0,
        unknown: 0,
      },
      alerts: { active: 1, critical: 0 },
      policy: { compliant: 1, nonCompliant: 0, unknown: 0 },
      advisor: { highImpact: 0, total: 0 },
      sources: [
        {
          source: 'resource-graph',
          observedAt: '2026-07-21T00:00:00.000Z',
          status: 'fresh',
          message: 'arbitrary upstream log secret-value',
        },
      ],
    })),
    resources: jest.fn(() => [
      {
        id: resourceId,
        name: 'vm-1',
        type: 'microsoft.compute/virtualmachines',
        subscriptionId: '11111111-1111-1111-1111-111111111111',
        resourceGroup: 'ops',
        location: 'eastus',
        provisioningState: 'Succeeded',
        powerState: 'running',
        health: 'degraded',
        tags: { token: 'secret-value' },
        observedAt: '2026-07-21T00:00:00.000Z',
      },
    ]),
  };
}

function client(output: unknown): FoundryAnalysisClient {
  return {
    analyze: jest.fn().mockResolvedValue(JSON.stringify(output)),
  };
}

describe('FoundryAnalysisService', () => {
  it('rejects unknown resources before invoking Foundry', async () => {
    const foundry = client({});
    const service = new FoundryAnalysisService({
      reader: reader(),
      client: foundry,
    });

    await expect(
      service.analyze({
        question: 'What is wrong?',
        resourceIds: [
          '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/unknown',
        ],
      }),
    ).rejects.toThrow(/does not contain resource ID/);
    expect(foundry.analyze).not.toHaveBeenCalled();
  });

  it('strictly validates model output and evidence references', async () => {
    const service = new FoundryAnalysisService({
      reader: reader(),
      client: client({
        summary: 'Possible host issue',
        hypotheses: [
          {
            text: 'The resource is degraded',
            confidence: 0.8,
            evidenceIds: ['invented-evidence'],
          },
        ],
        suggestedTemplateIds: ['virtual-machine.restart'],
        warnings: [],
        unexpected: true,
      }),
    });

    await expect(
      service.analyze({
        question: 'What is wrong?',
        resourceIds: [resourceId],
      }),
    ).rejects.toThrow(/invalid analysis JSON/);
  });

  it('forwards only bounded normalized evidence to the injected client', async () => {
    const foundry = client({
      summary: 'The VM is degraded.',
      hypotheses: [
        {
          text: 'Resource Health reports degradation.',
          confidence: 0.9,
          evidenceIds: ['resource-1', 'source-1'],
        },
      ],
      suggestedTemplateIds: ['virtual-machine.restart'],
      warnings: ['Confirm workload impact before creating a plan.'],
    });
    const service = new FoundryAnalysisService({
      reader: reader(),
      client: foundry,
    });

    await expect(
      service.analyze({
        question: 'Why is this VM degraded?',
        resourceIds: [resourceId],
      }),
    ).resolves.toMatchObject({
      recommendation: {
        suggestedTemplateIds: ['virtual-machine.restart'],
      },
    });
    const prompt = jest.mocked(foundry.analyze).mock.calls[0][0];
    expect(prompt).toContain('untrusted data');
    expect(prompt).toContain('\\"status\\":\\"fresh\\"');
    expect(prompt).not.toContain('arbitrary upstream log');
    expect(prompt).not.toContain('secret-value');
  });
});
