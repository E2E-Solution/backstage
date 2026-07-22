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

import type { LoggerService } from '@backstage/backend-plugin-api';
import type { ResourceEntityV1alpha1 } from '@backstage/catalog-model';
import type { Config } from '@backstage/config';
import type {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import {
  CuratedAzureCatalogTarget,
  readCuratedAzureCatalogTargets,
} from './config';

const PROVIDER_NAME = 'azure-ops-curated-ownership';
const LOCATION_KEY = 'azure-ops-curated-ownership';
const LOCATION_REF = `provider:${PROVIDER_NAME}`;

function targetToEntity(
  target: CuratedAzureCatalogTarget,
): ResourceEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: target.name,
      annotations: {
        'azure.com/resource-id': target.resourceId,
        'backstage.io/managed-by-location': LOCATION_REF,
        'backstage.io/managed-by-origin-location': LOCATION_REF,
      },
      ...(target.description !== undefined
        ? { description: target.description }
        : {}),
      ...(target.tags !== undefined ? { tags: target.tags } : {}),
    },
    spec: {
      type: target.type,
      owner: target.owner,
      ...(target.system ? { system: target.system } : {}),
    },
  };
}

/**
 * Provides the curated Azure ownership projection configured for Azure Ops.
 *
 * @public
 */
export class CuratedAzureEntityProvider implements EntityProvider {
  static fromConfig(
    config: Config,
    options: { logger: LoggerService },
  ): CuratedAzureEntityProvider {
    return new CuratedAzureEntityProvider(
      readCuratedAzureCatalogTargets(config),
      options.logger,
    );
  }

  private constructor(
    private readonly targets: CuratedAzureCatalogTarget[],
    private readonly logger: LoggerService,
  ) {}

  getProviderName(): string {
    return PROVIDER_NAME;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    if (this.targets.length === 0) {
      this.logger.info('No curated Azure catalog targets are configured');
    }

    const entities = [...this.targets]
      .sort((left, right) => left.name.localeCompare(right.name, 'en-US'))
      .map(target => ({
        locationKey: LOCATION_KEY,
        entity: targetToEntity(target),
      }));

    await connection.applyMutation({
      type: 'full',
      entities,
    });

    this.logger.info(
      `Applied ${entities.length} curated Azure catalog target(s)`,
    );
  }
}
