// ========================================
// MAIN.JS - Point d'entrée principal
// ========================================

console.log('🚀 Chargement de main.js...');

import { saveProgress, loadProgress, resetProgress } from './storage.js';
import { gainXP, updateXPDisplay, calculateXPForNextLevel } from './levels.js';
import { pokemonDataDB } from './data.js';

console.log('✅ Imports chargés');
import { checkAchievements, renderAchievements } from './achievements.js';
import {
  AudioManager,
  initializeTabs,
  showLevelUpNotification,
  createClickAnimation,
  initializePlaytimeDisplay,
  initializeVolumeControls
} from './ui.js';
import { openBooster, renderCards, initializeBoosterButtons, updateBoosterPrices, showBoosterOpeningOverlay } from './cards.js';
import { purchaseUpgrade, renderUpgradeBranches, updateAllUpgradeCards } from './upgrades.js';
import { initializeBattleSystem } from './combat.js';

// État global du jeu
const gameState = {
  points: 0,
  inventory: {},
  playerLevel: 1,
  currentXP: 0,
  xpToNextLevel: 100,
  autoClickerLevel: 0,
  purchasedUpgrades: {},
  totalClicks: 0,
  totalUpgradesPurchased: 0,
  totalVictories: 0,
  achievementState: {},
  boostersPurchased: 0,
  totalPlaytime: 0,
  sessionStartTime: Date.now(),
  // Bonus d'améliorations (initialisés à 0)
  flatClickBonus: 0,
  clickPercentBonus: 0,
  criticalChance: 0,
  passivePointsPerSecondBase: 0,
  passivePercentBonus: 0,
  rareChanceBonus: 0,
  legendaryChanceBonus: 0,
  duplicatePointsEnabled: false
};

// Liste des pokémons (à charger depuis data.js)
let pokemons = [];

// Audio manager
const audioManager = new AudioManager();

// Configuration globale
window.shinyChance = 0.01; // 1% de chance de shiny

/**
 * Initialisation du jeu
 */
async function initializeGame() {
  console.log('🎮 Initialisation du Pokémon Clicker...');
  
  // 1. Charger les données sauvegardées
  const savedData = loadProgress();
  if (savedData) {
    Object.assign(gameState, savedData);
    gameState.sessionStartTime = Date.now(); // Redémarrer le compteur de session
    
    // Recalculer xpToNextLevel si non sauvegardé ou incorrect
    if (!gameState.xpToNextLevel || gameState.playerLevel > 1) {
      gameState.xpToNextLevel = calculateXPForNextLevel(gameState.playerLevel);
    }
    
    console.log('💾 Sauvegarde chargée');
    
    // Mettre à jour l'affichage des points immédiatement
    const pointsDisplay = document.querySelector('#points');
    if (pointsDisplay) {
      pointsDisplay.textContent = gameState.points;
    }
  }
  
  // 2. Charger les données des Pokémon depuis le module de données
  pokemons = Array.isArray(pokemonDataDB) ? pokemonDataDB : [];
  if (pokemons.length) {
    console.log(`📦 ${pokemons.length} Pokémon chargés`);
  } else {
    console.error('❌ Données Pokémon introuvables');
  }
  
  // 3. Initialiser l'audio
  const soundList = ['victory', 'defeat', 'level_up', 'booster_open', 'shiny', 'purchase'];
  await audioManager.init(soundList);
  initializeVolumeControls(audioManager);
  
  // 4. Initialiser l'interface
  initializeTabs(); // Initialise et active automatiquement le premier onglet
  updateXPDisplay(gameState);
  initializePlaytimeDisplay(gameState);
  renderAchievements(gameState);
  
  // 5. Initialiser les systèmes de jeu
  initializeClicker();
  initializeUpgradeSystem();
  initializeBoosterSystem();
  initializeBattleSystem(gameState, pokemons, audioManager, handleVictory);
  // Afficher les cartes possédées depuis la sauvegarde
  const initialOwned = getOwnedCardsList();
  console.log(`📦 ${initialOwned.length} cartes possédées`);
  
  const cardsContainer = document.querySelector('#cards');
  if (initialOwned.length) {
    if (cardsContainer) cardsContainer.innerHTML = ''; // Vider avant de remplir
    renderCards(initialOwned, gameState, getDisplayName);
  } else {
    // Afficher un message si aucune carte
    if (cardsContainer) {
      cardsContainer.innerHTML = '<p style="text-align: center; color: #95a5a6; padding: 2rem; font-size: 1.2rem;">📦 Aucun Pokémon dans votre collection.<br>Achetez un booster pour commencer !</p>';
    }
  }
  
  // 5.c Activer le code Konami (easter egg discret)
  initializeKonamiCode();
  
  // 5.b Bouton de réinitialisation
  const resetButton = document.getElementById('reset-btn');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      const confirmation = confirm('Voulez-vous vraiment réinitialiser votre progression ? Cette action est irréversible.');
      if (confirmation) {
        try { resetProgress(); } catch (error) { console.warn('Reset progress failed:', error); }
        // Recharger la page pour repartir sur un état sain
        window.location.reload();
      }
    });
  }
  
  // 6. Démarrer les vérifications périodiques
  startPeriodicChecks();
  
  console.log('✅ Jeu initialisé avec succès');
}

/**
 * Initialise le système de clic
 */
function initializeClicker() {
  const clickButton = document.querySelector('#clickBtn');
  const pointsDisplay = document.querySelector('#points');
  
  if (!clickButton) return;
  
  clickButton.addEventListener('click', (event) => {
    // Gain de base : 1 point
    let clickValue = 1;
    
    // Appliquer les bonus d'améliorations
    clickValue += (gameState.flatClickBonus || 0);
    clickValue = Math.floor(clickValue * (1 + (gameState.clickPercentBonus || 0) / 100));
    
    // Chance critique
    if (gameState.criticalChance && Math.random() < gameState.criticalChance / 100) {
      clickValue *= 10;
      audioManager.play('shiny'); // Son spécial pour crit
    }
    
    gameState.points += clickValue;
    gameState.totalClicks++;
    
    // Gagner 1 XP par clic
    gainXP(1, gameState, onLevelUp);
    
    // Mettre à jour l'affichage
    if (pointsDisplay) {
      pointsDisplay.textContent = gameState.points;
    }
    
    // Animation visuelle
    createClickAnimation(event, clickValue);
    
    // Mettre à jour les cartes d'amélioration
    updateAllUpgradeCards(gameState);
    
    // Sauvegarder (throttled)
    saveProgress(gameState);
  });
}

/**
 * Démarre les vérifications périodiques
 */
function startPeriodicChecks() {
  // Vérification des succès toutes les 30 secondes
  setInterval(() => {
    const hasNewAchievements = checkAchievements(gameState, pokemons);
    if (hasNewAchievements) {
      renderAchievements(gameState);
      saveProgress(gameState);
    }
  }, 30000);
  
  // Sauvegarde automatique toutes les 5 minutes
  setInterval(() => {
    saveProgress(gameState);
  }, 300000);
  
  // Gains passifs chaque seconde
  setInterval(() => {
    if (gameState.passivePointsPerSecondBase) {
      let passiveGain = gameState.passivePointsPerSecondBase;
      passiveGain = Math.floor(passiveGain * (1 + (gameState.passivePercentBonus || 0) / 100));
      gameState.points += passiveGain;
      
      // Mettre à jour l'affichage
      const pointsDisplay = document.querySelector('#points');
      if (pointsDisplay) {
        pointsDisplay.textContent = gameState.points;
      }
      
      // Mettre à jour les cartes d'amélioration
      updateAllUpgradeCards(gameState);
    }
  }, 1000);
}

/**
 * Callback pour la montée de niveau
 */
function onLevelUp(level, title) {
  audioManager.play('level_up');
  showLevelUpNotification(level, title);
  updateXPDisplay(gameState);
  saveProgress(gameState);
}

/**
 * Initialise le système d'améliorations
 */
function initializeUpgradeSystem() {
  renderUpgradeBranches(gameState);
  
  // Event delegation pour les boutons d'achat
  const upgradesContainer = document.querySelector('#upgrades');
  if (upgradesContainer) {
    upgradesContainer.addEventListener('click', (event) => {
      const target = event.target;
      if (target.classList.contains('upgrade-buy-btn')) {
        // Empêche le focus/bouton de provoquer un scroll ou reflow gênant
        event.preventDefault();
        event.stopPropagation();
        const trackId = target.dataset.trackId;
        const card = document.getElementById(`upgrade-card-${trackId}`);
        if (!card) return;
        const currentLevel = parseInt(card.dataset.currentLevel);
        
        // Sauvegarder la position de scroll avant re-render
        const previousScrollY = window.scrollY;
        const previousFocused = document.activeElement;
        
        const result = purchaseUpgrade(trackId, currentLevel, gameState, audioManager);
        if (result.success) {
          card.dataset.currentLevel = String(currentLevel + 1);
          renderUpgradeBranches(gameState);
          
            // Restaurer la position
          window.scrollTo({ top: previousScrollY, behavior: 'instant' });
          
          // Option: replacer le focus sur le même bouton s'il existe encore
          if (previousFocused && previousFocused.id) {
            const newButton = document.getElementById(previousFocused.id);
            if (newButton) newButton.focus({ preventScroll: true });
          }
          
          // Highlight léger sur la carte mise à jour
          const updatedCard = document.getElementById(`upgrade-card-${trackId}`);
          if (updatedCard) {
            updatedCard.classList.add('upgrade-pulse');
            setTimeout(() => updatedCard.classList.remove('upgrade-pulse'), 600);
          }
          
          const pointsDisplay = document.querySelector('#points');
          if (pointsDisplay) {
            pointsDisplay.textContent = gameState.points;
          }
          
          saveProgress(gameState);
        }
      }
    });
  }
}

/**
 * Initialise le système de boosters
 */
function initializeBoosterSystem() {
  const boosterContainer = document.querySelector('.booster-container');
  if (!boosterContainer) {
    console.error('❌ Conteneur de boosters introuvable');
    return;
  }
  
  console.log('🎴 Initialisation des boosters');
  const boosterButtons = initializeBoosterButtons(gameState, () => {
    updateBoosterPrices(boosterButtons, gameState);
  });
  console.log('✅ Boutons de boosters créés:', boosterButtons);
  
  // Event delegation pour les boutons de booster
  boosterContainer.addEventListener('click', (event) => {
    const button = event.target.closest('[data-booster-type]');
    if (!button) return;
    
    const boosterType = button.dataset.boosterType;
    const upgradeBonus = {
      rareChanceBonus: gameState.rareChanceBonus || 0,
      legendaryChanceBonus: gameState.legendaryChanceBonus || 0,
      duplicatePointsEnabled: gameState.duplicatePointsEnabled || false
    };
    
    const result = openBooster(boosterType, pokemons, gameState, upgradeBonus, audioManager);
    
    if (result.success) {
      // Mettre à jour l'affichage des points
      const pointsDisplay = document.querySelector('#points');
      if (pointsDisplay) {
        pointsDisplay.textContent = gameState.points;
      }
      
      // Mettre à jour les prix des boosters
      updateBoosterPrices(boosterButtons, gameState);
      
      // Animation d'ouverture de booster, puis rendre les cartes à la validation
      showBoosterOpeningOverlay(result.cards, result.imageUrl, () => {
        renderCards(result.cards, gameState, getDisplayName);
      }, audioManager);
      
      // Sauvegarder
      saveProgress(gameState);
    }
  });
  
  // Mettre à jour les prix initiaux
  updateBoosterPrices(boosterButtons, gameState);
}

/**
 * Gère les victoires en combat
 */
function handleVictory(xpGain) {
  console.log(`🏆 Victoire ! Appel de gainXP avec ${xpGain} XP`);
  gainXP(xpGain, gameState, onLevelUp);
}

/**
 * Retourne le nom d'affichage d'un Pokémon
 */
function getDisplayName(entity, maybeIsShiny) {
  // Supporte deux formes d'appel: getDisplayName(card) ou getDisplayName(pokemon, isShiny)
  const hasNameObject = entity && entity.name && typeof entity.name === 'object';
  const baseName = hasNameObject ? (entity.name.fr || entity.name.en || '???') : (entity.name || '???');
  const shinyFlag = typeof maybeIsShiny !== 'undefined' ? maybeIsShiny : !!entity.isShiny;
  return shinyFlag ? `✨ ${baseName}` : baseName;
}

// Construit un objet "carte" cohérent à partir d'un pokémon de base et d'un flag shiny
function buildCardFromBase(basePokemon, isShiny) {
  if (!basePokemon) return null;
  if (isShiny) {
    return {
      ...basePokemon,
      isShiny: true,
      pokedex_id: `${basePokemon.pokedex_id}_shiny`,
      sprites: {
        regular: basePokemon.sprites.shiny || basePokemon.sprites.regular,
        shiny: basePokemon.sprites.shiny || basePokemon.sprites.regular
      },
      rareté: basePokemon.rareté === 3 ? 4 : 3
    };
  }
  return { ...basePokemon, isShiny: false };
}

// Reconstitue la liste des cartes possédées depuis l'inventaire (une entrée par variante)
function getOwnedCardsList() {
  const result = [];
  const seen = new Set();
  Object.keys(gameState.inventory).forEach(key => {
    if (!gameState.inventory[key]) return;
    if (seen.has(key)) return;
    seen.add(key);
    const isShiny = key.includes('_shiny');
    const idString = isShiny ? key.replace('_shiny', '') : key;
    const baseId = parseInt(idString, 10);
    const basePokemon = pokemons.find(p => p.pokedex_id === baseId);
    const card = buildCardFromBase(basePokemon, isShiny);
    if (card) result.push(card);
  });
  return result;
}

// Lancer le jeu au chargement de la page (voir listener plus bas avec logs)

/**
 * Active un écouteur pour le code Konami.
 * Séquence: ↑ ↑ ↓ ↓ ← → ← → B A
 * Effet: +1 000 000 points, mise à jour UI et sauvegarde (aucun affichage).
 */
function initializeKonamiCode() {
  const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let index = 0;
  document.addEventListener('keydown', (event) => {
    let key = event.key;
    // Normaliser pour accepter 'b' et 'B'
    if (!key.startsWith('Arrow')) {
      key = key.toLowerCase();
    }
    if (key === sequence[index]) {
      index++;
      if (index === sequence.length) {
        // Récompense silencieuse
        gameState.points += 1000000;
        const pointsDisplay = document.getElementById('points');
        if (pointsDisplay) pointsDisplay.textContent = gameState.points;
        updateAllUpgradeCards(gameState);
        saveProgress(gameState);
        index = 0;
      }
    } else {
      index = (key === sequence[0]) ? 1 : 0;
    }
  }, { capture: true });
}

// Lancer le jeu au chargement de la page (unique)
console.log('📄 Attente du chargement du DOM...');
document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM chargé, initialisation du jeu...');
  initializeGame();
  // Exposer globalement pour le débogage
  window.gameState = gameState;
  window.audioManager = audioManager;
  console.log('🎮 Main.js complètement chargé');
});

