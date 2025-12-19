// send.js
const webhookUrl = "https://pheonixnnk.app.n8n.cloud/webhook/prompt-trigger";

async function sendToWebhook(text) {
  try {
    const body = {
      message: text
    };

    console.log(`[Webhook] Sending: "${text}" to n8n...`);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.text();
    console.log("[Webhook] Response:", data);
    return data;
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return null;
  }
}

module.exports = { sendToWebhook };
