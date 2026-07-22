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

import type { FetchApi } from '@backstage/frontend-plugin-api';
import { AzureOpsClient } from './AzureOpsClient';

describe('AzureOpsClient', () => {
  it('requests incidents with bounded filters', async () => {
    const fetchApi: FetchApi = {
      fetch: jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    };

    await expect(
      new AzureOpsClient(fetchApi).getIncidents({
        status: 'active',
        severity: 'Sev1',
        limit: 25,
      }),
    ).resolves.toEqual([]);
    expect(fetchApi.fetch).toHaveBeenCalledWith(
      'plugin://azure-ops/incidents?limit=25&status=active&severity=Sev1',
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
  });

  it('propagates backend errors without returning fallback data', async () => {
    const fetchApi: FetchApi = {
      fetch: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              name: 'NotAllowedError',
              message: "Permission 'azure-ops.read' is required",
            },
            response: { statusCode: 403 },
          }),
          {
            status: 403,
            statusText: 'Forbidden',
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    };

    const request = new AzureOpsClient(fetchApi).getSummary();

    await expect(request).rejects.toMatchObject({
      name: 'ResponseError',
      statusCode: 403,
      cause: {
        name: 'NotAllowedError',
        message: "Permission 'azure-ops.read' is required",
      },
    });
  });
});
