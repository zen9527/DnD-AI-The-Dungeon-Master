export declare function rollDice(type: number, count: number): number[];
export declare function rollWithAdvantage(type: number): number;
export declare function rollWithDisadvantage(type: number): number;
export declare function calculateTotal(rolls: number[], modifier?: number): number;
export declare function calculateProficiencyBonus(level: number): number;
export declare function calculateModifier(attribute: number): number;
export declare function calculateAC(dex: number, armorBonus?: number): number;
export declare function calculateHit(roll: number, attackBonus: number, targetAC: number): {
    hit: boolean;
    isCritical: boolean;
};
export declare function calculateDamage(rolls: number[], abilityModifier?: number): number;
export declare function handleDeath(currentHp: number, maxHp: number): {
    dead: boolean;
    status: string;
};
//# sourceMappingURL=dice.d.ts.map