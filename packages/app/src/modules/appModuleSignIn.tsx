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

import { SignInPage, type IdentityProviders } from '@backstage/core-components';
import { microsoftAuthApiRef } from '@backstage/core-plugin-api';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';

export const signInProviders: IdentityProviders = [
  {
    id: 'microsoft-auth-provider',
    title: 'Microsoft',
    message: 'Sign in with Microsoft Entra ID',
    apiRef: microsoftAuthApiRef,
  },
  'guest',
];

export const microsoftSignInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => props =>
      <SignInPage {...props} providers={signInProviders} />,
  },
});

export const appModuleSignIn = createFrontendModule({
  pluginId: 'app',
  extensions: [microsoftSignInPage],
});
