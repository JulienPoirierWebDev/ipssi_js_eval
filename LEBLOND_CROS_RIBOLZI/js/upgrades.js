// ========================================
// UPGRADES.JS - Système d'améliorations
// ========================================

/**
 * Données des branches d'améliorations
 * Chaque branche contient plusieurs tracks (lignes d'amélioration)
 * Chaque track contient plusieurs niveaux
 */
export const upgradeTracksData = [
  // Branche Clic
  {
    branch: 'click',
    icon: '🖱️',
    branchName: 'Branche Clic',
    color: '#e74c3c',
    trackId: 'click_flat',
    name: 'Doigt d\'acier',
    levels: [
      { cost: 20, desc: '+1 point par clic' },
      { cost: 100, desc: '+2 points par clic' },
      { cost: 500, desc: '+5 points par clic' },
      { cost: 2500, desc: '+10 points par clic' },
      { cost: 10000, desc: '+25 points par clic' },
      { cost: 50000, desc: '+50 points par clic' },
      { cost: 250000, desc: '+100 points par clic' },
      { cost: 1000000, desc: '+250 points par clic' },
      { cost: 5000000, desc: '+500 points par clic' },
      { cost: 25000000, desc: '+1000 points par clic' }
    ]
  },
  {
    branch: 'click',
    icon: '🖱️',
    branchName: 'Branche Clic',
    color: '#e74c3c',
    trackId: 'click_percent',
    name: 'Foudre de Pikachu',
    levels: [
      { cost: 150, desc: '+10% points par clic' },
      { cost: 800, desc: '+10% points par clic' },
      { cost: 3000, desc: '+10% points par clic' },
      { cost: 15000, desc: '+10% points par clic' },
      { cost: 60000, desc: '+10% points par clic' },
      { cost: 250000, desc: '+10% points par clic' },
      { cost: 1000000, desc: '+10% points par clic' },
      { cost: 4000000, desc: '+10% points par clic' },
      { cost: 16000000, desc: '+10% points par clic' },
      { cost: 64000000, desc: '+10% points par clic' }
    ]
  },
  {
    branch: 'click',
    icon: '🖱️',
    branchName: 'Branche Clic',
    color: '#e74c3c',
    trackId: 'click_crit',
    name: 'Clic critique',
    unique: true,
    levels: [
      { cost: 10000, desc: '1% de chance de x10 points' }
    ]
  },
  
  // Branche Passif
  {
    branch: 'passive',
    icon: '🌿',
    branchName: 'Branche Passif',
    color: '#3498db',
    trackId: 'passive_base',
    name: 'Équipe automatique',
    levels: [
      { cost: 50, desc: '1 point/sec' },
      { cost: 300, desc: '2 points/sec' },
      { cost: 1500, desc: '5 points/sec' },
      { cost: 7500, desc: '15 points/sec' },
      { cost: 30000, desc: '50 points/sec' },
      { cost: 120000, desc: '100 points/sec' },
      { cost: 480000, desc: '200 points/sec' },
      { cost: 2000000, desc: '500 points/sec' },
      { cost: 8000000, desc: '1000 points/sec' },
      { cost: 32000000, desc: '2000 points/sec' }
    ]
  },
  {
    branch: 'passive',
    icon: '🌿',
    branchName: 'Branche Passif',
    color: '#3498db',
    trackId: 'passive_percent',
    name: 'Turbo passif',
    levels: [
      { cost: 1000, desc: '+25% gain passif' },
      { cost: 5000, desc: '+25% gain passif' },
      { cost: 20000, desc: '+25% gain passif' },
      { cost: 80000, desc: '+25% gain passif' },
      { cost: 320000, desc: '+25% gain passif' },
      { cost: 1280000, desc: '+25% gain passif' },
      { cost: 5120000, desc: '+25% gain passif' },
      { cost: 20000000, desc: '+25% gain passif' },
      { cost: 80000000, desc: '+25% gain passif' },
      { cost: 320000000, desc: '+25% gain passif' }
    ]
  },
  
  // Branche Booster
  {
    branch: 'booster',
    icon: '🎴',
    branchName: 'Branche Booster',
    color: '#9b59b6',
    trackId: 'boost_rare',
    name: 'Rareté',
    levels: [
      { cost: 500, desc: '+5% chance carte rare' },
      { cost: 2000, desc: '+5% chance carte rare' },
      { cost: 10000, desc: '+5% chance carte rare' },
      { cost: 40000, desc: '+5% chance carte rare' },
      { cost: 160000, desc: '+5% chance carte rare' },
      { cost: 640000, desc: '+5% chance carte rare' },
      { cost: 2500000, desc: '+5% chance carte rare' },
      { cost: 10000000, desc: '+5% chance carte rare' },
      { cost: 40000000, desc: '+5% chance carte rare' },
      { cost: 160000000, desc: '+5% chance carte rare' }
    ]
  },
  {
    branch: 'booster',
    icon: '🎴',
    branchName: 'Branche Booster',
    color: '#9b59b6',
    trackId: 'boost_leg',
    name: 'Légendaire',
    levels: [
      { cost: 1500, desc: '+5% chance légendaire' },
      { cost: 7500, desc: '+5% chance légendaire' },
      { cost: 25000, desc: '+5% chance légendaire' },
      { cost: 100000, desc: '+5% chance légendaire' },
      { cost: 400000, desc: '+5% chance légendaire' },
      { cost: 1600000, desc: '+5% chance légendaire' },
      { cost: 6000000, desc: '+5% chance légendaire' },
      { cost: 24000000, desc: '+5% chance légendaire' },
      { cost: 96000000, desc: '+5% chance légendaire' },
      { cost: 384000000, desc: '+5% chance légendaire' }
    ]
  },
  {
    branch: 'booster',
    icon: '🎴',
    branchName: 'Branche Booster',
    color: '#9b59b6',
    trackId: 'boost_dup',
    name: 'Recyclage',
    unique: true,
    levels: [
      { cost: 2500, desc: 'Doublons = points bonus' }
    ]
  }
];

/**
 * Applique les effets d'une amélioration
 */
export function applyUpgradeEffect(trackId, level, gameState) {
  const track = upgradeTracksData.find(track => track.trackId === trackId);
  if (!track) return;
  
  const upgradeLevel = level + 1; // level est 0-indexed, upgradeLevel est 1-indexed
  
  switch (trackId) {
    case 'click_flat':
      gameState.flatClickBonus = (gameState.flatClickBonus || 0) + [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000][level];
      break;
    case 'click_percent':
      gameState.clickPercentBonus = (gameState.clickPercentBonus || 0) + [10, 10, 10, 10, 10, 10, 10, 10, 10, 10][level];
      break;
    case 'click_crit':
      gameState.criticalChance = 1;
      break;
    case 'passive_base':
      gameState.passivePointsPerSecondBase = (gameState.passivePointsPerSecondBase || 0) + [1, 2, 5, 15, 50, 100, 200, 500, 1000, 2000][level];
      break;
    case 'passive_percent':
      gameState.passivePercentBonus = (gameState.passivePercentBonus || 0) + [25, 25, 25, 25, 25, 25, 25, 25, 25, 25][level];
      break;
    case 'boost_rare':
      gameState.rareChanceBonus = (gameState.rareChanceBonus || 0) + [5, 5, 5, 5, 5, 5, 5, 5, 5, 5][level];
      break;
    case 'boost_leg':
      gameState.legendaryChanceBonus = (gameState.legendaryChanceBonus || 0) + [5, 5, 5, 5, 5, 5, 5, 5, 5, 5][level];
      break;
    case 'boost_dup':
      gameState.duplicatePointsEnabled = true;
      break;
  }
}

/**
 * Achète une amélioration
 */
export function purchaseUpgrade(trackId, level, gameState, audioManager) {
  const track = upgradeTracksData.find(track => track.trackId === trackId);
  if (!track) return { success: false, reason: 'Amélioration introuvable' };
  
  const upgradeId = `${trackId}_${level + 1}`;
  
  // Vérifier si déjà acheté
  if (gameState.purchasedUpgrades[upgradeId]) {
    return { success: false, reason: 'Déjà acheté' };
  }
  
  // Vérifier le coût
  const upgradeCost = track.levels[level].cost;
  if (gameState.points < upgradeCost) {
    return { success: false, reason: 'Pas assez de points' };
  }
  
  // Acheter
  gameState.points -= upgradeCost;
  gameState.purchasedUpgrades[upgradeId] = true;
  gameState.totalUpgradesPurchased++;
  
  // Appliquer l'effet
  applyUpgradeEffect(trackId, level, gameState);
  
  // Son d'achat
  if (audioManager) {
    audioManager.play('purchase');
  }
  
  return { success: true };
}

/**
 * Affiche toutes les cartes d'amélioration
 */
export function renderUpgradeBranches(gameState) {
  const upgradesContainer = document.querySelector('#upgrades');
  if (!upgradesContainer) return;
  
  // Vider le conteneur
  while (upgradesContainer.firstChild) {
    upgradesContainer.removeChild(upgradesContainer.firstChild);
  }
  
  // Calculer le niveau actuel de chaque track
  const trackLevels = {};
  upgradeTracksData.forEach(track => {
    let currentLevel = 0;
    for (let levelIndex = 0; levelIndex < track.levels.length; levelIndex++) {
      const upgradeId = `${track.trackId}_${levelIndex + 1}`;
      if (gameState.purchasedUpgrades[upgradeId]) {
        currentLevel = levelIndex + 1;
      } else {
        break;
      }
    }
    trackLevels[track.trackId] = currentLevel;
  });
  
  // Regrouper par branche
  const branchGroups = {};
  upgradeTracksData.forEach(track => {
    if (!branchGroups[track.branch]) {
      branchGroups[track.branch] = {
        name: track.branchName,
        color: track.color,
        tracks: []
      };
    }
    branchGroups[track.branch].tracks.push(track);
  });
  
  // Afficher chaque branche
  Object.keys(branchGroups).forEach(branchKey => {
    const branchData = branchGroups[branchKey];
    
    const heading = document.createElement('h3');
    heading.textContent = branchData.name;
    heading.style.margin = '0.6rem 0 0.3rem 0';
    heading.style.color = branchData.color;
    heading.style.textShadow = '0 1px 6px rgba(0,0,0,0.25)';
    upgradesContainer.appendChild(heading);
    
    // Afficher chaque track
    branchData.tracks.forEach(track => {
      const currentLevel = trackLevels[track.trackId];
      const nextLevel = currentLevel < track.levels.length ? currentLevel : track.levels.length - 1;
      const nextUpgrade = track.levels[nextLevel];
      const maxed = currentLevel >= track.levels.length;
      
      const card = createUpgradeCard(track, currentLevel, nextUpgrade, maxed, gameState);
      upgradesContainer.appendChild(card);
    });
  });
}

/**
 * Crée une carte d'amélioration
 */
function createUpgradeCard(track, currentLevel, nextUpgrade, maxed, gameState) {
  const card = document.createElement('div');
  card.className = 'upgrade-card';
  card.id = `upgrade-card-${track.trackId}`;
  card.dataset.trackId = track.trackId;
  card.dataset.currentLevel = String(currentLevel);
  
  // Icône
  const icon = document.createElement('div');
  icon.className = 'upgrade-icon';
  icon.textContent = track.icon;
  card.appendChild(icon);
  
  // Contenu
  const content = document.createElement('div');
  content.className = 'upgrade-content';
  
  const name = document.createElement('h4');
  name.className = 'upgrade-name';
  if (track.unique) {
    name.textContent = track.name;
  } else {
    const levelNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    const levelText = levelNumerals[currentLevel] || 'MAX';
    name.textContent = `${track.name} ${levelText}`;
  }
  content.appendChild(name);
  
  const description = document.createElement('p');
  description.className = 'upgrade-description';
  description.id = `upgrade-desc-${track.trackId}`;
  description.textContent = nextUpgrade.desc;
  content.appendChild(description);
  
  // Footer
  const footer = document.createElement('div');
  footer.className = 'upgrade-footer';
  
  const cost = document.createElement('span');
  cost.className = 'upgrade-cost';
  cost.id = `upgrade-cost-${track.trackId}`;
  cost.textContent = maxed ? 'MAX' : `${nextUpgrade.cost} 💰`;
  footer.appendChild(cost);
  
  const buyButton = document.createElement('button');
  buyButton.className = 'upgrade-buy-btn';
  buyButton.id = `upgrade-buy-${track.trackId}`;
  buyButton.dataset.trackId = track.trackId;
  buyButton.textContent = maxed ? 'MAX' : 'Améliorer';
  buyButton.disabled = maxed;
  footer.appendChild(buyButton);
  
  const checkmark = document.createElement('span');
  checkmark.className = 'upgrade-checkmark';
  checkmark.id = `upgrade-done-${track.trackId}`;
  checkmark.textContent = maxed ? '✓ MAX' : '';
  footer.appendChild(checkmark);
  
  content.appendChild(footer);
  card.appendChild(content);
  
  // État visuel
  updateUpgradeCardState(card, gameState.points, currentLevel, nextUpgrade, maxed, track.levels.length);
  
  return card;
}

/**
 * Met à jour l'état visuel d'une carte d'amélioration
 */
function updateUpgradeCardState(card, points, currentLevel, nextUpgrade, maxed, totalLevels) {
  card.classList.remove('locked', 'available', 'purchased');
  
  if (maxed) {
    card.classList.add('purchased');
  } else if (points >= nextUpgrade.cost) {
    card.classList.add('available');
  } else {
    card.classList.add('locked');
  }
}

/**
 * Met à jour l'état de toutes les cartes d'amélioration
 */
export function updateAllUpgradeCards(gameState) {
  upgradeTracksData.forEach(track => {
    const card = document.getElementById(`upgrade-card-${track.trackId}`);
    if (!card) return;
    
    const currentLevel = parseInt(card.dataset.currentLevel);
    const maxed = currentLevel >= track.levels.length;
    const nextLevel = currentLevel < track.levels.length ? currentLevel : track.levels.length - 1;
    const nextUpgrade = track.levels[nextLevel];
    
    updateUpgradeCardState(card, gameState.points, currentLevel, nextUpgrade, maxed, track.levels.length);
  });
}
