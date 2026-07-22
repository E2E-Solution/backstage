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

import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import type { EntityProvider } from '@backstage/plugin-catalog-node';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { catalogModuleAzureOps } from './module';

describe('catalogModuleAzureOps', () => {
  it('registers the curated provider with the catalog extension point', async () => {
    let provider: EntityProvider | undefined;

    await startTestBackend({
      extensionPoints: [
        [
          catalogProcessingExtensionPoint,
          {
            addEntityProvider(added: EntityProvider | EntityProvider[]) {
              provider = Array.isArray(added) ? added[0] : added;
            },
          },
        ],
      ],
      features: [
        catalogModuleAzureOps,
        mockServices.rootConfig.factory({
          data: { azureOps: { catalog: { targets: [] } } },
        }),
        mockServices.logger.factory(),
      ],
    });

    expect(provider?.getProviderName()).toBe('azure-ops-curated-ownership');
  });
});
