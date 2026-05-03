import { z } from "zod";
export declare const playerActionSchema: z.ZodObject<{
    action: z.ZodString;
    dice: z.ZodOptional<z.ZodObject<{
        type: z.ZodUnion<[z.ZodLiteral<4>, z.ZodLiteral<6>, z.ZodLiteral<8>, z.ZodLiteral<10>, z.ZodLiteral<12>, z.ZodLiteral<20>]>;
        count: z.ZodNumber;
        modifier: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: 4 | 6 | 8 | 10 | 12 | 20;
        count: number;
        modifier?: number | undefined;
    }, {
        type: 4 | 6 | 8 | 10 | 12 | 20;
        count: number;
        modifier?: number | undefined;
    }>>;
    target: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: string;
    dice?: {
        type: 4 | 6 | 8 | 10 | 12 | 20;
        count: number;
        modifier?: number | undefined;
    } | undefined;
    target?: string | undefined;
}, {
    action: string;
    dice?: {
        type: 4 | 6 | 8 | 10 | 12 | 20;
        count: number;
        modifier?: number | undefined;
    } | undefined;
    target?: string | undefined;
}>;
export type PlayerActionInput = z.infer<typeof playerActionSchema>;
//# sourceMappingURL=action.d.ts.map