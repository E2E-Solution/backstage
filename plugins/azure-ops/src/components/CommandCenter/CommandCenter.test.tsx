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
import { fireEvent, screen } from '@testing-library/react';
import type {
  AzureAnalysisResponse,
  AzureOperationPlan,
} from '@internal/backstage-plugin-azure-ops-common';
import type { AzureOpsApi } from '../../api';
import { CommandCenter, parseOperationParameters } from './CommandCenter';

const resourceId =
  '/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/ops/providers/Microsoft.Compute/virtualMachines/vm-1';

const plan: AzureOperationPlan = {
  id: '22222222-2222-2222-2222-222222222222',
  templateId: 'virtual-machine.restart',
  templateVersion: 1,
  resourceId: resourceId.toLowerCase(),
  requestedBy: 'user:default/operator',
  risk: 'high',
  parameters: {},
  preconditions: ['The target still matches the plan.'],
  steps: [
    {
      sequence: 1,
      action: 'restart',
      resourceId: resourceId.toLowerCase(),
      description: 'Restart virtual machine',
      expectedState: 'running',
    },
  ],
  rollback: 'Follow the workload recovery procedure.',
  createdAt: '2026-07-21T00:00:00.000Z',
  expiresAt: '2026-07-21T01:00:00.000Z',
  hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
};

const analysis: AzureAnalysisResponse = {
  correlationId: 'analysis-test-1',
  evidence: {
    id: 'evidence-1',
    generatedAt: '2026-07-21T00:00:00.000Z',
    resourceIds: [resourceId.toLowerCase()],
    items: [
      {
        id: 'resource-1',
        source: 'resource-graph',
        observedAt: '2026-07-21T00:00:00.000Z',
        title: 'Virtual machine resource',
        summary: '{"health":"degraded"}',
        resourceId: resourceId.toLowerCase(),
      },
    ],
  },
  recommendation: {
    summary: 'The virtual machine is degraded.',
    hypotheses: [
      {
        text: 'Resource Health reports degradation.',
        confidence: 0.87,
        evidenceIds: ['resource-1'],
      },
    ],
    suggestedTemplateIds: ['virtual-machine.restart'],
    warnings: ['Confirm workload impact before creating a plan.'],
  },
};

function createApi(foundryConfigured = true): AzureOpsApi {
  return {
    getCapabilities: jest.fn().mockResolvedValue({
      foundryConfigured,
      orchestratorConfigured: false,
      writesRequireApproval: true,
    }),
    analyze: jest.fn().mockResolvedValue(analysis),
    getSummary: jest.fn(),
    getIncidents: jest.fn(),
    getResources: jest.fn(),
    getOperationTemplates: jest.fn().mockResolvedValue([
      {
        id: 'virtual-machine.restart',
        title: 'Restart virtual machine',
        risk: 'high',
        resourceTypes: ['microsoft.compute/virtualmachines'],
      },
    ]),
    createPlan: jest.fn().mockResolvedValue(plan),
    requestApproval: jest.fn(),
    getApprovals: jest.fn(),
    decideApproval: jest.fn(),
    executeApproval: jest.fn(),
    getExecutions: jest.fn(),
  };
}

describe('CommandCenter', () => {
  it('validates parameters JSON and renders the exact returned plan', async () => {
    expect(parseOperationParameters('[]')).toEqual({
      error: 'Parameters must be a JSON object.',
    });
    const api = createApi();
    await renderInTestApp(<CommandCenter api={api} />);

    const template = await screen.findByLabelText('Operation template');
    fireEvent.mouseDown(template);
    fireEvent.click(
      await screen.findByRole('option', { name: /Restart virtual machine/ }),
    );
    fireEvent.change(screen.getByLabelText(/Azure resource ID/), {
      target: { value: resourceId },
    });
    const parameters = screen.getByLabelText(/Parameters JSON/);
    fireEvent.change(parameters, { target: { value: '{broken' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Create plan' }));
    expect(
      await screen.findByText(/Parameters are not valid JSON/),
    ).toBeInTheDocument();
    expect(api.createPlan).not.toHaveBeenCalled();

    fireEvent.change(parameters, { target: { value: '{}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));

    expect(
      await screen.findByText('Deterministic operation plan'),
    ).toBeInTheDocument();
    expect(screen.getByText(plan.hash)).toBeInTheDocument();
    expect(screen.getByText(plan.rollback)).toBeInTheDocument();
    expect(
      screen.getByText(/The target still matches the plan/),
    ).toBeInTheDocument();
    expect(screen.getByText(/expected state: running/)).toBeInTheDocument();
    expect(
      screen.getByText(/Foundry is configured for read-only analysis/),
    ).toBeInTheDocument();
  });

  it('clears stale plan and approval state before local validation', async () => {
    const api = createApi();
    await renderInTestApp(<CommandCenter api={api} />);

    fireEvent.mouseDown(await screen.findByLabelText('Operation template'));
    fireEvent.click(
      await screen.findByRole('option', { name: /Restart virtual machine/ }),
    );
    fireEvent.change(screen.getByLabelText(/Azure resource ID/), {
      target: { value: resourceId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create plan' }));
    expect(
      await screen.findByText('Deterministic operation plan'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Request approval' }));
    expect(
      screen.getByText(
        `Request approval for ${plan.templateId} on ${plan.resourceId}?`,
        { exact: false },
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    fireEvent.change(screen.getByLabelText(/Parameters JSON/), {
      target: { value: '{broken' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Create plan' }));

    expect(
      await screen.findByText(/Parameters are not valid JSON/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Deterministic operation plan'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request approval' }),
    ).not.toBeInTheDocument();
    expect(api.requestApproval).not.toHaveBeenCalled();
  });

  it('shows a gated message when Foundry is not configured', async () => {
    await renderInTestApp(<CommandCenter api={createApi(false)} />);

    expect(
      await screen.findByText(/Foundry analysis is not configured/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Analyze with Foundry' }),
    ).not.toBeInTheDocument();
  });

  it('renders an evidence-linked recommendation without creating a plan', async () => {
    const api = createApi();
    await renderInTestApp(<CommandCenter api={api} />);

    fireEvent.change(await screen.findByLabelText('Analysis question'), {
      target: { value: ' Why is this VM degraded? ' },
    });
    fireEvent.change(screen.getByLabelText('Analysis resource IDs'), {
      target: { value: resourceId },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Analyze with Foundry' }),
    );

    expect(
      await screen.findByText('The virtual machine is degraded.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/87% confidence/)).toBeInTheDocument();
    expect(screen.getAllByText(/resource-1/)).toHaveLength(2);
    expect(screen.getByText(/virtual-machine.restart/)).toBeInTheDocument();
    expect(
      screen.getByText(/Confirm workload impact before creating a plan/),
    ).toBeInTheDocument();
    expect(api.analyze).toHaveBeenCalledWith({
      question: 'Why is this VM degraded?',
      resourceIds: [resourceId.toLowerCase()],
    });
    expect(api.createPlan).not.toHaveBeenCalled();
  });
});
