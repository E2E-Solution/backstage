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

import type { TokenCredential } from '@azure/core-auth';
import type {
  AzureApprovalRequest,
  AzureExecutionRecord,
} from '@internal/backstage-plugin-azure-ops-common';
import {
  HttpOrchestratorDispatcher,
  OrchestratorDispatchError,
} from './dispatcher';

const execution: AzureExecutionRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  approvalId: '00000000-0000-4000-8000-000000000002',
  planHash: 'hash',
  correlationId: 'correlation-1',
  status: 'dispatching',
  queuedAt: '2026-07-21T00:00:00.000Z',
};
const approval: AzureApprovalRequest = {
  id: execution.approvalId,
  status: 'approved',
  requestedAt: '2026-07-21T00:00:00.000Z',
  plan: {
    id: '00000000-0000-4000-8000-000000000003',
    templateId: 'virtual-machine.start',
    templateVersion: 1,
    resourceId:
      '/subscriptions/11111111-1111-1111-1111-111111111111/resourcegroups/ops/providers/microsoft.compute/virtualmachines/vm-1',
    requestedBy: 'user:default/alice',
    risk: 'medium',
    parameters: {},
    preconditions: [],
    steps: [],
    rollback: 'Stop the VM.',
    createdAt: '2026-07-21T00:00:00.000Z',
    expiresAt: '2026-07-21T01:00:00.000Z',
    hash: 'hash',
  },
};

describe('HttpOrchestratorDispatcher', () => {
  it('uses the audience scope, bearer token, and stable execution idempotency key', async () => {
    const getToken = jest.fn().mockResolvedValue({
      token: 'secret-token',
      expiresOnTimestamp: Date.now() + 60_000,
    });
    const credential: TokenCredential = { getToken };
    const fetchImplementation = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accepted: true, orchestrationId: 'instance-1' }),
        {
          status: 202,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const dispatcher = new HttpOrchestratorDispatcher({
      endpoint: 'https://orchestrator.example.com/dispatch',
      audience: 'api://azure-ops-orchestrator',
      credential,
      fetchImplementation,
    });

    await expect(dispatcher.dispatch(execution, approval)).resolves.toEqual({
      orchestrationId: 'instance-1',
    });
    expect(getToken).toHaveBeenCalledWith(
      'api://azure-ops-orchestrator/.default',
    );
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://orchestrator.example.com/dispatch',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer secret-token',
          'idempotency-key': execution.id,
          'x-correlation-id': execution.correlationId,
        }),
        body: expect.stringContaining(`"idempotencyKey":"${execution.id}"`),
      }),
    );
  });

  it.each([400, 401, 403, 404, 422])(
    'classifies definitive HTTP %s client rejection as rejected',
    async status => {
      const dispatcher = new HttpOrchestratorDispatcher({
        endpoint: 'https://orchestrator.example.com/dispatch',
        audience: 'api://azure-ops-orchestrator',
        credential: {
          getToken: jest.fn().mockResolvedValue({
            token: 'secret-token',
            expiresOnTimestamp: Date.now() + 60_000,
          }),
        },
        fetchImplementation: jest
          .fn()
          .mockResolvedValue(new Response(null, { status })),
      });

      await expect(
        dispatcher.dispatch(execution, approval),
      ).rejects.toMatchObject({
        outcome: 'rejected',
        message: expect.stringContaining(`HTTP ${status}`),
      } satisfies Partial<OrchestratorDispatchError>);
    },
  );

  it.each([408, 409, 425, 429, 500, 502, 503])(
    'classifies retryable or ambiguous HTTP %s response as ambiguous',
    async status => {
      const dispatcher = new HttpOrchestratorDispatcher({
        endpoint: 'https://orchestrator.example.com/dispatch',
        audience: 'api://azure-ops-orchestrator',
        credential: {
          getToken: jest.fn().mockResolvedValue({
            token: 'secret-token',
            expiresOnTimestamp: Date.now() + 60_000,
          }),
        },
        fetchImplementation: jest
          .fn()
          .mockResolvedValue(new Response(null, { status })),
      });

      await expect(
        dispatcher.dispatch(execution, approval),
      ).rejects.toMatchObject({
        outcome: 'ambiguous',
        message: expect.stringContaining(`HTTP ${status}`),
      } satisfies Partial<OrchestratorDispatchError>);
    },
  );

  it('classifies malformed successful responses and transport failures as ambiguous', async () => {
    const credential: TokenCredential = {
      getToken: jest.fn().mockResolvedValue({
        token: 'secret-token',
        expiresOnTimestamp: Date.now() + 60_000,
      }),
    };
    const invalid = new HttpOrchestratorDispatcher({
      endpoint: 'https://orchestrator.example.com/dispatch',
      audience: 'api://azure-ops-orchestrator',
      credential,
      fetchImplementation: jest
        .fn()
        .mockResolvedValue(new Response('{}', { status: 202 })),
    });
    await expect(invalid.dispatch(execution, approval)).rejects.toMatchObject({
      outcome: 'ambiguous',
    } satisfies Partial<OrchestratorDispatchError>);

    const transport = new HttpOrchestratorDispatcher({
      endpoint: 'https://orchestrator.example.com/dispatch',
      audience: 'api://azure-ops-orchestrator',
      credential,
      fetchImplementation: jest
        .fn()
        .mockRejectedValue(new Error('connection reset')),
    });
    await expect(transport.dispatch(execution, approval)).rejects.toMatchObject(
      {
        outcome: 'ambiguous',
      } satisfies Partial<OrchestratorDispatchError>,
    );

    const malformedSuccess = new HttpOrchestratorDispatcher({
      endpoint: 'https://orchestrator.example.com/dispatch',
      audience: 'api://azure-ops-orchestrator',
      credential,
      fetchImplementation: jest
        .fn()
        .mockResolvedValue(new Response('not-json', { status: 200 })),
    });
    await expect(
      malformedSuccess.dispatch(execution, approval),
    ).rejects.toMatchObject({
      outcome: 'ambiguous',
    } satisfies Partial<OrchestratorDispatchError>);
  });
});
