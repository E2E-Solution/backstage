# Azure Ops Catalog Module

This private catalog backend module projects explicitly curated Azure ownership
and operating context into standard Backstage `Resource` entities. Configure
targets under `azureOps.catalog.targets`:

```yaml
azureOps:
  catalog:
    targets:
      - resourceId: /subscriptions/00000000-0000-0000-0000-000000000001
        name: production-subscription
        owner: group:default/cloud-platform
        type: azure-subscription
        system: system:default/production
        description: Production landing zone
        tags:
          - azure
          - production
      - resourceId: /subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/operations
        name: operations-rg
        owner: group:default/cloud-platform
        type: azure-resource-group
```

Each target becomes a `backstage.io/v1alpha1` `Resource` with the normalized
Azure resource ID in the `azure.com/resource-id` annotation. Names and Azure
resource IDs must be unique.

## Authority boundary

The Backstage Catalog stores only curated ownership and operating context. It
does not mirror live Azure inventory. Azure Resource Graph and the Azure Ops
backend remain authoritative for live resources and state.

Catalog ownership is descriptive and never grants Azure authorization. Azure
RBAC and the Azure Ops authorization policy remain authoritative for access and
operations.
