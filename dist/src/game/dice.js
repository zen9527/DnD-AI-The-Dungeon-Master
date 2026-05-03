export function rollDice(type, count) {
    return Array.from({ length: count }, () => Math.floor(Math.random() * type) + 1);
}
export function rollWithAdvantage(type) {
    const r1 = Math.floor(Math.random() * type) + 1;
    const r2 = Math.floor(Math.random() * type) + 1;
    return Math.max(r1, r2);
}
export function rollWithDisadvantage(type) {
    const r1 = Math.floor(Math.random() * type) + 1;
    const r2 = Math.floor(Math.random() * type) + 1;
    return Math.min(r1, r2);
}
export function calculateTotal(rolls, modifier = 0) {
    return rolls.reduce((sum, r) => sum + r, 0) + modifier;
}
export function calculateProficiencyBonus(level) {
    if (level <= 4)
        return 2;
    if (level <= 8)
        return 3;
    if (level <= 12)
        return 4;
    if (level <= 16)
        return 5;
    return 6;
}
export function calculateModifier(attribute) {
    return Math.floor((attribute - 10) / 2);
}
export function calculateAC(dex, armorBonus = 0) {
    return 10 + calculateModifier(dex) + armorBonus;
}
export function calculateHit(roll, attackBonus, targetAC) {
    const total = roll + attackBonus;
    const isCritical = roll === 20;
    const hit = isCritical || total >= targetAC;
    return { hit, isCritical };
}
export function calculateDamage(rolls, abilityModifier = 0) {
    return calculateTotal(rolls, abilityModifier);
}
export function handleDeath(currentHp, maxHp) {
    if (currentHp <= 0) {
        return { dead: true, status: currentHp <= -maxHp ? "dead" : "dropped unconscious" };
    }
    return { dead: false, status: "stable" };
}
//# sourceMappingURL=dice.js.map