// ========================================
// STORAGE.JS - Gestion de la sauvegarde
// ========================================

const STORAGE_KEY = 'pokemon_clicker_save';
let saveScheduled = false;

/**
 * Sauvegarde la progression du joueur dans le localStorage
 * Utilise un throttle de 500ms pour éviter les sauvegardes trop fréquentes
 */
export function saveProgress(gameState) {
  if (saveScheduled) return;
  
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    try {
      // Calculer le temps de jeu total avant sauvegarde
      const currentPlaytime = gameState.totalPlaytime + (Date.now() - gameState.sessionStartTime);
      
      const data = {
        points: gameState.points,
        inventory: gameState.inventory,
        playerLevel: gameState.playerLevel,
        currentXP: gameState.currentXP,
        xpToNextLevel: gameState.xpToNextLevel,
        autoClickerLevel: gameState.autoClickerLevel,
        purchasedUpgrades: Object.keys(gameState.purchasedUpgrades),
        totalClicks: gameState.totalClicks,
        totalUpgradesPurchased: gameState.totalUpgradesPurchased,
        totalVictories: gameState.totalVictories,
        achievementState: gameState.achievementState,
        boostersPurchased: gameState.boostersPurchased,
        totalPlaytime: currentPlaytime
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Sauvegarde impossible:', error);
    }
  }, 500);
}

/**
 * Charge la progression depuis le localStorage
 * @returns {Object|null} Les données sauvegardées ou null si aucune sauvegarde
 */
export function loadProgress() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return null;
    
    const data = JSON.parse(rawData);
    
    // Valider et retourner les données
    return {
      points: typeof data.points === 'number' ? data.points : 0,
      inventory: data.inventory && typeof data.inventory === 'object' ? data.inventory : {},
      playerLevel: typeof data.playerLevel === 'number' ? data.playerLevel : 1,
      currentXP: typeof data.currentXP === 'number' ? data.currentXP : 0,
      xpToNextLevel: typeof data.xpToNextLevel === 'number' ? data.xpToNextLevel : 100,
      autoClickerLevel: typeof data.autoClickerLevel === 'number' ? data.autoClickerLevel : 0,
      purchasedUpgrades: Array.isArray(data.purchasedUpgrades) ? data.purchasedUpgrades : [],
      totalClicks: typeof data.totalClicks === 'number' ? data.totalClicks : 0,
      totalUpgradesPurchased: typeof data.totalUpgradesPurchased === 'number' ? data.totalUpgradesPurchased : 0,
      totalVictories: typeof data.totalVictories === 'number' ? data.totalVictories : 0,
      achievementState: data.achievementState && typeof data.achievementState === 'object' ? data.achievementState : {},
      boostersPurchased: typeof data.boostersPurchased === 'number' ? data.boostersPurchased : 0,
      totalPlaytime: typeof data.totalPlaytime === 'number' ? data.totalPlaytime : 0
    };
  } catch (error) {
    console.warn('Chargement impossible:', error);
    return null;
  }
}

/**
 * Réinitialise complètement la sauvegarde
 */
export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn('Réinitialisation impossible:', error);
    return false;
  }
}
