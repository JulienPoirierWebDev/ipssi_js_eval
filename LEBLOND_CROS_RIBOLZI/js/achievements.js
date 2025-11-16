// ========================================
// ACHIEVEMENTS.JS - Système de succès
// ========================================

// Définition de tous les succès du jeu
export const achievementsDefinition = [
  { 
    categoryIcon: '💪', 
    category: 'Clics', 
    items: [
      { key: 'clicks_100', name: 'Dresseur débutant', condition: '100 clics', type: 'clicks', target: 100, reward: '+' },
      { key: 'clicks_1000', name: 'Dresseur confirmé', condition: '1 000 clics', type: 'clicks', target: 1000, reward: '+' },
      { key: 'clicks_10000', name: 'Maître du clic', condition: '10 000 clics', type: 'clicks', target: 10000, reward: '+' }
    ]
  },
  { 
    categoryIcon: '💰', 
    category: 'Points cumulés', 
    items: [
      { key: 'points_10000', name: 'Riche !', condition: '10 000 points', type: 'points', target: 10000, reward: '+' },
      { key: 'points_1000000', name: 'Millionnaire', condition: '1 000 000 points', type: 'points', target: 1000000, reward: '+' }
    ]
  },
  { 
    categoryIcon: '🧠', 
    category: 'Améliorations', 
    items: [
      { key: 'upgrades_5', name: 'Ingénieux', condition: 'Acheter 5 améliorations', type: 'upgrades', target: 5, reward: '+' },
      { key: 'upgrades_15', name: 'Stratège', condition: 'Acheter 15 améliorations', type: 'upgrades', target: 15, reward: '+' }
    ]
  },
  { 
    categoryIcon: '🃏', 
    category: 'Collection', 
    items: [
      { key: 'cards_10', name: 'Collectionneur', condition: '10 cartes obtenues', type: 'cardsTotal', target: 10, reward: '+' },
      { key: 'commons_all', name: 'Maître du Pokédex', condition: 'toutes cartes communes', type: 'allCommons', target: true, reward: '+' },
      { key: 'legendary_1', name: 'Légendaire', condition: '1 carte légendaire', type: 'legendaryCount', target: 1, reward: '+' }
    ]
  },
  { 
    categoryIcon: '🕒', 
    category: 'Temps de jeu', 
    items: [
      { key: 'playtime_30min', name: 'Persévérant', condition: '30 min de jeu', type: 'playtime', target: 30 * 60 * 1000, reward: '+' },
      { key: 'playtime_2h', name: 'Insomniaque', condition: '2h de jeu', type: 'playtime', target: 2 * 60 * 60 * 1000, reward: '+' }
    ]
  },
  { 
    categoryIcon: '⚔️', 
    category: 'Combat', 
    items: [
      { key: 'victory_1', name: 'Premier duel', condition: '1 victoire', type: 'victories', target: 1, reward: '+' },
      { key: 'victory_10', name: 'Champion', condition: '10 victoires', type: 'victories', target: 10, reward: '+' },
      { key: 'victory_100', name: 'Maître Pokémon', condition: '100 victoires', type: 'victories', target: 100, reward: '+' }
    ]
  }
];

/**
 * Vérifie si les conditions des succès sont remplies
 * @param {Object} gameState - État du jeu actuel
 * @param {Array} pokemons - Liste des pokémons disponibles
 * @returns {boolean} True si au moins un succès a été débloqué
 */
export function checkAchievements(gameState, pokemons) {
  let hasChanges = false;
  
  achievementsDefinition.forEach(category => {
    category.items.forEach(achievement => {
      // Skip si déjà obtenu
      if (gameState.achievementState[achievement.key]) return;
      
      let achieved = false;
      const currentTotalPlaytime = gameState.totalPlaytime + (Date.now() - gameState.sessionStartTime);
      
      switch (achievement.type) {
        case 'clicks':
          achieved = gameState.totalClicks >= achievement.target;
          break;
          
        case 'points':
          achieved = gameState.points >= achievement.target;
          break;
          
        case 'upgrades':
          achieved = gameState.totalUpgradesPurchased >= achievement.target;
          break;
          
        case 'cardsTotal': {
          let totalCards = 0;
          for (const key in gameState.inventory) {
            totalCards += gameState.inventory[key];
          }
          achieved = totalCards >= achievement.target;
          break;
        }
        
        case 'allCommons': {
          const commonPokemons = pokemons.filter(pokemon => pokemon.rareté === 1);
          achieved = commonPokemons.every(pokemon => 
            gameState.inventory[String(pokemon.pokedex_id)] >= 1
          );
          break;
        }
        
        case 'legendaryCount': {
          const legendariesOwned = pokemons.filter(pokemon =>
            pokemon.rareté === 3 && gameState.inventory[String(pokemon.pokedex_id)] >= 1
          ).length;
          achieved = legendariesOwned >= achievement.target;
          break;
        }
        
        case 'playtime':
          achieved = currentTotalPlaytime >= achievement.target;
          break;
          
        case 'victories':
          achieved = gameState.totalVictories >= achievement.target;
          break;
      }
      
      if (achieved) {
        gameState.achievementState[achievement.key] = true;
        hasChanges = true;
      }
    });
  });
  
  return hasChanges;
}

/**
 * Affiche tous les succès dans le conteneur
 */
export function renderAchievements(gameState) {
  const container = document.getElementById('achievements-container');
  if (!container) return;
  
  // Vider le conteneur
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  // Créer les catégories
  achievementsDefinition.forEach(category => {
    const categoryBlock = document.createElement('div');
    categoryBlock.className = 'achievement-category';
    
    const categoryHeading = document.createElement('h3');
    categoryHeading.textContent = `${category.categoryIcon} ${category.category}`;
    categoryBlock.appendChild(categoryHeading);
    
    const achievementList = document.createElement('div');
    achievementList.className = 'achievement-list';
    
    category.items.forEach(achievement => {
      const achievementRow = document.createElement('div');
      achievementRow.className = 'achievement-item';
      
      if (gameState.achievementState[achievement.key]) {
        achievementRow.classList.add('completed');
      }
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'achievement-name';
      nameSpan.textContent = achievement.name;
      
      const conditionSpan = document.createElement('span');
      conditionSpan.className = 'achievement-condition';
      conditionSpan.textContent = achievement.condition;
      
      const rewardSpan = document.createElement('span');
      rewardSpan.className = 'achievement-reward';
      rewardSpan.textContent = achievement.reward;
      
      achievementRow.appendChild(nameSpan);
      achievementRow.appendChild(conditionSpan);
      achievementRow.appendChild(rewardSpan);
      
      achievementList.appendChild(achievementRow);
    });
    
    categoryBlock.appendChild(achievementList);
    container.appendChild(categoryBlock);
  });
}
