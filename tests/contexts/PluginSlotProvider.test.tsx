import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useContext } from "react";
import { PluginSlotProvider } from "../../src/contexts/PluginSlotProvider";
import { PluginSlotContext } from "../../src/contexts/PluginSlotContext";
import type { PluginSlotRegistryType } from "../../src/contexts/PluginSlotContext";
import type { SlotContribution, SlotComponentProps } from "../../src/types/pluginSlots";

const TestComponent = ({ context: _ctx, pluginId }: SlotComponentProps) => (
  <span data-testid="slot-component">{pluginId}</span>
);

function RegistryConsumer({ onRegistry }: { onRegistry: (r: PluginSlotRegistryType) => void }) {
  const registry = useContext(PluginSlotContext);
  if (registry) onRegistry(registry);
  return null;
}

describe("PluginSlotProvider", () => {
  it("should provide an empty registry initially", () => {
    let registry: PluginSlotRegistryType | undefined;

    render(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    expect(registry).toBeDefined();
    expect(registry!.contributions).toEqual([]);
  });

  it("should register and unregister a contribution", () => {
    let registry: PluginSlotRegistryType | undefined;

    const { rerender } = render(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    const contribution: SlotContribution = {
      pluginId: "test-plugin",
      slot: "sidebar.footer.actions",
      component: TestComponent,
      order: 50,
    };

    let unregister: (() => void) | undefined;
    act(() => {
      unregister = registry!.register(contribution);
    });

    rerender(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    expect(registry!.contributions).toHaveLength(1);

    act(() => {
      unregister!();
    });

    rerender(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    expect(registry!.contributions).toHaveLength(0);
  });

  it("should getSlotContributions filtered by slot name and sorted by order", () => {
    let registry: PluginSlotRegistryType | undefined;

    const { rerender } = render(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    act(() => {
      registry!.registerAll([
        { pluginId: "b", slot: "sidebar.footer.actions", component: TestComponent, order: 200 },
        { pluginId: "a", slot: "sidebar.footer.actions", component: TestComponent, order: 10 },
        { pluginId: "c", slot: "data-grid.toolbar.actions", component: TestComponent, order: 100 },
      ]);
    });

    rerender(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    const sidebarSlots = registry!.getSlotContributions("sidebar.footer.actions", {});
    expect(sidebarSlots).toHaveLength(2);
    expect(sidebarSlots[0].pluginId).toBe("a"); // order 10 first
    expect(sidebarSlots[1].pluginId).toBe("b"); // order 200 second

    const toolbarSlots = registry!.getSlotContributions("data-grid.toolbar.actions", {});
    expect(toolbarSlots).toHaveLength(1);
    expect(toolbarSlots[0].pluginId).toBe("c");
  });

  it("should filter contributions by when predicate", () => {
    let registry: PluginSlotRegistryType | undefined;

    const { rerender } = render(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    act(() => {
      registry!.registerAll([
        {
          pluginId: "postgres-only",
          slot: "sidebar.footer.actions",
          component: TestComponent,
          when: (ctx) => ctx.driver === "postgres",
        },
        {
          pluginId: "always",
          slot: "sidebar.footer.actions",
          component: TestComponent,
        },
      ]);
    });

    rerender(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    const withPostgres = registry!.getSlotContributions("sidebar.footer.actions", { driver: "postgres" });
    expect(withPostgres).toHaveLength(2);

    const withMysql = registry!.getSlotContributions("sidebar.footer.actions", { driver: "mysql" });
    expect(withMysql).toHaveLength(1);
    expect(withMysql[0].pluginId).toBe("always");
  });

  it("should registerAll and unregister all at once", () => {
    let registry: PluginSlotRegistryType | undefined;

    const { rerender } = render(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    let unregisterAll: (() => void) | undefined;
    act(() => {
      unregisterAll = registry!.registerAll([
        { pluginId: "a", slot: "sidebar.footer.actions", component: TestComponent },
        { pluginId: "b", slot: "sidebar.footer.actions", component: TestComponent },
      ]);
    });

    rerender(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    expect(registry!.contributions).toHaveLength(2);

    act(() => {
      unregisterAll!();
    });

    rerender(
      <PluginSlotProvider>
        <RegistryConsumer onRegistry={(r) => { registry = r; }} />
      </PluginSlotProvider>,
    );

    expect(registry!.contributions).toHaveLength(0);
  });
});
