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
  makeValidator,
  parseEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import type { CompoundEntityRef } from '@backstage/catalog-model';
import type { Config } from '@backstage/config';
import { parseAzureResourceId } from '@internal/backstage-plugin-azure-ops-common';

export interface CuratedAzureCatalogTarget {
  resourceId: string;
  name: string;
  owner: string;
  type: string;
  system?: string;
  description?: string;
  tags?: string[];
}

const validators = makeValidator();

function invalid(path: string, message: string): never {
  throw new Error(`Invalid configuration at ${path}: ${message}`);
}

function normalizeEntityRef(
  value: string,
  path: string,
  expectedKinds: string[],
  defaultKind: string,
): string {
  let ref: CompoundEntityRef;
  try {
    ref = parseEntityRef(value, {
      defaultKind,
      defaultNamespace: 'default',
    });
  } catch (error) {
    invalid(path, error instanceof Error ? error.message : String(error));
  }

  if (
    !expectedKinds.includes(ref.kind.toLocaleLowerCase('en-US')) ||
    !validators.isValidNamespace(ref.namespace) ||
    !validators.isValidEntityName(ref.name)
  ) {
    invalid(
      path,
      `expected a valid ${expectedKinds.join(' or ')} entity reference`,
    );
  }

  return stringifyEntityRef(ref);
}

export function readCuratedAzureCatalogTargets(
  config: Config,
): CuratedAzureCatalogTarget[] {
  let targets: Config[];
  try {
    targets = config.getOptionalConfigArray('azureOps.catalog.targets') ?? [];
  } catch (error) {
    invalid(
      'azureOps.catalog.targets',
      error instanceof Error ? error.message : String(error),
    );
  }

  const names = new Set<string>();
  const resourceIds = new Set<string>();

  return targets.map((target, index) => {
    const path = `azureOps.catalog.targets[${index}]`;
    let resourceId: string;
    let name: string;
    let owner: string;
    let type: string;
    let system: string | undefined;
    let description: string | undefined;
    let tags: string[] | undefined;

    try {
      resourceId = target.getString('resourceId');
      name = target.getString('name');
      owner = target.getString('owner');
      type = target.getString('type').trim();
      system = target.getOptionalString('system');
      description = target.getOptionalString('description');
      tags = target.getOptionalStringArray('tags');
    } catch (error) {
      invalid(path, error instanceof Error ? error.message : String(error));
    }

    const parsedResourceId = parseAzureResourceId(resourceId);
    if (!parsedResourceId) {
      invalid(
        `${path}.resourceId`,
        'expected a canonical Azure subscription, resource group, or resource ID',
      );
    }

    if (!validators.isValidEntityName(name)) {
      invalid(`${path}.name`, 'expected a Backstage-safe entity name');
    }
    if (names.has(name.toLocaleLowerCase('en-US'))) {
      invalid(`${path}.name`, `duplicate catalog entity name "${name}"`);
    }
    names.add(name.toLocaleLowerCase('en-US'));

    if (resourceIds.has(parsedResourceId.id)) {
      invalid(
        `${path}.resourceId`,
        `duplicate Azure resource ID "${parsedResourceId.id}"`,
      );
    }
    resourceIds.add(parsedResourceId.id);

    if (!type) {
      invalid(`${path}.type`, 'expected a non-empty resource type');
    }

    for (const [tagIndex, tag] of (tags ?? []).entries()) {
      if (!validators.isValidTag(tag)) {
        invalid(
          `${path}.tags[${tagIndex}]`,
          'expected a Backstage-safe metadata tag',
        );
      }
    }

    return {
      resourceId: parsedResourceId.id,
      name,
      owner: normalizeEntityRef(
        owner,
        `${path}.owner`,
        ['group', 'user'],
        'Group',
      ),
      type,
      ...(system
        ? {
            system: normalizeEntityRef(
              system,
              `${path}.system`,
              ['system'],
              'System',
            ),
          }
        : {}),
      ...(description !== undefined ? { description } : {}),
      ...(tags !== undefined ? { tags } : {}),
    };
  });
}
