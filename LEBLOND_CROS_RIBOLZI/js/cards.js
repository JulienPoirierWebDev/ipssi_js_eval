// ========================================
// CARDS.JS - Système de cartes et boosters
// ========================================

// Configuration des types de boosters
export const boosterTypes = {
  basic: {
    name: 'Booster Basique',
    icon: '🎴',
    color: '#f39c12',
    priceMultiplier: 1,
    rareBonus: 0,
    legendaryBonus: 0,
    commonPenalty: 0,
    description: 'Booster standard',
    imageUrl: 'images/booster-pokemon.png'
  },
  premium: {
    name: 'Booster Premium',
    icon: '✨',
    color: '#3498db',
    priceMultiplier: 3,
    rareBonus: 0.10,
    legendaryBonus: 0.03,
    commonPenalty: 0,
    description: 'Meilleures chances !',
    imageUrl: 'images/booster-premium.png'
  },
  ultimate: {
    name: 'Booster Ultime',
    icon: '💎',
    color: '#9b59b6',
    priceMultiplier: 10,
    rareBonus: 0.35,
    legendaryBonus: 0.25,
    commonPenalty: -0.50,
    description: 'Légendaires garantis !',
    imageUrl: 'images/booster-ultimate.png'
  }
};

/**
 * Calcule le prix d'un booster basique
 */
export function getBasicBoosterPrice(boostersPurchased) {
  return Math.floor(100 * Math.pow(1.15, boostersPurchased));
}

/**
 * Tire un Pokémon avec probabilités selon la rareté
 * @param {Array} pokemons - Liste des pokémons disponibles
 * @param {Object} boosterBonus - Bonus de rareté du booster
 * @param {Object} upgradeBonus - Bonus des améliorations
 * @param {number} shinyChance - Chance de shiny (0-1)
 */
export function drawPokemonWithRarity(pokemons, boosterBonus = {}, upgradeBonus = {}, shinyChance = 0.01) {
  // Probabilités de base
  let probabilityCommon = 0.70;
  let probabilityRare = 0.25;
  let probabilityLegendary = 0.05;
  
  // Appliquer bonus multiplicatifs des upgrades
  if (upgradeBonus.rareChanceBonus) {
    probabilityRare *= (1 + upgradeBonus.rareChanceBonus / 100);
  }
  if (upgradeBonus.legendaryChanceBonus) {
    probabilityLegendary *= (1 + upgradeBonus.legendaryChanceBonus / 100);
  }
  
  // Appliquer bonus/malus du type de booster (additif)
  probabilityCommon += (boosterBonus.common || 0);
  probabilityRare += (boosterBonus.rare || 0);
  probabilityLegendary += (boosterBonus.legendary || 0);
  
  // S'assurer que les probabilités restent positives
  probabilityCommon = Math.max(0.05, probabilityCommon);
  
  // Renormaliser pour garder somme = 1
  const total = probabilityCommon + probabilityRare + probabilityLegendary;
  probabilityCommon /= total;
  probabilityRare /= total;
  probabilityLegendary /= total;
  
  // Tirer la rareté
  const randomValue = Math.random();
  let rarityFilter;
  if (randomValue < probabilityCommon) {
    rarityFilter = 1;
  } else if (randomValue < probabilityCommon + probabilityRare) {
    rarityFilter = 2;
  } else {
    rarityFilter = 3;
  }
  
  // Filtrer les pokémons par rareté
  const filteredPokemons = pokemons.filter(pokemon => pokemon.rareté === rarityFilter);
  if (filteredPokemons.length === 0) {
    // Fallback
    return pokemons[Math.floor(Math.random() * pokemons.length)];
  }
  
  const selectedPokemon = filteredPokemons[Math.floor(Math.random() * filteredPokemons.length)];
  
  // Vérifier si c'est un shiny
  const isShiny = Math.random() < shinyChance;
  
  if (isShiny && selectedPokemon.sprites.shiny) {
    return {
      ...selectedPokemon,
      isShiny: true,
      pokedex_id: selectedPokemon.pokedex_id + '_shiny',
      sprites: {
        regular: selectedPokemon.sprites.shiny,
        shiny: selectedPokemon.sprites.shiny
      },
      rareté: selectedPokemon.rareté === 3 ? 4 : 3
    };
  }
  
  return {
    ...selectedPokemon,
    isShiny: false
  };
}

/**
 * Calcule l'XP gagné selon la rareté d'un Pokémon
 */
export function calculateCardXP(pokemon) {
  if (pokemon.isShiny) {
    return pokemon.rareté === 4 ? 500 : 200;
  }
  
  switch (pokemon.rareté) {
    case 1: return 1;
    case 2: return 3;
    case 3: return 6;
    default: return 1;
  }
}

/**
 * Ouvre un booster et retourne les cartes obtenues
 */
export function openBooster(boosterType, pokemons, gameState, upgradeBonus, audioManager) {
  const config = boosterTypes[boosterType];
  const boosterPrice = Math.floor(getBasicBoosterPrice(gameState.boostersPurchased) * config.priceMultiplier);
  
  // Vérifier si le joueur a assez de points
  if (gameState.points < boosterPrice) {
    return { success: false, reason: 'Pas assez de points !' };
  }
  
  // Déduire le prix
  gameState.points -= boosterPrice;
  gameState.boostersPurchased++;
  
  const drawnCards = [];
  let totalXP = 0;
  const boosterBonus = {
    rare: config.rareBonus,
    legendary: config.legendaryBonus,
    common: config.commonPenalty || 0
  };
  
  // Tirer 3 cartes
  for (let cardIndex = 0; cardIndex < 3; cardIndex++) {
    const pokemon = drawPokemonWithRarity(pokemons, boosterBonus, upgradeBonus, window.shinyChance || 0.01);
    drawnCards.push(pokemon);
    
    // Ajouter à l'inventaire
    const inventoryKey = String(pokemon.pokedex_id);
    const previousCount = gameState.inventory[inventoryKey] || 0;
    gameState.inventory[inventoryKey] = previousCount + 1;
    
    // Bonus points pour les doublons (si amélioration achetée)
    if (upgradeBonus.duplicatePointsEnabled && previousCount > 0) {
      let bonusPoints = Math.floor(gameState.points * 0.01) + 5;
      bonusPoints = Math.floor(bonusPoints * (1 + (upgradeBonus.globalBonusPercent || 0) / 100));
      gameState.points += bonusPoints;
    }
    
    // Calculer l'XP
    totalXP += calculateCardXP(pokemon);
  }
  
  // Jouer le son si disponible
  if (audioManager) {
    audioManager.play('booster_open');
    
    // Son spécial si shiny
    const hasShiny = drawnCards.some(card => card.isShiny);
    if (hasShiny) {
      setTimeout(() => audioManager.play('shiny'), 300);
    }
  }
  
  return {
    success: true,
    cards: drawnCards,
    totalXP: totalXP,
    imageUrl: config.imageUrl
  };
}

/**
 * Affiche les cartes obtenues dans le conteneur
 */
export function renderCards(cards, gameState, getDisplayNameFn) {
  const cardsContainer = document.querySelector('#cards');
  if (!cardsContainer) return;
  
  cards.forEach(card => {
    const cardId = String(card.pokedex_id);
    let existingCard = cardsContainer.querySelector(`[data-card-id="${cardId}"]`);
    
    if (existingCard) {
      // Mettre à jour le compteur
      const countElement = existingCard.querySelector('.card-count');
      if (countElement) {
        countElement.textContent = `x${gameState.inventory[cardId] || 0}`;
      }
      
      // Animation pulse
      existingCard.classList.add('pulse');
      setTimeout(() => existingCard.classList.remove('pulse'), 150);
    } else {
      // Créer une nouvelle carte
      const cardElement = createCardElement(card, gameState, getDisplayNameFn);
      cardsContainer.appendChild(cardElement);
    }
  });
}

/**
 * Crée un élément HTML pour une carte Pokémon
 */
function createCardElement(card, gameState, getDisplayNameFn) {
  const cardDiv = document.createElement('div');
  cardDiv.className = 'pokemon-card';
  cardDiv.classList.add(`rarity-${card.rareté}`);
  if (card.isShiny) cardDiv.classList.add('shiny');
  cardDiv.setAttribute('data-card-id', String(card.pokedex_id));
  
  // Nom
  const nameElement = document.createElement('b');
  nameElement.textContent = getDisplayNameFn ? getDisplayNameFn(card) : card.name.fr;
  if (card.isShiny) {
    nameElement.style.color = '#FFD700';
    nameElement.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.8)';
  }
  cardDiv.appendChild(nameElement);
  
  // Image
  const imageElement = document.createElement('img');
  imageElement.src = card.sprites.regular;
  imageElement.alt = card.name.fr;
  cardDiv.appendChild(imageElement);
  
  // Compteur
  const cardId = String(card.pokedex_id);
  const countElement = document.createElement('div');
  countElement.className = 'card-count';
  countElement.textContent = `x${gameState.inventory[cardId] || 0}`;
  cardDiv.appendChild(countElement);
  
  return cardDiv;
}

/**
 * Initialise les boutons de boosters
 */
export function initializeBoosterButtons(gameState, updatePricesFn) {
  const boosterControls = document.querySelector('#booster-controls');
  if (!boosterControls) return;
  // Nettoyer d'abord pour éviter la duplication si la fonction est rappelée
  boosterControls.innerHTML = '';
  
  const buttons = {};
  
  Object.keys(boosterTypes).forEach(type => {
    const config = boosterTypes[type];
    const button = document.createElement('button');
    const price = Math.floor(getBasicBoosterPrice(gameState.boostersPurchased) * config.priceMultiplier);
    
    button.className = 'booster-button';
    if (type === 'premium') button.classList.add('premium');
    if (type === 'ultimate') button.classList.add('ultimate');
    
    button.textContent = `${config.icon} ${config.name} (${price} 💰)`;
    button.dataset.boosterType = type;
    button.title = config.description;
    
    boosterControls.appendChild(button);
    buttons[type] = button;
  });
  
  return buttons;
}

/**
 * Affiche l'overlay et l'animation d'ouverture de booster, puis la révélation des cartes
 * @param {Array} cards - Les cartes tirées (3 éléments)
 * @param {string} imageUrl - Image du booster (selon le type)
 * @param {Function} onDone - Callback appelé quand l'utilisateur valide
 * @param {Object} audioManager - Pour jouer des sons additionnels si nécessaire
 */
export function showBoosterOpeningOverlay(cards, imageUrl, onDone, audioManager) {
  // Éviter plusieurs overlays
  if (document.querySelector('.booster-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'booster-overlay';
  
  const tip = document.createElement('div');
  tip.className = 'booster-tip';
  tip.textContent = 'Clique sur le booster pour l\'ouvrir';
  overlay.appendChild(tip);
  
  const pack = document.createElement('div');
  pack.className = 'booster-pack';
  
  const img = document.createElement('img');
  img.className = 'booster-pack-img';
  img.src = imageUrl || 'images/booster-pokemon.png';
  img.alt = 'Booster';
  pack.appendChild(img);
  overlay.appendChild(pack);
  
  document.body.appendChild(overlay);
  
  const playOpen = () => {
    // Animation de secousse puis ouverture
    pack.classList.add('shake');
    setTimeout(() => {
      pack.classList.remove('shake');
      pack.classList.add('open');
      // Particules décoratives
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'booster-particle';
        const angle = (Math.PI * 2 * i) / 12;
        const radius = 140 + Math.random() * 40;
        p.style.setProperty('--tx', `${Math.cos(angle) * radius}px`);
        p.style.setProperty('--ty', `${Math.sin(angle) * radius}px`);
        overlay.appendChild(p);
        setTimeout(() => p.remove(), 1000);
      }
      
      // Après le burst, révéler les cartes
      setTimeout(() => {
        pack.remove();
        tip.textContent = 'Cartes obtenues';
        
        const reveal = document.createElement('div');
        reveal.className = 'booster-cards-reveal';
        
        cards.forEach((card, idx) => {
          const cardWrap = document.createElement('div');
          cardWrap.className = 'booster-revealed-card';
          cardWrap.style.animationDelay = `${0.1 * (idx + 1)}s`;
          
          const img = document.createElement('img');
          img.src = (card && card.sprites && card.sprites.regular) ? card.sprites.regular : '';
          img.alt = card?.name?.fr || 'Pokémon';
          cardWrap.appendChild(img);
          
          const name = document.createElement('div');
          name.className = 'revealed-card-name';
          const baseName = card?.name?.fr || card?.name?.en || '???';
          name.textContent = card?.isShiny ? `✨ ${baseName}` : baseName;
          cardWrap.appendChild(name);
          
          const rarity = document.createElement('div');
          rarity.className = 'revealed-card-rarity';
          let rarityLabel = 'Commun';
          if (card?.isShiny) rarityLabel = 'Shiny';
          else if (card?.rareté === 2) rarityLabel = 'Rare';
          else if (card?.rareté >= 3) rarityLabel = 'Légendaire';
          rarity.textContent = rarityLabel;
          cardWrap.appendChild(rarity);
          
          reveal.appendChild(cardWrap);
        });
        
        overlay.appendChild(reveal);
        
        const validate = document.createElement('button');
        validate.className = 'booster-validate-btn';
        validate.textContent = 'Valider';
        validate.addEventListener('click', () => {
          overlay.classList.add('fade-out');
          setTimeout(() => {
            overlay.remove();
            if (typeof onDone === 'function') onDone();
          }, 350);
        }, { once: true });
        overlay.appendChild(validate);
      }, 400);
    }, 550);
  };
  
  // Clic pour ouvrir le booster
  pack.addEventListener('click', () => {
    if (audioManager) {
      // Optionnel: petit feedback; le son principal est déjà joué dans openBooster
    }
    playOpen();
  }, { once: true });
}

/**
 * Met à jour les prix affichés sur les boutons de boosters
 */
export function updateBoosterPrices(boosterButtons, gameState) {
  Object.keys(boosterButtons).forEach(type => {
    const button = boosterButtons[type];
    const config = boosterTypes[type];
    const price = Math.floor(getBasicBoosterPrice(gameState.boostersPurchased) * config.priceMultiplier);
    button.textContent = `${config.icon} ${config.name} (${price} 💰)`;
  });
}
