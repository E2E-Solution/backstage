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

import { mockServices } from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import type { EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { CuratedAzureEntityProvider } from './CuratedAzureEntityProvider';

const subscriptionId = '00000000-0000-0000-0000-000000000001';
const logger = mockServices.logger.mock();

function config(targets: object[]) {
  return new ConfigReader({
    azureOps: { catalog: { targets } },
  });
}

function connection(): jest.Mocked<EntityProviderConnection> {
  return {
    applyMutation: jest.fn(),
    refresh: jest.fn(),
  };
}

describe('CuratedAzureEntityProvider', () => {
  it('emits normalized subscription, resource group, and resource entities', async () => {
    const provider = CuratedAzureEntityProvider.fromConfig(
      config([
        {
          resourceId: `subscriptions/${subscriptionId}`,
          name: 'production-subscription',
          owner: 'group:default/cloud-platform',
          type: 'azure-subscription',
          description: 'Production landing zone',
          tags: ['azure', 'production'],
        },
        {
          resourceId: `/SUBSCRIPTIONS/${subscriptionId}/RESOURCEGROUPS/Operations/`,
          name: 'operations-rg',
          owner: 'cloud-platform',
          type: 'azure-resource-group',
          system: 'operations',
        },
        {
          resourceId: `/subscriptions/${subscriptionId}/resourceGroups/Operations/providers/Microsoft.Web/sites/Portal`,
          name: 'operations-portal',
          owner: 'user:default/operator',
          type: 'azure-web-app',
        },
      ]),
      { logger },
    );
    const catalogConnection = connection();

    await provider.connect(catalogConnection);

    expect(provider.getProviderName()).toBe('azure-ops-curated-ownership');
    expect(catalogConnection.applyMutation).toHaveBeenCalledWith({
      type: 'full',
      entities: [
        {
          locationKey: 'azure-ops-curated-ownership',
          entity: {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Resource',
            metadata: {
              name: 'operations-portal',
              annotations: {
                'azure.com/resource-id': `/subscriptions/${subscriptionId}/resourcegroups/operations/providers/microsoft.web/sites/portal`,
                'backstage.io/managed-by-location':
                  'provider:azure-ops-curated-ownership',
                'backstage.io/managed-by-origin-location':
                  'provider:azure-ops-curated-ownership',
              },
            },
            spec: {
              type: 'azure-web-app',
              owner: 'user:default/operator',
            },
          },
        },
        {
          locationKey: 'azure-ops-curated-ownership',
          entity: {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Resource',
            metadata: {
              name: 'operations-rg',
              annotations: {
                'azure.com/resource-id': `/subscriptions/${subscriptionId}/resourcegroups/operations`,
                'backstage.io/managed-by-location':
                  'provider:azure-ops-curated-ownership',
                'backstage.io/managed-by-origin-location':
                  'provider:azure-ops-curated-ownership',
              },
            },
            spec: {
              type: 'azure-resource-group',
              owner: 'group:default/cloud-platform',
              system: 'system:default/operations',
            },
          },
        },
        {
          locationKey: 'azure-ops-curated-ownership',
          entity: {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Resource',
            metadata: {
              name: 'production-subscription',
              annotations: {
                'azure.com/resource-id': `/subscriptions/${subscriptionId}`,
                'backstage.io/managed-by-location':
                  'provider:azure-ops-curated-ownership',
                'backstage.io/managed-by-origin-location':
                  'provider:azure-ops-curated-ownership',
              },
              description: 'Production landing zone',
              tags: ['azure', 'production'],
            },
            spec: {
              type: 'azure-subscription',
              owner: 'group:default/cloud-platform',
            },
          },
        },
      ],
    });
  });

  it('rejects duplicate names and normalized resource IDs', () => {
    const base = {
      resourceId: `/subscriptions/${subscriptionId}`,
      name: 'production',
      owner: 'group:default/cloud-platform',
      type: 'azure-subscription',
    };

    expect(() =>
      CuratedAzureEntityProvider.fromConfig(config([base, { ...base }]), {
        logger,
      }),
    ).toThrow('duplicate catalog entity name "production"');

    expect(() =>
      CuratedAzureEntityProvider.fromConfig(
        config([
          base,
          {
            ...base,
            resourceId: `//SUBSCRIPTIONS/${subscriptionId}//`,
            name: 'another-name',
          },
        ]),
        { logger },
      ),
    ).toThrow(`duplicate Azure resource ID "/subscriptions/${subscriptionId}"`);
  });

  it.each([
    [
      {
        resourceId: '/providers/Microsoft.Management',
        name: 'invalid-id',
        owner: 'group:default/cloud-platform',
        type: 'azure-subscription',
      },
      'targets[0].resourceId',
    ],
    [
      {
        resourceId: `/subscriptions/${subscriptionId}`,
        name: 'not a safe name',
        owner: 'group:default/cloud-platform',
        type: 'azure-subscription',
      },
      'targets[0].name',
    ],
    [
      {
        resourceId: `/subscriptions/${subscriptionId}`,
        name: 'invalid-owner',
        owner: 'component:default/portal',
        type: 'azure-subscription',
      },
      'targets[0].owner',
    ],
    [
      {
        resourceId: `/subscriptions/${subscriptionId}`,
        name: 'invalid-system',
        owner: 'group:default/cloud-platform',
        type: 'azure-subscription',
        system: 'group:default/platform',
      },
      'targets[0].system',
    ],
    [
      {
        resourceId: `/subscriptions/${subscriptionId}`,
        name: 'invalid-type',
        owner: 'group:default/cloud-platform',
        type: ' ',
      },
      'targets[0].type',
    ],
    [
      {
        resourceId: `/subscriptions/${subscriptionId}`,
        name: 'invalid-tag',
        owner: 'group:default/cloud-platform',
        type: 'azure-subscription',
        tags: ['Not Valid'],
      },
      'targets[0].tags[0]',
    ],
  ])('rejects invalid target configuration %#', (target, path) => {
    expect(() =>
      CuratedAzureEntityProvider.fromConfig(config([target]), { logger }),
    ).toThrow(`Invalid configuration at azureOps.catalog.${path}`);
  });

  it('uses full mutations to reconcile removed and empty targets', async () => {
    const catalogConnection = connection();
    const firstTarget = {
      resourceId: `/subscriptions/${subscriptionId}`,
      name: 'production',
      owner: 'group:default/cloud-platform',
      type: 'azure-subscription',
    };
    const secondTarget = {
      resourceId: `/subscriptions/00000000-0000-0000-0000-000000000002`,
      name: 'development',
      owner: 'group:default/cloud-platform',
      type: 'azure-subscription',
    };

    await CuratedAzureEntityProvider.fromConfig(
      config([firstTarget, secondTarget]),
      { logger },
    ).connect(catalogConnection);
    await CuratedAzureEntityProvider.fromConfig(config([firstTarget]), {
      logger,
    }).connect(catalogConnection);
    await CuratedAzureEntityProvider.fromConfig(new ConfigReader({}), {
      logger,
    }).connect(catalogConnection);

    expect(catalogConnection.applyMutation).toHaveBeenCalledTimes(3);
    expect(catalogConnection.applyMutation.mock.calls[0][0]).toMatchObject({
      type: 'full',
      entities: [
        { locationKey: 'azure-ops-curated-ownership' },
        { locationKey: 'azure-ops-curated-ownership' },
      ],
    });
    expect(catalogConnection.applyMutation.mock.calls[1][0]).toMatchObject({
      type: 'full',
      entities: [{ locationKey: 'azure-ops-curated-ownership' }],
    });
    expect(catalogConnection.applyMutation.mock.calls[2][0]).toEqual({
      type: 'full',
      entities: [],
    });
    expect(logger.info).toHaveBeenCalledWith(
      'No curated Azure catalog targets are configured',
    );
  });
});
