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

import { AzureResourceGraphGateway } from './resourceGraph';

const subscription = '11111111-1111-1111-1111-111111111111';

describe('AzureResourceGraphGateway', () => {
  it('collects more than 10,000 rows across continuation pages', async () => {
    let page = 0;
    const resources = jest.fn(async () => {
      page += 1;
      return {
        data: Array.from({ length: 1000 }, (_, index) => ({
          id: `${page}-${index}`,
        })),
        skipToken: page < 11 ? `page-${page + 1}` : undefined,
      };
    });
    const gateway = AzureResourceGraphGateway.forTest({ resources });

    await expect(gateway.query('Resources', [subscription])).resolves.toEqual({
      rows: expect.arrayContaining([{ id: '1-0' }, { id: '11-999' }]),
      partial: false,
    });
    expect(resources).toHaveBeenCalledTimes(11);
  });

  it('returns collected rows as partial at the page bound or after a later failure', async () => {
    const bounded = AzureResourceGraphGateway.forTest(
      {
        resources: jest.fn(async () => ({
          data: [{ id: 'row' }],
          skipToken: 'more',
        })),
      },
      2,
    );
    await expect(bounded.query('Resources', [subscription])).resolves.toEqual({
      rows: [{ id: 'row' }, { id: 'row' }],
      partial: true,
      message:
        'Azure Resource Graph query reached the 2-page safety limit with more results available',
    });

    const resources = jest
      .fn()
      .mockResolvedValueOnce({ data: [{ id: 'kept' }], skipToken: 'next' })
      .mockRejectedValueOnce(new Error('page unavailable'));
    const failed = AzureResourceGraphGateway.forTest({ resources });
    await expect(failed.query('Resources', [subscription])).resolves.toEqual({
      rows: [{ id: 'kept' }],
      partial: true,
      message: 'Azure Resource Graph page 2 failed: page unavailable',
    });
  });
});
