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

/** @public */
export const AZURE_OPS_PLUGIN_ID = 'azure-ops';

/** @public */
export const AZURE_RESOURCE_ID_ANNOTATION = 'azure.com/resource-id';

/** @public */
export const azureOperationTemplateIds = [
  'virtual-machine.start',
  'virtual-machine.restart',
  'virtual-machine.deallocate',
  'app-service.start',
  'app-service.stop',
  'app-service.restart',
  'function-app.start',
  'function-app.stop',
  'function-app.restart',
  'logic-app.trigger.enable',
  'logic-app.trigger.disable',
  'aks.cluster.start',
  'aks.cluster.stop',
  'aks.node-pool.scale',
  'kubernetes.deployment.restart',
  'kubernetes.deployment.scale',
  'container-app.revision.activate',
  'container-app.traffic.update',
  'container-app.scale.update',
  'policy.remediation.create',
] as const;

/** @public */
export type AzureOperationTemplateId =
  (typeof azureOperationTemplateIds)[number];
