const LEARN_STUFF_COMMAND = "/learn-stuff";

export const ORIGINAL_OUTPUT_MESSAGE_TYPE = "learn-stuff-original-output";
export const LEARN_STUFF_DETAILS_MESSAGE_TYPE = "learn-stuff-details";

type LearnStuffInputSource = "interactive" | "rpc" | "extension" | undefined;

type AgentEndMessageLike = {
  role?: string;
  content?: unknown;
};

type AgentEndEventLike = {
  messages?: AgentEndMessageLike[];
};

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .filter((item): item is { type: "text"; text: string } => {
      if (!item || typeof item !== "object") return false;
      const part = item as { type?: unknown; text?: unknown };
      return part.type === "text" && typeof part.text === "string";
    })
    .map((item) => item.text)
    .join("\n")
    .trim();
}

function isLearnStuffInput(text: string | undefined): boolean {
  return text?.trim().toLowerCase().startsWith(LEARN_STUFF_COMMAND) ?? false;
}

export function extractLatestAssistantText(event: AgentEndEventLike): string | null {
  const messages = event.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;

    const text = messageContentToText(message.content);
    if (text.length > 0) return text;
  }

  return null;
}

type ReplayDecisionInput = {
  hasPendingMessages: boolean;
  hasPendingReplayText: boolean;
  lastInputSource: LearnStuffInputSource;
  lastInputText: string | undefined;
};

export function shouldReplayOriginalOutput(input: ReplayDecisionInput): boolean {
  if (input.hasPendingMessages) return false;
  if (!input.hasPendingReplayText) return false;
  if (input.lastInputSource !== "extension") return false;
  return isLearnStuffInput(input.lastInputText);
}

export function buildOriginalOutputReplayMessage(content: string, reason: string) {
  return {
    customType: ORIGINAL_OUTPUT_MESSAGE_TYPE,
    content,
    display: true,
    details: {
      reason,
      chars: content.length,
    },
  } as const;
}

export function buildLearnStuffDetailsMessage(content: string, reason: string) {
  return {
    customType: LEARN_STUFF_DETAILS_MESSAGE_TYPE,
    content,
    display: true,
    details: {
      reason,
      chars: content.length,
    },
  } as const;
}
