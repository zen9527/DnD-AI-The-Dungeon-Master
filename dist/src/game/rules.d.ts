import type { Player, NPC } from "../types/index.js";
export declare const SKILLS: Record<string, keyof Player['attributes']>;
export declare const SAVING_THROWS: Record<string, keyof Player['attributes']>;
export declare const DC_DIFFICULTY: Record<string, {
    dc: number;
    label: string;
}>;
export declare const CLASS_SKILL_PROFICIENCIES: Record<string, string[]>;
export declare const CLASS_SAVING_THROW_PROFICIENCIES: Record<string, string[]>;
export declare function getSkillModifier(player: Player, skill: string): number;
export declare function checkSkill(roll: number, player: Player, skill: string, dc: number): {
    success: boolean;
    total: number;
    dc: number;
};
export declare function getSavingThrowModifier(player: Player, saveType: keyof Player['attributes']): number;
export declare function checkSavingThrow(roll: number, player: Player, saveType: keyof Player['attributes'], dc: number): {
    success: boolean;
    total: number;
    dc: number;
};
export declare function calculatePassiveScore(player: Player, skill: string): number;
export declare function getSpellSaveDC(player: Player): number;
export declare function rollDeathSave(): {
    roll: number;
    success: boolean;
};
export declare function getHitDice(player: Player): number;
export declare function rollHitDice(player: Player): {
    healed: number;
    conMod: number;
};
export declare function getAttackBonus(player: Player, weaponAttackBonus?: number): number;
export declare function getAttackAttributeMod(player: Player): number;
export declare function isHit(roll: number, player: Player, target: NPC, weaponAttackBonus?: number): {
    hit: boolean;
    isCritical: boolean;
};
export declare function getDamageDice(player: Player, weapon?: {
    damageDice?: {
        type: number;
        count: number;
    };
}): {
    type: number;
    count: number;
};
export declare function calculateAttackDamage(rolls: number[], player: Player, weapon?: {
    attackBonus?: number;
}): number;
export declare function checkCreatureDeath(npc: NPC, damage: number): {
    npc: NPC;
    defeated: boolean;
    status: string;
};
export declare function calculateInitiative(dex: number): number;
//# sourceMappingURL=rules.d.ts.map