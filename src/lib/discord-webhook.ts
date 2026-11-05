/**
 * Posts a message to a Discord webhook. Never throws: callers announce records
 * that are already saved, so a Discord failure is logged and nothing more.
 */
export async function postDiscordWebhook(
  webhookUrl: string,
  payload: unknown,
  logLabel: string,
) {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(
        `${logLabel} Discord webhook returned HTTP ${response.status}`,
      );
    }
  } catch (error) {
    console.error(`${logLabel} Discord webhook failed:`, error);
  }
}
