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
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { AzureOpsPermissionPolicy } from './policy';

/**
 * Permission policy module that enforces the configured Azure Ops roles.
 *
 * @public
 */
export const permissionModuleAzureOpsPolicy = createBackendModule({
  pluginId: 'permission',
  moduleId: 'azure-ops-policy',
  register(reg) {
    reg.registerInit({
      deps: {
        config: coreServices.rootConfig,
        policy: policyExtensionPoint,
      },
      async init({ config, policy }) {
        policy.setPolicy(AzureOpsPermissionPolicy.fromConfig(config));
      },
    });
  },
});
