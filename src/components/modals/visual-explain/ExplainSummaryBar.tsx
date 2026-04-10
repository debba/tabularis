import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Sparkles } from "lucide-react";
import type { ExplainPlan } from "../../../types/explain";
import { formatTime, formatCost, getMaxCost } from "../../../utils/explainPlan";

export type ExplainViewMode = "graph" | "raw" | "ai";

interface ExplainSummaryBarProps {
  plan: ExplainPlan | null;
  viewMode: ExplainViewMode;
  onViewModeChange: (mode: ExplainViewMode) => void;
  aiEnabled: boolean;
}

export const ExplainSummaryBar = memo(
  ({ plan, viewMode, onViewModeChange, aiEnabled }: ExplainSummaryBarProps) => {
    const { t } = useTranslation();

    if (!plan) return null;

    const maxCost = getMaxCost(plan.root);

    const toggleButtonClass = (mode: ExplainViewMode) =>
      `flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
        viewMode === mode
          ? mode === "ai"
            ? "bg-purple-900/40 text-purple-300 border border-purple-500/40"
            : "bg-blue-900/40 text-blue-300 border border-blue-500/40"
          : "text-muted hover:text-primary bg-surface-secondary hover:bg-surface-tertiary border border-transparent"
      }`;

    return (
      <div className="flex items-center gap-4 px-4 py-2 border-b border-default bg-base/50 text-xs">
        {plan.planning_time_ms != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">
              {t("editor.visualExplain.planningTime")}:
            </span>
            <span className="text-primary font-mono font-semibold">
              {formatTime(plan.planning_time_ms)}
            </span>
          </div>
        )}

        {plan.execution_time_ms != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">
              {t("editor.visualExplain.executionTime")}:
            </span>
            <span className="text-primary font-mono font-semibold">
              {formatTime(plan.execution_time_ms)}
            </span>
          </div>
        )}

        {maxCost > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted">
              {t("editor.visualExplain.totalCost")}:
            </span>
            <span className="text-primary font-mono font-semibold">
              {formatCost(maxCost)}
            </span>
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() =>
            onViewModeChange(viewMode === "raw" ? "graph" : "raw")
          }
          className={toggleButtonClass("raw")}
        >
          <FileText size={12} />
          {t("editor.visualExplain.rawOutput")}
        </button>

        {aiEnabled && (
          <button
            onClick={() =>
              onViewModeChange(viewMode === "ai" ? "graph" : "ai")
            }
            className={toggleButtonClass("ai")}
          >
            <Sparkles size={12} />
            {t("editor.visualExplain.aiAnalysis")}
          </button>
        )}
      </div>
    );
  },
);
