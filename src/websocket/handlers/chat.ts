import type { ChatMessage } from "../../types/index.js";
import { generateId } from "../../utils/id.js";
import { getLocalizedMessage } from "../../utils/locale-loader.js";
import { chatMessageSchema, emoteSchema, privateChatSchema } from "../../../shared/index.js";
import { parsePayload, requirePlayer } from "../guards.js";
import type { HandlerContext, HandlerRegistry } from "../types.js";

/** CHAT_MESSAGE — plain in-character chat, broadcast with the full game state. */
function handleChatMessage(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  const { engine } = resolved;

  const parsed = parsePayload(ctx, chatMessageSchema);
  if (!parsed) return;

  engine.addChatMessage(ctx.client.playerId!, parsed.content);
  ctx.manager.broadcastToGame(engine.id, "CHAT_MESSAGE", {
    message: engine.game.chatHistory[engine.game.chatHistory.length - 1],
    gameState: engine.game,
  });
}

/** PLAYER_EMOTE — renders as "*Name does something*". */
function handleEmote(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  const { engine, player } = resolved;

  const parsed = parsePayload(ctx, emoteSchema);
  if (!parsed) return;

  const content = `*${player.characterName || player.name} ${parsed.action}*`;
  const emoteMsg: ChatMessage = {
    id: generateId(),
    playerId: player.id,
    playerName: player.name,
    characterName: player.characterName,
    content,
    type: "emote",
    timestamp: Date.now(),
  };

  engine.addChatMessage(player.id, content);
  ctx.manager.broadcastToGame(engine.id, "EMOTE_MESSAGE", { message: emoteMsg, gameState: engine.game });
}

/** PRIVATE_CHAT — delivered only to the sender and the named target. */
function handlePrivateChat(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  const { engine, player: sender } = resolved;

  const parsed = parsePayload(ctx, privateChatSchema);
  if (!parsed) return;

  const target = engine.game.players.find(p => p.id === parsed.targetPlayerId);
  if (!target) {
    ctx.manager.sendError(ctx.ws, "Target player not found");
    return;
  }

  const privateMsg: ChatMessage = {
    id: generateId(),
    playerId: sender.id,
    playerName: sender.name,
    characterName: sender.characterName,
    content: getLocalizedMessage(target.locale || "en-US", "private_chat.prefix")
      .replace("{targetName}", target.characterName || target.name)
      .replace("{content}", parsed.content),
    type: "text",
    timestamp: Date.now(),
  };

  ctx.manager.send(ctx.ws, "PRIVATE_MESSAGE", { message: privateMsg, targetPlayerId: parsed.targetPlayerId });

  const targetWs = ctx.manager.findPlayerSocket(parsed.targetPlayerId);
  if (targetWs) {
    ctx.manager.send(targetWs, "PRIVATE_MESSAGE", { message: privateMsg, senderPlayerId: sender.id });
  }
}

export const chatHandlers: HandlerRegistry = {
  CHAT_MESSAGE: handleChatMessage,
  PLAYER_EMOTE: handleEmote,
  PRIVATE_CHAT: handlePrivateChat,
};
