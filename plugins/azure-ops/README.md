# Azure Ops

Azure Ops is a proof-of-concept operational view for allowlisted Azure
subscriptions. It uses Backstage's new frontend system and is available at
`/azure-ops`.

The plugin provides:

- **Dashboard**: resource, alert, policy, and Advisor KPIs with explicit source
  freshness.
- **Status**: active and resolved Azure Monitor incidents plus a bounded,
  filterable Azure resource inventory.
- **Approvals**: approval decisions and execution history.
- **Command Center**: deterministic operation templates, exact plan review, and
  approval requests.

## Safety boundary

Inventory and summaries are read-only. The Command Center never executes an
operation while creating a plan. Every write requires an immutable plan,
explicit approval, and a separate execution action enforced by the backend.
Authorization, expiry, plan hashes, resource state, and orchestrator
availability are validated again by the backend; frontend controls are not a
security boundary.

Microsoft Foundry-assisted analysis is optional. When configured, the backend
sends bounded evidence to a prompt agent and validates the structured response.
Recommendations cannot create, approve, or execute a plan automatically.

Backend errors and unavailable or partial Azure data are shown to operators
rather than replaced with example or success-shaped fallback data.

Azure Monitor incidents originate from the backend's authenticated ingress
adapter endpoint. The frontend does not receive Action Group webhooks directly;
it reads normalized incident records using `azure-ops.read` and shows explicit
loading, empty, and error states.
