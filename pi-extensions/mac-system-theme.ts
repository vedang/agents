/**
 * Syncs pi theme with macOS system appearance (dark/light mode).
 *
 * Usage:
 *   pi -e examples/extensions/mac-system-theme.ts
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const execAsync = promisify(exec);

async function isDarkMode(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      "osascript -e 'tell application \"System Events\" to tell appearance preferences to return dark mode'",
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export default function (pi: ExtensionAPI) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function stopThemePolling(): void {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    stopThemePolling();

    // Theme polling is only useful in interactive sessions with a UI.
    // Avoid starting background work in print/json mode.
    if (!ctx.hasUI) return;

    let currentTheme = "";
    const syncTheme = async () => {
      const nextTheme = (await isDarkMode()) ? "dark" : "light";
      if (nextTheme === currentTheme) return;
      currentTheme = nextTheme;
      ctx.ui.setTheme(nextTheme);
    };

    await syncTheme();
    intervalId = setInterval(() => {
      void syncTheme();
    }, 2000);

    // Defensive fallback: if teardown is ever skipped, do not keep the
    // process alive solely for theme polling.
    intervalId.unref?.();
  });

  pi.on("session_shutdown", stopThemePolling);
}
