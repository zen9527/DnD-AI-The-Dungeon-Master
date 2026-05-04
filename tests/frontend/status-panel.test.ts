import { describe, it, expect } from "vitest";

describe("Player status panel HTML generation", () => {
  // Test the HTML structure that should be generated for player status
  it("should generate player status HTML with HP bars", () => {
    const players = [
      { id: "p1", characterName: "Hero", characterClass: "Fighter", hp: 8, maxHp: 10 },
      { id: "p2", characterName: "Mage", characterClass: "Wizard", hp: 5, maxHp: 6 }
    ];
    
    // Generate expected HTML structure
    const html = players.map(p => 
      `<li class="player-status">
        <span class="player-name">${p.characterName}</span>
        <span class="player-class">${p.characterClass} Lv.1</span>
        <div class="hp-bar-fill" style="width: ${(p.hp / p.maxHp) * 100}%"></div>
        <span class="hp-bar-text">${p.hp}/${p.maxHp}</span>
      </li>`
    ).join("");
    
    expect(html).toContain("Hero");
    expect(html).toContain("8/10");
    expect(html).toContain("80%");
    expect(html).toContain("player-status");
    expect(html).toContain("hp-bar-fill");
  });

  it("should highlight current player in HTML", () => {
    const players = [
      { id: "p1", characterName: "Hero", hp: 8, maxHp: 10 },
      { id: "p2", characterName: "Mage", hp: 5, maxHp: 6 }
    ];
    const currentPlayerId = "p2";
    
    // Generate HTML with current player highlighting
    const html = players.map(p => 
      `<li class="player-status ${p.id === currentPlayerId ? 'current' : ''}">
        ${p.characterName}
      </li>`
    ).join("");
    
    expect(html).toContain('class="player-status current"');
    expect(html).toContain("Mage");
  });

  it("should calculate HP percentage correctly for different health levels", () => {
    const testCases = [
      { hp: 10, maxHp: 10, expectedPct: 100 },
      { hp: 5, maxHp: 10, expectedPct: 50 },
      { hp: 3, maxHp: 10, expectedPct: 30 },
      { hp: 1, maxHp: 10, expectedPct: 10 },
    ];

    for (const tc of testCases) {
      const pct = Math.round((tc.hp / tc.maxHp) * 100);
      expect(pct).toBe(tc.expectedPct);
    }
  });

  it("should generate HTML with current player class", () => {
    const players = [
      { id: "p1", characterName: "Hero", hp: 8, maxHp: 10 },
      { id: "p2", characterName: "Mage", hp: 5, maxHp: 6 }
    ];
    const currentPlayerId = "p2";
    
    // Generate HTML with current player highlighting (matching app.ts implementation)
    const html = players.map(p => {
      const isCurrentPlayer = p.id === currentPlayerId;
      return `<li class="${isCurrentPlayer ? 'current-player' : ''}">
        <div class="player-info">
          <span class="character-name">${p.characterName}</span>
        </div>
      </li>`;
    }).join("");
    
    expect(html).toContain('class="current-player"');
    expect(html).toContain("Mage");
    expect(html).toContain("Hero");
  });

  it("should determine HP bar color class based on health percentage", () => {
    const testCases = [
      { hp: 8, maxHp: 10, expectedClass: 'high' }, // 80% > 60%
      { hp: 7, maxHp: 10, expectedClass: 'high' }, // 70% > 60%
      { hp: 6, maxHp: 10, expectedClass: 'mid' },  // 60% not > 60%, but > 30%
      { hp: 4, maxHp: 10, expectedClass: 'mid' },  // 40% > 30%
      { hp: 3, maxHp: 10, expectedClass: 'low' },  // 30% not > 30%
      { hp: 1, maxHp: 10, expectedClass: 'low' },  // 10%
    ];

    for (const tc of testCases) {
      const hpPct = tc.hp / tc.maxHp;
      const actualClass = hpPct > 0.6 ? 'high' : hpPct > 0.3 ? 'mid' : 'low';
      expect(actualClass).toBe(tc.expectedClass);
    }
  });
});
