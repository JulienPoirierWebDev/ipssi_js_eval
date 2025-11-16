// ========================================
// LEVELS.JS - Système de progression (XP et niveaux)
// ========================================

// Titres des niveaux importants
const levelTitles = {
  1: 'Dresseur débutant',
  5: 'Dresseur intermédiaire',
  10: 'Dresseur expérimenté',
  15: 'Champion régional',
  20: 'Maître Pokémon',
  25: 'Dresseur suprême'
};

/**
 * Calcule l'XP nécessaire pour atteindre le niveau suivant
 * Formule exponentielle pour une progression équilibrée
 */
export function calculateXPForNextLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Fait gagner de l'XP au joueur et gère les montées de niveau
 * @param {number} xpAmount - Quantité d'XP à gagner
 * @param {Object} gameState - État du jeu (modifié directement)
 * @param {Function} onLevelUp - Callback appelé lors d'une montée de niveau
 */
export function gainXP(xpAmount, gameState, onLevelUp) {
  if (gameState.playerLevel >= 25) return; // Niveau max atteint
  
  console.log(`💫 Gain de ${xpAmount} XP (${gameState.currentXP} / ${gameState.xpToNextLevel})`);
  
  gameState.currentXP += xpAmount;
  
  // Vérifier les montées de niveau
  while (gameState.currentXP >= gameState.xpToNextLevel && gameState.playerLevel < 25) {
    gameState.currentXP -= gameState.xpToNextLevel;
    gameState.playerLevel++;
    gameState.xpToNextLevel = calculateXPForNextLevel(gameState.playerLevel);
    
    // Appeler le callback pour la notification visuelle
    if (onLevelUp) {
      const title = levelTitles[gameState.playerLevel];
      onLevelUp(gameState.playerLevel, title);
    }
  }
  
  // Si niveau max atteint, mettre l'XP à 0
  if (gameState.playerLevel >= 25) {
    gameState.currentXP = 0;
    gameState.xpToNextLevel = Infinity;
  }
  
  updateXPDisplay(gameState);
}

/**
 * Met à jour l'affichage de la barre d'XP
 */
export function updateXPDisplay(gameState) {
  console.log(`📊 Mise à jour XP: ${gameState.currentXP} / ${gameState.xpToNextLevel} (niveau ${gameState.playerLevel})`);
  
  const xpBarElement = document.getElementById('xp-bar');
  const xpTextElement = document.getElementById('xp-text');
  const levelElement = document.getElementById('player-level');
  const statusElement = document.getElementById('level-status');
  
  console.log('Éléments trouvés:', { xpBar: !!xpBarElement, xpText: !!xpTextElement, level: !!levelElement, status: !!statusElement });
  
  if (xpBarElement) {
    const percentage = (gameState.currentXP / gameState.xpToNextLevel) * 100;
    xpBarElement.style.width = `${percentage}%`;
    console.log(`✅ Barre XP mise à jour: ${percentage}%`);
  } else {
    console.error('❌ Élément xp-bar introuvable');
  }
  
  if (xpTextElement) {
    xpTextElement.textContent = `${gameState.currentXP} / ${gameState.xpToNextLevel}`;
    console.log(`✅ Texte XP mis à jour: ${gameState.currentXP} / ${gameState.xpToNextLevel}`);
  } else {
    console.error('❌ Élément xp-text introuvable');
  }
  
  if (levelElement) {
    levelElement.textContent = gameState.playerLevel;
    console.log(`✅ Niveau mis à jour: ${gameState.playerLevel}`);
  } else {
    console.error('❌ Élément player-level introuvable');
  }
  
  if (statusElement) {
    const title = levelTitles[gameState.playerLevel] || `Niveau ${gameState.playerLevel}`;
    statusElement.textContent = title;
    console.log(`✅ Statut mis à jour: ${title}`);
  } else {
    console.error('❌ Élément level-status introuvable');
  }
}

/**
 * Retourne le titre du niveau actuel
 */
export function getLevelTitle(level) {
  return levelTitles[level] || `Niveau ${level}`;
}
