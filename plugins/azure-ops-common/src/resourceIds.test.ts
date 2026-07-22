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

import { normalizeAzureResourceId, parseAzureResourceId } from './resourceIds';

describe('Azure resource IDs', () => {
  it('normalizes and parses subscription, resource group, and nested resources', () => {
    expect(
      normalizeAzureResourceId(
        ' //SUBSCRIPTIONS/00000000-0000-0000-0000-000000000001// ',
      ),
    ).toBe('/subscriptions/00000000-0000-0000-0000-000000000001');

    expect(
      parseAzureResourceId(
        '/subscriptions/00000000-0000-0000-0000-000000000001',
      ),
    ).toEqual({
      id: '/subscriptions/00000000-0000-0000-0000-000000000001',
      scopeType: 'subscription',
      subscriptionId: '00000000-0000-0000-0000-000000000001',
    });

    expect(
      parseAzureResourceId(
        '/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/Operations',
      ),
    ).toMatchObject({
      scopeType: 'resource-group',
      resourceGroup: 'operations',
    });

    expect(
      parseAzureResourceId(
        '/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/Operations/providers/Microsoft.Web/sites/Portal/slots/Blue',
      ),
    ).toMatchObject({
      scopeType: 'resource',
      providerNamespace: 'microsoft.web',
      resourceType: 'microsoft.web/sites/slots',
      resourceName: 'portal/blue',
    });

    expect(
      parseAzureResourceId(
        '/subscriptions/00000000-0000-0000-0000-000000000001/providers/Microsoft.Authorization/policyAssignments/Baseline',
      ),
    ).toEqual({
      id: '/subscriptions/00000000-0000-0000-0000-000000000001/providers/microsoft.authorization/policyassignments/baseline',
      scopeType: 'resource',
      subscriptionId: '00000000-0000-0000-0000-000000000001',
      providerNamespace: 'microsoft.authorization',
      resourceType: 'microsoft.authorization/policyassignments',
      resourceName: 'baseline',
    });
  });

  it('rejects malformed or tenant-level identifiers', () => {
    expect(parseAzureResourceId('')).toBeUndefined();
    expect(
      parseAzureResourceId('/providers/Microsoft.Management'),
    ).toBeUndefined();
    expect(
      parseAzureResourceId(
        '/subscriptions/not-a-guid/resourceGroups/operations',
      ),
    ).toBeUndefined();
    expect(
      parseAzureResourceId(
        '/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/operations/providers/Microsoft.Web/sites',
      ),
    ).toBeUndefined();
    expect(
      parseAzureResourceId(
        '/subscriptions/00000000-0000-0000-0000-000000000001/providers/Microsoft.Authorization/policyAssignments',
      ),
    ).toBeUndefined();
  });
});
