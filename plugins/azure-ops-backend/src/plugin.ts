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
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { actionsRegistryServiceRef } from '@backstage/backend-plugin-api/alpha';
import { notificationService } from '@backstage/plugin-notifications-node';
import { azureOpsPermissions } from '@internal/backstage-plugin-azure-ops-common';
import { createRouter } from './router';
import { registerAzureOpsActions } from './actions';
import { readAzureOpsConfig } from './config';
import { HttpOrchestratorDispatcher } from './services/dispatcher';
import { DefaultAzureOpsReader } from './services/inventory';
import { DeterministicPlanService } from './services/planning';
import { AzureResourceGraphGateway } from './services/resourceGraph';
import { AzureOpsStore } from './services/store';
import {
  AIProjectFoundryAnalysisClient,
  FoundryAnalysisService,
} from './services/foundry';
import { createAzureCredential } from './services/azureCredential';
import { IncidentNotificationDeliveryService } from './services/notificationDelivery';

/**
 * Deterministic Azure operations backend.
 *
 * @public
 */
export const azureOpsPlugin = createBackendPlugin({
  pluginId: 'azure-ops',
  register(env) {
    env.registerInit({
      deps: {
        actionsRegistry: actionsRegistryServiceRef,
        config: coreServices.rootConfig,
        database: coreServices.database,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        notifications: notificationService,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
        scheduler: coreServices.scheduler,
      },
      async init({
        actionsRegistry,
        config,
        database,
        httpAuth,
        httpRouter,
        logger,
        notifications,
        permissions,
        permissionsRegistry,
        scheduler,
      }) {
        const azureConfig = readAzureOpsConfig(config);
        const gateway = AzureResourceGraphGateway.create({
          managedIdentityClientId: azureConfig.managedIdentityClientId,
          production: process.env.NODE_ENV === 'production',
          maxPages: azureConfig.resourceGraphMaxPages,
          servicePrincipal: azureConfig.servicePrincipal,
        });
        const reader = new DefaultAzureOpsReader({
          enabled: azureConfig.enabled,
          subscriptions: azureConfig.subscriptions,
          gateway,
        });
        const plans = new DeterministicPlanService({
          enabled: azureConfig.enabled,
          subscriptions: azureConfig.subscriptions,
          ttlMs: azureConfig.planTtlMs,
        });
        const store = await AzureOpsStore.create({ database });
        const notificationDelivery = IncidentNotificationDeliveryService.create(
          {
            store,
            notifications,
            logger,
          },
        );
        const dispatcher = new HttpOrchestratorDispatcher({
          endpoint: azureConfig.orchestratorEndpoint,
          audience: azureConfig.orchestratorAudience,
          credential: azureConfig.orchestratorEndpoint
            ? createAzureCredential({
                managedIdentityClientId:
                  azureConfig.orchestratorManagedIdentityClientId,
                production: process.env.NODE_ENV === 'production',
              })
            : undefined,
        });
        const analysis = new FoundryAnalysisService({
          reader,
          client: azureConfig.foundry
            ? AIProjectFoundryAnalysisClient.create({
                ...azureConfig.foundry,
                production: process.env.NODE_ENV === 'production',
              })
            : undefined,
        });
        permissionsRegistry.addPermissions(azureOpsPermissions);
        permissionsRegistry.addPermissions(azureOpsPermissions);
        httpRouter.use(
          await createRouter({
            enabled: azureConfig.enabled,
            httpAuth,
            permissions,
            reader,
            plans,
            store,
            dispatcher,
            analysis,
            notificationDelivery,
            azureMonitorAllowedSubjects:
              azureConfig.azureMonitorAllowedSubjects,
            orchestratorCallbackAllowedSubjects:
              azureConfig.orchestratorCallbackAllowedSubjects,
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        registerAzureOpsActions({
          actionsRegistry,
          permissions,
          reader,
          plans,
          store,
        });

        if (azureConfig.enabled) {
          await scheduler.scheduleTask({
            id: 'azure-ops-inventory-refresh',
            frequency: azureConfig.refreshFrequency,
            timeout: azureConfig.refreshTimeout,
            initialDelay: azureConfig.refreshFrequency,
            fn: () => reader.refresh(),
          });
          void reader
            .refresh()
            .then(() => {
              logger.info('Completed initial Azure Ops inventory refresh');
            })
            .catch(error => {
              logger.error('Initial Azure Ops inventory refresh failed', error);
            });
        }
        await scheduler.scheduleTask({
          id: 'azure-ops-notification-reconciliation',
          frequency: { minutes: 1 },
          timeout: { seconds: 45 },
          initialDelay: { seconds: 15 },
          fn: async () => {
            await notificationDelivery.reconcile();
          },
        });
      },
    });
  },
});
