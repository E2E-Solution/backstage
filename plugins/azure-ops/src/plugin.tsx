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
  createFrontendPlugin,
  PageBlueprint,
  SubPageBlueprint,
} from '@backstage/frontend-plugin-api';
import { RiCloudLine } from '@remixicon/react';

import {
  approvalsRouteRef,
  commandCenterRouteRef,
  dashboardRouteRef,
  rootRouteRef,
  statusRouteRef,
} from './routes';

export const azureOpsPage = PageBlueprint.make({
  name: 'azure-ops',
  params: {
    path: '/azure-ops',
    routeRef: rootRouteRef,
    title: 'Azure Ops',
    icon: <RiCloudLine />,
  },
});

export const dashboardSubPage = SubPageBlueprint.make({
  attachTo: { id: 'page:azure-ops/azure-ops', input: 'pages' },
  name: 'dashboard',
  params: {
    path: 'dashboard',
    title: 'Dashboard',
    routeRef: dashboardRouteRef,
    loader: () => import('./components/Dashboard').then(m => <m.Dashboard />),
  },
});

export const statusSubPage = SubPageBlueprint.make({
  attachTo: { id: 'page:azure-ops/azure-ops', input: 'pages' },
  name: 'status',
  params: {
    path: 'status',
    title: 'Status',
    routeRef: statusRouteRef,
    loader: () => import('./components/Status').then(m => <m.Status />),
  },
});

export const approvalsSubPage = SubPageBlueprint.make({
  attachTo: { id: 'page:azure-ops/azure-ops', input: 'pages' },
  name: 'approvals',
  params: {
    path: 'approvals',
    title: 'Approvals',
    routeRef: approvalsRouteRef,
    loader: () => import('./components/Approvals').then(m => <m.Approvals />),
  },
});

export const commandCenterSubPage = SubPageBlueprint.make({
  attachTo: { id: 'page:azure-ops/azure-ops', input: 'pages' },
  name: 'command-center',
  params: {
    path: 'command-center',
    title: 'Command Center',
    routeRef: commandCenterRouteRef,
    loader: () =>
      import('./components/CommandCenter').then(m => <m.CommandCenter />),
  },
});

/**
 * Azure operations control plane frontend plugin.
 *
 * @public
 */
export const azureOpsPlugin = createFrontendPlugin({
  pluginId: 'azure-ops',
  title: 'Azure Ops',
  icon: <RiCloudLine />,
  info: { packageJson: () => import('../package.json') },
  extensions: [
    azureOpsPage,
    dashboardSubPage,
    statusSubPage,
    approvalsSubPage,
    commandCenterSubPage,
  ],
  routes: {
    root: rootRouteRef,
    dashboard: dashboardRouteRef,
    status: statusRouteRef,
    approvals: approvalsRouteRef,
    commandCenter: commandCenterRouteRef,
  },
});
