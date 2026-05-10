import { usePendingApprovals } from "../../hooks/useAiActivity";
import { AiApprovalModal } from "./AiApprovalModal";

/// Listens for `ai://pending_approval` events emitted by the file watcher
/// and presents one approval modal at a time. Mounted once at the App
/// level, so it shows over any current page.
export function AiApprovalGate() {
  const { pending, decide } = usePendingApprovals();
  const current = pending[0];
  if (!current) return null;

  const handleClose = () => {
    // Closing without an explicit decision is treated as deny — the MCP
    // subprocess is blocked waiting on us, so silent dismissal would just
    // burn the timeout.
    decide({
      approvalId: current.id,
      decision: "deny",
      reason: "dismissed",
    }).catch(() => {});
  };

  return (
    <AiApprovalModal
      approval={current}
      onApprove={(editedQuery) =>
        decide({
          approvalId: current.id,
          decision: "approve",
          editedQuery,
        })
      }
      onDeny={(reason) =>
        decide({
          approvalId: current.id,
          decision: "deny",
          reason,
        })
      }
      onClose={handleClose}
    />
  );
}
