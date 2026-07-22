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

import {
  AzureApprovalRequest,
  AzureExecutionRecord,
} from '@internal/backstage-plugin-azure-ops-common';
import { TokenCredential } from '@azure/core-auth';
import { ServiceUnavailableError } from '@backstage/errors';
import { z } from 'zod/v3';

const responseSchema = z.object({
  accepted: z.literal(true),
  orchestrationId: z.string().min(1).max(256),
});

const definitiveRejectionStatuses = new Set([400, 401, 403, 404, 422]);

export interface OrchestratorDispatcher {
  configured: boolean;
  dispatch(
    execution: AzureExecutionRecord,
    approval: AzureApprovalRequest,
  ): Promise<{ orchestrationId: string }>;
}

export class OrchestratorDispatchError extends ServiceUnavailableError {
  constructor(message: string, readonly outcome: 'rejected' | 'ambiguous') {
    super(message);
  }
}

export class HttpOrchestratorDispatcher implements OrchestratorDispatcher {
  readonly configured: boolean;

  constructor(
    private readonly options: {
      endpoint?: string;
      audience?: string;
      credential?: TokenCredential;
      fetchImplementation?: typeof fetch;
    },
  ) {
    this.configured = Boolean(
      options.endpoint && options.audience && options.credential,
    );
  }

  async dispatch(
    execution: AzureExecutionRecord,
    approval: AzureApprovalRequest,
  ): Promise<{ orchestrationId: string }> {
    const { endpoint, audience, credential } = this.options;
    if (!endpoint || !audience || !credential) {
      throw new ServiceUnavailableError(
        'No authenticated durable Azure Ops orchestrator is configured',
      );
    }
    let accessToken;
    try {
      accessToken = await credential.getToken(`${audience}/.default`);
    } catch {
      throw new OrchestratorDispatchError(
        'Durable orchestrator authentication failed before dispatch',
        'rejected',
      );
    }
    if (!accessToken?.token) {
      throw new OrchestratorDispatchError(
        'Durable orchestrator authentication returned no access token',
        'rejected',
      );
    }

    let response: Response;
    try {
      response = await (this.options.fetchImplementation ?? fetch)(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken.token}`,
          'content-type': 'application/json',
          'idempotency-key': execution.id,
          'x-correlation-id': execution.correlationId,
        },
        body: JSON.stringify({
          schemaVersion: 1,
          executionId: execution.id,
          approvalId: approval.id,
          correlationId: execution.correlationId,
          idempotencyKey: execution.id,
          plan: approval.plan,
        }),
      });
    } catch {
      throw new OrchestratorDispatchError(
        'Durable orchestrator dispatch outcome is unknown',
        'ambiguous',
      );
    }
    if (!response.ok) {
      const outcome = definitiveRejectionStatuses.has(response.status)
        ? 'rejected'
        : 'ambiguous';
      throw new OrchestratorDispatchError(
        outcome === 'rejected'
          ? `Durable orchestrator rejected the execution with HTTP ${response.status}`
          : `Durable orchestrator dispatch outcome is unknown after HTTP ${response.status}`,
        outcome,
      );
    }
    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new OrchestratorDispatchError(
        'Durable orchestrator accepted the request but returned an unreadable response',
        'ambiguous',
      );
    }
    const parsed = responseSchema.safeParse(responseBody);
    if (!parsed.success) {
      throw new OrchestratorDispatchError(
        'Durable orchestrator accepted the request but returned an invalid response',
        'ambiguous',
      );
    }
    return { orchestrationId: parsed.data.orchestrationId };
  }
}
