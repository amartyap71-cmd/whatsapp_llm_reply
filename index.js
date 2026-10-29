
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

const processing = new Set();

client.on("qr", (qr) => {
  console.log("Scan this QR code with WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("WhatsApp authenticated.");
});

client.on("ready", () => {
  console.log("WhatsApp AI is ready!");
});

client.on("auth_failure", (message) => {
  console.error("Authentication failed:", message);
});

client.on("message", async (message) => {
  // Ignore groups and messages without text.
  if (message.fromMe || message.from.endsWith("@g.us")) return;

  const text = message.body?.trim();
  if (!text) return;

  // Prevent processing multiple messages from the same chat at once.
  const chatId = message.from;
  if (processing.has(chatId)) return;

  processing.add(chatId);

  try {
    console.log("Incoming:", text);

    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "nemotron-3-nano:4b",
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful, friendly WhatsApp assistant. " +
              "Reply naturally and concisely. Do not claim to be the user.",
          },
          { role: "user", content: text },
        ],
        options: { temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.message?.content?.trim();

    if (reply) {
      await message.reply(reply);
      console.log("Reply sent:", reply);
    }
  } catch (error) {
    console.error("Failed to generate or send reply:", error.message);
  } finally {
    processing.delete(chatId);
  }
});

client.on("disconnected", (reason) => {
  console.log("WhatsApp disconnected:", reason);
});

client.initialize();
