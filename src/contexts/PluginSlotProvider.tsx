import { useState, useCallback, useMemo } from "react";

import { PluginSlotContext } from "./PluginSlotContext";
import type { PluginSlotRegistryType } from "./PluginSlotContext";
import type { SlotContribution, SlotName, SlotContext } from "../types/pluginSlots";

interface PluginSlotProviderProps {
  children: React.ReactNode;
}

export const PluginSlotProvider = ({ children }: PluginSlotProviderProps) => {
  const [contributions, setContributions] = useState<SlotContribution[]>([]);

  const register = useCallback((contribution: SlotContribution) => {
    setContributions((prev) => [...prev, contribution]);
    return () => {
      setContributions((prev) => prev.filter((c) => c !== contribution));
    };
  }, []);

  const registerAll = useCallback((newContributions: SlotContribution[]) => {
    setContributions((prev) => [...prev, ...newContributions]);
    return () => {
      const toRemove = new Set(newContributions);
      setContributions((prev) => prev.filter((c) => !toRemove.has(c)));
    };
  }, []);

  const getSlotContributions = useCallback(
    (slot: SlotName, context: SlotContext): SlotContribution[] => {
      return contributions
        .filter((c) => c.slot === slot)
        .filter((c) => !c.when || c.when(context))
        .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    },
    [contributions],
  );

  const value: PluginSlotRegistryType = useMemo(
    () => ({ contributions, register, registerAll, getSlotContributions }),
    [contributions, register, registerAll, getSlotContributions],
  );

  return (
    <PluginSlotContext.Provider value={value}>
      {children}
    </PluginSlotContext.Provider>
  );
};
