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

export interface Config {
  azureOps?: {
    catalog?: {
      /** Curated Azure scopes and resources represented in the catalog. */
      targets?: Array<{
        /** Canonical Azure resource ID for a subscription, resource group, or resource. */
        resourceId: string;
        /** Backstage-safe metadata name. */
        name: string;
        /** User or Group entity reference that owns this target. */
        owner: string;
        /** Catalog resource type, for example azure-resource-group. */
        type: string;
        /** Optional System entity reference. */
        system?: string;
        /** Optional human-readable operating context. */
        description?: string;
        /** Optional Backstage metadata tags. */
        tags?: string[];
      }>;
    };
  };
}
