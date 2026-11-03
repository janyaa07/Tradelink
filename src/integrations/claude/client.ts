import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;

/** True when an Anthropic API key is set for this server. */
export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** The model used for order reading; ANTHROPIC_MODEL overrides the Claude Sonnet default. */
export function claudeModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

/** One shared client, created on first use. Call only when isClaudeConfigured() is true. */
export function getClaudeClient(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}
