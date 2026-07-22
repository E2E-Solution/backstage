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

import type { AzureResourceRef } from './types';

const subscriptionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @public */
export function normalizeAzureResourceId(resourceId: string): string {
  const normalized = `/${resourceId.trim().replace(/^\/+|\/+$/g, '')}`
    .replace(/\/+/g, '/')
    .toLocaleLowerCase('en-US');
  return normalized === '/' ? '' : normalized;
}

/** @public */
export function parseAzureResourceId(
  resourceId: string,
): AzureResourceRef | undefined {
  const id = normalizeAzureResourceId(resourceId);
  const segments = id.split('/').filter(Boolean);
  if (
    segments[0] !== 'subscriptions' ||
    !subscriptionIdPattern.test(segments[1] ?? '')
  ) {
    return undefined;
  }

  const subscriptionId = segments[1];
  if (segments.length === 2) {
    return { id, scopeType: 'subscription', subscriptionId };
  }

  if (segments[2] === 'providers') {
    if (segments.length < 6 || segments.length % 2 !== 0) {
      return undefined;
    }
    const providerNamespace = segments[3];
    const typeSegments: string[] = [];
    const nameSegments: string[] = [];
    for (let index = 4; index < segments.length; index += 2) {
      typeSegments.push(segments[index]);
      nameSegments.push(segments[index + 1]);
    }
    return {
      id,
      scopeType: 'resource',
      subscriptionId,
      providerNamespace,
      resourceType: `${providerNamespace}/${typeSegments.join('/')}`,
      resourceName: nameSegments.join('/'),
    };
  }

  if (
    segments[2] !== 'resourcegroups' ||
    !segments[3] ||
    (segments.length > 4 && segments[4] !== 'providers')
  ) {
    return undefined;
  }

  const resourceGroup = segments[3];
  if (segments.length === 4) {
    return {
      id,
      scopeType: 'resource-group',
      subscriptionId,
      resourceGroup,
    };
  }

  if (segments.length < 8 || segments.length % 2 !== 0) {
    return undefined;
  }

  const providerNamespace = segments[5];
  const typeSegments: string[] = [];
  const nameSegments: string[] = [];
  for (let index = 6; index < segments.length; index += 2) {
    typeSegments.push(segments[index]);
    nameSegments.push(segments[index + 1]);
  }

  return {
    id,
    scopeType: 'resource',
    subscriptionId,
    resourceGroup,
    providerNamespace,
    resourceType: `${providerNamespace}/${typeSegments.join('/')}`,
    resourceName: nameSegments.join('/'),
  };
}
