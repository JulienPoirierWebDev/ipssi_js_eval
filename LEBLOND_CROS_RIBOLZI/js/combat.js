// ========================================
// COMBAT.JS - Système de combat 3v3
// ========================================

/**
 * État du combat actuel
 */
let battleState = {
  active: false,
  playerTeam: [],
  enemyTeam: [],
  currentTurn: 'player',
  turnCount: 0,
  battleLog: []
};

/**
 * Initialise le système de combat
 */
export function initializeBattleSystem(gameState, pokemons, audioManager, onVictory) {
  const battleBtn = document.getElementById('start-battle-btn');
  const teamSlots = document.querySelectorAll('.team-slot');
  
  if (!battleBtn || teamSlots.length === 0) return;
  
  // Initialiser les slots de sélection d'équipe
  initializeTeamSelection(teamSlots, gameState, pokemons);
  
  // Bouton de démarrage du combat
  battleBtn.addEventListener('click', () => {
    const selectedTeam = getSelectedTeam(teamSlots, gameState, pokemons);
    if (selectedTeam.length !== 3) {
      showBattleMessage('Sélectionnez 3 Pokémon pour votre équipe !', 'error');
      return;
    }
    
    startBattle(selectedTeam, gameState, pokemons, audioManager, onVictory);
  });
}

/**
 * Initialise les slots de sélection d'équipe
 */
function initializeTeamSelection(teamSlots, gameState, pokemons) {
  teamSlots.forEach((slot, slotIndex) => {
    slot.addEventListener('click', () => {
      openPokemonSelector(slotIndex, teamSlots, gameState, pokemons);
    });
  });
}

/**
 * Ouvre le sélecteur de Pokémon pour un slot
 */
function openPokemonSelector(slotIndex, teamSlots, gameState, pokemons) {
  const modal = document.createElement('div');
  modal.className = 'pokemon-selector-modal';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(0,0,0,0.8)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '1000';
  
  const content = document.createElement('div');
  content.style.background = '#1a1a2e';
  content.style.padding = '1.5rem';
  content.style.borderRadius = '12px';
  content.style.maxWidth = '800px';
  content.style.maxHeight = '80vh';
  content.style.overflowY = 'auto';
  content.style.border = '2px solid #e74c3c';
  
  const title = document.createElement('h3');
  title.textContent = 'Sélectionnez un Pokémon';
  title.style.marginBottom = '1rem';
  title.style.color = '#e74c3c';
  content.appendChild(title);
  
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
  grid.style.gap = '0.5rem';
  
  // Afficher uniquement les Pokémon possédés
  Object.keys(gameState.inventory).forEach(inventoryKey => {
    if (gameState.inventory[inventoryKey] === 0) return;
    
    const isShiny = inventoryKey.includes('_shiny');
    const pokemonId = parseInt(inventoryKey.replace('_shiny', ''), 10);
    const pokemon = pokemons.find(poke => poke.pokedex_id === pokemonId);
    if (!pokemon) return;
    const displayImg = isShiny ? (pokemon.sprites.shiny || pokemon.sprites.regular) : pokemon.sprites.regular;
    const displayName = (isShiny ? '✨ ' : '') + (pokemon.name?.fr || pokemon.name?.en || pokemon.name || '???');
    
    const pokemonCard = document.createElement('div');
    pokemonCard.style.padding = '0.75rem';
    pokemonCard.style.background = '#16213e';
    pokemonCard.style.borderRadius = '8px';
    pokemonCard.style.cursor = 'pointer';
    pokemonCard.style.textAlign = 'center';
    pokemonCard.style.border = '2px solid transparent';
    pokemonCard.style.transition = 'all 0.2s ease';
    
    pokemonCard.addEventListener('mouseenter', () => {
      pokemonCard.style.borderColor = '#e74c3c';
      pokemonCard.style.transform = 'scale(1.05)';
    });
    
    pokemonCard.addEventListener('mouseleave', () => {
      pokemonCard.style.borderColor = 'transparent';
      pokemonCard.style.transform = 'scale(1)';
    });
    
  const pokemonImage = document.createElement('img');
  pokemonImage.src = displayImg;
    pokemonImage.style.width = '80px';
    pokemonImage.style.height = '80px';
    pokemonImage.style.objectFit = 'contain';
    
  const pokemonName = document.createElement('p');
  pokemonName.textContent = displayName;
    pokemonName.style.margin = '0.3rem 0 0 0';
    pokemonName.style.fontSize = '0.9rem';
    if (isShiny) {
      pokemonName.style.color = '#ffd700';
    }
    
    pokemonCard.appendChild(pokemonImage);
    pokemonCard.appendChild(pokemonName);
    
    pokemonCard.addEventListener('click', () => {
      selectPokemonForSlot(slotIndex, pokemon, isShiny === true, teamSlots);
      document.body.removeChild(modal);
    });
    
    grid.appendChild(pokemonCard);
  });
  
  content.appendChild(grid);
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fermer';
  closeBtn.style.marginTop = '1rem';
  closeBtn.style.padding = '0.5rem 1.5rem';
  closeBtn.style.background = '#e74c3c';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '6px';
  closeBtn.style.color = 'white';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  document.body.appendChild(modal);
}

/**
 * Sélectionne un Pokémon pour un slot
 */
function selectPokemonForSlot(slotIndex, pokemon, isShiny, teamSlots) {
  const slot = teamSlots[slotIndex];
  const slotImage = slot.querySelector('.team-slot-image');
  const slotName = slot.querySelector('.team-slot-name');
  
  if (slotImage) {
    const imgSrc = isShiny ? (pokemon.sprites?.shiny || pokemon.sprites?.regular) : (pokemon.sprites?.regular);
    slotImage.src = imgSrc;
    slotImage.style.display = 'block';
  }
  
  if (slotName) {
    const baseName = pokemon.name?.fr || pokemon.name?.en || pokemon.name || '???';
    slotName.textContent = isShiny ? `✨ ${baseName}` : baseName;
    slotName.style.color = isShiny ? '#ffd700' : '#ffffff';
  }
  
  slot.dataset.pokemonId = String(pokemon.pokedex_id);
  slot.dataset.isShiny = String(isShiny);
}

/**
 * Récupère l'équipe sélectionnée
 */
function getSelectedTeam(teamSlots, gameState, pokemons) {
  const team = [];
  teamSlots.forEach(slot => {
  const pokemonId = slot.dataset.pokemonId;
    const isShiny = slot.dataset.isShiny === 'true';
    
    if (pokemonId) {
      const pokemon = pokemons.find(poke => poke.pokedex_id === parseInt(pokemonId));
      if (pokemon) {
        const imageUrl = isShiny ? (pokemon.sprites?.shiny || pokemon.sprites?.regular) : (pokemon.sprites?.regular);
        const nameStr = pokemon.name?.fr || pokemon.name?.en || pokemon.name || '???';
        team.push({
          ...pokemon,
          name: nameStr,
          image: imageUrl,
          isShiny,
          currentHp: calculatePokemonHP(pokemon),
          maxHp: calculatePokemonHP(pokemon),
          attack: calculatePokemonAttack(pokemon)
        });
      }
    }
  });
  return team;
}

/**
 * Calcule les HP d'un Pokémon
 */
function calculatePokemonHP(pokemon) {
  // Utilise la rareté numérique: 1 (commun), 2 (rare), 3 (légendaire), 4 (shiny légendaire)
  switch (pokemon.rareté) {
    case 1: return 100;
    case 2: return 150;
    case 3: return 250;
    case 4: return 300; // shiny boost
    default: return 100;
  }
}

/**
 * Calcule l'attaque d'un Pokémon
 */
function calculatePokemonAttack(pokemon) {
  switch (pokemon.rareté) {
    case 1: return 15;
    case 2: return 25;
    case 3: return 40;
    case 4: return 55; // shiny boost
    default: return 15;
  }
}

/**
 * Démarre un combat
 */
function startBattle(playerTeam, gameState, pokemons, audioManager, onVictory) {
  // Générer l'équipe ennemie
  const enemyTeam = generateEnemyTeam(pokemons);
  
  battleState = {
    active: true,
    playerTeam: playerTeam.map(pokemon => ({ ...pokemon })),
    enemyTeam: enemyTeam,
    currentTurn: 'player',
    turnCount: 0,
    battleLog: []
  };
  
  // Afficher l'écran de combat
  displayBattleScreen(battleState, gameState, audioManager, onVictory);
  
  if (audioManager) {
    // Son de bataille (pas de fichier battle_start, on peut utiliser victory ou rien)
    // audioManager.play('victory');
  }
  
  addBattleLog('Le combat commence !');
}

/**
 * Génère une équipe ennemie aléatoire
 */
function generateEnemyTeam(pokemons) {
  const team = [];
  const commonPokemons = pokemons.filter(pokemon => pokemon.rareté === 1);
  const rarePokemons = pokemons.filter(pokemon => pokemon.rareté === 2);
  const legendaryPokemons = pokemons.filter(pokemon => pokemon.rareté === 3);
  
  for (let index = 0; index < 3; index++) {
    const randomValue = Math.random();
    let pokemon;
    
    if (randomValue < 0.6 && commonPokemons.length) {
      pokemon = commonPokemons[Math.floor(Math.random() * commonPokemons.length)];
    } else if (randomValue < 0.9 && rarePokemons.length) {
      pokemon = rarePokemons[Math.floor(Math.random() * rarePokemons.length)];
    } else if (legendaryPokemons.length) {
      pokemon = legendaryPokemons[Math.floor(Math.random() * legendaryPokemons.length)];
    } else if (rarePokemons.length) {
      pokemon = rarePokemons[Math.floor(Math.random() * rarePokemons.length)];
    } else if (commonPokemons.length) {
      pokemon = commonPokemons[Math.floor(Math.random() * commonPokemons.length)];
    } else {
      pokemon = pokemons[Math.floor(Math.random() * pokemons.length)];
    }
    
    team.push({
      ...pokemon,
      name: pokemon.name?.fr || pokemon.name?.en || pokemon.name || '???',
      image: pokemon.sprites?.regular,
      isShiny: false,
      currentHp: calculatePokemonHP(pokemon),
      maxHp: calculatePokemonHP(pokemon),
      attack: calculatePokemonAttack(pokemon)
    });
  }
  
  return team;
}

/**
 * Affiche l'écran de combat
 */
function displayBattleScreen(battle, gameState, audioManager, onVictory) {
  const battleContainer = document.getElementById('battle-screen');
  if (!battleContainer) return;
  
  battleContainer.style.display = 'block';
  
  // Vider le conteneur
  while (battleContainer.firstChild) {
    battleContainer.removeChild(battleContainer.firstChild);
  }
  
  // Créer l'interface de combat
  const battleArea = document.createElement('div');
  battleArea.className = 'battle-area';
  
  // Équipes
  const teams = document.createElement('div');
  teams.style.display = 'flex';
  teams.style.justifyContent = 'space-between';
  teams.style.marginBottom = '1rem';
  
  const playerSide = createTeamDisplay(battle.playerTeam, 'Votre équipe');
  const enemySide = createTeamDisplay(battle.enemyTeam, 'Équipe ennemie');
  
  teams.appendChild(playerSide);
  teams.appendChild(enemySide);
  battleArea.appendChild(teams);
  
  // Actions de combat
  const actions = document.createElement('div');
  actions.className = 'battle-actions';
  actions.style.marginTop = '1rem';
  
  battle.playerTeam.forEach((pokemon, index) => {
    if (pokemon.currentHp > 0) {
      const attackBtn = document.createElement('button');
      attackBtn.textContent = `Attaquer avec ${pokemon.name}`;
      attackBtn.className = 'battle-action-btn';
      attackBtn.addEventListener('click', () => {
        executeTurn(index, battle, gameState, audioManager, onVictory);
      });
      actions.appendChild(attackBtn);
    }
  });
  
  battleArea.appendChild(actions);
  
  // Log de combat
  const log = document.createElement('div');
  log.id = 'battle-log';
  log.className = 'battle-log';
  log.style.marginTop = '1rem';
  log.style.padding = '1rem';
  log.style.background = '#16213e';
  log.style.borderRadius = '8px';
  log.style.maxHeight = '200px';
  log.style.overflowY = 'auto';
  battleArea.appendChild(log);
  
  battleContainer.appendChild(battleArea);
  
  updateBattleLog();
}

/**
 * Crée l'affichage d'une équipe
 */
function createTeamDisplay(team, title) {
  const container = document.createElement('div');
  container.style.flex = '1';
  container.style.padding = '1rem';
  
  const heading = document.createElement('h4');
  heading.textContent = title;
  heading.style.marginBottom = '0.5rem';
  container.appendChild(heading);
  
  team.forEach((pokemon, index) => {
    const pokemonDiv = document.createElement('div');
    pokemonDiv.className = 'battle-pokemon';
    pokemonDiv.id = `battle-pokemon-${title.includes('Votre') ? 'player' : 'enemy'}-${index}`;
    pokemonDiv.style.marginBottom = '0.5rem';
    pokemonDiv.style.padding = '0.5rem';
    pokemonDiv.style.background = pokemon.currentHp > 0 ? '#1a1a2e' : '#555';
    pokemonDiv.style.borderRadius = '6px';
    pokemonDiv.style.display = 'flex';
    pokemonDiv.style.alignItems = 'center';
    pokemonDiv.style.gap = '0.5rem';
    
    const image = document.createElement('img');
    image.src = pokemon.isShiny ? pokemon.shiny : pokemon.image;
    image.style.width = '40px';
    image.style.height = '40px';
    image.style.objectFit = 'contain';
    pokemonDiv.appendChild(image);
    
    const info = document.createElement('div');
    info.style.flex = '1';
    
    const name = document.createElement('div');
    name.textContent = pokemon.name;
    name.style.fontWeight = 'bold';
    info.appendChild(name);
    
    const hpBar = document.createElement('div');
    hpBar.style.width = '100%';
    hpBar.style.height = '8px';
    hpBar.style.background = '#333';
    hpBar.style.borderRadius = '4px';
    hpBar.style.overflow = 'hidden';
    hpBar.style.marginTop = '0.25rem';
    
    const hpFill = document.createElement('div');
    hpFill.id = `hp-bar-${title.includes('Votre') ? 'player' : 'enemy'}-${index}`;
    hpFill.style.width = `${(pokemon.currentHp / pokemon.maxHp) * 100}%`;
    hpFill.style.height = '100%';
    hpFill.style.background = pokemon.currentHp > pokemon.maxHp * 0.5 ? '#2ecc71' : pokemon.currentHp > pokemon.maxHp * 0.2 ? '#f39c12' : '#e74c3c';
    hpFill.style.transition = 'width 0.3s ease';
    hpBar.appendChild(hpFill);
    
    info.appendChild(hpBar);
    
    const hpText = document.createElement('div');
    hpText.id = `hp-text-${title.includes('Votre') ? 'player' : 'enemy'}-${index}`;
    hpText.textContent = `${pokemon.currentHp}/${pokemon.maxHp} HP`;
    hpText.style.fontSize = '0.8rem';
    hpText.style.marginTop = '0.25rem';
    info.appendChild(hpText);
    
    pokemonDiv.appendChild(info);
    container.appendChild(pokemonDiv);
  });
  
  return container;
}

/**
 * Exécute un tour de combat
 */
function executeTurn(playerPokemonIndex, battle, gameState, audioManager, onVictory) {
  if (!battle.active) return;
  
  // Attaque du joueur
  const playerPokemon = battle.playerTeam[playerPokemonIndex];
  const aliveEnemies = battle.enemyTeam.filter(pokemon => pokemon.currentHp > 0);
  
  if (aliveEnemies.length === 0) {
    endBattle(true, battle, gameState, audioManager, onVictory);
    return;
  }
  
  const targetEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
  const enemyIndex = battle.enemyTeam.indexOf(targetEnemy);
  
  const damage = Math.floor(playerPokemon.attack * (0.8 + Math.random() * 0.4));
  targetEnemy.currentHp = Math.max(0, targetEnemy.currentHp - damage);
  
  addBattleLog(`${playerPokemon.name} attaque ${targetEnemy.name} pour ${damage} dégâts !`);
  updatePokemonDisplay('enemy', enemyIndex, targetEnemy);
  
  if (audioManager) {
    // Son d'attaque (pas de fichier, on peut utiliser purchase comme bruit)
    audioManager.play('purchase');
  }
  
  // Vérifier la victoire
  if (battle.enemyTeam.every(pokemon => pokemon.currentHp <= 0)) {
    endBattle(true, battle, gameState, audioManager, onVictory);
    return;
  }
  
  // Tour de l'ennemi
  setTimeout(() => {
    enemyTurn(battle, gameState, audioManager, onVictory);
  }, 1000);
}

/**
 * Tour de l'ennemi
 */
function enemyTurn(battle, gameState, audioManager, onVictory) {
  const aliveEnemies = battle.enemyTeam.filter(pokemon => pokemon.currentHp > 0);
  const alivePlayers = battle.playerTeam.filter(pokemon => pokemon.currentHp > 0);
  
  if (alivePlayers.length === 0) {
    endBattle(false, battle, gameState, audioManager, onVictory);
    return;
  }
  
  aliveEnemies.forEach(enemyPokemon => {
    const targetPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const playerIndex = battle.playerTeam.indexOf(targetPlayer);
    
    const damage = Math.floor(enemyPokemon.attack * (0.8 + Math.random() * 0.4));
    targetPlayer.currentHp = Math.max(0, targetPlayer.currentHp - damage);
    
    addBattleLog(`${enemyPokemon.name} attaque ${targetPlayer.name} pour ${damage} dégâts !`);
    updatePokemonDisplay('player', playerIndex, targetPlayer);
  });
  
  if (audioManager) {
    // Son d'attaque (pas de fichier, on peut utiliser purchase comme bruit)
    audioManager.play('purchase');
  }
  
  // Vérifier la défaite
  if (battle.playerTeam.every(pokemon => pokemon.currentHp <= 0)) {
    endBattle(false, battle, gameState, audioManager, onVictory);
  }
  
  // Réactiver les boutons d'action
  displayBattleScreen(battle, gameState, audioManager, onVictory);
}

/**
 * Met à jour l'affichage d'un Pokémon
 */
function updatePokemonDisplay(side, index, pokemon) {
  const hpBar = document.getElementById(`hp-bar-${side}-${index}`);
  const hpText = document.getElementById(`hp-text-${side}-${index}`);
  
  if (hpBar) {
    const hpPercent = (pokemon.currentHp / pokemon.maxHp) * 100;
    hpBar.style.width = `${hpPercent}%`;
    hpBar.style.background = hpPercent > 50 ? '#2ecc71' : hpPercent > 20 ? '#f39c12' : '#e74c3c';
  }
  
  if (hpText) {
    hpText.textContent = `${pokemon.currentHp}/${pokemon.maxHp} HP`;
  }
}

/**
 * Termine le combat
 */
function endBattle(victory, battle, gameState, audioManager, onVictory) {
  battle.active = false;
  
  if (victory) {
    const xpGain = 50;
    const pointsGain = 100;
    
    addBattleLog(`🎉 Victoire ! Vous gagnez ${xpGain} XP et ${pointsGain} points !`);
    
    gameState.points += pointsGain;
    gameState.totalVictories++;
    
    if (onVictory) {
      onVictory(xpGain);
    }
    
    if (audioManager) {
      audioManager.play('victory');
    }
  } else {
    addBattleLog('💀 Défaite... Réessayez avec une meilleure équipe !');
    
    if (audioManager) {
      audioManager.play('defeat');
    }
  }
  
  // Bouton pour fermer
  setTimeout(() => {
    const closeBtn = document.createElement('button');
    closeBtn.textContent = victory ? 'Continuer' : 'Retour';
    closeBtn.className = 'battle-action-btn';
    closeBtn.style.marginTop = '1rem';
    closeBtn.addEventListener('click', () => {
      const battleContainer = document.getElementById('battle-screen');
      if (battleContainer) {
        battleContainer.style.display = 'none';
      }
    });
    
    const battleLog = document.getElementById('battle-log');
    if (battleLog) {
      battleLog.appendChild(closeBtn);
    }
  }, 1000);
}

/**
 * Ajoute un message au log de combat
 */
function addBattleLog(message) {
  battleState.battleLog.push(message);
  updateBattleLog();
}

/**
 * Met à jour l'affichage du log de combat
 */
function updateBattleLog() {
  const log = document.getElementById('battle-log');
  if (!log) return;
  
  // Vider le log
  while (log.firstChild) {
    log.removeChild(log.firstChild);
  }
  
  battleState.battleLog.forEach(message => {
    const logEntry = document.createElement('div');
    logEntry.textContent = message;
    logEntry.style.padding = '0.25rem 0';
    logEntry.style.borderBottom = '1px solid #333';
    log.appendChild(logEntry);
  });
  
  // Scroller vers le bas
  log.scrollTop = log.scrollHeight;
}

/**
 * Affiche un message de combat
 */
function showBattleMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.textContent = message;
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.left = '50%';
  messageDiv.style.transform = 'translateX(-50%)';
  messageDiv.style.padding = '1rem 2rem';
  messageDiv.style.background = type === 'error' ? '#e74c3c' : '#2ecc71';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '8px';
  messageDiv.style.zIndex = '2000';
  messageDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (document.body.contains(messageDiv)) {
      document.body.removeChild(messageDiv);
    }
  }, 3000);
}

export { battleState };
