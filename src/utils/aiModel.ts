/**
 * Determines if a given AI model supports vision/image input
 * @param provider - The AI provider (openai, anthropic, openrouter, ollama)
 * @param model - The model name/identifier
 * @returns true if the model supports vision capabilities
 */
export function modelSupportsVision(provider: string, model: string): boolean {
  if (!provider || !model) return false;

  switch (provider.toLowerCase()) {
    case "openai":
      return (
        model.includes("gpt-4o") ||
        model.includes("gpt-5") ||
        model.startsWith("o1")
      );

    case "anthropic":
      return (
        model.includes("claude-3") ||
        model.includes("claude-opus") ||
        model.includes("claude-sonnet") ||
        model.includes("claude-haiku")
      );

    case "ollama":
      return (
        model.includes("llava") ||
        model.includes("bakllava") ||
        model.includes("vision")
      );

    case "openrouter":
      return (
        model.includes("vision") ||
        model.includes("gpt-4") ||
        model.includes("claude") ||
        model.includes("llava")
      );

    default:
      return false;
  }
}

/**
 * Parses a combined "provider:model" string into its components
 * @param combined - String in format "provider:model"
 * @returns Object with provider and model, or null if invalid format
 */
export function parseModelString(combined: string): {
  provider: string;
  model: string;
} | null {
  if (!combined) return null;

  const parts = combined.split(":");
  if (parts.length !== 2) return null;

  return {
    provider: parts[0],
    model: parts[1],
  };
}

/**
 * Formats provider and model into a combined string
 * @param provider - The AI provider
 * @param model - The model name
 * @returns String in format "provider:model"
 */
export function formatModelString(provider: string, model: string): string {
  return `${provider}:${model}`;
}
