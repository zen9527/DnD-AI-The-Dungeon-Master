import { z } from "zod";
export const chatMessageSchema = z.object({
    content: z.string().min(1).max(2000),
});
//# sourceMappingURL=chat.js.map