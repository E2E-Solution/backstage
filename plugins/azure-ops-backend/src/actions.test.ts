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

import { PermissionsService } from '@backstage/backend-plugin-api';
import { ActionsRegistryService } from '@backstage/backend-plugin-api/alpha';
import { mockCredentials } from '@backstage/backend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { registerAzureOpsActions } from './actions';
import { AzureOpsStore } from './services/store';

describe('registerAzureOpsActions', () => {
  it('marks incident listing read-only and gates it with read permission', async () => {
    const register = jest.fn();
    const authorize = jest
      .fn()
      .mockResolvedValue([{ result: AuthorizeResult.ALLOW }]);
    const permissions = { authorize } as unknown as PermissionsService;
    const listIncidents = jest.fn().mockResolvedValue([]);
    const credentials = mockCredentials.user();
    registerAzureOpsActions({
      actionsRegistry: { register } as unknown as ActionsRegistryService,
      permissions,
      reader: {
        refresh: jest.fn(),
        summary: jest.fn(),
        resources: jest.fn(),
      },
      plans: {
        templates: jest.fn(),
        create: jest.fn(),
      },
      store: { listIncidents } as unknown as AzureOpsStore,
    });

    expect(
      register.mock.calls.map(([action]) => [action.name, action.attributes]),
    ).toEqual([
      ['summary', { destructive: false, readOnly: true, idempotent: true }],
      [
        'list-incidents',
        { destructive: false, readOnly: true, idempotent: true },
      ],
      [
        'list-resources',
        { destructive: false, readOnly: true, idempotent: true },
      ],
      [
        'create-plan',
        { destructive: false, readOnly: false, idempotent: false },
      ],
    ]);

    const incidentAction = register.mock.calls
      .map(([action]) => action)
      .find(action => action.name === 'list-incidents');
    expect(incidentAction).toBeDefined();
    await incidentAction.action({
      input: { status: 'active', limit: 10 },
      credentials,
    });
    expect(authorize).toHaveBeenCalledWith(
      [{ permission: expect.objectContaining({ name: 'azureOps.read' }) }],
      { credentials },
    );
    expect(listIncidents).toHaveBeenCalledWith({
      status: 'active',
      limit: 10,
    });
  });
});
