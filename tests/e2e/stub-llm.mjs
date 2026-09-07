// A stand-in Dungeon Master: an OpenAI-compatible /chat/completions endpoint
// that streams a canned narrative.
//
// The end-to-end suite runs against this rather than a real provider so it needs
// no API key, costs nothing, and gives the same answer every run. It streams in
// small deltas on purpose — the client has to accumulate them, and shipping a
// version that showed only the newest token is exactly the bug this catches.
import { createServer } from "http";

const PORT = Number(process.env.STUB_LLM_PORT || 3199);

/**
 * Pause between streamed deltas. The cancel flow needs a stream slow enough
 * to interrupt; production replies arrive at whatever speed the provider has.
 */
const CHUNK_DELAY_MS = Number(process.env.STUB_CHUNK_DELAY_MS || 4);

/**
 * Requests containing this marker fail with a 500 — exactly once, then heal,
 * so the retry flow can watch the same turn fail and then succeed.
 */
const FAILURE_MARKER = "TRIGGER FAILURE";
let failureSpent = false;

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

  // Buffer the request body — the failure mode keys off what the player did.
  const bodyParts = [];
  req.on("data", part => bodyParts.push(part));
  req.on("end", async () => {
    if (!failureSpent && Buffer.concat(bodyParts).toString().includes(FAILURE_MARKER)) {
      failureSpent = true;
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "stub: simulated provider outage" } }));
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    for (const chunk of chunksOf(FULL_REPLY)) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`);
      await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
    }

    res.write("data: [DONE]\n\n");
    res.end();
  });
});

server.listen(PORT, () => console.log(`[stub-llm] listening on ${PORT}`));
