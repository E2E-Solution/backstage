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

import { screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { DashboardContent } from './Dashboard';

describe('DashboardContent', () => {
  it('keeps disabled and unavailable source states visible', async () => {
    await renderInTestApp(
      <DashboardContent
        summary={{
          generatedAt: '2026-07-21T00:00:00.000Z',
          resources: {
            total: 0,
            available: 0,
            degraded: 0,
            unavailable: 0,
            unknown: 0,
          },
          alerts: { active: 0, critical: 0 },
          policy: { compliant: 0, nonCompliant: 0, unknown: 0 },
          advisor: { highImpact: 0, total: 0 },
          sources: [
            {
              source: 'resource-graph',
              observedAt: '2026-07-21T00:00:00.000Z',
              status: 'unavailable',
              message: 'Azure Ops is disabled',
            },
          ],
        }}
      />,
    );

    expect(
      await screen.findByText(/Azure data is incomplete or unavailable/),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Azure Ops is disabled/)).not.toHaveLength(0);
    expect(screen.getAllByText(/Unavailable/)).not.toHaveLength(0);
    expect(
      screen.getByText(/All Azure writes require an explicit approval/),
    ).toBeInTheDocument();
  });
});
