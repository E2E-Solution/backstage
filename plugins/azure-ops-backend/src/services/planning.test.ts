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

import { DeterministicPlanService } from './planning';

const subscription = '11111111-1111-1111-1111-111111111111';
const vmId = `/subscriptions/${subscription}/resourceGroups/demo/providers/Microsoft.Compute/virtualMachines/vm1`;
const assignmentId = `/subscriptions/${subscription}/providers/Microsoft.Authorization/policyAssignments/Baseline`;

describe('DeterministicPlanService', () => {
  const plans = new DeterministicPlanService({
    subscriptions: [subscription],
    ttlMs: 60_000,
    now: () => new Date('2026-07-21T00:00:00.000Z'),
  });

  it('produces a stable hash and exact plan', () => {
    const first = plans.create({
      templateId: 'virtual-machine.restart',
      resourceId: vmId,
      parameters: {},
      requestedBy: 'user:default/alice',
    });
    const second = plans.create({
      templateId: 'virtual-machine.restart',
      resourceId: vmId,
      parameters: {},
      requestedBy: 'user:default/alice',
    });
    expect(first.hash).toBe(second.hash);
    expect(first).toMatchObject({
      risk: 'high',
      expiresAt: '2026-07-21T00:01:00.000Z',
      steps: [
        {
          sequence: 1,
          action: 'restart',
          expectedState: 'running',
        },
      ],
    });
  });

  it('rejects a mismatched resource type and invalid parameters', () => {
    expect(() =>
      plans.create({
        templateId: 'app-service.stop',
        resourceId: vmId,
        parameters: {},
        requestedBy: 'user:default/alice',
      }),
    ).toThrow(/requires resource type/);
    expect(() =>
      plans.create({
        templateId: 'aks.node-pool.scale',
        resourceId: vmId.replace(
          'Microsoft.Compute/virtualMachines/vm1',
          'Microsoft.ContainerService/managedClusters/aks1',
        ),
        parameters: { nodePoolName: 'system', count: -1 },
        requestedBy: 'user:default/alice',
      }),
    ).toThrow();
  });

  it('canonicalizes and constrains policy remediation assignments', () => {
    expect(
      plans.create({
        templateId: 'policy.remediation.create',
        resourceId: assignmentId,
        parameters: { assignmentId },
        requestedBy: 'user:default/alice',
      }),
    ).toMatchObject({
      resourceId: assignmentId.toLowerCase(),
      parameters: { assignmentId: assignmentId.toLowerCase() },
    });

    const otherSubscription = '22222222-2222-2222-2222-222222222222';
    expect(() =>
      plans.create({
        templateId: 'policy.remediation.create',
        resourceId: assignmentId,
        parameters: {
          assignmentId: assignmentId.replace(subscription, otherSubscription),
        },
        requestedBy: 'user:default/alice',
      }),
    ).toThrow(/subscription is not allowlisted/);
    expect(() =>
      plans.create({
        templateId: 'policy.remediation.create',
        resourceId: assignmentId,
        parameters: {
          assignmentId: assignmentId.replace('Baseline', 'Different'),
        },
        requestedBy: 'user:default/alice',
      }),
    ).toThrow(/must match the target resource ID/);
    expect(() =>
      plans.create({
        templateId: 'policy.remediation.create',
        resourceId: assignmentId,
        parameters: {
          assignmentId: assignmentId.replace(
            'policyAssignments/Baseline',
            'policyDefinitions/Baseline',
          ),
        },
        requestedBy: 'user:default/alice',
      }),
    ).toThrow(/policyAssignments resource ID/);
  });

  it('rejects planning when disabled or when the allowlist is empty', () => {
    const input = {
      templateId: 'virtual-machine.start' as const,
      resourceId: vmId,
      parameters: {},
      requestedBy: 'user:default/alice',
    };
    expect(() =>
      new DeterministicPlanService({
        enabled: false,
        subscriptions: [subscription],
        ttlMs: 60_000,
      }).create(input),
    ).toThrow(/disabled/);
    expect(() =>
      new DeterministicPlanService({
        enabled: true,
        subscriptions: [],
        ttlMs: 60_000,
      }).create(input),
    ).toThrow(/No Azure subscriptions/);
  });
});
