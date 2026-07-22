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
import userEvent from '@testing-library/user-event';
import type { AzureApprovalRequest } from '@internal/backstage-plugin-azure-ops-common';
import type { AzureOpsApi } from '../../api';
import { Approvals } from './Approvals';

const approval: AzureApprovalRequest = {
  id: '33333333-3333-3333-3333-333333333333',
  status: 'pending',
  requestedAt: '2026-07-21T00:00:00.000Z',
  plan: {
    id: '22222222-2222-2222-2222-222222222222',
    templateId: 'virtual-machine.restart',
    templateVersion: 1,
    resourceId:
      '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
    requestedBy: 'user:default/requester',
    risk: 'high',
    parameters: {},
    preconditions: [],
    steps: [],
    rollback: 'Follow the recovery procedure.',
    createdAt: '2026-07-21T00:00:00.000Z',
    expiresAt: '2026-07-21T01:00:00.000Z',
    hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
  },
};

describe('Approvals', () => {
  it('confirms an action, sends it, and refetches approval state', async () => {
    const getApprovals = jest
      .fn()
      .mockResolvedValueOnce([approval])
      .mockResolvedValue([{ ...approval, status: 'approved' }]);
    const decideApproval = jest.fn().mockResolvedValue({
      ...approval,
      status: 'approved',
    });
    const api: AzureOpsApi = {
      getCapabilities: jest.fn(),
      analyze: jest.fn(),
      getSummary: jest.fn(),
      getIncidents: jest.fn(),
      getResources: jest.fn(),
      getOperationTemplates: jest.fn(),
      createPlan: jest.fn(),
      requestApproval: jest.fn(),
      getApprovals,
      decideApproval,
      executeApproval: jest.fn(),
      getExecutions: jest.fn().mockResolvedValue([]),
    };
    const user = userEvent.setup();

    await renderInTestApp(<Approvals api={api} />);
    await user.click(
      await screen.findByRole('button', {
        name: /Approve virtual-machine.restart/,
      }),
    );
    expect(
      await screen.findByText(/The plan risk is high/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm approve' }));

    expect(decideApproval).toHaveBeenCalledWith(approval.id, 'approve');
    expect(await screen.findByText('approved')).toBeInTheDocument();
    expect(getApprovals).toHaveBeenCalledTimes(2);
  });
});
