// A stand-in Dungeon Master: an OpenAI-compatible /chat/completions endpoint
// that streams a canned narrative.
//
// The end-to-end suite runs against this rather than a real provider so it needs
// no API key, costs nothing, and gives the same answer every run. It streams in
// small deltas on purpose — the client has to accumulate them, and shipping a
// version that showed only the newest token is exactly the bug this catches.
import { createServer } from "http";

const PORT = Number(process.env.STUB_LLM_PORT || 3199);

/** Two paragraphs plus the ---JSON--- envelope the parser expects. */
const NARRATIVE =
  "The torchlight gutters against wet stone as you step into the chamber. " +
  "Somewhere ahead, water drips into an unseen pool.\n\n" +
  "A rusted portcullis blocks the northern passage. What do you do?";

const STRUCTURED = {
  hit: false,
  isCritical: false,
  creatureDefeated: false,
  turn: { nextPlayerId: "", initiative: [], round: 1, currentTurnIndex: 0 },
};

const FULL_REPLY = `${NARRATIVE}\n---JSON---\n${JSON.stringify(STRUCTURED)}\n---JSON---`;

/** Break the reply into small chunks so the client's accumulation is exercised. */
function chunksOf(text, size = 12) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const server = createServer((req, res) => {
  if (req.url?.endsWith("/models")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ id: "stub-dm" }] }));
    return;
  }

  if (!req.url?.endsWith("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }

  // Drain the request body; the stub replies the same way regardless.
  req.resume();
  req.on("end", async () => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    for (const chunk of chunksOf(FULL_REPLY)) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await new Promise(r => setTimeout(r, 4));
    }

    res.write("data: [DONE]\n\n");
    res.end();
  });
});

server.listen(PORT, () => console.log(`[stub-llm] listening on ${PORT}`));
