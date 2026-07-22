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

import { ResourceGraphClient } from '@azure/arm-resourcegraph';
import type { AzureServicePrincipalConfig } from '../config';
import { createAzureCredential } from './azureCredential';

export interface ResourceGraphGateway {
  query(
    query: string,
    subscriptions: string[],
  ): Promise<ResourceGraphQueryResult>;
}

export interface ResourceGraphQueryResult {
  rows: unknown[];
  partial: boolean;
  message?: string;
}

interface ResourceGraphClientLike {
  resources(request: {
    subscriptions: string[];
    query: string;
    options: {
      resultFormat: 'objectArray';
      top: number;
      skipToken?: string;
    };
  }): Promise<{ data: unknown; skipToken?: string }>;
}

function rowsFromResponse(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (
    typeof data === 'object' &&
    data !== null &&
    'rows' in data &&
    Array.isArray(data.rows) &&
    'columns' in data &&
    Array.isArray(data.columns)
  ) {
    const names = data.columns.map(column =>
      typeof column === 'object' &&
      column !== null &&
      'name' in column &&
      typeof column.name === 'string'
        ? column.name
        : undefined,
    );
    return data.rows.map(row => {
      if (!Array.isArray(row)) {
        return row;
      }
      return Object.fromEntries(
        names.flatMap((name, index) =>
          name === undefined ? [] : [[name, row[index]]],
        ),
      );
    });
  }
  throw new Error('Azure Resource Graph returned an unsupported result shape');
}

export class AzureResourceGraphGateway implements ResourceGraphGateway {
  static create(options: {
    managedIdentityClientId?: string;
    production?: boolean;
    maxPages?: number;
    servicePrincipal?: AzureServicePrincipalConfig;
  }): AzureResourceGraphGateway {
    return new AzureResourceGraphGateway(
      new ResourceGraphClient(
        createAzureCredential({
          managedIdentityClientId: options.managedIdentityClientId,
          production: options.production ?? false,
          servicePrincipal: options.servicePrincipal,
        }),
      ),
      options.maxPages,
    );
  }

  static forTest(
    client: ResourceGraphClientLike,
    maxPages?: number,
  ): AzureResourceGraphGateway {
    return new AzureResourceGraphGateway(client, maxPages);
  }

  private constructor(
    private readonly client: ResourceGraphClientLike,
    private readonly maxPages = 100,
  ) {}

  async query(
    query: string,
    subscriptions: string[],
  ): Promise<ResourceGraphQueryResult> {
    const rows: unknown[] = [];
    let skipToken: string | undefined;
    for (let page = 0; page < this.maxPages; page += 1) {
      let response;
      try {
        response = await this.client.resources({
          subscriptions,
          query,
          options: {
            resultFormat: 'objectArray',
            top: 1000,
            skipToken,
          },
        });
      } catch (error) {
        if (page === 0) {
          throw error;
        }
        return {
          rows,
          partial: true,
          message: `Azure Resource Graph page ${page + 1} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
      rows.push(...rowsFromResponse(response.data));
      skipToken = response.skipToken;
      if (!skipToken) {
        return { rows, partial: false };
      }
    }
    return {
      rows,
      partial: true,
      message: `Azure Resource Graph query reached the ${this.maxPages}-page safety limit with more results available`,
    };
  }
}
