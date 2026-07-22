# Azure Ops backend

This plugin provides deterministic Azure inventory and operation planning,
approval, execution dispatch, audit, and reactive Azure Monitor incidents.

## Local Microsoft Entra setup

The localhost POC uses two separate identities:

- A Backstage user signs in through the Microsoft Entra authorization-code flow
  in the browser.
- The Azure Ops backend reads Azure Resource Graph with a service identity. The
  localhost POC may use an explicit client-secret service principal; production
  always uses managed identity.

Create the dedicated single-tenant app registration
`Backstage Local Azure Ops` out-of-band. Add a **Web** platform with the exact
redirect URI
`http://localhost:7007/api/auth/microsoft/handler/frame`, create a client
secret, and retain the standard delegated OpenID scopes and Microsoft Graph
`User.Read` permission used for sign-in. Set these environment variables before
starting Backstage:

```bash
export AUTH_MICROSOFT_TENANT_ID='<tenant-uuid>'
export AUTH_MICROSOFT_CLIENT_ID='<application-client-uuid>'
export AUTH_MICROSOFT_CLIENT_SECRET='<client-secret>'
```

Do not commit or log the secret. For this local POC, grant the app registration's
service principal the Azure **Reader** role on both subscriptions allowlisted in
`azureOps.subscriptions`. The same environment-backed registration is
intentionally referenced by both localhost authentication configurations, but
the signed-in user's token is never used for Azure resource access.

Production must remove the development-only catalog bypass and guest fallback,
ingest users into the catalog, and use managed identity for Resource Graph.
Use separate app registrations and least-privilege roles for user sign-in and
service workloads as appropriate.

## Azure Monitor ingress

`POST /api/azure-ops/events/azure-monitor` is a normalized ingestion endpoint
for a trusted ingress adapter. The adapter must send the Azure Monitor common
alert schema using Backstage **SERVICE** credentials. Configure
`backend.auth.externalAccess` for that service and set
`accessRestrictions: [{ plugin: azure-ops }]`, then add that entry's exact
service `subject` to
`azureOps.ingress.azureMonitor.allowedSubjects`. Supply credentials through an
environment-backed secret; do not store token values in configuration. The
allowlist is case-sensitive, accepts no patterns, and fails closed when absent.

Azure Monitor Action Groups and the common alert schema remain authoritative.
A production deployment can place a Service Bus adapter ahead of Backstage,
but this plugin does not claim Service Bus delivery and must not be exposed as
an unauthenticated Action Group webhook.

The endpoint stores only bounded, normalized incident fields and canonical
Azure target IDs. It discards `alertContext` and does not persist the full
request. First-fire and resolution transitions send broadcast Backstage
notifications linked to `/azure-ops/status`. If notification delivery fails,
the incident and its delivery intent remain persisted and the request returns
an explicit retryable failure until every required delivery is durably
acknowledged. Replayed ingress retries available delivery, while a bounded
scheduled reconciler recovers pending and expired leases without another
ingress request. Notifications that were durably marked delivered are never
sent again; a successful send whose acknowledgement cannot be persisted remains
leased and is retried only after lease expiry.

## Durable orchestrator integration

Configure `azureOps.orchestrator.endpoint` and
`azureOps.orchestrator.audience` together. Dispatch uses a managed identity in
production and requests the audience's `/.default` scope. An optional
`managedIdentityClientId` under `azureOps.orchestrator` selects a dedicated
user-assigned identity.

The orchestrator reports status through
`POST /api/azure-ops/events/orchestrator`. This endpoint accepts only bounded
status payloads with matching execution, orchestration, and correlation IDs.
It requires Backstage **SERVICE** credentials and must use an
`accessRestrictions: [{ plugin: azure-ops }]` external access entry separate
from user access and the Azure Monitor ingress credential. Add its exact
service `subject` to `azureOps.orchestrator.callbackAllowedSubjects`; a Monitor
ingress subject is not accepted for orchestrator callbacks, or vice versa.

## Installation

This plugin is installed via the
`@internal/backstage-plugin-azure-ops-backend` package. To install it to your
backend package, run the following command:

```bash
# From your root directory
yarn --cwd packages/backend add @internal/backstage-plugin-azure-ops-backend
```

Then add the plugin to your backend in `packages/backend/src/index.ts`:

```ts
const backend = createBackend();
// ...
backend.add(import('@internal/backstage-plugin-azure-ops-backend'));
```

## Development

This plugin backend can be started in a standalone mode from directly in this
package with `yarn start`. It is a limited setup that is most convenient when
developing the plugin backend itself.

If you want to run the entire project, including the frontend, run `yarn start`
from the root directory.
