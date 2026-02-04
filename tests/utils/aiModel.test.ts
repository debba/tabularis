import { describe, it, expect } from "vitest";
import {
  modelSupportsVision,
  parseModelString,
  formatModelString,
} from "../../src/utils/aiModel";

describe("aiModel", () => {
  describe("modelSupportsVision", () => {
    describe("OpenAI models", () => {
      it("should return true for gpt-4o models", () => {
        expect(modelSupportsVision("openai", "gpt-4o")).toBe(true);
        expect(modelSupportsVision("openai", "gpt-4o-mini")).toBe(true);
        expect(modelSupportsVision("openai", "gpt-4o-2024-05-13")).toBe(true);
      });

      it("should return true for gpt-5 models", () => {
        expect(modelSupportsVision("openai", "gpt-5")).toBe(true);
        expect(modelSupportsVision("openai", "gpt-5.2")).toBe(true);
        expect(modelSupportsVision("openai", "gpt-5-turbo")).toBe(true);
      });

      it("should return true for o1 models", () => {
        expect(modelSupportsVision("openai", "o1-preview")).toBe(true);
        expect(modelSupportsVision("openai", "o1-mini")).toBe(true);
      });

      it("should return false for non-vision models", () => {
        expect(modelSupportsVision("openai", "gpt-3.5-turbo")).toBe(false);
        expect(modelSupportsVision("openai", "gpt-4")).toBe(false);
        expect(modelSupportsVision("openai", "davinci")).toBe(false);
      });

      it("should be case insensitive for provider", () => {
        expect(modelSupportsVision("OpenAI", "gpt-4o")).toBe(true);
        expect(modelSupportsVision("OPENAI", "gpt-4o")).toBe(true);
      });
    });

    describe("Anthropic models", () => {
      it("should return true for claude-3 models", () => {
        expect(modelSupportsVision("anthropic", "claude-3-opus")).toBe(true);
        expect(modelSupportsVision("anthropic", "claude-3-sonnet")).toBe(true);
        expect(modelSupportsVision("anthropic", "claude-3-haiku")).toBe(true);
      });

      it("should return true for claude-opus models", () => {
        expect(modelSupportsVision("anthropic", "claude-opus-4")).toBe(true);
        expect(modelSupportsVision("anthropic", "claude-opus-4.5")).toBe(true);
      });

      it("should return true for claude-sonnet models", () => {
        expect(modelSupportsVision("anthropic", "claude-sonnet-3.5")).toBe(
          true
        );
        expect(modelSupportsVision("anthropic", "claude-sonnet-4")).toBe(true);
      });

      it("should return true for claude-haiku models", () => {
        expect(modelSupportsVision("anthropic", "claude-haiku-3")).toBe(true);
      });

      it("should return false for older models", () => {
        expect(modelSupportsVision("anthropic", "claude-2")).toBe(false);
        expect(modelSupportsVision("anthropic", "claude-1")).toBe(false);
        expect(modelSupportsVision("anthropic", "claude-instant")).toBe(false);
      });
    });

    describe("Ollama models", () => {
      it("should return true for llava models", () => {
        expect(modelSupportsVision("ollama", "llava")).toBe(true);
        expect(modelSupportsVision("ollama", "llava-13b")).toBe(true);
        expect(modelSupportsVision("ollama", "llava-phi3")).toBe(true);
      });

      it("should return true for bakllava models", () => {
        expect(modelSupportsVision("ollama", "bakllava")).toBe(true);
        expect(modelSupportsVision("ollama", "bakllava-7b")).toBe(true);
      });

      it("should return true for models with vision in name", () => {
        expect(modelSupportsVision("ollama", "llama3-vision")).toBe(true);
        expect(modelSupportsVision("ollama", "mistral-vision")).toBe(true);
      });

      it("should return false for text-only models", () => {
        expect(modelSupportsVision("ollama", "llama3")).toBe(false);
        expect(modelSupportsVision("ollama", "mistral")).toBe(false);
        expect(modelSupportsVision("ollama", "codellama")).toBe(false);
      });
    });

    describe("OpenRouter models", () => {
      it("should return true for models with vision in name", () => {
        expect(modelSupportsVision("openrouter", "gpt-4-vision-preview")).toBe(
          true
        );
        expect(modelSupportsVision("openrouter", "claude-3-vision")).toBe(
          true
        );
      });

      it("should return true for gpt-4 models", () => {
        expect(modelSupportsVision("openrouter", "openai/gpt-4")).toBe(true);
        expect(modelSupportsVision("openrouter", "gpt-4-turbo")).toBe(true);
      });

      it("should return true for claude models", () => {
        expect(
          modelSupportsVision("openrouter", "anthropic/claude-3-opus")
        ).toBe(true);
        expect(
          modelSupportsVision("openrouter", "anthropic/claude-sonnet")
        ).toBe(true);
      });

      it("should return true for llava models", () => {
        expect(modelSupportsVision("openrouter", "llava-13b")).toBe(true);
      });

      it("should return false for non-vision models", () => {
        expect(modelSupportsVision("openrouter", "meta-llama/llama-2")).toBe(
          false
        );
        expect(modelSupportsVision("openrouter", "mistralai/mistral-7b")).toBe(
          false
        );
      });
    });

    describe("Edge cases", () => {
      it("should return false for unknown providers", () => {
        expect(modelSupportsVision("unknown", "some-model")).toBe(false);
        expect(modelSupportsVision("gemini", "gemini-pro")).toBe(false);
      });

      it("should return false for empty inputs", () => {
        expect(modelSupportsVision("", "gpt-4o")).toBe(false);
        expect(modelSupportsVision("openai", "")).toBe(false);
        expect(modelSupportsVision("", "")).toBe(false);
      });

      it("should handle null/undefined gracefully", () => {
        expect(modelSupportsVision(null as any, "gpt-4o")).toBe(false);
        expect(modelSupportsVision("openai", null as any)).toBe(false);
        expect(modelSupportsVision(undefined as any, undefined as any)).toBe(
          false
        );
      });
    });
  });

  describe("parseModelString", () => {
    it("should parse valid provider:model strings", () => {
      expect(parseModelString("openai:gpt-4o")).toEqual({
        provider: "openai",
        model: "gpt-4o",
      });

      expect(parseModelString("anthropic:claude-opus-4.5")).toEqual({
        provider: "anthropic",
        model: "claude-opus-4.5",
      });

      expect(parseModelString("ollama:llava")).toEqual({
        provider: "ollama",
        model: "llava",
      });
    });

    it("should handle complex model names with colons", () => {
      expect(parseModelString("openrouter:openai/gpt-4")).toEqual({
        provider: "openrouter",
        model: "openai/gpt-4",
      });
    });

    it("should return null for invalid formats", () => {
      expect(parseModelString("")).toBe(null);
      expect(parseModelString("no-colon")).toBe(null);
      expect(parseModelString("too:many:colons")).toBe(null);
    });

    it("should return null for null/undefined", () => {
      expect(parseModelString(null as any)).toBe(null);
      expect(parseModelString(undefined as any)).toBe(null);
    });

    it("should handle empty provider or model", () => {
      const result1 = parseModelString(":model");
      expect(result1).toEqual({ provider: "", model: "model" });

      const result2 = parseModelString("provider:");
      expect(result2).toEqual({ provider: "provider", model: "" });
    });
  });

  describe("formatModelString", () => {
    it("should format provider and model correctly", () => {
      expect(formatModelString("openai", "gpt-4o")).toBe("openai:gpt-4o");
      expect(formatModelString("anthropic", "claude-opus-4.5")).toBe(
        "anthropic:claude-opus-4.5"
      );
      expect(formatModelString("ollama", "llava")).toBe("ollama:llava");
    });

    it("should handle empty strings", () => {
      expect(formatModelString("", "model")).toBe(":model");
      expect(formatModelString("provider", "")).toBe("provider:");
      expect(formatModelString("", "")).toBe(":");
    });

    it("should handle special characters", () => {
      expect(formatModelString("openrouter", "openai/gpt-4-vision")).toBe(
        "openrouter:openai/gpt-4-vision"
      );
    });

    it("should be inverse of parseModelString", () => {
      const original = "anthropic:claude-sonnet-3.5";
      const parsed = parseModelString(original);
      expect(parsed).not.toBe(null);
      const formatted = formatModelString(parsed!.provider, parsed!.model);
      expect(formatted).toBe(original);
    });
  });
});
