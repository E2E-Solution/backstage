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

import { coreExtensionData } from '@backstage/frontend-plugin-api';
import {
  createExtensionTester,
  renderTestApp,
} from '@backstage/frontend-test-utils';
import { screen } from '@testing-library/react';
import plugin from './index';
import { azureOpsPage, azureOpsPlugin } from './plugin';

describe('azure-ops', () => {
  it('exports the plugin and expected page routes', () => {
    expect(plugin).toBe(azureOpsPlugin);
    expect(azureOpsPlugin).toBeDefined();
    const tester = createExtensionTester(azureOpsPage);
    expect(tester.get(coreExtensionData.routePath)).toBe('/azure-ops');
  });

  it('attaches the subpages to the registered plugin page', async () => {
    renderTestApp({
      features: [azureOpsPlugin],
      initialRouteEntries: ['/azure-ops/dashboard'],
    });

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Command Center')).toBeInTheDocument();
  });
});
