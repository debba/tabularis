import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { invoke } from "../../src/lib/invoke";

// Mock @tauri-apps/api/core so tauriInvoke is controllable
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("invoke", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    vi.clearAllMocks();
    localStorage.clear();
    // Ensure no Tauri environment by default
    const win = window as unknown as Record<string, unknown>;
    delete win["__TAURI_INTERNALS__"];
  });

  afterEach(() => {
    const win = window as unknown as Record<string, unknown>;
    delete win["__TAURI_INTERNALS__"];
  });

  describe("isTauri() path", () => {
    beforeEach(() => {
      const win = window as unknown as Record<string, unknown>;
      win["__TAURI_INTERNALS__"] = {};
    });

    it("should delegate to tauriInvoke with command and params", async () => {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      vi.mocked(tauriInvoke).mockResolvedValueOnce({ rows: [] });

      const result = await invoke("list_tables", { db: "mydb" });

      expect(tauriInvoke).toHaveBeenCalledWith("list_tables", { db: "mydb" });
      expect(result).toEqual({ rows: [] });
    });

    it("should delegate without params when none provided", async () => {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      vi.mocked(tauriInvoke).mockResolvedValueOnce("pong");

      await invoke("ping");

      expect(tauriInvoke).toHaveBeenCalledWith("ping", undefined);
    });

    it("should propagate errors from tauriInvoke", async () => {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      vi.mocked(tauriInvoke).mockRejectedValueOnce(new Error("Tauri error"));

      await expect(invoke("failing_command")).rejects.toThrow("Tauri error");
    });

    it("should not call fetch in Tauri environment", async () => {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      vi.mocked(tauriInvoke).mockResolvedValueOnce(null);

      await invoke("some_command");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("fetch path (remote control environment)", () => {
    it("should POST to /api/invoke with correct body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(["table1", "table2"]),
      });

      const result = await invoke("list_tables", { db: "mydb" });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/invoke",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ command: "list_tables", params: { db: "mydb" } }),
        }),
      );
      expect(result).toEqual(["table1", "table2"]);
    });

    it("should use empty object as default params when none provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(null),
      });

      await invoke("no_params_command");

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.params).toEqual({});
    });

    it("should include Content-Type application/json header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await invoke("ping");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/invoke",
        expect.objectContaining({
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        }),
      );
    });

    it("should include Authorization header when rc_token is set in localStorage", async () => {
      localStorage.setItem("rc_token", "my-secret-token");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await invoke("ping");

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer my-secret-token");
    });

    it("should not include Authorization header when rc_token is absent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await invoke("ping");

      const headers = mockFetch.mock.calls[0][1].headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("should return parsed JSON on success", async () => {
      const payload = { id: 1, name: "Alice" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(payload),
      });

      const result = await invoke("get_user", { id: 1 });
      expect(result).toEqual(payload);
    });

    it("should throw with response text on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(invoke("bad_command")).rejects.toThrow("Internal Server Error");
    });

    it("should not call tauriInvoke in web environment", async () => {
      const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await invoke("some_command");

      expect(tauriInvoke).not.toHaveBeenCalled();
    });

    describe("401 handling", () => {
      let reloadSpy: ReturnType<typeof vi.fn>;

      beforeEach(() => {
        reloadSpy = vi.fn();
        Object.defineProperty(window, "location", {
          value: { reload: reloadSpy },
          writable: true,
          configurable: true,
        });
      });

      it("should remove rc_token and reload when 401 and token was present", async () => {
        localStorage.setItem("rc_token", "expired-token");
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        });

        await expect(invoke("protected_command")).rejects.toThrow("Unauthorized");

        expect(localStorage.getItem("rc_token")).toBeNull();
        expect(reloadSpy).toHaveBeenCalledTimes(1);
      });

      it("should not reload when 401 and no token was present", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        });

        await expect(invoke("protected_command")).rejects.toThrow("Unauthorized");

        expect(reloadSpy).not.toHaveBeenCalled();
      });

      it("should still throw after handling 401", async () => {
        localStorage.setItem("rc_token", "token");
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Session expired"),
        });

        await expect(invoke("protected_command")).rejects.toThrow("Session expired");
      });
    });
  });
});
