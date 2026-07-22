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
    /** Enables Azure queries and scheduled refresh. Defaults to false. */
    enabled?: boolean;
    /** Azure subscription UUIDs that the plugin may query and plan against. */
    subscriptions?: string[];
    refresh?: {
      /** Inventory cache refresh frequency. */
      frequency?: string | { minutes?: number; hours?: number };
      /** Maximum duration of a refresh. */
      timeout?: string | { seconds?: number; minutes?: number };
      /** Maximum Azure Resource Graph pages collected per query. */
      maxPages?: number;
    };
    managedIdentity?: {
      /** User-assigned managed identity client ID. */
      clientId?: string;
    };
    /** Local development service principal for Azure Resource Graph only. */
    servicePrincipal?: {
      /** Microsoft Entra tenant ID. */
      tenantId: string;
      /** Microsoft Entra application (client) ID. */
      clientId: string;
      /**
       * Microsoft Entra client secret.
       * @visibility secret
       */
      clientSecret: string;
    };
    plans?: {
      /** Lifetime of a deterministic plan. */
      ttl?: string | { minutes?: number; hours?: number };
      /** Maximum resources accepted by a plan request. */
      maxResourceCount?: number;
    };
    ingress?: {
      azureMonitor?: {
        /** Exact Backstage service subjects allowed to submit Azure Monitor events. */
        allowedSubjects?: string[];
      };
    };
    orchestrator?: {
      /** Durable orchestrator HTTPS endpoint. Must not contain credentials. */
      endpoint?: string;
      /** Microsoft Entra application ID URI used as the token audience. */
      audience?: string;
      /** Optional user-assigned managed identity client ID for dispatch. */
      managedIdentityClientId?: string;
      /** Exact Backstage service subjects allowed to submit orchestrator callbacks. */
      callbackAllowedSubjects?: string[];
    };
    foundry?: {
      /** HTTPS Microsoft Foundry project endpoint. */
      projectEndpoint?: string;
      /** Existing read-only prompt agent name. */
      promptAgentName?: string;
      /** Optional user-assigned managed identity client ID for Foundry. */
      managedIdentityClientId?: string;
    };
  };
}
