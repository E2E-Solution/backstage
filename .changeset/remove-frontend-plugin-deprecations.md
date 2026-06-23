---
'@backstage/frontend-plugin-api': minor
---

Removed deprecated frontend system APIs. The replacements are:

- Use `ToastApi` instead of the alert API.
- Import `AnalyticsImplementationBlueprint` and `AnalyticsImplementationFactory` from `@backstage/plugin-app-react`.
- Use `IconElement` and `IconsApi.icon` for icons. The legacy `IconComponent` type remains available from `@backstage/core-plugin-api`.
- Use `PageLayoutTab` instead of `PageTab`, `CreateFrontendPluginOptions` instead of `PluginOptions`, and `pluginId` instead of the `id` alias.
- Use `DialogApi.open` instead of `show` or `showModal`.
- Call `createApiRef<T>().with(...)` instead of passing options directly to `createApiRef`.
- Use `configSchema` with Standard Schema-compatible schemas instead of the Zod v3 `config.schema` callback form.
- Import `ExtensionFactoryMiddleware` from `@backstage/frontend-app-api` and `withApis` from `@backstage/core-plugin-api`.
