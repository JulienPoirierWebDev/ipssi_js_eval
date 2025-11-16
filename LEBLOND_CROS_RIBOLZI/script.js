// Variables globales pour les rendre accessibles partout
const STORAGE_KEY = 'pkclicker_save_v1'; // clé de stockage globale (utilisée par save/load/reset)
let points = 0;
let pointsDisplay;
let inventory = {};

// Compteurs et succès (déclarés tôt pour éviter les erreurs de portée lors des premières sauvegardes/chargements)
let totalClicks = 0; // compteur total des clics
let totalUpgradesPurchased = 0; // nombre total d'améliorations achetées
let totalVictories = 0; // victoires combat
const achievementState = {}; // clé -> bool

// Système de niveaux et d'expérience
let playerLevel = 1;
let currentXP = 0;
let xpToNextLevel = 100;

// Auto-clicker (global pour que le reset puisse tout effacer proprement)
let autoClickerLevel = 0;
let autoClickerInterval = null;

// Variable globale pour contrôler les chances de shiny (accessible via console)
window.shinyChance = 0.005; // Par défaut 0.5%

// Fonction console pour activer/désactiver le mode shiny 100%
window.setShinyMode = function(enabled = true) {
	if (enabled) {
		window.shinyChance = 1.0;
		console.log('🌟 Mode SHINY activé! Tous les Pokémon seront shiny!');
	} else {
		window.shinyChance = 0.005;
		console.log('✨ Mode SHINY désactivé. Retour aux chances normales (0.5%).');
	}
	return window.shinyChance;
};

// Titres de niveaux
const levelTitles = {
  1: 'Dresseur débutant',
  5: 'Dresseur intermédiaire',
  10: 'Dresseur expérimenté',
  15: 'Champion régional',
  20: 'Maître Pokémon',
  25: 'Dresseur suprême'
};

// Fonction pour calculer l'XP nécessaire pour le prochain niveau (progression exponentielle)
function calculateXPForNextLevel(level) {
  if (level >= 25) return Infinity; // Niveau max atteint
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Fonction pour obtenir le titre du niveau actuel
function getLevelTitle(level) {
  // Chercher le titre correspondant au niveau exact ou au palier inférieur
  const exactTitle = levelTitles[level];
  if (exactTitle) return exactTitle;
  
  // Sinon, trouver le palier précédent
  const thresholds = [25, 20, 15, 10, 5, 1];
  for (const threshold of thresholds) {
    if (level >= threshold) return levelTitles[threshold];
  }
  return levelTitles[1];
}

// Fonction pour ajouter de l'XP et gérer les montées de niveau
function gainXP(amount) {
  if (playerLevel >= 25) return; // Niveau max atteint
  
  currentXP += amount;
  
  // Vérifier les montées de niveau
  while (currentXP >= xpToNextLevel && playerLevel < 25) {
    currentXP -= xpToNextLevel;
    playerLevel++;
    xpToNextLevel = calculateXPForNextLevel(playerLevel);
    
    // Son de montée de niveau
    if (window.audioManager) window.audioManager.play('levelUp');
    
    // Notification de montée de niveau
    showLevelUpNotification();
  }
  
  // Si niveau max atteint, mettre l'XP à 0
  if (playerLevel >= 25) {
    currentXP = 0;
    xpToNextLevel = Infinity;
  }
  
  updateXPDisplay();
	try { if (typeof window !== 'undefined' && window.saveProgress) window.saveProgress(); } catch(e) {}
}

// Fonction pour afficher une notification de montée de niveau
function showLevelUpNotification() {
  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  
  const content = document.createElement('div');
  content.className = 'level-up-content';
  
  const h2 = document.createElement('h2');
  h2.textContent = '🎉 NIVEAU SUPÉRIEUR ! 🎉';
  
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Vous êtes maintenant niveau ';
  const strong = document.createElement('strong');
  strong.textContent = playerLevel;
  paragraph.appendChild(strong);
  
  // Ajouter le titre si c'est un palier important
  const title = levelTitles[playerLevel];
  if (title) {
    paragraph.appendChild(document.createTextNode(' !'));
    const titleParagraph = document.createElement('p');
    titleParagraph.textContent = `⭐ ${title} ⭐`;
    titleParagraph.style.fontSize = '1.2rem';
    titleParagraph.style.marginTop = '0.5rem';
    titleParagraph.style.color = '#ffd700';
    content.appendChild(h2);
    content.appendChild(paragraph);
    content.appendChild(titleParagraph);
  } else {
    paragraph.appendChild(document.createTextNode(' !'));
    content.appendChild(h2);
    content.appendChild(paragraph);
  }
  
  notification.appendChild(content);
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Fonction pour mettre à jour l'affichage de l'XP
function updateXPDisplay() {
  const levelDisplay = document.getElementById('player-level');
  const xpBar = document.getElementById('xp-bar');
  const xpText = document.getElementById('xp-text');
	const levelStatus = document.getElementById('level-status');
  
  if (levelDisplay) {
    const title = getLevelTitle(playerLevel);
    levelDisplay.textContent = playerLevel;
    levelDisplay.title = title; // Afficher le titre au survol
  }
	// Mettre à jour l'élément de statut de niveau (titre visuel sous la barre)
	if (levelStatus) {
		levelStatus.textContent = getLevelTitle(playerLevel);
	}
  
  if (playerLevel >= 25) {
    // Niveau max atteint
    if (xpBar) xpBar.style.width = '100%';
    if (xpText) xpText.textContent = 'NIVEAU MAX';
  } else {
    if (xpBar) {
      const percentage = (currentXP / xpToNextLevel) * 100;
      xpBar.style.width = percentage + '%';
    }
    if (xpText) xpText.textContent = `${currentXP} / ${xpToNextLevel}`;
  }
}

// Langue courante et helper global pour obtenir le nom à afficher
let currentLang = 'fr';
function getDisplayName(pokemon) {
	if (!pokemon || !pokemon.name) return '';
	if (currentLang === 'en') return pokemon.name.en || pokemon.name.fr || pokemon.name.jp || '';
	if (currentLang === 'jp') return pokemon.name.jp || pokemon.name.fr || pokemon.name.en || '';
	return pokemon.name.fr || pokemon.name.en || pokemon.name.jp || '';
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");
  
  // === GESTIONNAIRE AUDIO ===
  const audioManager = {
    // Pool d'instances audio pour permettre la superposition
    soundPools: {},
    bgm: new Audio('sounds/pokemon_lofi.mp3'),
    bgmVolume: 0.3,
    sfxVolume: 0.6,
    muted: false,
    
    init() {
      // Créer des pools de sons pour permettre la superposition
      const soundList = ['victory', 'defeat', 'levelUp', 'boosterOpen', 'shiny', 'purchase'];
      soundList.forEach(name => {
        this.soundPools[name] = {
          path: `sounds/${name.replace(/([A-Z])/g, '_$1').toLowerCase()}.mp3`,
          instances: []
        };
      });
      
      // Configuration de la musique de fond
      this.bgm.loop = true;
      this.bgm.volume = this.bgmVolume;
      
      // Gérer les erreurs de chargement
      this.bgm.addEventListener('error', () => {
        console.warn('Musique de fond introuvable dans sounds/');
      });
      
      // Démarrer la musique après une interaction utilisateur (requis par les navigateurs)
      document.addEventListener('click', () => this.startBGM(), { once: true });
      
      // Initialiser les contrôles UI
      this.initControls();
    },
    
    initControls() {
      const bgmSlider = document.getElementById('bgm-volume');
      const sfxSlider = document.getElementById('sfx-volume');
      const bgmValue = document.getElementById('bgm-value');
      const sfxValue = document.getElementById('sfx-value');
      const toggleBtn = document.getElementById('toggle-audio');
      
      if (bgmSlider) {
        bgmSlider.addEventListener('input', (e) => {
          this.bgmVolume = e.target.value / 100;
          this.bgm.volume = this.muted ? 0 : this.bgmVolume;
          bgmValue.textContent = e.target.value;
        });
      }
      
      if (sfxSlider) {
        sfxSlider.addEventListener('input', (e) => {
          this.sfxVolume = e.target.value / 100;
          sfxValue.textContent = e.target.value;
        });
      }
      
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          this.muted = !this.muted;
          this.bgm.volume = this.muted ? 0 : this.bgmVolume;
          toggleBtn.textContent = this.muted ? '🔇' : '🔊';
          toggleBtn.classList.toggle('muted', this.muted);
        });
      }
    },
    
    startBGM() {
      if (!this.muted && this.bgm.paused) {
        this.bgm.play().catch(e => console.log('BGM play error:', e));
      }
    },
    
    play(soundName) {
      if (this.muted) return;
      
      const pool = this.soundPools[soundName];
      if (!pool) return;
      
      // Créer une nouvelle instance audio pour permettre la superposition
      const audio = new Audio(pool.path);
      audio.volume = this.sfxVolume;
      
      // Jouer le son
      audio.play().catch(e => console.log(`Sound ${soundName} error:`, e));
      
      // Nettoyer l'instance après la lecture
      audio.addEventListener('ended', () => {
        audio.remove();
      });
    }
  };
  
  // Initialiser le gestionnaire audio
  audioManager.init();
  
  // Exposer pour utilisation globale
  window.audioManager = audioManager;
  
  // Système de gestion des onglets
  const tabsContainer = document.querySelector(".tabs-container");
  const tabButtons = document.querySelectorAll(".tab-select");
  let currentTabIndex = 0;
	const langSelect = document.querySelector('#lang-select');
	if (langSelect) {
		langSelect.value = currentLang;
		langSelect.addEventListener('change', () => {
			currentLang = langSelect.value;
			// Mettre à jour les sélecteurs et affichages (via la fonction exposée par initializeBattleSystem)
			if (typeof window !== 'undefined' && typeof window.updatePokemonSelection === 'function') {
				window.updatePokemonSelection();
			} else {
				console.warn('updatePokemonSelection() non disponible au moment du changement de langue');
			}
			// Mettre à jour les noms dans les cartes affichées (identifiées par id)
			const cardDivs = cardsContainer?.querySelectorAll('[data-card-id]') || [];
			cardDivs.forEach(div => {
				const safe = div.getAttribute('data-card-id');
				// Gérer les IDs shiny (format: "pokedex_id_shiny")
				const baseId = safe.replace('_shiny', '');
				const p = pokemons.find(pp => String(pp.pokedex_id) === safe || String(pp.pokedex_id) === baseId);
				if (p) {
					const b = div.querySelector('b');
					if (b) b.textContent = getDisplayName(p);
				}
			});
			// Mettre à jour les noms affichés en combat s'il y en a
			if (typeof window !== 'undefined' && typeof window.refreshBattleNames === 'function') {
				window.refreshBattleNames();
			}

			// Dispatch a global event so subsystems inside initializeBattleSystem
			// (which hold their own scope) can react and update UI reliably.
			document.dispatchEvent(new Event('languageChanged'));
		});
	}
  
  function switchToTab(index) {
    // Mettre à jour l'état des boutons
    tabButtons.forEach((btn, i) => {
      if (i === index) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
    
    // Animer le défilement
    tabsContainer.style.transform = `translateX(-${index * 100}vw)`;
    currentTabIndex = index;
  }

	// Note: `updatePokemonSelection` est défini dans initializeBattleSystem();
	// on l'expose plus tard depuis cette fonction pour éviter les ReferenceError.
  
  // Ajouter les événements de clic sur les boutons
  tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      const tabIndex = parseInt(button.dataset.tab);
      switchToTab(tabIndex);
    });
  });
  
  // Initialiser les éléments de l'UI du clicker
  pointsDisplay = document.querySelector("#points");
  const clickBtn = document.querySelector("#clickBtn");
	const clickerCenter = document.querySelector('.clicker-center');
	// Valeur de points gagnés par clic (facile à adapter plus tard)
	let clickGain = 1;
	const upgrades = document.querySelector("#upgrades");
  const cardsContainer = document.querySelector("#cards"); // conteneur pour afficher les cartes obtenues
  const boosterControls = document.querySelector("#booster-controls"); // conteneur pour les contrôles du booster
	// Compteur d'achats de boosters pour le prix dynamique
	let boostersPurchased = 0;
	// Compteur de temps de jeu (en millisecondes)
	let totalPlaytime = 0;
	let sessionStartTime = Date.now();
	// Persistance (localStorage) avec throttle
	let saveScheduled = false;
	function saveProgress() {
		if (saveScheduled) return; // Déjà planifié
		saveScheduled = true;
		setTimeout(() => {
			saveScheduled = false;
			try {
				// Calculer le temps de jeu actuel avant de sauvegarder
				const currentPlaytime = totalPlaytime + (Date.now() - sessionStartTime);
				const data = { 
					points, 
					inventory, 
					playerLevel, 
					currentXP, 
					xpToNextLevel, 
					autoClickerLevel,
					purchasedUpgrades: Object.keys(purchasedUpgrades),
					totalClicks,
					totalUpgradesPurchased,
					totalVictories,
					achievementState,
					boostersPurchased,
					totalPlaytime: currentPlaytime
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			} catch(e) { console.warn('Sauvegarde impossible', e); }
		}, 500); // Sauvegarde max toutes les 500ms
	}
	function loadProgress() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return;
			const data = JSON.parse(raw);
			if (typeof data.points === 'number') points = data.points;
			if (data.inventory && typeof data.inventory === 'object') inventory = data.inventory;
			if (typeof data.playerLevel === 'number') playerLevel = data.playerLevel;
			if (typeof data.currentXP === 'number') currentXP = data.currentXP;
			if (typeof data.xpToNextLevel === 'number') xpToNextLevel = data.xpToNextLevel;
			if (typeof data.autoClickerLevel === 'number') autoClickerLevel = data.autoClickerLevel;
			if (Array.isArray(data.purchasedUpgrades)) {
				data.purchasedUpgrades.forEach(id => { purchasedUpgrades[id] = true; });
			}
			// Charger les succès
			if (typeof data.totalClicks === 'number') totalClicks = data.totalClicks;
			if (typeof data.totalUpgradesPurchased === 'number') totalUpgradesPurchased = data.totalUpgradesPurchased;
			if (typeof data.totalVictories === 'number') totalVictories = data.totalVictories;
			if (data.achievementState && typeof data.achievementState === 'object') {
				Object.assign(achievementState, data.achievementState);
			}
			// Charger le compteur de boosters
			if (typeof data.boostersPurchased === 'number') boostersPurchased = data.boostersPurchased;
			// Charger le temps de jeu total
			if (typeof data.totalPlaytime === 'number') {
				totalPlaytime = data.totalPlaytime;
				sessionStartTime = Date.now(); // Redémarrer le compteur de session
			}
		} catch(e) { console.warn('Chargement impossible', e); }
	}
	if (typeof window !== 'undefined') window.saveProgress = saveProgress;
  
  // Initialiser le système de combat
  initializeBattleSystem();

	// Système d'auto-clicker évolutif (variables globales définies en haut)
  
  // Configuration des niveaux d'auto-clicker (prix et gains progressifs)
  const autoClickerLevels = [
    { level: 1, cost: 15, gain: 1, description: "Génère 1 point toutes les 2 secondes" },
    { level: 2, cost: 50, gain: 2, description: "Génère 2 points toutes les 2 secondes" },
    { level: 3, cost: 150, gain: 4, description: "Génère 4 points toutes les 2 secondes" },
    { level: 4, cost: 400, gain: 8, description: "Génère 8 points toutes les 2 secondes" },
    { level: 5, cost: 1000, gain: 15, description: "Génère 15 points toutes les 2 secondes" },
    { level: 6, cost: 2500, gain: 30, description: "Génère 30 points toutes les 2 secondes" },
    { level: 7, cost: 6000, gain: 55, description: "Génère 55 points toutes les 2 secondes" },
    { level: 8, cost: 12000, gain: 100, description: "Génère 100 points toutes les 2 secondes" },
    { level: 9, cost: 25000, gain: 180, description: "Génère 180 points toutes les 2 secondes" },
    { level: 10, cost: 50000, gain: 320, description: "Génère 320 points toutes les 2 secondes" },
  ];

	const upgradesContainer = document.querySelector("#upgrades");
	// --- Système d'améliorations avancé (branches) ---
	// Variables cumulatives des effets
	let flatClickBonus = 0; // +X points par clic
	let criticalChance = 0; // % chance de critique (double points en clic)
	let clickPercentBonus = 0; // % multiplicatif sur le gain de clic
	let passivePointsPerSecondBase = 0; // points par seconde (avant %)
	let passivePercentBonus = 0; // % bonus sur le passif
	let rareChanceBonus = 0; // % bonus multiplicatif sur probabilité de rare
	let legendaryChanceBonus = 0; // % bonus multiplicatif sur probabilité de légendaire
	let duplicatePointsEnabled = false; // gagne des points quand on obtient un doublon
	let autoClickPercentBonus = 0; // % bonus sur auto-clicker existant
	window.healDoubleEnabled = false; // soins de combat doublés (global)
	let bossDamagePercent = 0; // % dégâts contre boss
	let globalBonusPercent = 0; // % bonus global sur tous les gains de points
	let purchasedUpgrades = {}; // id -> true
	let passiveInterval = null;
	let passiveRemainder = 0; // accumulation des fractions du passif

	// Système d'améliorations progressif - regroupées par type
	// Chaque "track" contient plusieurs niveaux
	const upgradeTracksData = [
		{ branch: 'click', icon: '🖱️', branchName: 'Branche Clic', color: '#e67e22', trackId: 'click_flat', name: 'Clic', 
			levels: [
				{ cost: 20, desc: '+1 pt/clic', apply(){ flatClickBonus += 1; } },
				{ cost: 50, desc: '+1 pt/clic', apply(){ flatClickBonus += 1; } },
				{ cost: 120, desc: '+2 pts/clic', apply(){ flatClickBonus += 2; } },
				{ cost: 280, desc: '+2 pts/clic', apply(){ flatClickBonus += 2; } },
				{ cost: 650, desc: '+3 pts/clic', apply(){ flatClickBonus += 3; } },
				{ cost: 1500, desc: '+4 pts/clic', apply(){ flatClickBonus += 4; } },
				{ cost: 3500, desc: '+5 pts/clic', apply(){ flatClickBonus += 5; } },
				{ cost: 8000, desc: '+7 pts/clic', apply(){ flatClickBonus += 7; } },
				{ cost: 18000, desc: '+10 pts/clic', apply(){ flatClickBonus += 10; } },
				{ cost: 40000, desc: '+15 pts/clic', apply(){ flatClickBonus += 15; } }
			]
		},
		{ branch: 'click', icon: '🖱️', branchName: 'Branche Clic', color: '#e67e22', trackId: 'click_crit', name: 'Critique', 
			levels: [
				{ cost: 300, desc: '+0.5% crit (x2)', apply(){ criticalChance += 0.5; } },
				{ cost: 700, desc: '+0.5% crit', apply(){ criticalChance += 0.5; } },
				{ cost: 1600, desc: '+1% crit', apply(){ criticalChance += 1; } },
				{ cost: 3600, desc: '+1% crit', apply(){ criticalChance += 1; } },
				{ cost: 8000, desc: '+1.5% crit', apply(){ criticalChance += 1.5; } },
				{ cost: 18000, desc: '+2% crit', apply(){ criticalChance += 2; } },
				{ cost: 40000, desc: '+2.5% crit', apply(){ criticalChance += 2.5; } },
				{ cost: 90000, desc: '+3% crit', apply(){ criticalChance += 3; } },
				{ cost: 200000, desc: '+4% crit', apply(){ criticalChance += 4; } },
				{ cost: 450000, desc: '+5% crit', apply(){ criticalChance += 5; } }
			]
		},
		{ branch: 'click', icon: '🖱️', branchName: 'Branche Clic', color: '#e67e22', trackId: 'click_pct', name: 'Puissance', 
			levels: [
				{ cost: 800, desc: '+5% clic', apply(){ clickPercentBonus += 5; } },
				{ cost: 2000, desc: '+5% clic', apply(){ clickPercentBonus += 5; } },
				{ cost: 5000, desc: '+8% clic', apply(){ clickPercentBonus += 8; } },
				{ cost: 12000, desc: '+10% clic', apply(){ clickPercentBonus += 10; } },
				{ cost: 28000, desc: '+12% clic', apply(){ clickPercentBonus += 12; } },
				{ cost: 65000, desc: '+15% clic', apply(){ clickPercentBonus += 15; } },
				{ cost: 150000, desc: '+18% clic', apply(){ clickPercentBonus += 18; } },
				{ cost: 350000, desc: '+22% clic', apply(){ clickPercentBonus += 22; } },
				{ cost: 800000, desc: '+27% clic', apply(){ clickPercentBonus += 27; } },
				{ cost: 1800000, desc: '+35% clic', apply(){ clickPercentBonus += 35; } }
			]
		},
		{ branch: 'passive', icon: '🌿', branchName: 'Branche Passif', color: '#27ae60', trackId: 'passive_base', name: 'Passif', 
			levels: [
				{ cost: 50, desc: '+1 pt/s', apply(){ passivePointsPerSecondBase += 1; restartPassiveInterval(); } },
				{ cost: 150, desc: '+2 pts/s', apply(){ passivePointsPerSecondBase += 2; restartPassiveInterval(); } },
				{ cost: 400, desc: '+3 pts/s', apply(){ passivePointsPerSecondBase += 3; restartPassiveInterval(); } },
				{ cost: 1000, desc: '+5 pts/s', apply(){ passivePointsPerSecondBase += 5; restartPassiveInterval(); } },
				{ cost: 2500, desc: '+8 pts/s', apply(){ passivePointsPerSecondBase += 8; restartPassiveInterval(); } },
				{ cost: 6000, desc: '+12 pts/s', apply(){ passivePointsPerSecondBase += 12; restartPassiveInterval(); } },
				{ cost: 15000, desc: '+18 pts/s', apply(){ passivePointsPerSecondBase += 18; restartPassiveInterval(); } },
				{ cost: 35000, desc: '+27 pts/s', apply(){ passivePointsPerSecondBase += 27; restartPassiveInterval(); } },
				{ cost: 80000, desc: '+40 pts/s', apply(){ passivePointsPerSecondBase += 40; restartPassiveInterval(); } },
				{ cost: 180000, desc: '+60 pts/s', apply(){ passivePointsPerSecondBase += 60; restartPassiveInterval(); } }
			]
		},
		{ branch: 'passive', icon: '🌿', branchName: 'Branche Passif', color: '#27ae60', trackId: 'passive_pct', name: 'Efficacité', 
			levels: [
				{ cost: 600, desc: '+10% passif', apply(){ passivePercentBonus += 10; restartPassiveInterval(); } },
				{ cost: 1800, desc: '+10% passif', apply(){ passivePercentBonus += 10; restartPassiveInterval(); } },
				{ cost: 5000, desc: '+15% passif', apply(){ passivePercentBonus += 15; restartPassiveInterval(); } },
				{ cost: 13000, desc: '+18% passif', apply(){ passivePercentBonus += 18; restartPassiveInterval(); } },
				{ cost: 32000, desc: '+22% passif', apply(){ passivePercentBonus += 22; restartPassiveInterval(); } },
				{ cost: 75000, desc: '+28% passif', apply(){ passivePercentBonus += 28; restartPassiveInterval(); } },
				{ cost: 170000, desc: '+35% passif', apply(){ passivePercentBonus += 35; restartPassiveInterval(); } },
				{ cost: 400000, desc: '+45% passif', apply(){ passivePercentBonus += 45; restartPassiveInterval(); } },
				{ cost: 900000, desc: '+55% passif', apply(){ passivePercentBonus += 55; restartPassiveInterval(); } },
				{ cost: 2000000, desc: '+70% passif', apply(){ passivePercentBonus += 70; restartPassiveInterval(); } }
			]
		},
		{ branch: 'booster', icon: '🎴', branchName: 'Branche Booster', color: '#9b59b6', trackId: 'boost_rare', name: 'Rareté', 
			levels: [
				{ cost: 120, desc: '+5% rares', apply(){ rareChanceBonus += 5; } },
				{ cost: 350, desc: '+5% rares', apply(){ rareChanceBonus += 5; } },
				{ cost: 900, desc: '+7% rares', apply(){ rareChanceBonus += 7; } },
				{ cost: 2200, desc: '+8% rares', apply(){ rareChanceBonus += 8; } },
				{ cost: 5500, desc: '+10% rares', apply(){ rareChanceBonus += 10; } },
				{ cost: 13000, desc: '+12% rares', apply(){ rareChanceBonus += 12; } },
				{ cost: 30000, desc: '+15% rares', apply(){ rareChanceBonus += 15; } },
				{ cost: 70000, desc: '+18% rares', apply(){ rareChanceBonus += 18; } },
				{ cost: 160000, desc: '+22% rares', apply(){ rareChanceBonus += 22; } },
				{ cost: 350000, desc: '+30% rares', apply(){ rareChanceBonus += 30; } }
			]
		},
		{ branch: 'booster', icon: '🎴', branchName: 'Branche Booster', color: '#9b59b6', trackId: 'boost_leg', name: 'Légendaire', 
			levels: [
				{ cost: 500, desc: '+5% légend.', apply(){ legendaryChanceBonus += 5; } },
				{ cost: 1400, desc: '+5% légend.', apply(){ legendaryChanceBonus += 5; } },
				{ cost: 3800, desc: '+7% légend.', apply(){ legendaryChanceBonus += 7; } },
				{ cost: 9500, desc: '+8% légend.', apply(){ legendaryChanceBonus += 8; } },
				{ cost: 23000, desc: '+10% légend.', apply(){ legendaryChanceBonus += 10; } },
				{ cost: 55000, desc: '+12% légend.', apply(){ legendaryChanceBonus += 12; } },
				{ cost: 130000, desc: '+15% légend.', apply(){ legendaryChanceBonus += 15; } },
				{ cost: 300000, desc: '+18% légend.', apply(){ legendaryChanceBonus += 18; } },
				{ cost: 700000, desc: '+23% légend.', apply(){ legendaryChanceBonus += 23; } },
				{ cost: 1600000, desc: '+30% légend.', apply(){ legendaryChanceBonus += 30; } }
			]
		},
		{ branch: 'booster', icon: '🎴', branchName: 'Branche Booster', color: '#9b59b6', trackId: 'boost_dup', name: 'Recyclage', unique: true,
			levels: [
				{ cost: 900, desc: 'Points bonus doublons', apply(){ duplicatePointsEnabled = true; } }
			]
		},
		{ branch: 'combat', icon: '⚔️', branchName: 'Badges Combat', color: '#c0392b', trackId: 'combat_heal', name: 'Soin renforcé', unique: true,
			levels: [
				{ cost: 400, desc: 'Soins x2', apply(){ window.healDoubleEnabled = true; } }
			]
		},
		{ branch: 'combat', icon: '⚔️', branchName: 'Badges Combat', color: '#c0392b', trackId: 'combat_boss', name: 'Chasseur', 
			levels: [
				{ cost: 1600, desc: '+10% dmg Boss', apply(){ bossDamagePercent += 10; } },
				{ cost: 4500, desc: '+10% dmg Boss', apply(){ bossDamagePercent += 10; } },
				{ cost: 11000, desc: '+15% dmg Boss', apply(){ bossDamagePercent += 15; } },
				{ cost: 27000, desc: '+15% dmg Boss', apply(){ bossDamagePercent += 15; } },
				{ cost: 65000, desc: '+20% dmg Boss', apply(){ bossDamagePercent += 20; } },
				{ cost: 150000, desc: '+25% dmg Boss', apply(){ bossDamagePercent += 25; } },
				{ cost: 350000, desc: '+30% dmg Boss', apply(){ bossDamagePercent += 30; } },
				{ cost: 800000, desc: '+35% dmg Boss', apply(){ bossDamagePercent += 35; } },
				{ cost: 1800000, desc: '+45% dmg Boss', apply(){ bossDamagePercent += 45; } },
				{ cost: 4000000, desc: '+60% dmg Boss', apply(){ bossDamagePercent += 60; } }
			]
		},
		{ branch: 'global', icon: '✨', branchName: 'Synergie Globale', color: '#f39c12', trackId: 'global', name: 'Synergie', 
			levels: [
				{ cost: 2500, desc: '+2% tous gains', apply(){ globalBonusPercent += 2; restartPassiveInterval(); } },
				{ cost: 7000, desc: '+3% tous gains', apply(){ globalBonusPercent += 3; restartPassiveInterval(); } },
				{ cost: 18000, desc: '+4% tous gains', apply(){ globalBonusPercent += 4; restartPassiveInterval(); } },
				{ cost: 45000, desc: '+5% tous gains', apply(){ globalBonusPercent += 5; restartPassiveInterval(); } },
				{ cost: 110000, desc: '+6% tous gains', apply(){ globalBonusPercent += 6; restartPassiveInterval(); } },
				{ cost: 260000, desc: '+8% tous gains', apply(){ globalBonusPercent += 8; restartPassiveInterval(); } },
				{ cost: 600000, desc: '+10% tous gains', apply(){ globalBonusPercent += 10; restartPassiveInterval(); } },
				{ cost: 1400000, desc: '+12% tous gains', apply(){ globalBonusPercent += 12; restartPassiveInterval(); } },
				{ cost: 3200000, desc: '+15% tous gains', apply(){ globalBonusPercent += 15; restartPassiveInterval(); } },
				{ cost: 7000000, desc: '+20% tous gains', apply(){ globalBonusPercent += 20; restartPassiveInterval(); } }
			]
		}
	];

	// Convertir les tracks en ancien format pour compatibilité
	const upgradeBranches = [];
	const trackProgress = {}; // trackId -> niveau actuel (0-based)
	upgradeTracksData.forEach(track => {
		track.levels.forEach((level, idx) => {
			const branch = upgradeBranches.find(b => b.key === track.branch);
			if (!branch) {
				upgradeBranches.push({ key: track.branch, name: track.branchName, color: track.color, upgrades: [] });
			}
			upgradeBranches.find(b => b.key === track.branch).upgrades.push({
				id: `${track.trackId}_${idx + 1}`,
				cost: level.cost,
				label: track.unique ? track.name : `${track.name} ${['I','II','III','IV','V','VI','VII','VIII','IX','X'][idx]}`,
				desc: level.desc,
				apply: level.apply,
				trackId: track.trackId,
				trackLevel: idx
			});
		});
	});

	function effectiveClickGain() {
		let base = 1 + flatClickBonus;
		base *= (1 + clickPercentBonus/100);
		base *= (1 + globalBonusPercent/100);
		return Math.max(1, Math.floor(base));
	}

	function restartPassiveInterval(){
		if (passiveInterval) clearInterval(passiveInterval);
		const effectivePerSecond = passivePointsPerSecondBase * (1 + passivePercentBonus/100) * (1 + globalBonusPercent/100);
		if (effectivePerSecond > 0){
			passiveInterval = setInterval(() => {
				// Empêcher les décimales: on accumule les fractions jusqu'à obtenir un entier
				const total = passiveRemainder + effectivePerSecond;
				const whole = Math.floor(total);
				passiveRemainder = total - whole;
				if (whole > 0) {
					points += whole;
					if (pointsDisplay) pointsDisplay.textContent = points;
					try { updateUpgradeCardsState(); } catch(e) {}
				}
				try { saveProgress(); } catch(e) {}
			}, 1000);
		}
	}

	function applyUpgrade(up){
		if (purchasedUpgrades[up.id]) {
			console.log('Déjà acheté:', up.id);
			return;
		}
		if (points < up.cost) {
			console.log('Pas assez de points:', points, '<', up.cost);
			return;
		}
		console.log('Achat upgrade:', up.id, 'coût:', up.cost);
		points -= up.cost;
		up.apply();
		purchasedUpgrades[up.id] = true;
		
		// Son d'achat
		if (window.audioManager) {
			window.audioManager.play('purchase');
		}
		try { totalUpgradesPurchased++; } catch(e) {}
		if (pointsDisplay) pointsDisplay.textContent = points;
		try { saveProgress(); } catch(e) {}
		if (typeof checkAchievements === 'function') try { checkAchievements(); } catch(e) {}
		// Note: la mise à jour de la carte est maintenant gérée par updateSingleUpgradeCard() dans le listener du bouton
	}

	function renderUpgradeBranches(){
		if (!upgradesContainer) return;
		console.log('=== renderUpgradeBranches appelé ===');
		
		// Garder l'autoclicker s'il existe
		const autoClickerCard = document.getElementById('autoclicker-card');
		console.log('AutoclickerCard existe?', !!autoClickerCard);
		upgradesContainer.innerHTML = '';

		// Calculer le niveau actuel de chaque track
		const trackLevels = {};
		upgradeTracksData.forEach(track => {
			let currentLevel = 0;
			for (let i = 0; i < track.levels.length; i++) {
				const upgradeId = `${track.trackId}_${i + 1}`;
				if (purchasedUpgrades[upgradeId]) {
					currentLevel = i + 1;
				} else {
					break;
				}
			}
			trackLevels[track.trackId] = currentLevel;
			console.log(`Track ${track.trackId}: niveau ${currentLevel}`);
		});

		// Regrouper les tracks par branche
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
			
			const h = document.createElement('h3');
			h.textContent = branchData.name;
			h.style.margin = '0.6rem 0 0.3rem 0';
			h.style.color = branchData.color;
			h.style.textShadow = '0 1px 6px rgba(0,0,0,0.25)';
			upgradesContainer.appendChild(h);

			// Afficher chaque track comme une seule carte
			branchData.tracks.forEach(track => {
				const currentLevel = trackLevels[track.trackId];
				const nextLevel = currentLevel < track.levels.length ? currentLevel : track.levels.length - 1;
				const nextUpgrade = track.levels[nextLevel];
				const maxed = currentLevel >= track.levels.length;

				const card = document.createElement('div');
				card.className = 'upgrade-card';
				card.id = `upgrade-card-${track.trackId}`;
				card.dataset.trackId = track.trackId;
				card.dataset.currentLevel = String(currentLevel);

				const icon = document.createElement('div');
				icon.className = 'upgrade-icon';
				icon.textContent = track.icon;
				card.appendChild(icon);

				const content = document.createElement('div');
				content.className = 'upgrade-content';
				const name = document.createElement('h4');
				name.className = 'upgrade-name';
				
				if (track.unique) {
					name.textContent = track.name;
				} else {
					const levelNum = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][currentLevel] || 'MAX';
					name.textContent = `${track.name} ${levelNum}`;
				}
				content.appendChild(name);

				const desc = document.createElement('p');
				desc.className = 'upgrade-description';
				desc.id = `upgrade-desc-${track.trackId}`;
				desc.textContent = nextUpgrade.desc;
				content.appendChild(desc);

				const footer = document.createElement('div');
				footer.className = 'upgrade-footer';
				const cost = document.createElement('span');
				cost.className = 'upgrade-cost';
				cost.id = `upgrade-cost-${track.trackId}`;
				cost.textContent = maxed ? 'MAX' : `${nextUpgrade.cost} 💰`;
				footer.appendChild(cost);

				const buyBtn = document.createElement('button');
				buyBtn.className = 'upgrade-buy-btn';
				buyBtn.id = `upgrade-buy-${track.trackId}`;
				buyBtn.dataset.trackId = track.trackId;
				buyBtn.textContent = maxed ? 'MAX' : 'Améliorer';
				buyBtn.addEventListener('click', function() {
					// Recalculer l'état actuel au moment du clic
					const trackData = upgradeTracksData.find(t => t.trackId === this.dataset.trackId);
					if (!trackData) return;
					
					let currentLvl = 0;
					for (let i = 0; i < trackData.levels.length; i++) {
						const uid = `${trackData.trackId}_${i + 1}`;
						if (purchasedUpgrades[uid]) {
							currentLvl = i + 1;
						} else {
							break;
						}
					}
					
					const isMaxed = currentLvl >= trackData.levels.length;
					if (!isMaxed && currentLvl < trackData.levels.length) {
						const upgradeId = `${trackData.trackId}_${currentLvl + 1}`;
						const up = upgradeBranches.flatMap(b => b.upgrades).find(u => u.id === upgradeId);
						if (up) {
							applyUpgrade(up);
							// Mettre à jour seulement cette carte
							updateSingleUpgradeCard(trackData.trackId);
						}
					}
				});
				footer.appendChild(buyBtn);

				const check = document.createElement('span');
				check.className = 'upgrade-checkmark';
				check.id = `upgrade-done-${track.trackId}`;
				check.textContent = maxed ? '✓ MAX' : '';
				footer.appendChild(check);

				content.appendChild(footer);
				card.appendChild(content);
				upgradesContainer.appendChild(card);
			});
		});

		// Remettre l'autoclicker s'il existait
		if (autoClickerCard) {
			upgradesContainer.appendChild(autoClickerCard);
		}

		updateUpgradeCardsState();
	}

	// Fonction pour mettre à jour une seule carte sans tout reconstruire
	function updateSingleUpgradeCard(trackId) {
		const track = upgradeTracksData.find(t => t.trackId === trackId);
		if (!track) return;
		
		// Calculer le niveau actuel
		let currentLevel = 0;
		for (let i = 0; i < track.levels.length; i++) {
			const upgradeId = `${track.trackId}_${i + 1}`;
			if (purchasedUpgrades[upgradeId]) {
				currentLevel = i + 1;
			} else {
				break;
			}
		}
		
		const nextLevel = currentLevel < track.levels.length ? currentLevel : track.levels.length - 1;
		const nextUpgrade = track.levels[nextLevel];
		const maxed = currentLevel >= track.levels.length;
		
		// Récupérer les éléments de la carte
		const card = document.getElementById(`upgrade-card-${track.trackId}`);
		const nameEl = card?.querySelector('.upgrade-name');
		const descEl = document.getElementById(`upgrade-desc-${track.trackId}`);
		const costEl = document.getElementById(`upgrade-cost-${track.trackId}`);
		const buyBtn = document.getElementById(`upgrade-buy-${track.trackId}`);
		const checkEl = document.getElementById(`upgrade-done-${track.trackId}`);
		
		if (!card) return;
		
		// Mettre à jour le niveau dans le dataset
		card.dataset.currentLevel = String(currentLevel);
		
		// Mettre à jour le nom avec le niveau actuel
		if (nameEl) {
			if (track.unique) {
				nameEl.textContent = track.name;
			} else {
				const levelNum = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][currentLevel] || 'MAX';
				nameEl.textContent = `${track.name} ${levelNum}`;
			}
		}
		
		// Mettre à jour la description
		if (descEl) {
			descEl.textContent = maxed ? track.levels[track.levels.length - 1].desc : nextUpgrade.desc;
		}
		
		// Mettre à jour l'état visuel
		card.classList.remove('locked', 'available', 'purchased');
		if (maxed) {
			card.classList.add('purchased');
			if (costEl) costEl.textContent = 'MAX';
			if (buyBtn) {
				buyBtn.disabled = true;
				buyBtn.textContent = 'MAX';
			}
			if (checkEl) checkEl.textContent = '✓ MAX';
		} else if (points >= nextUpgrade.cost) {
			card.classList.add('available');
			if (costEl) costEl.textContent = `${nextUpgrade.cost} 💰`;
			if (buyBtn) {
				buyBtn.disabled = false;
				buyBtn.textContent = 'Améliorer';
			}
			if (checkEl) checkEl.textContent = '';
		} else {
			card.classList.add('locked');
			if (costEl) costEl.textContent = `${nextUpgrade.cost} 💰`;
			if (buyBtn) {
				buyBtn.disabled = true;
				buyBtn.textContent = 'Améliorer';
			}
			if (checkEl) checkEl.textContent = '';
		}
	}

	// Throttle pour éviter les mises à jour trop fréquentes
	let upgradeStateUpdateScheduled = false;
	let lastUpgradeUpdate = 0;
	const UPDATE_THROTTLE_MS = 250; // Maximum une mise à jour toutes les 250ms
	
	function updateUpgradeCardsState(){
		if (upgradeStateUpdateScheduled) return; // Déjà planifié
		
		const now = Date.now();
		const timeSinceLastUpdate = now - lastUpgradeUpdate;
		
		if (timeSinceLastUpdate < UPDATE_THROTTLE_MS) {
			// Trop tôt, on planifie pour plus tard
			if (!upgradeStateUpdateScheduled) {
				upgradeStateUpdateScheduled = true;
				setTimeout(() => {
					upgradeStateUpdateScheduled = false;
					updateUpgradeCardsState();
				}, UPDATE_THROTTLE_MS - timeSinceLastUpdate);
			}
			return;
		}
		
		upgradeStateUpdateScheduled = true;
		lastUpgradeUpdate = now;
		
		requestAnimationFrame(() => {
			upgradeStateUpdateScheduled = false;
			
			// Batch DOM queries en dehors de la boucle
			const cardsCache = new Map();
			upgradeTracksData.forEach(track => {
				const card = document.getElementById(`upgrade-card-${track.trackId}`);
				if (!card) return;
				cardsCache.set(track.trackId, {
					card,
					buyBtn: document.getElementById(`upgrade-buy-${track.trackId}`),
					costEl: document.getElementById(`upgrade-cost-${track.trackId}`),
					descEl: document.getElementById(`upgrade-desc-${track.trackId}`),
					checkEl: document.getElementById(`upgrade-done-${track.trackId}`),
					nameEl: card.querySelector('.upgrade-name')
				});
			});
			
			upgradeTracksData.forEach(track => {
				const elements = cardsCache.get(track.trackId);
				if (!elements) return;
				
				const { card, buyBtn, costEl, descEl, checkEl, nameEl } = elements;

				// Calculer niveau actuel
				let currentLevel = 0;
				for (let i = 0; i < track.levels.length; i++) {
					const upgradeId = `${track.trackId}_${i + 1}`;
					if (purchasedUpgrades[upgradeId]) {
						currentLevel = i + 1;
					} else {
						break;
					}
				}

				const maxed = currentLevel >= track.levels.length;
				const nextLevel = currentLevel < track.levels.length ? currentLevel : track.levels.length - 1;
				const nextUpgrade = track.levels[nextLevel];

				// Stocker l'état précédent pour éviter les modifications inutiles
				const prevState = card.dataset.upgradeState;
				const newState = maxed ? 'maxed' : (points >= nextUpgrade.cost ? 'available' : 'locked');
				
				if (prevState !== newState) {
					card.dataset.upgradeState = newState;
					card.classList.remove('locked','available','purchased');
				}

				// Mettre à jour le nom avec le niveau actuel (seulement si changement d'état)
				if (prevState !== newState && nameEl) {
					if (track.unique) {
						nameEl.textContent = track.name;
					} else {
						const levelNum = ['I','II','III','IV','V','VI','VII','VIII','IX','X'][currentLevel] || 'MAX';
						nameEl.textContent = `${track.name} ${levelNum}`;
					}
				}

				// Mettre à jour la description (seulement si changement d'état)
				if (prevState !== newState && descEl) {
					descEl.textContent = nextUpgrade.desc;
				}

				if (maxed) {
					if (prevState !== 'maxed') {
						card.classList.add('purchased');
						if (costEl) costEl.textContent = 'MAX';
						if (buyBtn) {
							buyBtn.disabled = true;
							buyBtn.textContent = 'MAX';
						}
						if (checkEl) checkEl.textContent = '✓ MAX';
					}
				} else if (points >= nextUpgrade.cost) {
					if (prevState !== 'available') {
						card.classList.add('available');
						if (costEl) costEl.textContent = `${nextUpgrade.cost} 💰`;
						if (buyBtn) {
							buyBtn.disabled = false;
							buyBtn.textContent = 'Améliorer';
						}
						if (checkEl) checkEl.textContent = '';
					}
				} else {
					if (prevState !== 'locked') {
						card.classList.add('locked');
						if (costEl) costEl.textContent = `${nextUpgrade.cost} 💰`;
						if (buyBtn) {
							buyBtn.disabled = true;
							buyBtn.textContent = 'Améliorer';
						}
						if (checkEl) checkEl.textContent = '';
					}
				}
			});
			
			// Mettre à jour l'autoclicker aussi
			if (typeof updateAutoClickerDisplay === 'function') {
				updateAutoClickerDisplay();
			}
		});
	}

	// Exposer une fonction de reset interne qui connaît les variables de ce scope (upgrades, passif, UI)
	if (typeof window !== 'undefined') {
		window.__internalReset = function() {
			try { if (passiveInterval) clearInterval(passiveInterval); } catch(e) {}
			passiveInterval = null;
			passiveRemainder = 0;
			// Variables de progression globales
			points = 0;
			inventory = {};
			playerLevel = 1;
			currentXP = 0;
			xpToNextLevel = calculateXPForNextLevel(1);
			// Auto-clicker
			try { if (autoClickerInterval) clearInterval(autoClickerInterval); } catch(e) {}
			autoClickerInterval = null;
			autoClickerLevel = 0;
			// Upgrades
			purchasedUpgrades = {};
			flatClickBonus = 0;
			criticalChance = 0;
			clickPercentBonus = 0;
			passivePointsPerSecondBase = 0;
			passivePercentBonus = 0;
			rareChanceBonus = 0;
			legendaryChanceBonus = 0;
			duplicatePointsEnabled = false;
			autoClickPercentBonus = 0;
			window.healDoubleEnabled = false;
			bossDamagePercent = 0;
			globalBonusPercent = 0;
			// Succès
			totalClicks = 0;
			totalUpgradesPurchased = 0;
			totalVictories = 0;
			for (const k in achievementState) { try { delete achievementState[k]; } catch(e) {} }
			// UI
			try { if (pointsDisplay) pointsDisplay.textContent = '0'; } catch(e) {}
			try { updateXPDisplay(); } catch(e) {}
			try { updateAutoClickerDisplay(); } catch(e) {}
			try { renderUpgradeBranches(); } catch(e) {}
			// Nettoyer les cartes
			try {
				const cardsContainerElement = document.querySelector('#cards');
				if (cardsContainerElement) while (cardsContainerElement.firstChild) cardsContainerElement.removeChild(cardsContainerElement.firstChild);
			} catch(e) {}
			// Notifier les autres systèmes
			try { document.dispatchEvent(new Event('inventoryUpdated')); } catch(e) {}
		};
	}

	// Charger sauvegarde avant construction UI dépendante
	loadProgress();
	// Après chargement, réappliquer les upgrades sauvegardées (sans re-déduire le coût ni compter achievements)
	upgradeBranches.forEach(b => b.upgrades.forEach(up => { if (purchasedUpgrades[up.id]) { up.apply(); } }));
	restartPassiveInterval();

	// Fonction pour formater le temps en HH:MM:SS
	function formatPlaytime(milliseconds) {
		const totalSeconds = Math.floor(milliseconds / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	// Fonction pour mettre à jour l'affichage du temps de jeu
	function updatePlaytimeDisplay() {
		const playtimeEl = document.getElementById('playtime');
		if (playtimeEl) {
			const currentPlaytime = totalPlaytime + (Date.now() - sessionStartTime);
			playtimeEl.textContent = formatPlaytime(currentPlaytime);
		}
	}

	// Mettre à jour le temps de jeu chaque seconde
	setInterval(updatePlaytimeDisplay, 1000);

	// Rendu initial des branches
	setTimeout(() => { 
		renderUpgradeBranches(); 
		updateUpgradeCardsState();
		// Mettre à jour les prix des boosters après le chargement
		if (typeof updateBoosterPrices === 'function') updateBoosterPrices();
		// Affichage initial du temps de jeu
		updatePlaytimeDisplay();
	}, 20);
	if (pointsDisplay) pointsDisplay.textContent = points;
	updateXPDisplay();

	// Reconstruire les cartes détenues depuis l'inventaire sauvegardé
	(function renderOwnedFromSave(){
		try {
			const cards = [];
			for (const idKey in inventory) {
				const qty = typeof inventory[idKey] === 'number' ? inventory[idKey] : 0;
				if (qty > 0) {
					const baseIdStr = String(idKey);
					const isShiny = baseIdStr.endsWith('_shiny');
					const baseId = parseInt(isShiny ? baseIdStr.replace('_shiny','') : baseIdStr, 10);
					const base = pokemons.find(p => p.pokedex_id === baseId);
					if (!base) continue;
					if (!isShiny) {
						cards.push(base);
					} else {
						cards.push({
							...base,
							isShiny: true,
							pokedex_id: base.pokedex_id + '_shiny',
							sprites: { ...base.sprites, regular: base.sprites.shiny || base.sprites.regular },
							rareté: base.rareté === 3 ? 4 : 3
						});
					}
				}
			}
			if (cards.length) renderCards(cards);
			// Rafraîchir les sélecteurs selon l'inventaire
			document.dispatchEvent(new Event('inventoryUpdated'));
		} catch(e) { console.warn('Rendu depuis sauvegarde échoué:', e); }
	})();
  
  // Fonction pour créer la carte d'auto-clicker
  function createAutoClickerCard() {
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.id = 'autoclicker-card';
    
    const icon = document.createElement('div');
    icon.className = 'upgrade-icon';
    icon.textContent = '⚡';
    card.appendChild(icon);
    
    const content = document.createElement('div');
    content.className = 'upgrade-content';
    
    const name = document.createElement('h4');
    name.className = 'upgrade-name';
    name.id = 'autoclicker-name';
    content.appendChild(name);
    
    const level = document.createElement('div');
    level.className = 'upgrade-level';
    level.id = 'autoclicker-level';
    content.appendChild(level);
    
    const desc = document.createElement('p');
    desc.className = 'upgrade-description';
    desc.id = 'autoclicker-desc';
    content.appendChild(desc);
    
    const footer = document.createElement('div');
    footer.className = 'upgrade-footer';
    
    const cost = document.createElement('span');
    cost.className = 'upgrade-cost';
    cost.id = 'autoclicker-cost';
    footer.appendChild(cost);
    
    const buyBtn = document.createElement('button');
    buyBtn.className = 'upgrade-buy-btn';
    buyBtn.id = 'autoclicker-buy-btn';
    buyBtn.textContent = 'Améliorer';
    buyBtn.onclick = upgradeAutoClicker;
    footer.appendChild(buyBtn);
    
    const maxLevel = document.createElement('span');
    maxLevel.className = 'upgrade-checkmark';
    maxLevel.id = 'autoclicker-max';
    maxLevel.textContent = '✓ Niveau Max';
    maxLevel.style.display = 'none';
    footer.appendChild(maxLevel);
    
    content.appendChild(footer);
    card.appendChild(content);
    
    return card;
  }
  
  // Fonction pour améliorer l'auto-clicker
  function upgradeAutoClicker() {
    const nextLevel = autoClickerLevel + 1;
    if (nextLevel > autoClickerLevels.length) return;
    
    const levelConfig = autoClickerLevels[nextLevel - 1];
		if (points >= levelConfig.cost) {
			points -= levelConfig.cost;
			pointsDisplay.textContent = points;
			try { updateUpgradeCardsState(); } catch(e) {}
      autoClickerLevel = nextLevel;
			try { totalUpgradesPurchased++; } catch(e) {}
			try { if (typeof checkAchievements === 'function') checkAchievements(); } catch(e) {}
			try { if (typeof saveProgress === 'function') saveProgress(); } catch(e) {}
      
      // Arrêter l'ancien intervalle si existant
      if (autoClickerInterval) {
        clearInterval(autoClickerInterval);
      }
      
      // Démarrer le nouvel auto-clicker avec le nouveau gain (intègre bonus %)
			autoClickerInterval = setInterval(() => {
        let gain = levelConfig.gain;
        gain = Math.floor(gain * (1 + autoClickPercentBonus/100) * (1 + globalBonusPercent/100));
        points += gain;
        pointsDisplay.textContent = points;
				try { updateUpgradeCardsState(); } catch(e) {}
        updateAutoClickerDisplay();
				try { if (typeof saveProgress === 'function') saveProgress(); } catch(e) {}
      }, 2000);
      
      updateAutoClickerDisplay();
			try { if (typeof saveProgress === 'function') saveProgress(); } catch(e) {}
    }
  }
  
  // Fonction pour mettre à jour l'affichage de l'auto-clicker
  function updateAutoClickerDisplay() {
    const card = document.getElementById('autoclicker-card');
    const nameEl = document.getElementById('autoclicker-name');
    const levelEl = document.getElementById('autoclicker-level');
    const descEl = document.getElementById('autoclicker-desc');
    const costEl = document.getElementById('autoclicker-cost');
    const buyBtn = document.getElementById('autoclicker-buy-btn');
    const maxLevelEl = document.getElementById('autoclicker-max');
    
    if (!card) return;
    
    if (autoClickerLevel === 0) {
      // Pas encore acheté
      nameEl.textContent = 'Auto-clicker';
      levelEl.textContent = '';
      descEl.textContent = autoClickerLevels[0].description;
      costEl.textContent = `${autoClickerLevels[0].cost} 💰`;
      buyBtn.textContent = 'Acheter';
      buyBtn.style.display = 'inline-block';
      maxLevelEl.style.display = 'none';
      
      if (points >= autoClickerLevels[0].cost) {
        card.classList.remove('locked', 'purchased');
        card.classList.add('available');
      } else {
        card.classList.remove('available', 'purchased');
        card.classList.add('locked');
      }
    } else if (autoClickerLevel < autoClickerLevels.length) {
      // Niveau intermédiaire
      const currentConfig = autoClickerLevels[autoClickerLevel - 1];
      const nextConfig = autoClickerLevels[autoClickerLevel];
      
      nameEl.textContent = 'Auto-clicker';
      levelEl.textContent = `Niveau ${autoClickerLevel} → ${autoClickerLevel + 1}`;
      descEl.textContent = `Actuel: ${currentConfig.gain}/2s | Prochain: ${nextConfig.gain}/2s`;
      costEl.textContent = `${nextConfig.cost} 💰`;
      buyBtn.textContent = 'Améliorer';
      buyBtn.style.display = 'inline-block';
      maxLevelEl.style.display = 'none';
      
      if (points >= nextConfig.cost) {
        card.classList.remove('locked', 'purchased');
        card.classList.add('available');
      } else {
        card.classList.remove('available', 'purchased');
        card.classList.add('locked');
      }
    } else {
      // Niveau max atteint
      const currentConfig = autoClickerLevels[autoClickerLevel - 1];
      
      nameEl.textContent = 'Auto-clicker';
      levelEl.textContent = `Niveau ${autoClickerLevel} (MAX)`;
      descEl.textContent = `Production: ${currentConfig.gain} points toutes les 2 secondes`;
      costEl.textContent = '';
      buyBtn.style.display = 'none';
      maxLevelEl.style.display = 'inline-flex';
      
      card.classList.remove('locked', 'available');
      card.classList.add('purchased');
    }
  }
  
  // Initialiser l'affichage de l'auto-clicker
  const autoClickerCard = createAutoClickerCard();
  upgradesContainer.appendChild(autoClickerCard);
  updateAutoClickerDisplay();
	// Redémarrer l'auto-clicker depuis la sauvegarde si besoin
	if (autoClickerInterval) clearInterval(autoClickerInterval);
	if (autoClickerLevel > 0) {
		const autoClickerConfig = autoClickerLevels[Math.min(autoClickerLevel - 1, autoClickerLevels.length - 1)];
		autoClickerInterval = setInterval(() => {
			let gain = autoClickerConfig.gain;
			gain = Math.floor(gain * (1 + autoClickPercentBonus/100) * (1 + globalBonusPercent/100));
			points += gain;
			pointsDisplay.textContent = points;
			try { updateUpgradeCardsState(); } catch(e) {}
			updateAutoClickerDisplay();
			try { saveProgress(); } catch(e) {}
		}, 2000);
	}

	function winpoint() {
		// Incrémenter le compteur de clics pour les succès
		totalClicks++;
		
		// Calcul du gain de clic avec bonus & critique
		let gain = effectiveClickGain();
		if (criticalChance > 0 && Math.random() < (criticalChance/100)) {
			gain *= 2; // critique double
		}
		points += gain;
		pointsDisplay.textContent = points;
		
		// Gagner de l'XP par clic (0.5 XP par clic) - gainXP() gère déjà la sauvegarde
		gainXP(0.5);
		
		// Animation flottante +N (optimisée)
		if (clickBtn && gain > 0) {
			const float = document.createElement('div');
			float.className = 'floating-gain';
			float.textContent = `+${gain}`;
			document.body.appendChild(float);
			// Position pré-calculée (évite getBoundingClientRect coûteux à chaque clic)
			float.style.top = '120px'; // Position fixe simple
			// Déclencher l'animation via classe CSS
			requestAnimationFrame(() => {
				float.classList.add('up');
				// Cleanup après animation
				setTimeout(() => float.remove(), 1000);
			});
		}
	}

	// Utiliser pointerdown pour supporter souris et écrans tactiles sans double déclenchement
	if (clickBtn) {
		clickBtn.addEventListener("pointerdown", winpoint);
	} else {
		console.error('Element #clickBtn not found for clicker');
	}
  
  // Initialiser l'affichage du niveau et de l'XP
  updateXPDisplay();
	try { if (window.saveProgress) window.saveProgress(); } catch(e) {}

	// Dev-only: activation discrète (aucun affichage ni log)
	(function(){
		const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
		let idx = 0;
		document.addEventListener('keydown', (keyboardEvent) => {
			const keyName = keyboardEvent.key;
			if (keyName === seq[idx]) {
				idx++;
				if (idx === seq.length) {
					// Récompense silencieuse
					points += 1000000;
					if (pointsDisplay) pointsDisplay.textContent = points;
					try { updateUpgradeCardsState(); } catch(e) {}
					idx = 0;
				}
			} else {
				idx = (keyName === seq[0]) ? 1 : 0;
			}
		}, { capture: true });
	})();

  // Système de boosters avec prix dynamique (boostersPurchased déclaré plus haut)
  
  // Fonction pour calculer le prix d'un booster basique
  function getBasicBoosterPrice() {
    return Math.floor(100 * Math.pow(1.15, boostersPurchased)); // Prix de base 100, augmente de 15% à chaque achat
  }
  
  // Types de boosters avec leurs caractéristiques
  const boosterTypes = {
    basic: {
      name: 'Booster Basique',
      icon: '🎴',
      color: '#f39c12',
      priceMultiplier: 1,
      rareBonus: 0,
      legendaryBonus: 0,
      description: 'Booster standard',
      imageUrl: 'images/booster-pokemon.png' // Image par défaut
    },
    premium: {
      name: 'Booster Premium',
      icon: '✨',
      color: '#3498db',
      priceMultiplier: 3,
      rareBonus: 0.10, // +10% chance de rares
      legendaryBonus: 0.03, // +3% chance de légendaires
      description: 'Meilleures chances !',
      imageUrl: 'images/booster-premium.png' // Image premium (créer cette image)
    },
    ultimate: {
      name: 'Booster Ultime',
      icon: '💎',
      color: '#9b59b6',
      priceMultiplier: 10,
      rareBonus: 0.35, // +35% chance de rares
      legendaryBonus: 0.25, // +25% chance de légendaires
      commonPenalty: -0.50, // -50% chance de communes (plus de légendaires et rares !)
      description: 'Légendaires garantis !',
      imageUrl: 'images/booster-ultimate.png' // Image ultime (créer cette image)
    }
  };
  
  // Créer les 3 boutons de boosters
  function createBoosterButton(type) {
    const config = boosterTypes[type];
    const button = document.createElement("button");
    const price = Math.floor(getBasicBoosterPrice() * config.priceMultiplier);
    button.textContent = `${config.icon} ${config.name} (${price} 💰)`;
    button.style.background = config.color;
    button.style.color = "white";
    button.style.margin = "0.3rem";
    button.style.padding = "0.8rem 1.5rem";
    button.style.border = "none";
    button.style.borderRadius = "12px";
    button.style.fontSize = "1rem";
    button.style.fontWeight = "700";
    button.style.cursor = "pointer";
    button.style.transition = "all 0.2s ease";
    button.dataset.boosterType = type;
    button.title = config.description;
    return button;
  }
  
  const booster_bouton = createBoosterButton('basic');
  const booster_premium = createBoosterButton('premium');
  const booster_ultimate = createBoosterButton('ultimate');
  
  // Fonction pour mettre à jour les prix de tous les boutons
  function updateBoosterPrices() {
    [booster_bouton, booster_premium, booster_ultimate].forEach(btn => {
      const type = btn.dataset.boosterType;
      const config = boosterTypes[type];
      const price = Math.floor(getBasicBoosterPrice() * config.priceMultiplier);
      btn.textContent = `${config.icon} ${config.name} (${price} 💰)`;
    });
  }
  
	// Fonction d'animation d'ouverture de booster
	async function playBoosterAnimation(drawnCards, boosterImageUrl) {
		// Jouer le son d'ouverture de booster
		if (window.audioManager) window.audioManager.play('boosterOpen');
		
		return new Promise(resolve => {
			// Overlay principal
			const overlay = document.createElement('div');
			overlay.className = 'booster-overlay';
      
			// Conteneur / pack
			const pack = document.createElement('div');
			pack.className = 'booster-pack';
      
			const img = document.createElement('img');
			img.className = 'booster-pack-img';
			img.alt = 'Booster';
			img.src = boosterImageUrl || 'images/booster-pokemon.png'; // Utiliser l'image spécifique ou fallback
			pack.appendChild(img);
      
			// Halo lumineux
			const glow = document.createElement('div');
			glow.className = 'booster-glow';
			pack.appendChild(glow);
      
			// Texte indicatif
			const tip = document.createElement('div');
			tip.className = 'booster-tip';
			tip.textContent = 'Ouverture du booster...';
			overlay.appendChild(tip);
      
			overlay.appendChild(pack);
			document.body.appendChild(overlay);
      
			// Particules de révélation
			function spawnParticles() {
				for (let particleIndex = 0; particleIndex < 28; particleIndex++) {
					const p = document.createElement('div');
					p.className = 'booster-particle';
					const angle = (Math.PI * 2 * particleIndex) / 28;
					const distance = 40 + Math.random() * 60;
					const tx = Math.cos(angle) * distance;
					const ty = Math.sin(angle) * distance;
					p.style.setProperty('--tx', tx + 'px');
					p.style.setProperty('--ty', ty + 'px');
					p.style.animationDelay = (0.4 + Math.random() * 0.2) + 's';
					pack.appendChild(p);
				}
			}
      
			// Déclenchement des différentes phases
			setTimeout(() => {
				pack.classList.add('shake');
			}, 30);
      
			setTimeout(() => {
				pack.classList.add('glow');
				spawnParticles();
			}, 450);
      
			// Ouverture (éclatement)
			setTimeout(() => {
				pack.classList.add('open');
				tip.textContent = 'Cartes révélées !';
			}, 1050);
      
			// Affichage des cartes obtenues
			setTimeout(() => {
				// Retirer le pack et le texte
				if (pack.parentNode) pack.parentNode.removeChild(pack);
				if (tip.parentNode) tip.parentNode.removeChild(tip);
				
				// Conteneur pour les cartes
				const cardsReveal = document.createElement('div');
				cardsReveal.className = 'booster-cards-reveal';
				
				// Afficher chaque carte obtenue
				drawnCards.forEach(card => {
					const cardDiv = document.createElement('div');
					cardDiv.className = card.isShiny ? 'booster-revealed-card shiny-card' : 'booster-revealed-card';
					cardDiv.style.background = stylebackground(card.rareté);
					
					const nameEl = document.createElement('div');
					nameEl.className = 'revealed-card-name';
					nameEl.textContent = getDisplayName(card);
					cardDiv.appendChild(nameEl);
					
					const imgEl = document.createElement('img');
					imgEl.src = card.sprites.regular;
					imgEl.alt = getDisplayName(card);
					cardDiv.appendChild(imgEl);
					
					const rarityEl = document.createElement('div');
					rarityEl.className = 'revealed-card-rarity';
					if (card.isShiny) {
						rarityEl.textContent = '✨ SHINY ✨';
						rarityEl.style.color = '#FFD700';
						rarityEl.style.textShadow = '0 0 10px #FFD700, 0 0 20px #FF69B4';
						rarityEl.style.animation = 'shinyPulse 1s ease-in-out infinite';
					} else {
						rarityEl.textContent = card.rareté === 3 ? '⭐ Légendaire' : card.rareté === 2 ? '💎 Rare' : '⚪ Commun';
					}
					cardDiv.appendChild(rarityEl);
					
					cardsReveal.appendChild(cardDiv);
				});
				
				overlay.appendChild(cardsReveal);
				
				// Bouton de validation
				const validateBtn = document.createElement('button');
				validateBtn.className = 'booster-validate-btn';
				validateBtn.textContent = 'Valider';
				validateBtn.onclick = () => {
					overlay.classList.add('fade-out');
					setTimeout(() => {
						if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
						resolve();
					}, 350);
				};
				
				overlay.appendChild(validateBtn);
			}, 1500);
		});
	}
  
  if (boosterControls) {
    boosterControls.appendChild(booster_bouton);// ajout du bouton basique
    boosterControls.appendChild(booster_premium);// ajout du bouton premium
    boosterControls.appendChild(booster_ultimate);// ajout du bouton ultime
  } else {
    console.error("Élément #booster-controls non trouvé dans le DOM");
  }

  
	// Fonction pour tirer un pokémon avec probabilités par rareté
	function drawPokemonWithRarity(boosterBonus = { rare: 0, legendary: 0, common: 0 }) {
		// Probabilités de base
		let pCommon = 0.70;
		let pRare = 0.25;
		let pLegend = 0.05;
		// Appliquer bonus multiplicatifs des upgrades booster
		pRare *= (1 + rareChanceBonus/100);
		pLegend *= (1 + legendaryChanceBonus/100);
		// Appliquer bonus/malus du type de booster (additif)
		pCommon += (boosterBonus.common || 0); // Peut être négatif pour réduire les communes
		pRare += boosterBonus.rare;
		pLegend += boosterBonus.legendary;
		// S'assurer que les probabilités restent positives
		pCommon = Math.max(0.05, pCommon); // Minimum 5% de communes
		// Renormaliser pour garder somme = 1
		const total = pCommon + pRare + pLegend;
		pCommon /= total; pRare /= total; pLegend /= total;
		const rand = Math.random();
		let rarityFilter;
		if (rand < pCommon) rarityFilter = 1; else if (rand < pCommon + pRare) rarityFilter = 2; else rarityFilter = 3;
		
		// Filtrer les pokémons par rareté choisie
		const filteredPokemons = pokemons.filter(p => p.rareté === rarityFilter);
		if (filteredPokemons.length === 0) {
			// Fallback si aucun pokémon de cette rareté
			return pokemons[Math.floor(Math.random() * pokemons.length)];
		}
		
		const selectedPokemon = filteredPokemons[Math.floor(Math.random() * filteredPokemons.length)];
		
		// Chance de shiny basée sur window.shinyChance
		const isShiny = Math.random() < window.shinyChance;
		
		if (isShiny && selectedPokemon.sprites.shiny) {
			// SHINY TROUVÉ ! Son spécial
			if (window.audioManager) {
				window.audioManager.play('shiny');
			}
			
			// Créer une version shiny du pokémon (objet distinct)
			return {
				...selectedPokemon,
				isShiny: true,
				pokedex_id: selectedPokemon.pokedex_id + '_shiny', // ID unique pour les shinys
				sprites: {
					regular: selectedPokemon.sprites.shiny,
					shiny: selectedPokemon.sprites.shiny // Garder aussi sprites.shiny pour le Pokédex
				},
				rareté: selectedPokemon.rareté === 3 ? 4 : 3 // Les shinys sont encore plus rares
			};
		}
		
		return selectedPokemon;
	}

	async function openBooster(boosterType = 'basic') { 
    const config = boosterTypes[boosterType];
    const booster_prix = Math.floor(getBasicBoosterPrice() * config.priceMultiplier);
    
    if (points < booster_prix) {
      alert("Pas assez de points !");// alerte si pas assez de points
      return;
    }
			points -= booster_prix;
			boostersPurchased++; // Incrémenter le compteur pour augmenter les prix futurs
			pointsDisplay.textContent = points;
			updateBoosterPrices(); // Mettre à jour tous les prix des boutons
			try { updateUpgradeCardsState(); } catch(e) {}
			try { if (typeof window.saveProgress === 'function') window.saveProgress(); } catch(e) {}

    const drawn = []; // tableau pour stocker les pokémons obtenus
    let totalXP = 0; // XP total gagné dans ce booster
    const boosterBonus = { 
      rare: config.rareBonus, 
      legendary: config.legendaryBonus,
      common: config.commonPenalty || 0 // Pénalité pour les communes (si définie)
    };
		for (let boosterCardIndex = 0; boosterCardIndex < 3; boosterCardIndex++) { // chaque booster contient 3 pokémons
			const randomPokemon = drawPokemonWithRarity(boosterBonus);// sélection avec probabilités + bonus du type de booster
			drawn.push(randomPokemon);// ajout du pokémon au tableau des obtenus
			// Utiliser pokedex_id comme clé interne pour l'inventaire (plus robuste pour i18n)
			const idKey = String(randomPokemon.pokedex_id);
			const before = inventory[idKey] || 0;
			inventory[idKey] = before + 1; // mise à jour de l'inventaire
			if (duplicatePointsEnabled && before > 0) {
				// Donner des points bonus pour doublon (1% des points actuels + 5 flat)
				let bonusDup = Math.floor(points * 0.01) + 5;
				bonusDup = Math.floor(bonusDup * (1 + globalBonusPercent/100));
				points += bonusDup;
			}
			
			// Gagner de l'XP selon la rareté du Pokémon
			// Rareté 1 (commun) = 1 XP, Rareté 2 (rare) = 3 XP, Rareté 3 (légendaire) = 6 XP
			// Les shinys donnent énormément d'XP : 200 XP pour shiny commun/rare, 500 XP pour shiny légendaire
			let xpGain = 1;
			if (randomPokemon.isShiny) {
				// Shiny = énorme boost d'XP (inchangé)
				xpGain = randomPokemon.rareté === 4 ? 500 : 200;
			} else {
				if (randomPokemon.rareté === 2) xpGain = 3;
				else if (randomPokemon.rareté === 3) xpGain = 6;
			}
			totalXP += xpGain;
		}

		// Jouer l'animation avec les cartes obtenues et l'image du type de booster
		try {
			await playBoosterAnimation(drawn, config.imageUrl);
		} catch (animationError) {
			console.warn('Animation booster interrompue', animationError);
		}

		renderCards(drawn);// affichage des cartes obtenues
		
		// Gagner l'XP total du booster
		if (totalXP > 0) gainXP(totalXP);
		// Déclencher l'événement de mise à jour de l'inventaire
		document.dispatchEvent(new Event("inventoryUpdated"));
		try { if (window.saveProgress) window.saveProgress(); } catch(saveError) {}
		// Si la fonction de vérification est exposée, l'appeler pour loguer d'éventuels mismatches
		if (typeof window !== 'undefined' && typeof window.verifyInventoryDisplay === 'function') {
			window.verifyInventoryDisplay();
		}
    try { if (typeof window.saveProgress === 'function') window.saveProgress(); } catch(saveError) {}
  }


  
  // fonction pour afficher les cartes obtenues avec une animation
  function stylebackground (rareté) {
        switch (rareté) {
          case 1:
            return "#585d60ff";
          case 2:
            return "#3498dbff";
          case 3:
            return "#9b59b6ff";
          case 4:
            return "linear-gradient(135deg, #FFD700 0%, #FF69B4 50%, #9b59b6ff 100%)"; // Shiny légendaire
        };
      }
	function renderCards(newCards) { 
		newCards.forEach((card) => {
			// Utiliser l'id comme identifiant unique pour les éléments DOM
			const safeId = String(card.pokedex_id);
			let existing = cardsContainer.querySelector(`[data-card-id="${CSS.escape ? CSS.escape(safeId) : safeId}"]`);

			if (existing) {
				// Mettre à jour le nombre (xN) et animer avec classe CSS
				const countEl = existing.querySelector('.card-count');
				if (countEl) {
					countEl.textContent = `x${typeof inventory[safeId] === 'number' ? inventory[safeId] : 0}`;
				}
				existing.classList.add('pulse');
				setTimeout(() => existing.classList.remove('pulse'), 150);
			} else {
				const div = document.createElement("div");
				div.className = 'pokemon-card';
				div.classList.add(`rarity-${card.rareté}`);
				if (card.isShiny) div.classList.add('shiny');
				div.setAttribute('data-card-id', safeId)
				
				// Créer les éléments de la carte
				const nameB = document.createElement('b');
				nameB.textContent = getDisplayName(card);
				if (card.isShiny) {
					nameB.style.color = '#FFD700';
					nameB.style.textShadow = '0 0 5px #FFD700';
				}
				div.appendChild(nameB);
				div.appendChild(document.createElement('br'));
				
				// Badge shiny si applicable
				if (card.isShiny) {
					const shinyBadge = document.createElement('span');
					shinyBadge.textContent = '✨ SHINY';
					shinyBadge.style.fontSize = '0.7rem';
					shinyBadge.style.color = '#FFD700';
					shinyBadge.style.fontWeight = 'bold';
					shinyBadge.style.textShadow = '0 0 8px #FF69B4';
					div.appendChild(shinyBadge);
					div.appendChild(document.createElement('br'));
				}
				
				const categorySmall = document.createElement('small');
				categorySmall.textContent = card.category;
				div.appendChild(categorySmall);
				div.appendChild(document.createElement('br'));
				
				const img = document.createElement('img');
				// Utiliser le sprite shiny si la carte est shiny
				img.src = card.isShiny && card.sprites.shiny ? card.sprites.shiny : card.sprites.regular;
				img.width = 90;
				div.appendChild(img);
				div.appendChild(document.createElement('br'));
				
				const statsSmall = document.createElement('small');
				const hpSpan = document.createElement('span');
				hpSpan.style.color = '#00ff11';
				hpSpan.textContent = `${card.stats.hp} PV`;
				statsSmall.appendChild(hpSpan);
				statsSmall.appendChild(document.createTextNode(' | '));
				
				const atkSpan = document.createElement('span');
				atkSpan.style.color = '#741d14ff';
				atkSpan.textContent = `${card.stats.atk} ATK`;
				statsSmall.appendChild(atkSpan);
				statsSmall.appendChild(document.createElement('br'));
				
				const defSpan = document.createElement('span');
				defSpan.style.color = '#2f1db4ff';
				defSpan.textContent = `${card.stats.def} DEF`;
				statsSmall.appendChild(defSpan);
				statsSmall.appendChild(document.createTextNode(' | '));
				
				const vitSpan = document.createElement('span');
				vitSpan.style.color = '#64187bff';
				vitSpan.textContent = `${card.stats.vit} VIT`;
				statsSmall.appendChild(vitSpan);
				statsSmall.appendChild(document.createElement('br'));
				
				div.appendChild(statsSmall);
				div.appendChild(document.createElement('br'));
				
				const countSmall = document.createElement('small');
				countSmall.className = 'card-count';
				countSmall.textContent = `x${typeof inventory[safeId] === 'number' ? inventory[safeId] : 0}`;
				div.appendChild(countSmall);
				
				cardsContainer.appendChild(div);
				// Animation d'apparition via CSS
				requestAnimationFrame(() => div.style.transform = "scale(1)");
			}
		});

		// Marquer que l'ordre actuel peut être ré-appliqué après tri
		if (typeof window !== 'undefined') {
			window.__lastRenderedCardsOrder = Array.from(cardsContainer.querySelectorAll('[data-card-id]')).map(el => el.getAttribute('data-card-id'));
		}
	}

	// Ajout tri par rareté (du plus rare au plus commun) déclenché par le bouton dans le Pokédex
	(function initRaritySort(){
		const sortBtn = document.getElementById('sort-rarity-btn');
		if (!sortBtn) return;
		let descending = true; // état initial: rare -> commun
		const rarityValue = (idKey) => {
			// récupérer la carte (shiny ou non) selon inventaire DOM
			const baseIdStr = String(idKey);
			const isShiny = baseIdStr.endsWith('_shiny');
			const numericId = parseInt(isShiny ? baseIdStr.replace('_shiny','') : baseIdStr, 10);
			const base = pokemons.find(p => p.pokedex_id === numericId);
			if (!base) return 0;
			// Tous les shinys doivent être considérés plus rares que n'importe quel non-shiny
			// On place donc toutes les cartes shiny dans une tranche supérieure
			if (isShiny) return 100 + (base.rareté || 0); // shiny > tout; ordre interne par rareté de base
			return base.rareté;
		};
		sortBtn.addEventListener('click', () => {
			const cardNodes = Array.from(cardsContainer.querySelectorAll('[data-card-id]'));
			cardNodes.sort((a,b) => {
				const ra = rarityValue(a.getAttribute('data-card-id'));
				const rb = rarityValue(b.getAttribute('data-card-id'));
				return descending ? (rb - ra) : (ra - rb);
			});
			// Replacer dans le DOM dans l'ordre trié
			cardNodes.forEach(node => cardsContainer.appendChild(node));
			descending = !descending;
			sortBtn.textContent = descending ? 'Trier rareté ↓' : 'Trier rareté ↑';
		});
	})();

	// ================== Système de succès (Achèvements) ==================
	const achievementsDefinition = [
		{ categoryIcon: '💪', category: 'Clics', items: [
			{ key:'clicks_100', name:'Dresseur débutant', condition:'100 clics', type:'clicks', target:100, reward:'+' },
			{ key:'clicks_1000', name:'Dresseur confirmé', condition:'1 000 clics', type:'clicks', target:1000, reward:'+' },
			{ key:'clicks_10000', name:'Maître du clic', condition:'10 000 clics', type:'clicks', target:10000, reward:'+' },
		]},
		{ categoryIcon: '💰', category: 'Points cumulés', items: [
			{ key:'points_10000', name:'Riche !', condition:'10 000 points', type:'points', target:10000, reward:'+' },
			{ key:'points_1000000', name:'Millionnaire', condition:'1 000 000 points', type:'points', target:1000000, reward:'+' },
		]},
		{ categoryIcon: '🧠', category: 'Améliorations', items: [
			{ key:'upgrades_5', name:'Ingénieux', condition:'Acheter 5 améliorations', type:'upgrades', target:5, reward:'+' },
			{ key:'upgrades_15', name:'Stratège', condition:'Acheter 15 améliorations', type:'upgrades', target:15, reward:'+' },
		]},
		{ categoryIcon: '🃏', category: 'Collection', items: [
			{ key:'cards_10', name:'Collectionneur', condition:'10 cartes obtenues', type:'cardsTotal', target:10, reward:'+' },
			{ key:'commons_all', name:'Maître du Pokédex', condition:'toutes cartes communes', type:'allCommons', target:true, reward:'+' },
			{ key:'legendary_1', name:'Légendaire', condition:'1 carte légendaire', type:'legendaryCount', target:1, reward:'+' },
		]},
		{ categoryIcon: '🕒', category: 'Temps de jeu', items: [
			{ key:'playtime_30min', name:'Persévérant', condition:'30 min de jeu', type:'playtime', target:30*60*1000, reward:'+' },
			{ key:'playtime_2h', name:'Insomniaque', condition:'2h de jeu', type:'playtime', target:2*60*60*1000, reward:'+' },
		]},
		{ categoryIcon: '⚔️', category: 'Combat', items: [
			{ key:'victory_1', name:'Premier duel', condition:'1 victoire', type:'victories', target:1, reward:'+' },
			{ key:'victory_10', name:'Champion', condition:'10 victoires', type:'victories', target:10, reward:'+' },
			{ key:'victory_100', name:'Maître Pokémon', condition:'100 victoires', type:'victories', target:100, reward:'+' },
		]}
	];

	// Déjà déclarés globalement en haut; on conserve les valeurs actuelles
	// totalClicks, totalUpgradesPurchased, totalVictories, sessionStartTime

	function renderAchievements() {
		const container = document.getElementById('achievements-container');
		if (!container) return;
		while (container.firstChild) container.removeChild(container.firstChild);
		achievementsDefinition.forEach(cat => {
			const block = document.createElement('div');
			block.className = 'achievement-category';
			const h3 = document.createElement('h3');
			h3.textContent = `${cat.categoryIcon} ${cat.category}`;
			block.appendChild(h3);
			const list = document.createElement('div');
			list.className = 'achievement-list';
			cat.items.forEach(item => {
				const row = document.createElement('div');
				row.className = 'achievement-item';
				if (achievementState[item.key]) row.classList.add('completed');
				const nameSpan = document.createElement('span');
				nameSpan.className = 'achievement-name';
				nameSpan.textContent = item.name;
				const condSpan = document.createElement('span');
				condSpan.className = 'achievement-condition';
				condSpan.textContent = item.condition;
				const rewardSpan = document.createElement('span');
				rewardSpan.className = 'achievement-reward';
				rewardSpan.textContent = item.reward;
				row.appendChild(nameSpan);
				row.appendChild(condSpan);
				row.appendChild(rewardSpan);
				list.appendChild(row);
			});
			block.appendChild(list);
			container.appendChild(block);
		});
	}

	function checkAchievements() {
		let hasChanges = false;
		achievementsDefinition.forEach(cat => {
			cat.items.forEach(item => {
				if (achievementState[item.key]) return; // déjà obtenu
				let achieved = false;
				switch (item.type) {
					case 'clicks': achieved = totalClicks >= item.target; break;
					case 'points': achieved = points >= item.target; break;
					case 'upgrades': achieved = totalUpgradesPurchased >= item.target; break;
					case 'cardsTotal': {
						let sum = 0; for (const k in inventory) sum += inventory[k]; achieved = sum >= item.target; break;
					}
					case 'allCommons': {
						// Vérifier que toutes les cartes de rareté 1 possédées >=1
						const commons = pokemons.filter(p => p.rareté === 1);
						achieved = commons.every(p => inventory[String(p.pokedex_id)] >= 1); break;
					}
					case 'legendaryCount': {
						const legendariesOwned = pokemons.filter(p => p.rareté === 3 && inventory[String(p.pokedex_id)] >= 1).length; achieved = legendariesOwned >= item.target; break;
					}
					case 'playtime': {
						const currentTotalPlaytime = totalPlaytime + (Date.now() - sessionStartTime);
						achieved = currentTotalPlaytime >= item.target;
						break;
					}
					case 'victories': achieved = totalVictories >= item.target; break;
					default: break;
				}
				if (achieved) {
					achievementState[item.key] = true;
					hasChanges = true;
				}
			});
		});
		// Ne re-render que si un succès a changé
		if (hasChanges) renderAchievements();
	}

	// Hooks
	document.addEventListener('inventoryUpdated', checkAchievements);
	
	// Victoires combat: patch checkBattleOutcome via event
	document.addEventListener('battleVictory', () => { totalVictories++; checkAchievements(); });

	// Timer pour playtime (vérif périodique moins fréquente)
	setInterval(checkAchievements, 30000); // 30s au lieu de 15s

	// Initial render
	setTimeout(renderAchievements, 50);

  booster_bouton.addEventListener("click", () => openBooster('basic'));
  booster_premium.addEventListener("click", () => openBooster('premium'));
  booster_ultimate.addEventListener("click", () => openBooster('ultimate'));

  let succès = false;
  function checkSuccess() {
    if (points >= 100 && !succès) {
      succès = true;
      alert("Félicitations ! Vous avez atteint 100 points !");
    }
  }
});

// Système de combat entre pokémons
function initializeBattleSystem() {
  // Log pour débugger l'initialisation
  console.log("Initializing battle system - 3v3 Mode");
  
  // Sélecteurs pour les 3 Pokémon de chaque joueur
  const player1Selects = [
    document.getElementById("player1-pokemon-1"),
    document.getElementById("player1-pokemon-2"),
    document.getElementById("player1-pokemon-3")
  ];
  const player2Selects = [
    document.getElementById("player2-pokemon-1"),
    document.getElementById("player2-pokemon-2"),
    document.getElementById("player2-pokemon-3")
  ];
  
  const startBattleBtn = document.getElementById("start-battle");
  const battleLog = document.getElementById("battle-log");
  const player1Side = document.getElementById("player1-side");
  const player2Side = document.getElementById("player2-side");
  const player2Container = document.getElementById("player2-container");
  const pvpMode = document.getElementById("pvp-mode");
  const pveMode = document.getElementById("pve-mode");
  
  // Vérifier que tous les éléments sont présents
  if (!player1Selects[0] || !player1Selects[1] || !player1Selects[2] ||
      !player2Selects[0] || !player2Selects[1] || !player2Selects[2] ||
      !startBattleBtn || !battleLog || !player1Side || !player2Side ||
      !player2Container || !pvpMode || !pveMode) {
    console.error("Erreur : Certains éléments HTML pour le combat sont introuvables !");
    return;
  }
  
  // Fonction pour afficher l'overlay de résultat de combat
  function showBattleResult(type, customMessage) {
    const overlay = document.createElement('div');
    overlay.className = `battle-result-overlay ${type}`;
    
    const text = document.createElement('div');
    text.className = 'battle-result-text';
    
    // Utiliser le message personnalisé si fourni, sinon le message par défaut
    if (customMessage) {
      text.textContent = customMessage;
    } else {
      text.textContent = type === 'victory' ? '🏆 VICTOIRE !' : '💀 DÉFAITE...';
    }
    
    overlay.appendChild(text);
    document.body.appendChild(overlay);
    
    // Retirer l'overlay après l'animation
    setTimeout(() => {
      overlay.remove();
    }, 2000);
  }
  
  // Limite du battleLog pour éviter le lag
  const MAX_BATTLE_LOG_MESSAGES = 50;
  function addBattleLogMessage(messageElement) {
    battleLog.appendChild(messageElement);
    // Supprimer les anciens messages si trop nombreux
    while (battleLog.children.length > MAX_BATTLE_LOG_MESSAGES) {
      battleLog.removeChild(battleLog.firstChild);
    }
    // Auto-scroll vers le bas
    battleLog.scrollTop = battleLog.scrollHeight;
  }
  
  // Vérification que les éléments sont bien trouvés
  console.log("Battle elements found:", {
    player1Selects,
    player2Selects,
    startBattleBtn,
    battleLog,
    player1Side,
    player2Side,
    player2Container,
    pvpMode,
    pveMode
  });
  
  let isPlayerVsPlayer = false;

  // Gestion des modes de jeu
  pvpMode.addEventListener("click", () => {
    isPlayerVsPlayer = true;
    pvpMode.classList.add("active");
    pveMode.classList.remove("active");
    player2Container.classList.add("visible");
    updatePokemonSelection();
  });

  pveMode.addEventListener("click", () => {
    isPlayerVsPlayer = false;
    pveMode.classList.add("active");
    pvpMode.classList.remove("active");
    player2Container.classList.remove("visible");
    updatePokemonSelection();
  });

  // Remplir les sélecteurs avec les Pokémon disponibles dans l'inventaire
  function updatePokemonSelection() {
    // Vider tous les sélecteurs
    player1Selects.forEach(select => {
      if (!select) return;
      while (select.firstChild) {
        select.removeChild(select.firstChild);
      }
    });
    player2Selects.forEach(select => {
      if (!select) return;
      while (select.firstChild) {
        select.removeChild(select.firstChild);
      }
    });
    
		// Remplir chaque sélecteur avec les Pokémon disponibles
		for (const idKey in inventory) {
			const qty = typeof inventory[idKey] === 'number' ? inventory[idKey] : 0;
			if (qty > 0) {
				const id = parseInt(idKey, 10);
				const pokemon = pokemons.find(p => p.pokedex_id === id);
				if (pokemon) {
					// Options pour les 3 sélecteurs du joueur 1
					player1Selects.forEach(select => {
						if (!select) return;
						const option = document.createElement("option");
						option.value = idKey;
						option.textContent = `${getDisplayName(pokemon)} (x${qty})`;
						select.appendChild(option);
					});

					// Options pour les 3 sélecteurs du joueur 2 en mode JcJ
					if (isPlayerVsPlayer) {
						player2Selects.forEach(select => {
							if (!select) return;
							const option = document.createElement("option");
							option.value = idKey;
							option.textContent = `${getDisplayName(pokemon)} (x${qty})`;
							select.appendChild(option);
						});
					}
				}
			}
		}
  }

  // Créer l'affichage d'un Pokémon dans l'arène
  function createPokemonDisplay(pokemon, side) {
    const container = document.createElement("div");
    container.className = "pokemon-info";
    
    const img = document.createElement('img');
    img.src = pokemon.sprites.regular;
    img.alt = getDisplayName(pokemon);
    container.appendChild(img);
    
    const h4 = document.createElement('h4');
    h4.textContent = getDisplayName(pokemon);
    container.appendChild(h4);
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'pokemon-stats';
    
    const pvSpan = document.createElement('span');
    pvSpan.textContent = `PV: ${pokemon.stats.hp}`;
    statsDiv.appendChild(pvSpan);
    
    const atkSpan = document.createElement('span');
    atkSpan.textContent = `ATK: ${pokemon.stats.atk}`;
    statsDiv.appendChild(atkSpan);
    
    const defSpan = document.createElement('span');
    defSpan.textContent = `DEF: ${pokemon.stats.def}`;
    statsDiv.appendChild(defSpan);
    
    container.appendChild(statsDiv);
    
    // Vider le side et ajouter le container
    while (side.firstChild) {
      side.removeChild(side.firstChild);
    }
    side.appendChild(container);
  }

	function refreshBattleNames() {
		// Rafraîchit tous les affichages de noms en fonction de la langue courante
		// 1) Cartes dans le pokédex / inventaire
		try {
			const cardsContainerElement = document.querySelector('#cards');
			if (cardsContainerElement) {
				const cardDivElements = cardsContainerElement.querySelectorAll('[data-card-id]');
				cardDivElements.forEach(cardDivElement => {
					const cardIdKey = cardDivElement.getAttribute('data-card-id');
					const foundPokemon = pokemons.find(pokemonData => String(pokemonData.pokedex_id) === cardIdKey);
					if (foundPokemon) {
						const nameBoldElement = cardDivElement.querySelector('b');
						if (nameBoldElement) nameBoldElement.textContent = getDisplayName(foundPokemon);
						const countElement = cardDivElement.querySelector('.card-count');
						if (countElement) countElement.textContent = `x${typeof inventory[cardIdKey] === 'number' ? inventory[cardIdKey] : 0}`;
					}
				});
			}
		} catch (refreshCardsError) {
			console.warn('Erreur lors du rafraîchissement des cartes :', refreshCardsError);
		}

		// 2) Options des selects de sélection de pokémon (3v3)
		try {
			const allSelects = [
				document.getElementById('player1-pokemon-1'),
				document.getElementById('player1-pokemon-2'),
				document.getElementById('player1-pokemon-3'),
				document.getElementById('player2-pokemon-1'),
				document.getElementById('player2-pokemon-2'),
				document.getElementById('player2-pokemon-3')
			];
			allSelects.forEach(selectElement => {
				if (!selectElement) return;
				for (let optionIndex = 0; optionIndex < selectElement.options.length; optionIndex++) {
					const optionElement = selectElement.options[optionIndex];
					const key = optionElement.value; // stocke l'id
					const p = pokemons.find(pp => String(pp.pokedex_id) === key);
					if (p) {
						optionElement.textContent = `${getDisplayName(p)} (x${typeof inventory[key] === 'number' ? inventory[key] : 0})`;
					}
				}
			});
		} catch (refreshSelectsError) {
			console.warn('Erreur lors du rafraîchissement des selects :', refreshSelectsError);
		}

		// 3) Arène de combat (si un combat est en cours)
		try {
			const current = window.__currentBattle || null;
			const p1Info = document.querySelector('#player1-side .pokemon-info');
			const p2Info = document.querySelector('#player2-side .pokemon-info');
			if (current && p1Info) {
				const p1 = pokemons.find(pp => pp.pokedex_id === current.p1) || null;
				if (p1) {
					const h4 = p1Info.querySelector('h4');
					const img = p1Info.querySelector('img');
					if (h4) h4.textContent = getDisplayName(p1);
					if (img) img.alt = getDisplayName(p1);
				}
			}
			if (current && p2Info) {
				const p2 = pokemons.find(pp => pp.pokedex_id === current.p2) || null;
				if (p2) {
					const h4 = p2Info.querySelector('h4');
					const img = p2Info.querySelector('img');
					if (h4) h4.textContent = getDisplayName(p2);
					if (img) img.alt = getDisplayName(p2);
					// Mettre à jour le nom affiché dans les contrôles si le bot utilisait le nom affiché
					const ctrl = document.querySelector('#player2-side .player-name');
					if (ctrl) {
						if (current.isBot) ctrl.textContent = getDisplayName(p2);
					}
				}
			}
		} catch (refreshArenaError) {
			console.warn('Erreur lors du rafraîchissement de l arène :', refreshArenaError);
		}

		// 4) Rafraîchir le journal de combat : reconstruire les messages marqués par dataset
		try {
			if (battleLog) {
				const entries = Array.from(battleLog.children || []);
				entries.forEach(el => {
					const t = el.dataset && el.dataset.type;
					if (!t) return; // message non-structuré
					switch (t) {
						case 'attack': {
							const atkId = el.dataset.attacker;
							const defId = el.dataset.defender;
							const damage = el.dataset.damage;
							const atkAtk = el.dataset.attackerAtk || '';
							const effect = el.dataset.effect || '';
							const atk = pokemons.find(p => String(p.pokedex_id) === String(atkId));
							const def = pokemons.find(p => String(p.pokedex_id) === String(defId));
							if (atk && def) {
								el.textContent = `${getDisplayName(atk)} attaque avec ${atkAtk || atk.stats.atk} ATK → ${getDisplayName(def)} perd ${damage} PV ! ${effect}`;
							}
							break;
						}
						case 'stunAttempt': {
							const atkId = el.dataset.attacker;
							const defId = el.dataset.defender;
							const atk = pokemons.find(p => String(p.pokedex_id) === String(atkId));
							const def = pokemons.find(p => String(p.pokedex_id) === String(defId));
							if (atk && def) el.textContent = `${getDisplayName(atk)} tente d'étourdir ${getDisplayName(def)} !`;
							break;
						}
						case 'stunResult': {
							if (el.dataset.success === '1') {
								const def = pokemons.find(p => String(p.pokedex_id) === String(el.dataset.defender));
								if (def) el.textContent = `🌟 ${getDisplayName(def)} est étourdi et passe son prochain tour !`;
							} else {
								el.textContent = `❌ L'étourdissement a échoué !`;
							}
							break;
						}
						case 'stunSkip': {
							const p = pokemons.find(x => String(x.pokedex_id) === String(el.dataset.pokemon));
							if (p) el.textContent = `😵 ${getDisplayName(p)} est étourdi et passe son tour !`;
							break;
						}
						case 'turn': {
							const p = pokemons.find(x => String(x.pokedex_id) === String(el.dataset.pokemon));
							if (p) el.textContent = `→ C'est au tour de ${getDisplayName(p)}`;
							break;
						}
						case 'death': {
							const loser = pokemons.find(x => String(x.pokedex_id) === String(el.dataset.loser));
							if (loser) el.textContent = `☠️ ${getDisplayName(loser)} n'a plus de PV... ${getDisplayName(loser)} est mort !`;
							break;
						}
						case 'victory': {
							const winner = pokemons.find(x => String(x.pokedex_id) === String(el.dataset.winner));
							if (winner) el.textContent = `🏆 ${getDisplayName(winner)} a gagné le combat !`;
							break;
						}
						case 'heal': {
							const p = pokemons.find(x => String(x.pokedex_id) === String(el.dataset.pokemon));
							if (p) {
								const healed = el.dataset.healed || '0';
								const hp = el.dataset.hp || '';
								const maxhp = el.dataset.maxhp || '';
								el.textContent = `${getDisplayName(p)} régénère ${healed} PV ! (→ ${hp}/${maxhp})`;
							}
							break;
						}
						default: break;
					}
				});
			}
		} catch (refreshLogError) {
			console.warn('Erreur lors du rafraîchissement du journal de combat :', refreshLogError);
		}

		// Exposer la fonction globalement pour l'appeler depuis d'autres scopes
		// (la ligne ci-dessous n'écrasera rien si déjà défini)
		if (typeof window !== 'undefined') window.refreshBattleNames = refreshBattleNames;

		// Exposer une fonction de vérification utile pour debugging : compare l'inventaire au DOM
		if (typeof window !== 'undefined') {
			window.verifyInventoryDisplay = function() {
				try {
					const mismatches = [];
					const cards = document.querySelectorAll('[data-card-id]');
					cards.forEach(div => {
						const id = div.getAttribute('data-card-id');
						const countEl = div.querySelector('.card-count');
						const domCount = countEl ? parseInt((countEl.textContent || '').replace(/^x/, ''), 10) : null;
						const invCount = typeof inventory[id] === 'number' ? inventory[id] : 0;
						if (domCount !== null && domCount !== invCount) {
							mismatches.push({ id, domCount, invCount });
						}
					});
					const selectElements = [document.getElementById('player1-pokemon'), document.getElementById('player2-pokemon')];
					selectElements.forEach(selectElement => {
						if (!selectElement) return;
						for (let optionIndex = 0; optionIndex < selectElement.options.length; optionIndex++) {
							const optionElement = selectElement.options[optionIndex];
							const key = optionElement.value;
							const inventoryCount = typeof inventory[key] === 'number' ? inventory[key] : 0;
							if (!optionElement.textContent.includes(`(x${inventoryCount})`)) {
								mismatches.push({ select: selectElement.id, option: optionElement.value, text: optionElement.textContent, inv: inventoryCount });
							}
						}
					});
					if (mismatches.length === 0) {
						console.log('verifyInventoryDisplay: OK — pas de mismatch trouvé');
					} else {
						console.warn('verifyInventoryDisplay: mismatches', mismatches);
					}
				} catch (verifyError) {
					console.error('verifyInventoryDisplay error', verifyError);
				}
			};
		}
	}

  // Sélectionner un Pokémon bot aléatoire
  function selectRandomBotPokemon() {
    const availablePokemons = pokemons.filter(p => p.stats.hp > 0);
    return availablePokemons[Math.floor(Math.random() * availablePokemons.length)];
  }

  function startBattle(pokemon1, pokemon2, isBot = false) {
    // Copier les stats pour ne pas modifier les originaux
    const battlePokemon1 = JSON.parse(JSON.stringify(pokemon1));
    const battlePokemon2 = JSON.parse(JSON.stringify(pokemon2));
		// Conserver le PV max pour la régénération
		battlePokemon1.maxHp = pokemon1.stats.hp;
		battlePokemon2.maxHp = pokemon2.stats.hp;

		// Marquer le combat courant globalement (utile pour rafraîchir les noms depuis l'extérieur)
		if (typeof window !== 'undefined') {
			window.__currentBattle = { p1: pokemon1.pokedex_id, p2: pokemon2.pokedex_id, isBot: !!isBot };
		}

    createPokemonDisplay(battlePokemon1, player1Side);
    createPokemonDisplay(battlePokemon2, player2Side);
    
    // Vider le battleLog
    while (battleLog.firstChild) {
      battleLog.removeChild(battleLog.firstChild);
    }

		// Déterminer l'ordre des tours en fonction de la vitesse (vit)
		let isPlayer1Turn;
		if (battlePokemon1.stats.vit > battlePokemon2.stats.vit) {
			isPlayer1Turn = true;
		} else if (battlePokemon1.stats.vit < battlePokemon2.stats.vit) {
			isPlayer1Turn = false;
		} else {
			// Même vitesse -> aléatoire
			isPlayer1Turn = Math.random() > 0.5;
		}
    let battleEnded = false;
    
    // Ajouter les contrôles pour les deux côtés
    console.log("Setting up controls for", player1Side, player2Side);
    
    // Créer les contrôles s'ils n'existent pas
    if (!player1Side.querySelector(".battle-controls")) {
      const controls1 = document.createElement("div");
      controls1.className = "battle-controls";
      player1Side.appendChild(controls1);
    }
    
    if (!player2Side.querySelector(".battle-controls")) {
      const controls2 = document.createElement("div");
      controls2.className = "battle-controls";
      player2Side.appendChild(controls2);
    }
    
	setupPlayerControls(player1Side, "Joueur 1", battlePokemon1);
	setupPlayerControls(player2Side, isBot ? getDisplayName(battlePokemon2) : "Joueur 2", battlePokemon2);

		function setupPlayerControls(side, playerName, pokemon) {
      const controls = side.querySelector(".battle-controls");
      if (!controls) {
        console.error("Controls not found for", playerName);
        return;
      }
      
      console.log("Setting up controls for", playerName);
      
      // Vider les contrôles
      while (controls.firstChild) {
        controls.removeChild(controls.firstChild);
      }
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'player-name';
      nameDiv.textContent = playerName;
      controls.appendChild(nameDiv);
      
      const attackButtonsDiv = document.createElement('div');
      attackButtonsDiv.className = 'attack-buttons';
      
      const attackBtn = document.createElement('button');
      attackBtn.className = 'attack-btn';
      attackBtn.disabled = true;
      attackBtn.textContent = 'Attaque';
      attackButtonsDiv.appendChild(attackBtn);
      
			const stunBtn = document.createElement('button');
			stunBtn.className = 'stun-btn';
			stunBtn.disabled = true;
			stunBtn.textContent = `Étourdissement (${Math.floor(pokemon.stats.spe_atk * 0.5)}% chance)`;
			attackButtonsDiv.appendChild(stunBtn);
      
      const healBtn = document.createElement('button');
      healBtn.className = 'heal-btn';
      healBtn.disabled = true;
      healBtn.textContent = 'Régénérer (30%)';
      attackButtonsDiv.appendChild(healBtn);
      
      controls.appendChild(attackButtonsDiv);
    }

	// Fonction centralisée pour les actions du bot
	function botAction() {
		const botChoice = Math.random();
		if (botChoice < 0.15 && battlePokemon2.stats.hp < battlePokemon2.maxHp) {
			// Bot régénère (15% si PV < max)
			let baseHeal = Math.ceil(battlePokemon2.maxHp * 0.3);
			const healAmount = window.healDoubleEnabled ? baseHeal * 2 : baseHeal;
			const before = battlePokemon2.stats.hp;
			battlePokemon2.stats.hp = Math.min(battlePokemon2.maxHp, battlePokemon2.stats.hp + healAmount);
			const healed = battlePokemon2.stats.hp - before;
			const messageElement = document.createElement('p');
			messageElement.dataset.type = 'heal';
			messageElement.dataset.pokemon = String(battlePokemon2.pokedex_id);
			messageElement.dataset.healed = String(healed);
			messageElement.dataset.hp = String(battlePokemon2.stats.hp);
			messageElement.dataset.maxhp = String(battlePokemon2.maxHp);
			messageElement.textContent = `${getDisplayName(battlePokemon2)} (bot) régénère ${healed} PV ! (→ ${battlePokemon2.stats.hp}/${battlePokemon2.maxHp})`;
			messageElement.style.color = '#f1c40f';
			addBattleLogMessage(messageElement);
			updatePokemonStats();
		} else if (botChoice < 0.35) {
			// Bot étourdit (20%)
			attack(battlePokemon2, battlePokemon1, 2, true);
		} else {
			// Bot attaque (65%)
			attack(battlePokemon2, battlePokemon1, 2, false);
		}
	}		function updatePokemonStats() {
			// Afficher des stats plus complètes pour refléter les spécificités
			const player1Stats = player1Side.querySelector(".pokemon-stats");
			const player2Stats = player2Side.querySelector(".pokemon-stats");
			
			// Vider et recréer les stats du joueur 1
			while (player1Stats.firstChild) {
				player1Stats.removeChild(player1Stats.firstChild);
			}
			
			const createStatSpan = (text) => {
				const span = document.createElement('span');
				span.textContent = text;
				return span;
			};
			
			player1Stats.appendChild(createStatSpan(`PV: ${battlePokemon1.stats.hp}/${battlePokemon1.maxHp}`));
			player1Stats.appendChild(createStatSpan(`ATK: ${battlePokemon1.stats.atk}`));
			player1Stats.appendChild(createStatSpan(`DEF: ${battlePokemon1.stats.def}`));
			player1Stats.appendChild(createStatSpan(`SP.ATK: ${battlePokemon1.stats.spe_atk}`));
			player1Stats.appendChild(createStatSpan(`SP.DEF: ${battlePokemon1.stats.spe_def}`));
			player1Stats.appendChild(createStatSpan(`VIT: ${battlePokemon1.stats.vit}`));
			
			// Vider et recréer les stats du joueur 2
			while (player2Stats.firstChild) {
				player2Stats.removeChild(player2Stats.firstChild);
			}
			
			player2Stats.appendChild(createStatSpan(`PV: ${battlePokemon2.stats.hp}/${battlePokemon2.maxHp}`));
			player2Stats.appendChild(createStatSpan(`ATK: ${battlePokemon2.stats.atk}`));
			player2Stats.appendChild(createStatSpan(`DEF: ${battlePokemon2.stats.def}`));
			player2Stats.appendChild(createStatSpan(`SP.ATK: ${battlePokemon2.stats.spe_atk}`));
			player2Stats.appendChild(createStatSpan(`SP.DEF: ${battlePokemon2.stats.spe_def}`));
			player2Stats.appendChild(createStatSpan(`VIT: ${battlePokemon2.stats.vit}`));
		}

		function attack(attacker, defender, playerNumber, isStun = false) {
			const message = document.createElement("p");

			if (isStun) {
				// Tentative d'étourdissement (baisse des chances globales)
				const stunChance = Math.floor(attacker.stats.spe_atk * 0.5);
				const isStunSuccessful = Math.random() * 100 <= stunChance;

				// Log the attempt with metadata so it can be re-rendered in another language
				message.dataset.type = 'stunAttempt';
				message.dataset.attacker = String(attacker.pokedex_id);
				message.dataset.defender = String(defender.pokedex_id);
				message.textContent = `${getDisplayName(attacker)} tente d'étourdir ${getDisplayName(defender)} !`;
				message.style.color = playerNumber === 1 ? "#27ae60" : "#e74c3c";
				addBattleLogMessage(message);

				if (isStunSuccessful) {
					const stunMessage = document.createElement("p");
					stunMessage.dataset.type = 'stunResult';
					stunMessage.dataset.success = '1';
					stunMessage.dataset.defender = String(defender.pokedex_id);
					stunMessage.textContent = `🌟 ${getDisplayName(defender)} est étourdi et passe son prochain tour !`;
					stunMessage.style.color = "#f39c12";
					addBattleLogMessage(stunMessage);
					defender.isStunned = true;
				} else {
					const failMessage = document.createElement("p");
					failMessage.dataset.type = 'stunResult';
					failMessage.dataset.success = '0';
					failMessage.textContent = `❌ L'étourdissement a échoué !`;
					failMessage.style.color = "#95a5a6";
					addBattleLogMessage(failMessage);
				}
			} else {
				// Attaque normale en prenant en compte atk / def / spe_atk / spe_def / vit
				const effectiveAtk = attacker.stats.atk + Math.round(attacker.stats.spe_atk * 0.35);
				const effectiveDef = defender.stats.def + Math.round(defender.stats.spe_def * 0.25);

				// Facteur aléatoire et avantage de vitesse
				const randomFactor = Math.random() * 0.3 + 0.85; // Entre 0.85 et 1.15
				const speedFactor = 1 + (attacker.stats.vit - defender.stats.vit) / 200; // petit bonus si plus rapide

				let raw = (effectiveAtk - effectiveDef * 0.6);
				if (raw < 1) raw = 1;

				let damage = Math.max(1, Math.floor(raw * randomFactor * speedFactor));

				// Chance de coup critique basée sur la vitesse
				const critChance = Math.min(30, Math.max(5, Math.floor(attacker.stats.vit / 3)));
				const isCrit = Math.random() * 100 < critChance;
				if (isCrit) {
					damage = Math.max(1, Math.floor(damage * 1.5));
				}

				defender.stats.hp = Math.max(0, defender.stats.hp - damage);

				// Texte pour l'efficacité
				let effectText = '';
				if (isCrit) {
					effectText = '🎯 Coup critique ! ';
				} else if (damage > effectiveAtk * 0.9) {
					effectText = '💥 Gros dégât ! ';
				} else if (damage < effectiveAtk * 0.35) {
					effectText = '😅 Pas très efficace... ';
				}

				// Add metadata for later re-rendering
				message.dataset.type = 'attack';
				message.dataset.attacker = String(attacker.pokedex_id);
				message.dataset.defender = String(defender.pokedex_id);
				message.dataset.damage = String(damage);
				message.dataset.isCrit = isCrit ? '1' : '0';
				message.dataset.attackerAtk = String(attacker.stats.atk || 0);
				message.dataset.effect = effectText;
				message.textContent = `${getDisplayName(attacker)} attaque avec ${effectiveAtk} ATK eff. → ${getDisplayName(defender)} perd ${damage} PV ! ${effectText}`;
				message.style.color = playerNumber === 1 ? "#27ae60" : "#e74c3c";
				addBattleLogMessage(message);
			}
      
			updatePokemonStats();
		}

		function updateControls() {
      // Vérifier si le combat est terminé avant tout
      if (checkBattleOutcome()) {
        return;
      }
      
      // Vérifier les étourdissements
      if (battlePokemon1.isStunned) {
        battlePokemon1.isStunned = false;
        isPlayer1Turn = false;
		const stunSkipMessage = document.createElement("p");
		stunSkipMessage.dataset.type = 'stunSkip';
		stunSkipMessage.dataset.pokemon = String(battlePokemon1.pokedex_id);
		stunSkipMessage.textContent = `😵 ${getDisplayName(battlePokemon1)} est étourdi et passe son tour !`;
		stunSkipMessage.style.color = "#95a5a6";
		addBattleLogMessage(stunSkipMessage);
        
        // Si c'est contre le bot et que le combat n'est pas terminé, le bot joue
        if (isBot && !checkBattleOutcome()) {
          setTimeout(() => {
            if (!battleEnded && !checkBattleOutcome()) {
              botAction();
              isPlayer1Turn = true;
              updateControls();
            }
          }, 1000);
        }
      }
      if (battlePokemon2.isStunned) {
        battlePokemon2.isStunned = false;
        isPlayer1Turn = true;
		const stunSkipMessage = document.createElement("p");
		stunSkipMessage.dataset.type = 'stunSkip';
		stunSkipMessage.dataset.pokemon = String(battlePokemon2.pokedex_id);
		stunSkipMessage.textContent = `😵 ${getDisplayName(battlePokemon2)} est étourdi et passe son tour !`;
		stunSkipMessage.style.color = "#95a5a6";
		addBattleLogMessage(stunSkipMessage);
      }
      
		// Mettre à jour les boutons du joueur 1 (attaque / stun / heal)
		const p1Controls = player1Side.querySelector('.battle-controls');
		if (p1Controls) {
			const atk = p1Controls.querySelector('.attack-btn');
			const stun = p1Controls.querySelector('.stun-btn');
			const heal = p1Controls.querySelector('.heal-btn');
			if (atk) atk.disabled = !isPlayer1Turn || battlePokemon1.stats.hp <= 0;
			if (stun) stun.disabled = !isPlayer1Turn || battlePokemon1.stats.hp <= 0;
			if (heal) heal.disabled = !isPlayer1Turn || battlePokemon1.stats.hp <= 0 || battlePokemon1.stats.hp >= battlePokemon1.maxHp;
		}

		// Mettre à jour les boutons du joueur 2 (attaque / stun / heal) uniquement si JcJ
		if (!isBot) {
			const p2Controls = player2Side.querySelector('.battle-controls');
			if (p2Controls) {
				const atk2 = p2Controls.querySelector('.attack-btn');
				const stun2 = p2Controls.querySelector('.stun-btn');
				const heal2 = p2Controls.querySelector('.heal-btn');
				if (atk2) atk2.disabled = isPlayer1Turn || battlePokemon2.stats.hp <= 0;
				if (stun2) stun2.disabled = isPlayer1Turn || battlePokemon2.stats.hp <= 0;
				if (heal2) heal2.disabled = isPlayer1Turn || battlePokemon2.stats.hp <= 0 || battlePokemon2.stats.hp >= battlePokemon2.maxHp;
			}
		}
      
      // Afficher le prochain tour seulement si le combat n'est pas terminé
      if (!checkBattleOutcome()) {
	const currentPlayer = isPlayer1Turn ? getDisplayName(battlePokemon1) : isBot ? getDisplayName(battlePokemon2) : "Joueur 2";
				const turnMessage = document.createElement("p");
				turnMessage.dataset.type = 'turn';
				// store which pokemon is the subject when possible
				if (isPlayer1Turn) {
					turnMessage.dataset.pokemon = String(battlePokemon1.pokedex_id);
				} else {
					turnMessage.dataset.pokemon = String(battlePokemon2.pokedex_id);
				}
				turnMessage.textContent = `→ C'est au tour de ${currentPlayer}`;
				turnMessage.style.fontWeight = "bold";
				turnMessage.style.color = "#3498db";
				addBattleLogMessage(turnMessage);
      }
    }

    function checkBattleOutcome() {
      if (battleEnded) return true;
      
	if (battlePokemon1.stats.hp <= 0) {
		battleEnded = true;
			if (typeof window !== 'undefined') window.__currentBattle = null;
	const message = document.createElement("p");
	message.dataset.type = 'death';
	message.dataset.loser = String(battlePokemon1.pokedex_id);
	message.textContent = `☠️ ${getDisplayName(battlePokemon1)} n'a plus de PV... ${getDisplayName(battlePokemon1)} est mort !`;
		message.style.fontWeight = "bold";
		message.style.color = "#e74c3c";
		addBattleLogMessage(message);
        
	const victoryMessage = document.createElement("p");
	victoryMessage.dataset.type = 'victory';
	victoryMessage.dataset.winner = String(battlePokemon2.pokedex_id);
	victoryMessage.dataset.loser = String(battlePokemon1.pokedex_id);
	victoryMessage.textContent = `🏆 ${getDisplayName(battlePokemon2)} a gagné le combat !`;
		victoryMessage.style.fontWeight = "bold";
		victoryMessage.style.color = "#27ae60";
		addBattleLogMessage(victoryMessage);
        
        // Désactiver tous les boutons
        const allButtons = document.querySelectorAll(".battle-controls button");
        allButtons.forEach(btn => btn.disabled = true);
        
        if (!isBot) {
          points += 50; // Récompense pour le joueur 2
          pointsDisplay.textContent = points;
					try { updateUpgradeCardsState(); } catch(e) {}
          // Pas d'XP car le joueur 1 a perdu
          try { if (window.saveProgress) window.saveProgress(); } catch(e) {}
        }
		// Déclencher un événement global de victoire (joueur 2)
		try { document.dispatchEvent(new Event('battleVictory')); } catch(e) {}
		
		// Animation et son de défaite pour le joueur
		if (window.audioManager) window.audioManager.play('defeat');
		showBattleResult('defeat');
		const p1Image = player1Side.querySelector('img');
		if (p1Image) p1Image.classList.add('battle-defeat-animation');
		const p2Image = player2Side.querySelector('img');
		if (p2Image) p2Image.classList.add('battle-victory-animation');
		
		return true;
	  } else if (battlePokemon2.stats.hp <= 0) {
		battleEnded = true;
			if (typeof window !== 'undefined') window.__currentBattle = null;
	const message = document.createElement("p");
	message.dataset.type = 'death';
	message.dataset.loser = String(battlePokemon2.pokedex_id);
	message.textContent = `☠️ ${getDisplayName(battlePokemon2)} n'a plus de PV... ${getDisplayName(battlePokemon2)} est mort !`;
		message.style.fontWeight = "bold";
		message.style.color = "#e74c3c";
		addBattleLogMessage(message);
        
	const victoryMessage = document.createElement("p");
	victoryMessage.dataset.type = 'victory';
	victoryMessage.dataset.winner = String(battlePokemon1.pokedex_id);
	victoryMessage.dataset.loser = String(battlePokemon2.pokedex_id);
	victoryMessage.textContent = `🏆 ${getDisplayName(battlePokemon1)} a gagné le combat !`;
		victoryMessage.style.fontWeight = "bold";
		victoryMessage.style.color = "#27ae60";
		addBattleLogMessage(victoryMessage);
        
        // Désactiver tous les boutons
        const allButtons = document.querySelectorAll(".battle-controls button");
        allButtons.forEach(btn => btn.disabled = true);
        
        points += isBot ? 100 : 50; // Plus de points contre le bot
        pointsDisplay.textContent = points;
	try { updateUpgradeCardsState(); } catch(e) {}
        
        // Gagner de l'XP pour avoir gagné le combat
        // Combat PvP = 100 XP, Combat vs Bot = 150 XP
        const xpGain = isBot ? 150 : 100;
        gainXP(xpGain);
	try { if (window.saveProgress) window.saveProgress(); } catch(e) {}
        
		// Déclencher un événement global de victoire (joueur 1)
		try { document.dispatchEvent(new Event('battleVictory')); } catch(e) {}
		
		// Animation et son de victoire pour le joueur
		if (window.audioManager) window.audioManager.play('victory');
		showBattleResult('victory');
		const p1Image = player1Side.querySelector('img');
		if (p1Image) p1Image.classList.add('battle-victory-animation');
		const p2Image = player2Side.querySelector('img');
		if (p2Image) p2Image.classList.add('battle-defeat-animation');
		
		return true;
      }
      return false;
    }

	function setupBattleControls() {
	  // Configuration des contrôles pour le joueur 1
	  const player1Controls = player1Side.querySelector(".battle-controls");
	  const player1AttackBtn = player1Controls?.querySelector(".attack-btn");
	  const player1StunBtn = player1Controls?.querySelector(".stun-btn");
      
	  if (!player1Controls) {
		console.error("Erreur: Impossible de trouver les contrôles du joueur 1");
		return;
	  }
      
	  // Configuration des événements pour le joueur 1
			if (player1AttackBtn) player1AttackBtn.onclick = () => {
				if (isPlayer1Turn && !battleEnded && battlePokemon1.stats.hp > 0) {
					attack(battlePokemon1, battlePokemon2, 1, false);
					if (checkBattleOutcome()) return;
					// Si l'adversaire vient d'être marqué étourdi (via un autre effet futur) ou est encore étourdi, rejouer
					if (battlePokemon2.isStunned) {
						updateControls();
						return;
					}
					isPlayer1Turn = false;
          
					if (isBot) {
						setTimeout(() => {
							if (!battleEnded && !checkBattleOutcome()) {
								botAction();
								if (checkBattleOutcome()) return;
								isPlayer1Turn = true;
								updateControls();
							}
						}, 1000);
					} else {
						updateControls();
					}
				}
			};
      
			if (player1StunBtn) player1StunBtn.onclick = () => {
				if (isPlayer1Turn && !battleEnded && battlePokemon1.stats.hp > 0) {
					attack(battlePokemon1, battlePokemon2, 1, true);
					if (checkBattleOutcome()) return;
					// Si l'étourdissement a réussi, conserver le tour
					if (battlePokemon2.isStunned) {
						updateControls();
						return;
					}
					isPlayer1Turn = false;
          
					if (isBot) {
						setTimeout(() => {
							if (!battleEnded && !checkBattleOutcome()) {
								botAction();
								if (checkBattleOutcome()) return;
								isPlayer1Turn = true;
								updateControls();
							}
						}, 1000);
					} else {
						updateControls();
					}
				}
			};

			// Régénération pour le joueur 1
			const player1HealBtn = player1Controls?.querySelector('.heal-btn');
			if (player1HealBtn) player1HealBtn.onclick = () => {
				if (isPlayer1Turn && !battleEnded && battlePokemon1.stats.hp > 0) {
					let baseHeal = Math.ceil(battlePokemon1.maxHp * 0.3);
					const healAmount = window.healDoubleEnabled ? baseHeal * 2 : baseHeal;
					const before = battlePokemon1.stats.hp;
					battlePokemon1.stats.hp = Math.min(battlePokemon1.maxHp, battlePokemon1.stats.hp + healAmount);
					const healed = battlePokemon1.stats.hp - before;
					const messageElement = document.createElement('p');
					messageElement.dataset.type = 'heal';
					messageElement.dataset.pokemon = String(battlePokemon1.pokedex_id);
					messageElement.dataset.healed = String(healed);
					messageElement.dataset.hp = String(battlePokemon1.stats.hp);
					messageElement.dataset.maxhp = String(battlePokemon1.maxHp);
					messageElement.textContent = `${getDisplayName(battlePokemon1)} régénère ${healed} PV ! (→ ${battlePokemon1.stats.hp}/${battlePokemon1.maxHp})`;
					messageElement.style.color = '#f1c40f';
					addBattleLogMessage(messageElement);
					updatePokemonStats();
					isPlayer1Turn = false;

					if (isBot) {
						setTimeout(() => {
							if (!battleEnded && !checkBattleOutcome()) {
								botAction();
								if (checkBattleOutcome()) return;
								isPlayer1Turn = true;
								updateControls();
							}
						}, 1000);
					} else {
						updateControls();
					}
				}
			};
      
      // Configuration des contrôles pour le joueur 2 (seulement en mode JcJ)
      if (!isBot) {
        const player2Controls = player2Side.querySelector(".battle-controls");
        const player2AttackBtn = player2Controls?.querySelector(".attack-btn");
        const player2StunBtn = player2Controls?.querySelector(".stun-btn");
        
				if (!player2Controls) {
          console.error("Erreur: Impossible de trouver les contrôles du joueur 2");
          return;
        }
        
				if (player2AttackBtn) player2AttackBtn.onclick = () => {
          if (!isPlayer1Turn && !battleEnded && battlePokemon2.stats.hp > 0) {
						attack(battlePokemon2, battlePokemon1, 2, false);
						if (checkBattleOutcome()) return;
						if (battlePokemon1.isStunned) {
							updateControls();
							return;
						}
						isPlayer1Turn = true;
						updateControls();
          }
        };
        
				if (player2StunBtn) player2StunBtn.onclick = () => {
          if (!isPlayer1Turn && !battleEnded && battlePokemon2.stats.hp > 0) {
						attack(battlePokemon2, battlePokemon1, 2, true);
						if (checkBattleOutcome()) return;
						if (battlePokemon1.isStunned) {
							updateControls();
							return;
						}
						isPlayer1Turn = true;
						updateControls();
          }
        };

				// Régénération pour le joueur 2 (en JcJ)
				const player2HealBtn = player2Controls?.querySelector('.heal-btn');
				if (player2HealBtn) player2HealBtn.onclick = () => {
					if (!isPlayer1Turn && !battleEnded && battlePokemon2.stats.hp > 0) {
						let baseHeal = Math.ceil(battlePokemon2.maxHp * 0.3);
						const healAmount = window.healDoubleEnabled ? baseHeal * 2 : baseHeal;
						const before = battlePokemon2.stats.hp;
						battlePokemon2.stats.hp = Math.min(battlePokemon2.maxHp, battlePokemon2.stats.hp + healAmount);
						const healed = battlePokemon2.stats.hp - before;
						const messageElement = document.createElement('p');
						messageElement.dataset.type = 'heal';
						messageElement.dataset.pokemon = String(battlePokemon2.pokedex_id);
						messageElement.dataset.healed = String(healed);
						messageElement.dataset.hp = String(battlePokemon2.stats.hp);
						messageElement.dataset.maxhp = String(battlePokemon2.maxHp);
						messageElement.textContent = `${getDisplayName(battlePokemon2)} régénère ${healed} PV ! (→ ${battlePokemon2.stats.hp}/${battlePokemon2.maxHp})`;
						messageElement.style.color = '#f1c40f';
						addBattleLogMessage(messageElement);
						updatePokemonStats();
						isPlayer1Turn = true;
						updateControls();
					}
				};
      }
    }
    
    // S'assurer que les Pokémon n'ont pas d'état d'étourdissement au début du combat
    battlePokemon1.isStunned = false;
    battlePokemon2.isStunned = false;

    // Initialiser le combat
    setupBattleControls();
    updateControls();
    
    // Si c'est le tour du bot au début, le faire jouer automatiquement
    if (isBot && !isPlayer1Turn && !checkBattleOutcome()) {
      setTimeout(() => {
        if (!battleEnded && !checkBattleOutcome()) {
          botAction();
          if (checkBattleOutcome()) return;
          isPlayer1Turn = true;
          updateControls();
        }
      }, 1000);
    }
  }

  // ============================================
  // FONCTION DE COMBAT 3v3 (SEQUENTIEL)
  // ============================================
  function startBattle3v3(team1, team2, isBot = false) {
    console.log("🎮 Starting 3v3 battle", team1, team2);
    
    // Index des Pokémon actifs dans chaque équipe
    let activeIndex1 = 0;
    let activeIndex2 = 0;
    
    // Copier les équipes pour ne pas modifier les originaux
    const battleTeam1 = team1.map(p => {
      const copy = JSON.parse(JSON.stringify(p));
      copy.maxHp = p.stats.hp;
      copy.isStunned = false;
      return copy;
    });
    
    const battleTeam2 = team2.map(p => {
      const copy = JSON.parse(JSON.stringify(p));
      copy.maxHp = p.stats.hp;
      copy.isStunned = false;
      return copy;
    });
    
    // Marquer le combat 3v3 actuel
    if (typeof window !== 'undefined') {
      window.__currentBattle = {
        team1: battleTeam1.map(p => p.pokedex_id),
        team2: battleTeam2.map(p => p.pokedex_id),
        isBot: !!isBot,
        mode: '3v3'
      };
    }
    
    let battleEnded = false;
    
    // Fonction pour obtenir le Pokémon actif
    function getActivePokemon1() {
      return battleTeam1[activeIndex1];
    }
    
    function getActivePokemon2() {
      return battleTeam2[activeIndex2];
    }
    
    // Fonction pour afficher toute l'équipe
		const _teamContainersCache = new WeakMap(); // side -> container
		function displayTeam(team, activeIndex, side) {
			let teamContainer = _teamContainersCache.get(side);
			if (!teamContainer) {
				teamContainer = document.createElement('div');
				teamContainer.className = 'battle-team-container';
				teamContainer.style.display = 'flex';
				teamContainer.style.flexDirection = 'column';
				teamContainer.style.gap = '10px';
				teamContainer.style.alignItems = 'center';
				_teamContainersCache.set(side, teamContainer);
				side.innerHTML = ''; // première insertion seulement
				side.appendChild(teamContainer);
			}

			// Assurer le bon nombre de cartes
			while (teamContainer.children.length < team.length) {
				const card = document.createElement('div');
				card.className = 'battle-team-member';
				card.style.padding = '10px';
				card.style.border = '2px solid #ccc';
				card.style.borderRadius = '8px';
				card.style.backgroundColor = '#f9f9f9';
				card.style.width = '180px';

				// Sous éléments permanents
				const img = document.createElement('img');
				img.style.width = '80px';
				img.style.height = '80px';
				img.style.display = 'block';
				img.style.margin = '0 auto';
				img.dataset.role = 'img';
				card.appendChild(img);

				const nameDiv = document.createElement('div');
				nameDiv.style.fontWeight = 'bold';
				nameDiv.style.textAlign = 'center';
				nameDiv.style.marginTop = '5px';
				nameDiv.style.fontSize = '14px';
				nameDiv.style.color = '#2c3e50';
				nameDiv.dataset.role = 'name';
				card.appendChild(nameDiv);

				const hpBar = document.createElement('div');
				hpBar.style.width = '100%';
				hpBar.style.height = '8px';
				hpBar.style.backgroundColor = '#ddd';
				hpBar.style.borderRadius = '4px';
				hpBar.style.marginTop = '5px';
				hpBar.style.overflow = 'hidden';
				const hpFill = document.createElement('div');
				hpFill.style.height = '100%';
				hpFill.style.transition = 'width 0.25s linear';
				hpFill.dataset.role = 'hpfill';
				hpBar.appendChild(hpFill);
				card.appendChild(hpBar);

				const hpText = document.createElement('div');
				hpText.style.textAlign = 'center';
				hpText.style.fontSize = '12px';
				hpText.style.marginTop = '3px';
				hpText.dataset.role = 'hptext';
				card.appendChild(hpText);

				teamContainer.appendChild(card);
			}

			// Mettre à jour chaque carte
			team.forEach((pokemon, index) => {
				const card = teamContainer.children[index];
				const img = card.querySelector('[data-role="img"]');
				const nameDiv = card.querySelector('[data-role="name"]');
				const hpFill = card.querySelector('[data-role="hpfill"]');
				const hpText = card.querySelector('[data-role="hptext"]');

				// Données
				if (img) {
					const newSrc = (pokemon.sprites && pokemon.sprites.regular) ? pokemon.sprites.regular : '';
					if (img.src !== newSrc) img.src = newSrc;
					img.alt = getDisplayName(pokemon);
				}
				if (nameDiv) nameDiv.textContent = getDisplayName(pokemon);
				const hpPercent = Math.max(0, (pokemon.stats.hp / pokemon.maxHp) * 100);
				if (hpFill) {
					hpFill.style.width = hpPercent + '%';
					hpFill.style.backgroundColor = hpPercent > 50 ? '#27ae60' : hpPercent > 25 ? '#f39c12' : '#e74c3c';
				}
				if (hpText) {
					hpText.textContent = `${pokemon.stats.hp}/${pokemon.maxHp} PV`;
					hpText.style.color = pokemon.stats.hp <= 0 ? '#e74c3c' : '#333';
				}

				// Style carte (éviter rebuild)
				card.style.opacity = pokemon.stats.hp <= 0 ? '0.35' : '1';
				if (index === activeIndex && pokemon.stats.hp > 0) {
					card.style.border = '3px solid #3498db';
					card.style.backgroundColor = '#e3f2fd';
					card.style.boxShadow = '0 0 10px rgba(52,152,219,0.35)';
				} else {
					card.style.border = '2px solid #ccc';
					card.style.backgroundColor = '#f9f9f9';
					card.style.boxShadow = 'none';
				}
			});
		}
    
    // Fonction pour rafraîchir l'affichage des équipes
    function updateTeamsDisplay() {
      displayTeam(battleTeam1, activeIndex1, player1Side);
      displayTeam(battleTeam2, activeIndex2, player2Side);
    }
    
    // Vider le battleLog
    while (battleLog.firstChild) {
      battleLog.removeChild(battleLog.firstChild);
    }
    
    // Affichage initial des équipes
    updateTeamsDisplay();
    
    // Message de début
    const startMessage = document.createElement('p');
    startMessage.textContent = '⚔️ Combat 3v3 - Chaque équipe a 3 Pokémon !';
    startMessage.style.fontWeight = 'bold';
    startMessage.style.color = '#3498db';
    startMessage.style.fontSize = '16px';
    addBattleLogMessage(startMessage);
    
    // Déterminer qui commence en fonction de la vitesse
    let isPlayer1Turn;
    const speed1 = getActivePokemon1().stats.vit;
    const speed2 = getActivePokemon2().stats.vit;
    if (speed1 > speed2) {
      isPlayer1Turn = true;
    } else if (speed1 < speed2) {
      isPlayer1Turn = false;
    } else {
      isPlayer1Turn = Math.random() > 0.5;
    }
    
		// Supprimer d'éventuels contrôles 3v3 existants pour éviter les doublons
		const existingControls3v3 = document.querySelector('.battle-3v3-controls');
		if (existingControls3v3 && existingControls3v3.parentNode) {
			existingControls3v3.parentNode.removeChild(existingControls3v3);
		}
		// Créer les contrôles de combat
		const controlsContainer = document.createElement('div');
    controlsContainer.className = 'battle-3v3-controls';
    controlsContainer.style.backgroundColor = 'rgba(0,0,0,0.8)';
    controlsContainer.style.padding = '20px';
    controlsContainer.style.borderRadius = '10px';
    controlsContainer.style.marginTop = '20px';
    controlsContainer.style.display = 'flex';
    controlsContainer.style.gap = '10px';
    
    const attackBtn = document.createElement('button');
    attackBtn.textContent = 'Attaque';
    attackBtn.className = 'attack-btn';
    attackBtn.style.padding = '12px 24px';
    attackBtn.style.fontSize = '16px';
    attackBtn.style.cursor = 'pointer';
    
    const stunBtn = document.createElement('button');
    stunBtn.textContent = 'Étourdissement';
    stunBtn.className = 'stun-btn';
    stunBtn.style.padding = '12px 24px';
    stunBtn.style.fontSize = '16px';
    stunBtn.style.cursor = 'pointer';
    
    const healBtn = document.createElement('button');
    healBtn.textContent = 'Régénérer (30%)';
    healBtn.className = 'heal-btn';
    healBtn.style.padding = '12px 24px';
    healBtn.style.fontSize = '16px';
    healBtn.style.cursor = 'pointer';
    
    // Indicateur de tour
    const turnIndicator = document.createElement('div');
    turnIndicator.className = 'turn-indicator-3v3';
    turnIndicator.style.fontSize = '18px';
    turnIndicator.style.fontWeight = 'bold';
    turnIndicator.style.marginBottom = '10px';
    turnIndicator.style.textAlign = 'center';
    
    // Définir le texte initial selon qui commence
    if (isPlayer1Turn) {
      turnIndicator.textContent = '→ Tour du Joueur 1';
      turnIndicator.style.color = '#27ae60';
    } else {
      turnIndicator.textContent = isBot ? '→ Tour du Bot...' : '→ Tour du Joueur 2';
      turnIndicator.style.color = isBot ? '#e74c3c' : '#3498db';
    }
    
    console.log('Indicateur de tour créé:', turnIndicator.textContent, 'isBot:', isBot, 'isPlayer1Turn:', isPlayer1Turn);
    
    controlsContainer.style.flexDirection = 'column';
    controlsContainer.style.alignItems = 'center';
    controlsContainer.appendChild(turnIndicator);
    controlsContainer.appendChild(attackBtn);
    controlsContainer.appendChild(stunBtn);
    controlsContainer.appendChild(healBtn);
    
    // Ajouter les contrôles dans la colonne de droite, en dessous du battle-log
    const rightColumn = document.querySelector('.battle-col.right');
    if (rightColumn) {
      rightColumn.appendChild(controlsContainer);
    } else {
      // Fallback : ajouter au body si la colonne n'existe pas
      document.body.appendChild(controlsContainer);
    }
    
		// Fonction d'attaque adaptée pour le 3v3
    function attack3v3(attacker, defender, playerNumber, isStun = false) {
      const message = document.createElement("p");
      
      if (isStun) {
        const stunChance = Math.floor(attacker.stats.spe_atk * 0.5);
        const isStunSuccessful = Math.random() * 100 <= stunChance;
        
        message.dataset.type = 'stunAttempt';
        message.dataset.attacker = String(attacker.pokedex_id);
        message.dataset.defender = String(defender.pokedex_id);
        message.textContent = `${getDisplayName(attacker)} tente d'étourdir ${getDisplayName(defender)} !`;
        message.style.color = playerNumber === 1 ? "#27ae60" : "#e74c3c";
        addBattleLogMessage(message);
        
        if (isStunSuccessful) {
          const stunMessage = document.createElement("p");
          stunMessage.dataset.type = 'stunResult';
          stunMessage.dataset.success = '1';
          stunMessage.dataset.defender = String(defender.pokedex_id);
          stunMessage.textContent = `🌟 ${getDisplayName(defender)} est étourdi et passe son prochain tour !`;
          stunMessage.style.color = "#f39c12";
          addBattleLogMessage(stunMessage);
          defender.isStunned = true;
        } else {
          const failMessage = document.createElement("p");
          failMessage.dataset.type = 'stunResult';
          failMessage.dataset.success = '0';
          failMessage.textContent = `❌ L'étourdissement a échoué !`;
          failMessage.style.color = "#95a5a6";
          addBattleLogMessage(failMessage);
        }
      } else {
        // Attaque normale
        const effectiveAtk = attacker.stats.atk + Math.round(attacker.stats.spe_atk * 0.35);
        const effectiveDef = defender.stats.def + Math.round(defender.stats.spe_def * 0.25);
        const randomFactor = Math.random() * 0.3 + 0.85;
        const speedFactor = 1 + (attacker.stats.vit - defender.stats.vit) / 200;
        
        let raw = (effectiveAtk - effectiveDef * 0.6);
        if (raw < 1) raw = 1;
        
        let damage = Math.max(1, Math.floor(raw * randomFactor * speedFactor));
        
        const critChance = Math.min(30, Math.max(5, Math.floor(attacker.stats.vit / 3)));
        const isCrit = Math.random() * 100 < critChance;
        if (isCrit) {
          damage = Math.max(1, Math.floor(damage * 1.5));
        }
        
	defender.stats.hp = Math.max(0, defender.stats.hp - damage);
        
        let effectText = '';
        if (isCrit) {
          effectText = '🎯 Coup critique ! ';
        }
        
        message.dataset.type = 'attack';
        message.dataset.attacker = String(attacker.pokedex_id);
        message.dataset.defender = String(defender.pokedex_id);
        message.dataset.damage = String(damage);
        message.textContent = `${getDisplayName(attacker)} attaque → ${getDisplayName(defender)} perd ${damage} PV ! ${effectText}`;
        message.style.color = playerNumber === 1 ? "#27ae60" : "#e74c3c";
				addBattleLogMessage(message);

				// Effets visuels de dégâts côté défenseur (bulles + flash barre de PV)
				try {
					const defenderSide = (playerNumber === 1) ? player2Side : player1Side;
					const activeCard = defenderSide.querySelector('.battle-team-container .battle-team-member[data-active="1"]')
						|| defenderSide.querySelector('.battle-team-container .battle-team-member');
					if (activeCard) {
						// Bulle de dégâts flottante
						const bubble = document.createElement('div');
						bubble.className = 'damage-float';
						bubble.textContent = `-${damage}`;
						activeCard.appendChild(bubble);
						bubble.addEventListener('animationend', () => bubble.remove());
					}
				} catch (e) { /* no-op */ }
      }
      
			updateTeamsDisplay();

			// Après mise à jour, appliquer un flash sur la barre de PV du défenseur
			try {
				const defenderSide2 = (attacker === getActivePokemon1()) ? player2Side : player1Side;
				const hpFillEl = defenderSide2.querySelector('.battle-team-container .battle-team-member[data-active="1"] [data-role="hpfill"]');
				if (hpFillEl) {
					hpFillEl.classList.remove('hp-hit');
					// Force reflow pour relancer l'animation
					// eslint-disable-next-line no-unused-expressions
					hpFillEl.offsetWidth;
					hpFillEl.classList.add('hp-hit');
				}
			} catch (e) { /* no-op */ }
    }
    
    // Fonction pour passer au Pokémon suivant
    function switchToNextPokemon(teamNumber) {
      if (teamNumber === 1) {
        const defeatedPokemon = getActivePokemon1();
        const message = document.createElement('p');
        message.textContent = `☠️ ${getDisplayName(defeatedPokemon)} est K.O. !`;
        message.style.color = '#e74c3c';
        message.style.fontWeight = 'bold';
        addBattleLogMessage(message);
        
	// Chercher le prochain Pokémon vivant
        for (let i = activeIndex1 + 1; i < battleTeam1.length; i++) {
          if (battleTeam1[i].stats.hp > 0) {
            activeIndex1 = i;
            const switchMessage = document.createElement('p');
            switchMessage.textContent = `🔄 ${getDisplayName(battleTeam1[i])} entre en combat !`;
            switchMessage.style.color = '#27ae60';
            switchMessage.style.fontWeight = 'bold';
            addBattleLogMessage(switchMessage);
            updateTeamsDisplay();
            return true;
          }
        }
        return false; // Plus de Pokémon vivants
      } else {
        const defeatedPokemon = getActivePokemon2();
        const message = document.createElement('p');
        message.textContent = `☠️ ${getDisplayName(defeatedPokemon)} est K.O. !`;
        message.style.color = '#e74c3c';
        message.style.fontWeight = 'bold';
        addBattleLogMessage(message);
        
	// Chercher le prochain Pokémon vivant
        for (let i = activeIndex2 + 1; i < battleTeam2.length; i++) {
          if (battleTeam2[i].stats.hp > 0) {
            activeIndex2 = i;
            const switchMessage = document.createElement('p');
            switchMessage.textContent = `🔄 ${getDisplayName(battleTeam2[i])} entre en combat !`;
            switchMessage.style.color = '#e74c3c';
            switchMessage.style.fontWeight = 'bold';
            addBattleLogMessage(switchMessage);
            updateTeamsDisplay();
            return true;
          }
        }
        return false; // Plus de Pokémon vivants
      }
    }
    
    // Vérifier la victoire
    function checkBattleOutcome3v3() {
      if (battleEnded) return true;
      
      const activePokemon1 = getActivePokemon1();
      const activePokemon2 = getActivePokemon2();
      
      // Si le Pokémon actif du joueur 1 meurt
      if (activePokemon1.stats.hp <= 0) {
        const hasNext = switchToNextPokemon(1);
        if (!hasNext) {
          // L'équipe 1 a perdu, l'équipe 2 a gagné
          battleEnded = true;
          if (typeof window !== 'undefined') window.__currentBattle = null;
          
          const victoryMessage = document.createElement('p');
          if (isBot) {
            // Mode Bot : afficher "DÉFAITE" pour le joueur
            victoryMessage.textContent = '💀 DÉFAITE...';
            victoryMessage.style.color = '#e74c3c';
            if (window.audioManager) window.audioManager.play('defeat');
            showBattleResult('defeat', '💀 DÉFAITE...');
          } else {
            // Mode JcJ : afficher la victoire du joueur 2
            victoryMessage.textContent = '🏆 Joueur 2 a gagné le combat 3v3 !';
            victoryMessage.style.color = '#27ae60';
            if (window.audioManager) window.audioManager.play('victory');
            showBattleResult('victory', '🏆 Joueur 2 Gagne !');
          }
          victoryMessage.style.fontWeight = 'bold';
          victoryMessage.style.fontSize = '18px';
          addBattleLogMessage(victoryMessage);
          
          // Désactiver les contrôles
          attackBtn.disabled = true;
          stunBtn.disabled = true;
          healBtn.disabled = true;
          
          // Retirer les contrôles après 3 secondes
          setTimeout(() => {
            if (controlsContainer.parentNode) {
              controlsContainer.parentNode.removeChild(controlsContainer);
            }
          }, 3000);
          
          return true;
        }
      }
      
      // Si le Pokémon actif du joueur 2 meurt
      if (activePokemon2.stats.hp <= 0) {
        const hasNext = switchToNextPokemon(2);
        if (!hasNext) {
          // L'équipe 2 a perdu, l'équipe 1 a gagné
          battleEnded = true;
          if (typeof window !== 'undefined') window.__currentBattle = null;
          
          const victoryMessage = document.createElement('p');
          let overlayMessage;
          if (isBot) {
            // Mode Bot : afficher "VICTOIRE" pour le joueur
            victoryMessage.textContent = '🏆 VICTOIRE !';
            overlayMessage = '🏆 VICTOIRE !';
          } else {
            // Mode JcJ : afficher la victoire du joueur 1
            victoryMessage.textContent = '🏆 Joueur 1 a gagné le combat 3v3 !';
            overlayMessage = '🏆 Joueur 1 Gagne !';
          }
          victoryMessage.style.fontWeight = 'bold';
          victoryMessage.style.color = '#27ae60';
          victoryMessage.style.fontSize = '18px';
          addBattleLogMessage(victoryMessage);
          
          points += isBot ? 200 : 150; // Plus de points pour un 3v3
          pointsDisplay.textContent = points;
          try { updateUpgradeCardsState(); } catch(e) {}
          
          const xpGain = isBot ? 150 : 100;
          gainXP(xpGain);
          try { if (window.saveProgress) window.saveProgress(); } catch(e) {}
          
          if (window.audioManager) window.audioManager.play('victory');
          showBattleResult('victory', overlayMessage);
          
          // Désactiver les contrôles
          attackBtn.disabled = true;
          stunBtn.disabled = true;
          healBtn.disabled = true;
          
          // Retirer les contrôles après 3 secondes
          setTimeout(() => {
            if (controlsContainer.parentNode) {
              controlsContainer.parentNode.removeChild(controlsContainer);
            }
          }, 3000);
          
          return true;
        }
      }
      
      return false;
    }
    
    // Action du bot
    function botAction3v3() {
      const botPokemon = getActivePokemon2();
      const playerPokemon = getActivePokemon1();
      
      const botChoice = Math.random();
      if (botChoice < 0.15 && botPokemon.stats.hp < botPokemon.maxHp) {
        // Régénération
        let baseHeal = Math.ceil(botPokemon.maxHp * 0.3);
        const healAmount = window.healDoubleEnabled ? baseHeal * 2 : baseHeal;
        const before = botPokemon.stats.hp;
        botPokemon.stats.hp = Math.min(botPokemon.maxHp, botPokemon.stats.hp + healAmount);
        const healed = botPokemon.stats.hp - before;
        
        const messageElement = document.createElement('p');
        messageElement.textContent = `${getDisplayName(botPokemon)} (bot) régénère ${healed} PV ! (→ ${botPokemon.stats.hp}/${botPokemon.maxHp})`;
        messageElement.style.color = '#f1c40f';
        addBattleLogMessage(messageElement);
        updateTeamsDisplay();
      } else if (botChoice < 0.35) {
        // Étourdissement
        attack3v3(botPokemon, playerPokemon, 2, true);
      } else {
        // Attaque
        attack3v3(botPokemon, playerPokemon, 2, false);
      }
    }
    
    // Mise à jour des contrôles
    function updateControls3v3() {
      if (checkBattleOutcome3v3()) return;
      
      const activePokemon1 = getActivePokemon1();
      const activePokemon2 = getActivePokemon2();
      
      // Gérer l'étourdissement
      if (activePokemon1.isStunned) {
        activePokemon1.isStunned = false;
        isPlayer1Turn = false;
        
        const stunSkipMessage = document.createElement("p");
        stunSkipMessage.textContent = `😵 ${getDisplayName(activePokemon1)} est étourdi et passe son tour !`;
        stunSkipMessage.style.color = "#95a5a6";
        addBattleLogMessage(stunSkipMessage);
        
        if (isBot && !checkBattleOutcome3v3()) {
          setTimeout(() => {
            if (!battleEnded) {
              botAction3v3();
              isPlayer1Turn = true;
              updateControls3v3();
            }
          }, 1000);
        }
        return;
      }
      
      if (activePokemon2.isStunned) {
        activePokemon2.isStunned = false;
        isPlayer1Turn = true;
        
        const stunSkipMessage = document.createElement("p");
        stunSkipMessage.textContent = `😵 ${getDisplayName(activePokemon2)} est étourdi et passe son tour !`;
        stunSkipMessage.style.color = "#95a5a6";
        addBattleLogMessage(stunSkipMessage);
      }
      
      // Mettre à jour l'indicateur de tour
      const turnIndicatorEl = document.querySelector('.turn-indicator-3v3');
      if (turnIndicatorEl) {
        if (isPlayer1Turn) {
          turnIndicatorEl.textContent = '→ Tour du Joueur 1';
          turnIndicatorEl.style.color = '#27ae60';
        } else {
          turnIndicatorEl.textContent = isBot ? '→ Tour du Bot...' : '→ Tour du Joueur 2';
          turnIndicatorEl.style.color = isBot ? '#e74c3c' : '#3498db';
        }
        console.log('Indicateur mis à jour:', turnIndicatorEl.textContent);
      } else {
        console.warn('Indicateur de tour non trouvé !');
      }
      
      // Activer/désactiver les boutons selon le joueur actif
      if (isPlayer1Turn) {
        attackBtn.disabled = activePokemon1.stats.hp <= 0;
        stunBtn.disabled = activePokemon1.stats.hp <= 0;
        healBtn.disabled = activePokemon1.stats.hp <= 0 || activePokemon1.stats.hp >= activePokemon1.maxHp;
      } else {
        // En mode JcJ, permettre au joueur 2 de jouer
        if (!isBot) {
          attackBtn.disabled = activePokemon2.stats.hp <= 0;
          stunBtn.disabled = activePokemon2.stats.hp <= 0;
          healBtn.disabled = activePokemon2.stats.hp <= 0 || activePokemon2.stats.hp >= activePokemon2.maxHp;
        } else {
          // En mode Bot, désactiver les boutons pendant le tour du bot
          attackBtn.disabled = true;
          stunBtn.disabled = true;
          healBtn.disabled = true;
        }
      }
      
      if (!checkBattleOutcome3v3()) {
        const currentPlayer = isPlayer1Turn ? getDisplayName(activePokemon1) : (isBot ? getDisplayName(activePokemon2) : "Joueur 2");
        const turnMessage = document.createElement("p");
        turnMessage.textContent = `→ C'est au tour de ${currentPlayer}`;
        turnMessage.style.fontWeight = "bold";
        turnMessage.style.color = "#3498db";
        addBattleLogMessage(turnMessage);
      }
    }
    
    // Configuration des boutons d'action
    attackBtn.onclick = () => {
      if (battleEnded) return;
      
      // Joueur 1 attaque
      if (isPlayer1Turn) {
        const attacker = getActivePokemon1();
        const defender = getActivePokemon2();
        
        // Vérifier que l'attaquant est vivant
        if (attacker.stats.hp <= 0) {
          console.warn("Pokémon mort ne peut pas attaquer");
          return;
        }
        
        attack3v3(attacker, defender, 1, false);
        if (checkBattleOutcome3v3()) return;
        isPlayer1Turn = false;
        
        if (isBot && !checkBattleOutcome3v3()) {
          // Mettre à jour l'affichage pour montrer "Tour du Bot"
          updateControls3v3();
          
          setTimeout(() => {
            if (!battleEnded && !checkBattleOutcome3v3()) {
              botAction3v3();
              if (checkBattleOutcome3v3()) return;
              isPlayer1Turn = true;
              updateControls3v3();
            }
          }, 1000);
        } else {
          updateControls3v3();
        }
      }
      // Joueur 2 attaque (mode JcJ)
      else if (!isBot) {
        const attacker = getActivePokemon2();
        const defender = getActivePokemon1();
        
        // Vérifier que l'attaquant est vivant
        if (attacker.stats.hp <= 0) {
          console.warn("Pokémon mort ne peut pas attaquer");
          return;
        }
        
        attack3v3(attacker, defender, 2, false);
        if (checkBattleOutcome3v3()) return;
        isPlayer1Turn = true;
        updateControls3v3();
      }
    };
    
    stunBtn.onclick = () => {
      if (battleEnded) return;
      
      // Joueur 1 étourdit
      if (isPlayer1Turn) {
        const attacker = getActivePokemon1();
        const defender = getActivePokemon2();
        
        // Vérifier que l'attaquant est vivant
        if (attacker.stats.hp <= 0) {
          console.warn("Pokémon mort ne peut pas étourdir");
          return;
        }
        
        attack3v3(attacker, defender, 1, true);
        if (checkBattleOutcome3v3()) return;
        isPlayer1Turn = false;
        
        if (isBot && !checkBattleOutcome3v3()) {
          // Mettre à jour l'affichage pour montrer "Tour du Bot"
          updateControls3v3();
          
          setTimeout(() => {
            if (!battleEnded && !checkBattleOutcome3v3()) {
              botAction3v3();
              if (checkBattleOutcome3v3()) return;
              isPlayer1Turn = true;
              updateControls3v3();
            }
          }, 1000);
        } else {
          updateControls3v3();
        }
      }
      // Joueur 2 étourdit (mode JcJ)
      else if (!isBot) {
        const attacker = getActivePokemon2();
        const defender = getActivePokemon1();
        
        // Vérifier que l'attaquant est vivant
        if (attacker.stats.hp <= 0) {
          console.warn("Pokémon mort ne peut pas étourdir");
          return;
        }
        
        attack3v3(attacker, defender, 2, true);
        if (checkBattleOutcome3v3()) return;
        isPlayer1Turn = true;
        updateControls3v3();
      }
    };
    
    healBtn.onclick = () => {
      if (battleEnded) return;
      
      // Joueur 1 régénère
      if (isPlayer1Turn) {
        const activePokemon = getActivePokemon1();
        
        // Vérifier que le Pokémon est vivant
        if (activePokemon.stats.hp <= 0) {
          console.warn("Pokémon mort ne peut pas se régénérer");
          return;
        }
        
        let baseHeal = Math.ceil(activePokemon.maxHp * 0.3);
        const healAmount = window.healDoubleEnabled ? baseHeal * 2 : baseHeal;
        const before = activePokemon.stats.hp;
        activePokemon.stats.hp = Math.min(activePokemon.maxHp, activePokemon.stats.hp + healAmount);
        const healed = activePokemon.stats.hp - before;
        
        const messageElement = document.createElement('p');
        messageElement.textContent = `${getDisplayName(activePokemon)} régénère ${healed} PV ! (→ ${activePokemon.stats.hp}/${activePokemon.maxHp})`;
        messageElement.style.color = '#f1c40f';
        addBattleLogMessage(messageElement);
        updateTeamsDisplay();
        
        isPlayer1Turn = false;
        
        if (isBot && !checkBattleOutcome3v3()) {
          // Mettre à jour l'affichage pour montrer "Tour du Bot"
          updateControls3v3();
          
          setTimeout(() => {
            if (!battleEnded && !checkBattleOutcome3v3()) {
              botAction3v3();
              if (checkBattleOutcome3v3()) return;
              isPlayer1Turn = true;
              updateControls3v3();
            }
          }, 1000);
        } else {
          updateControls3v3();
        }
      }
      // Joueur 2 régénère (mode JcJ)
      else if (!isBot) {
        const activePokemon = getActivePokemon2();
        
        // Vérifier que le Pokémon est vivant
        if (activePokemon.stats.hp <= 0) {
          console.warn("Pokémon mort ne peut pas se régénérer");
          return;
        }
        
        let baseHeal = Math.ceil(activePokemon.maxHp * 0.3);
        const healAmount = window.healDoubleEnabled ? baseHeal * 2 : baseHeal;
        const before = activePokemon.stats.hp;
        activePokemon.stats.hp = Math.min(activePokemon.maxHp, activePokemon.stats.hp + healAmount);
        const healed = activePokemon.stats.hp - before;
        
        const messageElement = document.createElement('p');
        messageElement.textContent = `${getDisplayName(activePokemon)} régénère ${healed} PV ! (→ ${activePokemon.stats.hp}/${activePokemon.maxHp})`;
        messageElement.style.color = '#f1c40f';
        addBattleLogMessage(messageElement);
        updateTeamsDisplay();
        
        isPlayer1Turn = true;
        updateControls3v3();
      }
    };
    
    // Initialiser le combat
    updateControls3v3();
    
    // Si le bot commence, le faire jouer
    if (isBot && !isPlayer1Turn && !checkBattleOutcome3v3()) {
      setTimeout(() => {
        if (!battleEnded) {
          botAction3v3();
          if (checkBattleOutcome3v3()) return;
          isPlayer1Turn = true;
          updateControls3v3();
        }
      }, 1000);
    }
  }



  // Ajout d'un log pour débugger
  console.log("Clique fonctionnel");
  
  startBattleBtn.addEventListener("click", function() {
    console.log("Battle button clicked - 3v3 Mode");
    
    // Récupérer les 3 Pokémon du joueur 1
    const team1 = [];
    for (let i = 0; i < 3; i++) {
      const pKey = parseInt(player1Selects[i].value, 10);
      const pokemon = pokemons.find(p => p.pokedex_id === pKey);
      if (!pokemon) {
        alert(`Joueur 1 : Veuillez sélectionner un Pokémon pour le slot ${i + 1} !`);
        return;
      }
      team1.push(pokemon);
    }
    
    // Vérifier qu'il n'y a pas de doublons dans l'équipe 1
    const team1Ids = team1.map(p => p.pokedex_id);
    if (new Set(team1Ids).size !== team1Ids.length) {
      alert("Joueur 1 : Vous ne pouvez pas sélectionner le même Pokémon plusieurs fois !");
      return;
    }
    
    let team2 = [];
    if (isPlayerVsPlayer) {
      // Mode JcJ - Récupérer les 3 Pokémon du joueur 2
      for (let i = 0; i < 3; i++) {
        const pKey = parseInt(player2Selects[i].value, 10);
        const pokemon = pokemons.find(p => p.pokedex_id === pKey);
        if (!pokemon) {
          alert(`Joueur 2 : Veuillez sélectionner un Pokémon pour le slot ${i + 1} !`);
          return;
        }
        team2.push(pokemon);
      }
      
      // Vérifier qu'il n'y a pas de doublons dans l'équipe 2
      const team2Ids = team2.map(p => p.pokedex_id);
      if (new Set(team2Ids).size !== team2Ids.length) {
        alert("Joueur 2 : Vous ne pouvez pas sélectionner le même Pokémon plusieurs fois !");
        return;
      }
      
      startBattle3v3(team1, team2, false);
    } else {
      // Mode JcBot - Générer 3 Pokémon aléatoires pour le bot
      for (let i = 0; i < 3; i++) {
        team2.push(selectRandomBotPokemon());
      }
      startBattle3v3(team1, team2, true);
    }
  });

  // S'assurer que tout est initialisé dans le bon ordre
  updatePokemonSelection();
  
  // Il y avait un doublon d'event listener, nous le supprimons

  // Actualiser la sélection après chaque booster
  document.addEventListener("inventoryUpdated", updatePokemonSelection);
	document.addEventListener("inventoryUpdated", () => { try { if (window.saveProgress) window.saveProgress(); } catch(e) {} });
	// Bouton de réinitialisation (haut droite)
	(function addResetButton(){
		const btn = document.createElement('button');
		btn.textContent = 'Réinitialiser';
		btn.title = 'Réinitialiser la progression';
		btn.type = 'button';
		btn.style.position = 'fixed';
		btn.style.bottom = '8px';
		btn.style.right = '8px';
		btn.style.zIndex = '9999';
		btn.style.padding = '6px 10px';
		btn.style.fontSize = '11px';
		btn.style.borderRadius = '6px';
		btn.style.background = 'rgba(0,0,0,0.55)';
		btn.style.color = '#fff';
		btn.style.border = '1px solid rgba(255,255,255,0.25)';
		btn.style.cursor = 'pointer';
		btn.style.backdropFilter = 'blur(4px)';
		btn.addEventListener('click', () => {
			if (!confirm('Confirmer la réinitialisation de toute la progression ?')) return;
			// Supprimer uniquement notre sauvegarde
			try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}
			// Utiliser la fonction interne plus fiable (scope DOMContentLoaded)
			try { if (typeof window.__internalReset === 'function') window.__internalReset(); } catch(e) { console.warn('internalReset failed', e); }
			// Feedback visuel simple
			try {
				const note = document.createElement('div');
				note.textContent = 'Progression réinitialisée';
				note.style.position = 'fixed';
				note.style.bottom = '48px';
				note.style.right = '12px';
				note.style.padding = '8px 14px';
				note.style.background = 'linear-gradient(135deg,#8b45b3,#3498db)';
				note.style.color = '#fff';
				note.style.fontSize = '13px';
				note.style.fontWeight = '600';
				note.style.borderRadius = '10px';
				note.style.boxShadow = '0 4px 18px rgba(0,0,0,0.4)';
				note.style.zIndex = '9999';
				document.body.appendChild(note);
				setTimeout(()=>{ note.style.opacity='0'; note.style.transition='opacity .6s'; }, 2000);
				setTimeout(()=>{ try { note.remove(); } catch(e) {} }, 2700);
			} catch(e) {}
		});
		document.body.appendChild(btn);
	})();
}

const pokemons = [
	{
		pokedex_id: 1,
		name: {
			fr: 'Bulbizarre',
			en: 'Bulbasaur',
			jp: 'フシギダネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 45,
			atk: 49,
			def: 49,
			spe_atk: 65,
			spe_def: 65,
			vit: 45,
		},
		category: 'Pokémon Graine',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 2,
		name: {
			fr: 'Herbizarre',
			en: 'Ivysaur',
			jp: 'フシギソウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/2/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/2/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 62,
			def: 63,
			spe_atk: 80,
			spe_def: 80,
			vit: 60,
		},
		category: 'Pokémon Graine',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 3,
		name: {
			fr: 'Florizarre',
			en: 'Venusaur',
			jp: 'フシギバナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/3/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/3/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/3/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/3/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 82,
			def: 83,
			spe_atk: 100,
			spe_def: 100,
			vit: 80,
		},
		category: 'Pokémon Graine',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 4,
		name: {
			fr: 'Salamèche',
			en: 'Charmander',
			jp: 'ヒトカゲ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/4/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/4/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 39,
			atk: 52,
			def: 43,
			spe_atk: 60,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Lézard',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 5,
		name: {
			fr: 'Reptincel',
			en: 'Charmeleon',
			jp: 'リザード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/5/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/5/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 58,
			atk: 64,
			def: 58,
			spe_atk: 80,
			spe_def: 65,
			vit: 80,
		},
		category: 'Pokémon Flamme',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 6,
		name: {
			fr: 'Dracaufeu',
			en: 'Charizard',
			jp: 'リザードン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/6/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/6/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/6/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/6/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 78,
			atk: 84,
			def: 78,
			spe_atk: 109,
			spe_def: 85,
			vit: 100,
		},
		category: 'Pokémon Flamme',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 7,
		name: {
			fr: 'Carapuce',
			en: 'Squirtle',
			jp: 'ゼニガメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/7/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/7/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 44,
			atk: 48,
			def: 65,
			spe_atk: 50,
			spe_def: 64,
			vit: 43,
		},
		category: 'Pokémon Minitortue',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 8,
		name: {
			fr: 'Carabaffe',
			en: 'Wartortle',
			jp: 'カメール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/8/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/8/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 59,
			atk: 63,
			def: 80,
			spe_atk: 65,
			spe_def: 80,
			vit: 58,
		},
		category: 'Pokémon Tortue',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 9,
		name: {
			fr: 'Tortank',
			en: 'Blastoise',
			jp: 'カメックス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/9/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/9/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/9/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/9/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 79,
			atk: 83,
			def: 100,
			spe_atk: 85,
			spe_def: 105,
			vit: 78,
		},
		category: 'Pokémon Carapace',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 10,
		name: {
			fr: 'Chenipan',
			en: 'Caterpie',
			jp: 'キャタピー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/10/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/10/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 45,
			atk: 30,
			def: 35,
			spe_atk: 20,
			spe_def: 20,
			vit: 45,
		},
		category: 'Pokémon Ver',
		generation: 1,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 11,
		name: {
			fr: 'Chrysacier',
			en: 'Metapod',
			jp: 'トランセル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/11/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/11/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 20,
			def: 55,
			spe_atk: 25,
			spe_def: 25,
			vit: 30,
		},
		category: 'Pokémon Cocon',
		generation: 1,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 12,
		name: {
			fr: 'Papilusion',
			en: 'Butterfree',
			jp: 'バタフリー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/12/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/12/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/12/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/12/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 45,
			def: 50,
			spe_atk: 90,
			spe_def: 80,
			vit: 70,
		},
		category: 'Pokémon Papillon',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 13,
		name: {
			fr: 'Aspicot',
			en: 'Weedle',
			jp: 'ビードル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/13/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/13/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 35,
			def: 30,
			spe_atk: 20,
			spe_def: 20,
			vit: 50,
		},
		category: 'Pokémon Insectopic',
		generation: 1,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 14,
		name: {
			fr: 'Coconfort',
			en: 'Kakuna',
			jp: 'コクーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/14/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/14/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 45,
			atk: 25,
			def: 50,
			spe_atk: 25,
			spe_def: 25,
			vit: 35,
		},
		category: 'Pokémon Cocon',
		generation: 1,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 15,
		name: {
			fr: 'Dardargnan',
			en: 'Beedrill',
			jp: 'スピアー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/15/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/15/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 65,
			atk: 90,
			def: 40,
			spe_atk: 45,
			spe_def: 80,
			vit: 75,
		},
		category: 'Pokémon Guêpoison',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 16,
		name: {
			fr: 'Roucool',
			en: 'Pidgey',
			jp: 'ポッポ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/16/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/16/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 40,
			spe_atk: 35,
			spe_def: 35,
			vit: 56,
		},
		category: 'Pokémon Minoiseau',
		generation: 1,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 17,
		name: {
			fr: 'Roucoups',
			en: 'Pidgeotto',
			jp: 'ピジョン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/17/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/17/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 63,
			atk: 60,
			def: 55,
			spe_atk: 50,
			spe_def: 50,
			vit: 71,
		},
		category: 'Pokémon Oiseau',
		generation: 1,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 18,
		name: {
			fr: 'Roucarnage',
			en: 'Pidgeot',
			jp: 'ピジョット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/18/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/18/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 83,
			atk: 80,
			def: 75,
			spe_atk: 70,
			spe_def: 70,
			vit: 101,
		},
		category: 'Pokémon Oiseau',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 19,
		name: {
			fr: 'Rattata',
			en: 'Rattata',
			jp: 'コラッタ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/19/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/19/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 30,
			atk: 56,
			def: 35,
			spe_atk: 25,
			spe_def: 35,
			vit: 72,
		},
		category: 'Pokémon Souris',
		generation: 1,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 20,
		name: {
			fr: 'Rattatac',
			en: 'Raticate',
			jp: 'ラッタ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/20/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/20/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 55,
			atk: 81,
			def: 60,
			spe_atk: 50,
			spe_def: 70,
			vit: 97,
		},
		category: 'Pokémon Souris',
		generation: 1,
		catch_rate: 127,
		rareté: 1,
	},
	{
		pokedex_id: 21,
		name: {
			fr: 'Piafabec',
			en: 'Spearow',
			jp: 'オニスズメ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/21/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/21/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 60,
			def: 30,
			spe_atk: 31,
			spe_def: 31,
			vit: 70,
		},
		category: 'Pokémon Minoiseau',
		generation: 1,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 22,
		name: {
			fr: 'Rapasdepic',
			en: 'Fearow',
			jp: 'オニドリル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/22/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/22/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 65,
			atk: 90,
			def: 65,
			spe_atk: 61,
			spe_def: 61,
			vit: 100,
		},
		category: 'Pokémon Bec-Oiseau',
		generation: 1,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 23,
		name: {
			fr: 'Abo',
			en: 'Ekans',
			jp: 'アーボ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/23/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/23/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 35,
			atk: 60,
			def: 44,
			spe_atk: 40,
			spe_def: 54,
			vit: 55,
		},
		category: 'Pokémon Serpent',
		generation: 1,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 24,
		name: {
			fr: 'Arbok',
			en: 'Arbok',
			jp: 'アーボック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/24/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/24/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 95,
			def: 69,
			spe_atk: 65,
			spe_def: 79,
			vit: 80,
		},
		category: 'Pokémon Cobra',
		generation: 1,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 25,
		name: {
			fr: 'Pikachu',
			en: 'Pikachu',
			jp: 'ピカチュウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/25/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/25/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/25/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/25/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 45,
			atk: 80,
			def: 50,
			spe_atk: 75,
			spe_def: 60,
			vit: 120,
		},
		category: 'Pokémon Souris',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 26,
		name: {
			fr: 'Raichu',
			en: 'Raichu',
			jp: 'ライチュウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/26/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/26/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 60,
			atk: 90,
			def: 55,
			spe_atk: 90,
			spe_def: 80,
			vit: 110,
		},
		category: 'Pokémon Souris',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 27,
		name: {
			fr: 'Sabelette',
			en: 'Sandshrew',
			jp: 'サンド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/27/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/27/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 50,
			atk: 75,
			def: 85,
			spe_atk: 20,
			spe_def: 30,
			vit: 40,
		},
		category: 'Pokémon Souris',
		generation: 1,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 28,
		name: {
			fr: 'Sablaireau',
			en: 'Sandslash',
			jp: 'サンドパン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/28/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/28/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 100,
			def: 110,
			spe_atk: 45,
			spe_def: 55,
			vit: 65,
		},
		category: 'Pokémon Souris',
		generation: 1,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 29,
		name: {
			fr: 'Nidoran♀',
			en: 'Nidoran♀',
			jp: 'ニドラン♀',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/29/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/29/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 55,
			atk: 47,
			def: 52,
			spe_atk: 40,
			spe_def: 40,
			vit: 41,
		},
		category: 'Pokémon Vénépic',
		generation: 1,
		catch_rate: 235,
		rareté: 2,
	},
	{
		pokedex_id: 30,
		name: {
			fr: 'Nidorina',
			en: 'Nidorina',
			jp: 'ニドリーナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/30/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/30/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 70,
			atk: 62,
			def: 67,
			spe_atk: 55,
			spe_def: 55,
			vit: 56,
		},
		category: 'Pokémon Vénépic',
		generation: 1,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 31,
		name: {
			fr: 'Nidoqueen',
			en: 'Nidoqueen',
			jp: 'ニドリーナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/31/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/31/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 92,
			def: 87,
			spe_atk: 75,
			spe_def: 85,
			vit: 76,
		},
		category: 'Pokémon Perceur',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 32,
		name: {
			fr: 'Nidoran♂',
			en: 'Nidoran♂',
			jp: 'ニドラン♂',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/32/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/32/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 46,
			atk: 57,
			def: 40,
			spe_atk: 40,
			spe_def: 40,
			vit: 50,
		},
		category: 'Pokémon Vénépic',
		generation: 1,
		catch_rate: 235,
		rareté: 2,
	},
	{
		pokedex_id: 33,
		name: {
			fr: 'Nidorino',
			en: 'Nidorino',
			jp: 'ニドリーノ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/33/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/33/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 61,
			atk: 72,
			def: 57,
			spe_atk: 55,
			spe_def: 55,
			vit: 65,
		},
		category: 'Pokémon Vénépic',
		generation: 1,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 34,
		name: {
			fr: 'Nidoking',
			en: 'Nidoking',
			jp: 'ニドキング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/34/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/34/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 81,
			atk: 102,
			def: 77,
			spe_atk: 85,
			spe_def: 75,
			vit: 85,
		},
		category: 'Pokémon Perceur',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 35,
		name: {
			fr: 'Mélofée',
			en: 'Clefairy',
			jp: 'ピッピ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/35/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/35/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 70,
			atk: 45,
			def: 48,
			spe_atk: 60,
			spe_def: 65,
			vit: 35,
		},
		category: 'Pokémon Fée',
		generation: 1,
		catch_rate: 150,
		rareté: 3,
	},
	{
		pokedex_id: 36,
		name: {
			fr: 'Mélodelfe',
			en: 'Clefable',
			jp: 'ピクシー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/36/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/36/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 95,
			atk: 70,
			def: 73,
			spe_atk: 95,
			spe_def: 90,
			vit: 60,
		},
		category: 'Pokémon Fée',
		generation: 1,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 37,
		name: {
			fr: 'Goupix',
			en: 'Vulpix',
			jp: 'ロコン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/37/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/37/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 38,
			atk: 41,
			def: 40,
			spe_atk: 50,
			spe_def: 65,
			vit: 65,
		},
		category: 'Pokémon Renard',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 38,
		name: {
			fr: 'Feunard',
			en: 'Ninetales',
			jp: 'キュウコン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/38/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/38/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 73,
			atk: 76,
			def: 75,
			spe_atk: 81,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Renard',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 39,
		name: {
			fr: 'Rondoudou',
			en: 'Jigglypuff',
			jp: 'プリン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/39/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/39/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 115,
			atk: 45,
			def: 20,
			spe_atk: 45,
			spe_def: 25,
			vit: 20,
		},
		category: 'Pokémon Bouboule',
		generation: 1,
		catch_rate: 170,
		rareté: 3,
	},
	{
		pokedex_id: 40,
		name: {
			fr: 'Grodoudou',
			en: 'Wigglytuff',
			jp: 'プクリン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/40/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/40/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 140,
			atk: 70,
			def: 45,
			spe_atk: 85,
			spe_def: 50,
			vit: 45,
		},
		category: 'Pokémon Bouboule',
		generation: 1,
		catch_rate: 50,
		rareté: 1,
	},
	{
		pokedex_id: 41,
		name: {
			fr: 'Nosferapti',
			en: 'Zubat',
			jp: 'ズバット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/41/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/41/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 35,
			spe_atk: 30,
			spe_def: 40,
			vit: 55,
		},
		category: 'Pokémon Chovsouris',
		generation: 1,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 42,
		name: {
			fr: 'Nosferalto',
			en: 'Golbat',
			jp: 'ゴルバット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/42/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/42/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 80,
			def: 70,
			spe_atk: 65,
			spe_def: 75,
			vit: 90,
		},
		category: 'Pokémon Chovsouris',
		generation: 1,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 43,
		name: {
			fr: 'Mystherbe',
			en: 'Oddish',
			jp: 'ナゾノクサ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/43/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/43/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 45,
			atk: 50,
			def: 55,
			spe_atk: 75,
			spe_def: 65,
			vit: 30,
		},
		category: 'Pokémon Racine',
		generation: 1,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 44,
		name: {
			fr: 'Ortide',
			en: 'Gloom',
			jp: 'クサイハナ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/44/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/44/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 65,
			def: 70,
			spe_atk: 85,
			spe_def: 75,
			vit: 40,
		},
		category: 'Pokémon Racine',
		generation: 1,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 45,
		name: {
			fr: 'Rafflesia',
			en: 'Vileplume',
			jp: 'ラフレシア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/45/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/45/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 75,
			atk: 80,
			def: 85,
			spe_atk: 110,
			spe_def: 90,
			vit: 50,
		},
		category: 'Pokémon Fleur',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 46,
		name: {
			fr: 'Paras',
			en: 'Paras',
			jp: 'パラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/46/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/46/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 35,
			atk: 70,
			def: 55,
			spe_atk: 45,
			spe_def: 55,
			vit: 25,
		},
		category: 'Pokémon Champignon',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 47,
		name: {
			fr: 'Parasect',
			en: 'Parasect',
			jp: 'パラセクト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/47/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/47/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 95,
			def: 80,
			spe_atk: 60,
			spe_def: 80,
			vit: 30,
		},
		category: 'Pokémon Champignon',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 48,
		name: {
			fr: 'Mimitoss',
			en: 'Venonat',
			jp: 'コンパン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/48/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/48/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 55,
			def: 50,
			spe_atk: 40,
			spe_def: 55,
			vit: 45,
		},
		category: 'Pokémon Vermine',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 49,
		name: {
			fr: 'Aéromite',
			en: 'Venomoth',
			jp: 'モルフォン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/49/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/49/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 70,
			atk: 65,
			def: 60,
			spe_atk: 90,
			spe_def: 75,
			vit: 90,
		},
		category: 'Pokémon Papipoison',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 50,
		name: {
			fr: 'Taupiqueur',
			en: 'Diglett',
			jp: 'ディグダ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/50/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/50/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 10,
			atk: 55,
			def: 25,
			spe_atk: 35,
			spe_def: 45,
			vit: 95,
		},
		category: 'Pokémon Taupe',
		generation: 1,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 51,
		name: {
			fr: 'Triopikeur',
			en: 'Dugtrio',
			jp: 'ダグトリオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/51/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/51/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 35,
			atk: 100,
			def: 50,
			spe_atk: 50,
			spe_def: 70,
			vit: 120,
		},
		category: 'Pokémon Taupe',
		generation: 1,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 52,
		name: {
			fr: 'Miaouss',
			en: 'Meowth',
			jp: 'ニャース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/52/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/52/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/52/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/52/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 35,
			spe_atk: 40,
			spe_def: 40,
			vit: 90,
		},
		category: 'Pokémon Chadégout',
		generation: 1,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 53,
		name: {
			fr: 'Persian',
			en: 'Persian',
			jp: 'ペルシアン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/53/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/53/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 65,
			atk: 70,
			def: 60,
			spe_atk: 65,
			spe_def: 65,
			vit: 115,
		},
		category: 'Pokémon Chadeville',
		generation: 1,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 54,
		name: {
			fr: 'Psykokwak',
			en: 'Psyduck',
			jp: 'コダック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/54/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/54/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 52,
			def: 48,
			spe_atk: 65,
			spe_def: 50,
			vit: 55,
		},
		category: 'Pokémon Canard',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 55,
		name: {
			fr: 'Akwakwak',
			en: 'Golduck',
			jp: 'ゴルダック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/55/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/55/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 80,
			atk: 82,
			def: 78,
			spe_atk: 95,
			spe_def: 80,
			vit: 85,
		},
		category: 'Pokémon Canard',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 56,
		name: {
			fr: 'Férosinge',
			en: 'Mankey',
			jp: 'マンキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/56/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/56/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 40,
			atk: 80,
			def: 35,
			spe_atk: 35,
			spe_def: 45,
			vit: 70,
		},
		category: 'Pokémon Porsinge',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 57,
		name: {
			fr: 'Colossinge',
			en: 'Primeape',
			jp: 'オコリザル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/57/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/57/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 65,
			atk: 105,
			def: 60,
			spe_atk: 60,
			spe_def: 70,
			vit: 95,
		},
		category: 'Pokémon Porsinge',
		generation: 1,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 58,
		name: {
			fr: 'Caninos',
			en: 'Growlithe',
			jp: 'ガーディ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/58/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/58/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 55,
			atk: 70,
			def: 45,
			spe_atk: 70,
			spe_def: 50,
			vit: 60,
		},
		category: 'Pokémon Chiot',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 59,
		name: {
			fr: 'Arcanin',
			en: 'Arcanine',
			jp: 'ウインディ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/59/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/59/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 90,
			atk: 110,
			def: 80,
			spe_atk: 100,
			spe_def: 80,
			vit: 95,
		},
		category: 'Pokémon Légendaire',
		generation: 1,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 60,
		name: {
			fr: 'Ptitard',
			en: 'Poliwag',
			jp: 'ニョロモ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/60/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/60/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 40,
			atk: 50,
			def: 40,
			spe_atk: 40,
			spe_def: 40,
			vit: 90,
		},
		category: 'Pokémon Têtard',
		generation: 1,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 61,
		name: {
			fr: 'Têtarte',
			en: 'Poliwhirl',
			jp: 'ニョロゾ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/61/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/61/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 65,
			atk: 65,
			def: 65,
			spe_atk: 50,
			spe_def: 50,
			vit: 90,
		},
		category: 'Pokémon Têtard',
		generation: 1,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 62,
		name: {
			fr: 'Tartard',
			en: 'Poliwrath',
			jp: 'ニョロボン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/62/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/62/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 90,
			atk: 95,
			def: 95,
			spe_atk: 70,
			spe_def: 90,
			vit: 70,
		},
		category: 'Pokémon Têtard',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 63,
		name: {
			fr: 'Abra',
			en: 'Abra',
			jp: 'ケーシィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/63/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/63/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 25,
			atk: 20,
			def: 15,
			spe_atk: 105,
			spe_def: 55,
			vit: 90,
		},
		category: 'Pokémon Psy',
		generation: 1,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 64,
		name: {
			fr: 'Kadabra',
			en: 'Kadabra',
			jp: 'ユンゲラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/64/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/64/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 40,
			atk: 35,
			def: 30,
			spe_atk: 120,
			spe_def: 70,
			vit: 105,
		},
		category: 'Pokémon Psy',
		generation: 1,
		catch_rate: 100,
		rareté: 3,
	},
	{
		pokedex_id: 65,
		name: {
			fr: 'Alakazam',
			en: 'Alakazam',
			jp: 'フーディン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/65/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/65/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 55,
			atk: 50,
			def: 45,
			spe_atk: 135,
			spe_def: 95,
			vit: 120,
		},
		category: 'Pokémon Psy',
		generation: 1,
		catch_rate: 50,
		rareté: 1,
	},
	{
		pokedex_id: 66,
		name: {
			fr: 'Machoc',
			en: 'Machop',
			jp: 'ワンリキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/66/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/66/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 70,
			atk: 80,
			def: 50,
			spe_atk: 35,
			spe_def: 35,
			vit: 35,
		},
		category: 'Pokémon Colosse',
		generation: 1,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 67,
		name: {
			fr: 'Machopeur',
			en: 'Machoke',
			jp: 'ゴーリキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/67/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/67/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 80,
			atk: 100,
			def: 70,
			spe_atk: 50,
			spe_def: 60,
			vit: 45,
		},
		category: 'Pokémon Colosse',
		generation: 1,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 68,
		name: {
			fr: 'Mackogneur',
			en: 'Machamp',
			jp: 'カイリキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/68/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/68/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/68/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/68/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 90,
			atk: 130,
			def: 80,
			spe_atk: 65,
			spe_def: 85,
			vit: 55,
		},
		category: 'Pokémon Colosse',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 69,
		name: {
			fr: 'Chétiflor',
			en: 'Bellsprout',
			jp: 'マダツボミ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/69/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/69/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 50,
			atk: 75,
			def: 35,
			spe_atk: 70,
			spe_def: 30,
			vit: 40,
		},
		category: 'Pokémon Fleur',
		generation: 1,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 70,
		name: {
			fr: 'Boustiflor',
			en: 'Weepinbell',
			jp: 'ウツドン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/70/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/70/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 65,
			atk: 90,
			def: 50,
			spe_atk: 85,
			spe_def: 45,
			vit: 55,
		},
		category: 'Pokémon Carnivore',
		generation: 1,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 71,
		name: {
			fr: 'Empiflor',
			en: 'Victreebel',
			jp: 'ウツボット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/71/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/71/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 105,
			def: 65,
			spe_atk: 100,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Carnivore',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 72,
		name: {
			fr: 'Tentacool',
			en: 'Tentacool',
			jp: 'メノクラゲ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/72/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/72/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 35,
			spe_atk: 50,
			spe_def: 100,
			vit: 70,
		},
		category: 'Pokémon Mollusque',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 73,
		name: {
			fr: 'Tentacruel',
			en: 'Tentacruel',
			jp: 'ドククラゲ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/73/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/73/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 70,
			def: 65,
			spe_atk: 80,
			spe_def: 120,
			vit: 100,
		},
		category: 'Pokémon Mollusque',
		generation: 1,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 74,
		name: {
			fr: 'Racaillou',
			en: 'Geodude',
			jp: 'イシツブテ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/74/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/74/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 80,
			def: 100,
			spe_atk: 30,
			spe_def: 30,
			vit: 20,
		},
		category: 'Pokémon Roche',
		generation: 1,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 75,
		name: {
			fr: 'Gravalanch',
			en: 'Graveler',
			jp: 'ゴローン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/75/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/75/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 95,
			def: 115,
			spe_atk: 45,
			spe_def: 45,
			vit: 35,
		},
		category: 'Pokémon Roche',
		generation: 1,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 76,
		name: {
			fr: 'Grolem',
			en: 'Golem',
			jp: 'ゴローニャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/76/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/76/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 130,
			spe_atk: 55,
			spe_def: 65,
			vit: 45,
		},
		category: 'Pokémon Titanesque',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 77,
		name: {
			fr: 'Ponyta',
			en: 'Ponyta',
			jp: 'ポニータ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/77/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/77/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 50,
			atk: 85,
			def: 55,
			spe_atk: 65,
			spe_def: 65,
			vit: 90,
		},
		category: 'Pokémon Cheval Feu',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 78,
		name: {
			fr: 'Galopa',
			en: 'Rapidash',
			jp: 'ギャロップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/78/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/78/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 100,
			def: 70,
			spe_atk: 80,
			spe_def: 80,
			vit: 105,
		},
		category: 'Pokémon Cheval Feu',
		generation: 1,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 79,
		name: {
			fr: 'Ramoloss',
			en: 'Slowpoke',
			jp: 'ヤドン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/79/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/79/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 65,
			def: 65,
			spe_atk: 40,
			spe_def: 40,
			vit: 15,
		},
		category: 'Pokémon Crétin',
		generation: 1,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 80,
		name: {
			fr: 'Flagadoss',
			en: 'Slowbro',
			jp: 'ヤドラン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/80/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/80/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 95,
			atk: 75,
			def: 110,
			spe_atk: 100,
			spe_def: 80,
			vit: 30,
		},
		category: 'Pokémon Symbiose',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 81,
		name: {
			fr: 'Magnéti',
			en: 'Magnemite',
			jp: 'コイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/81/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/81/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 25,
			atk: 35,
			def: 70,
			spe_atk: 95,
			spe_def: 55,
			vit: 45,
		},
		category: 'Pokémon Magnétique',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 82,
		name: {
			fr: 'Magnéton',
			en: 'Magneton',
			jp: 'レアコイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/82/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/82/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 50,
			atk: 60,
			def: 95,
			spe_atk: 120,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Magnétique',
		generation: 1,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 83,
		name: {
			fr: 'Canarticho',
			en: "Farfetch'd",
			jp: 'カモネギ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/83/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/83/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 52,
			atk: 90,
			def: 55,
			spe_atk: 58,
			spe_def: 62,
			vit: 60,
		},
		category: 'Pokémon Canard Fou',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 84,
		name: {
			fr: 'Doduo',
			en: 'Doduo',
			jp: 'ドードー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/84/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/84/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 35,
			atk: 85,
			def: 45,
			spe_atk: 35,
			spe_def: 35,
			vit: 75,
		},
		category: 'Pokémon Duoiseau',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 85,
		name: {
			fr: 'Dodrio',
			en: 'Dodrio',
			jp: 'ドードリオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/85/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/85/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 110,
			def: 70,
			spe_atk: 60,
			spe_def: 60,
			vit: 110,
		},
		category: 'Pokémon Trioiseau',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 86,
		name: {
			fr: 'Otaria',
			en: 'Seel',
			jp: 'パウワウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/86/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/86/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 65,
			atk: 45,
			def: 55,
			spe_atk: 45,
			spe_def: 70,
			vit: 45,
		},
		category: 'Pokémon Otarie',
		generation: 1,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 87,
		name: {
			fr: 'Lamantine',
			en: 'Dewgong',
			jp: 'ジュゴン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/87/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/87/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 90,
			atk: 70,
			def: 80,
			spe_atk: 70,
			spe_def: 95,
			vit: 70,
		},
		category: 'Pokémon Otarie',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 88,
		name: {
			fr: 'Tadmorv',
			en: 'Grimer',
			jp: 'ベトベター',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/88/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/88/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 80,
			def: 50,
			spe_atk: 40,
			spe_def: 50,
			vit: 25,
		},
		category: 'Pokémon Dégueu',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 89,
		name: {
			fr: 'Grotadmorv',
			en: 'Muk',
			jp: 'ベトベトン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/89/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/89/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 105,
			atk: 105,
			def: 75,
			spe_atk: 65,
			spe_def: 100,
			vit: 50,
		},
		category: 'Pokémon Dégueu',
		generation: 1,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 90,
		name: {
			fr: 'Kokiyas',
			en: 'Shellder',
			jp: 'シェルダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/90/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/90/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 30,
			atk: 65,
			def: 100,
			spe_atk: 45,
			spe_def: 25,
			vit: 40,
		},
		category: 'Pokémon Bivalve',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 91,
		name: {
			fr: 'Crustabri',
			en: 'Cloyster',
			jp: 'パルシェン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/91/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/91/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 50,
			atk: 95,
			def: 180,
			spe_atk: 85,
			spe_def: 45,
			vit: 70,
		},
		category: 'Pokémon Bivalve',
		generation: 1,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 92,
		name: {
			fr: 'Fantominus',
			en: 'Gastly',
			jp: 'ゴース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/92/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/92/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 30,
			atk: 35,
			def: 30,
			spe_atk: 100,
			spe_def: 35,
			vit: 80,
		},
		category: 'Pokémon Gaz',
		generation: 1,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 93,
		name: {
			fr: 'Spectrum',
			en: 'Haunter',
			jp: 'ゴースト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/93/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/93/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 45,
			atk: 50,
			def: 45,
			spe_atk: 115,
			spe_def: 55,
			vit: 95,
		},
		category: 'Pokémon Gaz',
		generation: 1,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 94,
		name: {
			fr: 'Ectoplasma',
			en: 'Gengar',
			jp: 'ゲンガー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/94/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/94/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/94/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/94/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 65,
			def: 60,
			spe_atk: 130,
			spe_def: 75,
			vit: 110,
		},
		category: 'Pokémon Ombre',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 95,
		name: {
			fr: 'Onix',
			en: 'Onix',
			jp: 'イワーク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/95/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/95/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 35,
			atk: 45,
			def: 160,
			spe_atk: 30,
			spe_def: 45,
			vit: 70,
		},
		category: 'Pokémon Serpenroc',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 96,
		name: {
			fr: 'Soporifik',
			en: 'Drowzee',
			jp: 'スリープ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/96/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/96/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 48,
			def: 45,
			spe_atk: 43,
			spe_def: 90,
			vit: 42,
		},
		category: 'Pokémon Hypnose',
		generation: 1,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 97,
		name: {
			fr: 'Hypnomade',
			en: 'Hypno',
			jp: 'スリーパー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/97/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/97/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 85,
			atk: 73,
			def: 70,
			spe_atk: 73,
			spe_def: 115,
			vit: 67,
		},
		category: 'Pokémon Hypnose',
		generation: 1,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 98,
		name: {
			fr: 'Krabby',
			en: 'Krabby',
			jp: 'クラブ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/98/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/98/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 30,
			atk: 105,
			def: 90,
			spe_atk: 25,
			spe_def: 25,
			vit: 50,
		},
		category: 'Pokémon Doux Crabe',
		generation: 1,
		catch_rate: 225,
		rareté: 1,
	},
	{
		pokedex_id: 99,
		name: {
			fr: 'Krabboss',
			en: 'Kingler',
			jp: 'キングラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/99/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/99/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/99/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/99/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 130,
			def: 115,
			spe_atk: 50,
			spe_def: 50,
			vit: 75,
		},
		category: 'Pokémon Pince',
		generation: 1,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 100,
		name: {
			fr: 'Voltorbe',
			en: 'Voltorb',
			jp: 'ビリリダマ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/100/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/100/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 40,
			atk: 30,
			def: 50,
			spe_atk: 55,
			spe_def: 55,
			vit: 100,
		},
		category: 'Pokémon Balle',
		generation: 1,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 101,
		name: {
			fr: 'Électrode',
			en: 'Electrode',
			jp: 'マルマイン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/101/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/101/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 70,
			spe_atk: 80,
			spe_def: 80,
			vit: 150,
		},
		category: 'Pokémon Balle',
		generation: 1,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 102,
		name: {
			fr: 'Noeunoeuf',
			en: 'Exeggcute',
			jp: 'タマタマ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/102/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/102/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 40,
			def: 80,
			spe_atk: 60,
			spe_def: 45,
			vit: 40,
		},
		category: 'Pokémon Œuf',
		generation: 1,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 103,
		name: {
			fr: 'Noadkoko',
			en: 'Exeggutor',
			jp: 'ナッシー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/103/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/103/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 95,
			atk: 95,
			def: 85,
			spe_atk: 125,
			spe_def: 75,
			vit: 55,
		},
		category: 'Pokémon Fruitpalme',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 104,
		name: {
			fr: 'Osselait',
			en: 'Cubone',
			jp: 'カラカラ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/104/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/104/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 95,
			spe_atk: 40,
			spe_def: 50,
			vit: 35,
		},
		category: 'Pokémon Solitaire',
		generation: 1,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 105,
		name: {
			fr: 'Ossatueur',
			en: 'Marowak',
			jp: 'ガラガラ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/105/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/105/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 80,
			def: 110,
			spe_atk: 50,
			spe_def: 80,
			vit: 45,
		},
		category: "Pokémon Gard'Os",
		generation: 1,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 106,
		name: {
			fr: 'Kicklee',
			en: 'Hitmonlee',
			jp: 'サワムラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/106/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/106/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 50,
			atk: 120,
			def: 53,
			spe_atk: 35,
			spe_def: 110,
			vit: 87,
		},
		category: 'Pokémon Latteur',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 107,
		name: {
			fr: 'Tygnon',
			en: 'Hitmonchan',
			jp: 'エビワラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/107/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/107/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 50,
			atk: 105,
			def: 79,
			spe_atk: 35,
			spe_def: 110,
			vit: 76,
		},
		category: 'Pokémon Puncheur',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 108,
		name: {
			fr: 'Excelangue',
			en: 'Lickitung',
			jp: 'ベロリンガ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/108/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/108/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 90,
			atk: 55,
			def: 75,
			spe_atk: 60,
			spe_def: 75,
			vit: 30,
		},
		category: 'Pokémon Lécheur',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 109,
		name: {
			fr: 'Smogo',
			en: 'Koffing',
			jp: 'ドガース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/109/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/109/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 65,
			def: 95,
			spe_atk: 60,
			spe_def: 45,
			vit: 35,
		},
		category: 'Pokémon Gaz Mortel',
		generation: 1,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 110,
		name: {
			fr: 'Smogogo',
			en: 'Weezing',
			jp: 'マタドガス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/110/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/110/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 65,
			atk: 90,
			def: 120,
			spe_atk: 85,
			spe_def: 70,
			vit: 60,
		},
		category: 'Pokémon Gaz Mortel',
		generation: 1,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 111,
		name: {
			fr: 'Rhinocorne',
			en: 'Rhyhorn',
			jp: 'サイホーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/111/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/111/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 80,
			atk: 85,
			def: 95,
			spe_atk: 30,
			spe_def: 30,
			vit: 25,
		},
		category: 'Pokémon Piquant',
		generation: 1,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 112,
		name: {
			fr: 'Rhinoféros',
			en: 'Rhydon',
			jp: 'サイドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/112/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/112/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 105,
			atk: 130,
			def: 120,
			spe_atk: 45,
			spe_def: 45,
			vit: 40,
		},
		category: 'Pokémon Perceur',
		generation: 1,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 113,
		name: {
			fr: 'Leveinard',
			en: 'Chansey',
			jp: 'ラッキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/113/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/113/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 250,
			atk: 5,
			def: 5,
			spe_atk: 35,
			spe_def: 105,
			vit: 50,
		},
		category: 'Pokémon Œuf',
		generation: 1,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 114,
		name: {
			fr: 'Saquedeneu',
			en: 'Tangela',
			jp: 'モンジャラ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/114/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/114/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 65,
			atk: 55,
			def: 115,
			spe_atk: 100,
			spe_def: 40,
			vit: 60,
		},
		category: 'Pokémon Vigne',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 115,
		name: {
			fr: 'Kangourex',
			en: 'Kangaskhan',
			jp: 'ガルーラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/115/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/115/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 105,
			atk: 95,
			def: 80,
			spe_atk: 40,
			spe_def: 80,
			vit: 90,
		},
		category: 'Pokémon Maternel',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 116,
		name: {
			fr: 'Hypotrempe',
			en: 'Horsea',
			jp: 'タッツー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/116/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/116/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 30,
			atk: 40,
			def: 70,
			spe_atk: 70,
			spe_def: 25,
			vit: 60,
		},
		category: 'Pokémon Dragon',
		generation: 1,
		catch_rate: 225,
		rareté: 2,
	},
	{
		pokedex_id: 117,
		name: {
			fr: 'Hypocéan',
			en: 'Seadra',
			jp: 'シードラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/117/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/117/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 65,
			def: 95,
			spe_atk: 95,
			spe_def: 45,
			vit: 85,
		},
		category: 'Pokémon Dragon',
		generation: 1,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 118,
		name: {
			fr: 'Poissirène',
			en: 'Goldeen',
			jp: 'トサキント ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/118/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/118/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 45,
			atk: 67,
			def: 60,
			spe_atk: 35,
			spe_def: 50,
			vit: 63,
		},
		category: 'Pokémon Poisson',
		generation: 1,
		catch_rate: 225,
		rareté: 1,
	},
	{
		pokedex_id: 119,
		name: {
			fr: 'Poissoroy',
			en: 'Seaking',
			jp: 'アズマオウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/119/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/119/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 80,
			atk: 92,
			def: 65,
			spe_atk: 65,
			spe_def: 80,
			vit: 68,
		},
		category: 'Pokémon Poisson',
		generation: 1,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 120,
		name: {
			fr: 'Stari',
			en: 'Staryu',
			jp: 'ヒトデマン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/120/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/120/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 30,
			atk: 45,
			def: 55,
			spe_atk: 70,
			spe_def: 55,
			vit: 85,
		},
		category: 'Pokémon Étoile',
		generation: 1,
		catch_rate: 225,
		rareté: 2,
	},
	{
		pokedex_id: 121,
		name: {
			fr: 'Staross',
			en: 'Starmie',
			jp: 'スターミー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/121/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/121/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 75,
			def: 85,
			spe_atk: 100,
			spe_def: 85,
			vit: 115,
		},
		category: 'Pokémon Mystérieux',
		generation: 1,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 122,
		name: {
			fr: 'M. Mime',
			en: 'Mr. Mime',
			jp: 'スターミー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/122/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/122/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 65,
			spe_atk: 100,
			spe_def: 120,
			vit: 90,
		},
		category: 'Pokémon Bloqueur',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 123,
		name: {
			fr: 'Insécateur',
			en: 'Scyther',
			jp: 'ストライク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/123/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/123/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 110,
			def: 80,
			spe_atk: 55,
			spe_def: 80,
			vit: 105,
		},
		category: 'Pokémon Mante',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 124,
		name: {
			fr: 'Lippoutou',
			en: 'Jynx',
			jp: 'ルージュラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/124/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/124/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 65,
			atk: 50,
			def: 35,
			spe_atk: 115,
			spe_def: 95,
			vit: 95,
		},
		category: 'Pokémon Humanoïde',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 125,
		name: {
			fr: 'Élektek',
			en: 'Electabuzz',
			jp: 'エレブー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/125/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/125/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 65,
			atk: 83,
			def: 57,
			spe_atk: 95,
			spe_def: 85,
			vit: 105,
		},
		category: 'Pokémon Électrique',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 126,
		name: {
			fr: 'Magmar',
			en: 'Magmar',
			jp: 'ブーバー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/126/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/126/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 95,
			def: 57,
			spe_atk: 100,
			spe_def: 85,
			vit: 93,
		},
		category: 'Pokémon Crache-feu',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 127,
		name: {
			fr: 'Scarabrute',
			en: 'Pinsir',
			jp: 'カイロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/127/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/127/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 65,
			atk: 125,
			def: 100,
			spe_atk: 55,
			spe_def: 70,
			vit: 85,
		},
		category: 'Pokémon Scarabée',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 128,
		name: {
			fr: 'Tauros',
			en: 'Tauros',
			jp: 'ケンタロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/128/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/128/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 75,
			atk: 100,
			def: 95,
			spe_atk: 40,
			spe_def: 70,
			vit: 110,
		},
		category: 'Pokémon Buffle',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 129,
		name: {
			fr: 'Magicarpe',
			en: 'Magikarp',
			jp: 'コイキング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/129/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/129/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 20,
			atk: 10,
			def: 55,
			spe_atk: 15,
			spe_def: 20,
			vit: 80,
		},
		category: 'Pokémon Poisson',
		generation: 1,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 130,
		name: {
			fr: 'Léviator',
			en: 'Gyarados',
			jp: 'ギャラドス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/130/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/130/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 95,
			atk: 125,
			def: 79,
			spe_atk: 60,
			spe_def: 100,
			vit: 81,
		},
		category: 'Pokémon Terrifiant',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 131,
		name: {
			fr: 'Lokhlass',
			en: 'Lapras',
			jp: 'ラプラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/131/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/131/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/131/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/131/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 130,
			atk: 85,
			def: 80,
			spe_atk: 85,
			spe_def: 95,
			vit: 60,
		},
		category: 'Pokémon Transport',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 132,
		name: {
			fr: 'Métamorph',
			en: 'Ditto',
			jp: 'メタモン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/132/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/132/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 48,
			atk: 48,
			def: 48,
			spe_atk: 48,
			spe_def: 48,
			vit: 48,
		},
		category: 'Pokémon Morphing',
		generation: 1,
		catch_rate: 35,
		rareté: 3,
	},
	{
		pokedex_id: 133,
		name: {
			fr: 'Évoli',
			en: 'Eevee',
			jp: 'イーブイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/133/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/133/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/133/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/133/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 65,
			atk: 75,
			def: 70,
			spe_atk: 65,
			spe_def: 85,
			vit: 75,
		},
		category: 'Pokémon Évolutif',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 134,
		name: {
			fr: 'Aquali',
			en: 'Vaporeon',
			jp: 'シャワーズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/134/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/134/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 130,
			atk: 65,
			def: 60,
			spe_atk: 110,
			spe_def: 95,
			vit: 65,
		},
		category: 'Pokémon Bulleur',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 135,
		name: {
			fr: 'Voltali',
			en: 'Jolteon',
			jp: 'サンダース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/135/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/135/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 65,
			atk: 65,
			def: 60,
			spe_atk: 110,
			spe_def: 95,
			vit: 130,
		},
		category: 'Pokémon Orage',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 136,
		name: {
			fr: 'Pyroli',
			en: 'Flareon',
			jp: 'ブースター',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/136/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/136/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 130,
			def: 60,
			spe_atk: 95,
			spe_def: 110,
			vit: 65,
		},
		category: 'Pokémon Flamme',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 137,
		name: {
			fr: 'Porygon',
			en: 'Porygon',
			jp: 'ポリゴン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/137/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/137/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 65,
			atk: 60,
			def: 70,
			spe_atk: 85,
			spe_def: 75,
			vit: 40,
		},
		category: 'Pokémon Virtuel',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 138,
		name: {
			fr: 'Amonita',
			en: 'Omanyte',
			jp: 'オムナイト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/138/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/138/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 35,
			atk: 40,
			def: 100,
			spe_atk: 90,
			spe_def: 55,
			vit: 35,
		},
		category: 'Pokémon Spirale',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 139,
		name: {
			fr: 'Amonistar',
			en: 'Omastar',
			jp: 'オムスター',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/139/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/139/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 60,
			def: 125,
			spe_atk: 115,
			spe_def: 70,
			vit: 55,
		},
		category: 'Pokémon Spirale',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 140,
		name: {
			fr: 'Kabuto',
			en: 'Kabuto',
			jp: 'カブト ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/140/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/140/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 30,
			atk: 80,
			def: 90,
			spe_atk: 55,
			spe_def: 45,
			vit: 55,
		},
		category: 'Pokémon Carapace',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 141,
		name: {
			fr: 'Kabutops',
			en: 'Kabutops',
			jp: 'カブトプス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/141/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/141/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 60,
			atk: 115,
			def: 105,
			spe_atk: 65,
			spe_def: 70,
			vit: 80,
		},
		category: 'Pokémon Carapace',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 142,
		name: {
			fr: 'Ptéra',
			en: 'Aerodactyl',
			jp: 'プテラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/142/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/142/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 80,
			atk: 105,
			def: 65,
			spe_atk: 60,
			spe_def: 75,
			vit: 130,
		},
		category: 'Pokémon Fossile',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 143,
		name: {
			fr: 'Ronflex',
			en: 'Snorlax',
			jp: 'カビゴン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/143/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/143/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/143/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/143/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 160,
			atk: 110,
			def: 65,
			spe_atk: 65,
			spe_def: 110,
			vit: 30,
		},
		category: 'Pokémon Pionceur',
		generation: 1,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 144,
		name: {
			fr: 'Artikodin',
			en: 'Articuno',
			jp: 'フリーザー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/144/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/144/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 85,
			def: 100,
			spe_atk: 95,
			spe_def: 125,
			vit: 85,
		},
		category: 'Pokémon Glaciaire',
		generation: 1,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 145,
		name: {
			fr: 'Électhor',
			en: 'Zapdos',
			jp: 'サンダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/145/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/145/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 90,
			def: 85,
			spe_atk: 125,
			spe_def: 90,
			vit: 100,
		},
		category: 'Pokémon Électrique',
		generation: 1,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 146,
		name: {
			fr: 'Sulfura',
			en: 'Moltres',
			jp: 'ファイヤー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/146/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/146/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 100,
			def: 90,
			spe_atk: 125,
			spe_def: 85,
			vit: 90,
		},
		category: 'Pokémon Flamme',
		generation: 1,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 147,
		name: {
			fr: 'Minidraco',
			en: 'Dratini',
			jp: 'ミニリュウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/147/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/147/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 41,
			atk: 64,
			def: 45,
			spe_atk: 50,
			spe_def: 50,
			vit: 50,
		},
		category: 'Pokémon Dragon',
		generation: 1,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 148,
		name: {
			fr: 'Draco',
			en: 'Dragonair',
			jp: 'ハクリュー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/148/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/148/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 61,
			atk: 84,
			def: 65,
			spe_atk: 70,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Dragon',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 149,
		name: {
			fr: 'Dracolosse',
			en: 'Dragonite',
			jp: 'カイリュー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/149/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/149/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 91,
			atk: 134,
			def: 95,
			spe_atk: 100,
			spe_def: 100,
			vit: 80,
		},
		category: 'Pokémon Dragon',
		generation: 1,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 150,
		name: {
			fr: 'Mewtwo',
			en: 'Mewtwo',
			jp: 'ミュウツー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/150/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/150/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 106,
			atk: 110,
			def: 90,
			spe_atk: 154,
			spe_def: 90,
			vit: 130,
		},
		category: 'Pokémon Génétique',
		generation: 1,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 151,
		name: {
			fr: 'Mew',
			en: 'Mew',
			jp: 'ミュウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/151/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/151/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 100,
			spe_atk: 100,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Nouveau',
		generation: 1,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 152,
		name: {
			fr: 'Germignon',
			en: 'Chikorita',
			jp: 'チコリータ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/152/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/152/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 45,
			atk: 49,
			def: 65,
			spe_atk: 49,
			spe_def: 65,
			vit: 45,
		},
		category: 'Pokémon Feuille',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 153,
		name: {
			fr: 'Macronium',
			en: 'Bayleef',
			jp: 'ベイリーフ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/153/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/153/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 62,
			def: 80,
			spe_atk: 63,
			spe_def: 80,
			vit: 60,
		},
		category: 'Pokémon Feuille',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 154,
		name: {
			fr: 'Méganium',
			en: 'Meganium',
			jp: 'メガニウム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/154/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/154/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 80,
			atk: 82,
			def: 100,
			spe_atk: 83,
			spe_def: 100,
			vit: 80,
		},
		category: 'Pokémon Herbe',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 155,
		name: {
			fr: 'Héricendre',
			en: 'Cyndaquil',
			jp: 'ヒノアラシ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/155/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/155/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 39,
			atk: 52,
			def: 43,
			spe_atk: 60,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Souris Feu',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 156,
		name: {
			fr: 'Feurisson',
			en: 'Quilava',
			jp: 'マグマラシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/156/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/156/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 58,
			atk: 64,
			def: 58,
			spe_atk: 80,
			spe_def: 65,
			vit: 80,
		},
		category: 'Pokémon Volcan',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 157,
		name: {
			fr: 'Typhlosion',
			en: 'Typhlosion',
			jp: 'バクフーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/157/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/157/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 78,
			atk: 84,
			def: 78,
			spe_atk: 109,
			spe_def: 85,
			vit: 100,
		},
		category: 'Pokémon Volcan',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 158,
		name: {
			fr: 'Kaiminus',
			en: 'Totodile',
			jp: 'ワニノコ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/158/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/158/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 65,
			def: 64,
			spe_atk: 44,
			spe_def: 48,
			vit: 43,
		},
		category: 'Pokémon Mâchoire',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 159,
		name: {
			fr: 'Crocrodil',
			en: 'Croconaw',
			jp: 'アリゲイツ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/159/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/159/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 65,
			atk: 80,
			def: 80,
			spe_atk: 59,
			spe_def: 63,
			vit: 58,
		},
		category: 'Pokémon Mâchoire',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 160,
		name: {
			fr: 'Aligatueur',
			en: 'Feraligatr',
			jp: 'オーダイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/160/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/160/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 85,
			atk: 105,
			def: 100,
			spe_atk: 79,
			spe_def: 83,
			vit: 78,
		},
		category: 'Pokémon Mâchoire',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 161,
		name: {
			fr: 'Fouinette',
			en: 'Sentret',
			jp: 'オタチ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/161/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/161/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 35,
			atk: 46,
			def: 34,
			spe_atk: 35,
			spe_def: 45,
			vit: 20,
		},
		category: 'Pokémon Espion',
		generation: 2,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 162,
		name: {
			fr: 'Fouinar',
			en: 'Furret',
			jp: 'オオタチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/162/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/162/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 85,
			atk: 76,
			def: 64,
			spe_atk: 45,
			spe_def: 55,
			vit: 90,
		},
		category: 'Pokémon Allongé',
		generation: 2,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 163,
		name: {
			fr: 'Hoothoot',
			en: 'Hoothoot',
			jp: 'ホーホー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/163/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/163/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 30,
			def: 30,
			spe_atk: 36,
			spe_def: 56,
			vit: 50,
		},
		category: 'Pokémon Hibou',
		generation: 2,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 164,
		name: {
			fr: 'Noarfang',
			en: 'Noctowl',
			jp: 'ヨルノズク ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/164/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/164/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 50,
			def: 50,
			spe_atk: 86,
			spe_def: 96,
			vit: 70,
		},
		category: 'Pokémon Hibou',
		generation: 2,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 165,
		name: {
			fr: 'Coxy',
			en: 'Ledyba',
			jp: 'レディバ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/165/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/165/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 20,
			def: 30,
			spe_atk: 40,
			spe_def: 80,
			vit: 55,
		},
		category: 'Pokémon 5 Étoiles',
		generation: 2,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 166,
		name: {
			fr: 'Coxyclaque',
			en: 'Ledian',
			jp: 'レディアン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/166/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/166/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 35,
			def: 50,
			spe_atk: 55,
			spe_def: 110,
			vit: 85,
		},
		category: 'Pokémon 5 Étoiles',
		generation: 2,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 167,
		name: {
			fr: 'Mimigal',
			en: 'Spinarak',
			jp: 'イトマル ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/167/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/167/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 60,
			def: 40,
			spe_atk: 40,
			spe_def: 40,
			vit: 30,
		},
		category: 'Pokémon Crache Fil',
		generation: 2,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 168,
		name: {
			fr: 'Migalos',
			en: 'Ariados',
			jp: 'アリアドス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/168/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/168/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 70,
			atk: 90,
			def: 70,
			spe_atk: 60,
			spe_def: 70,
			vit: 40,
		},
		category: 'Pokémon Long-Patte',
		generation: 2,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 169,
		name: {
			fr: 'Nostenfer',
			en: 'Crobat',
			jp: 'クロバット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/169/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/169/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 90,
			def: 80,
			spe_atk: 70,
			spe_def: 80,
			vit: 130,
		},
		category: 'Pokémon Chovsouris',
		generation: 2,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 170,
		name: {
			fr: 'Loupio',
			en: 'Chinchou',
			jp: 'チョンチー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/170/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/170/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 75,
			atk: 38,
			def: 38,
			spe_atk: 56,
			spe_def: 56,
			vit: 67,
		},
		category: 'Pokémon Poisson',
		generation: 2,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 171,
		name: {
			fr: 'Lanturn',
			en: 'Lanturn',
			jp: 'ランターン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/171/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/171/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 125,
			atk: 58,
			def: 58,
			spe_atk: 76,
			spe_def: 76,
			vit: 67,
		},
		category: 'Pokémon Lumière',
		generation: 2,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 172,
		name: {
			fr: 'Pichu',
			en: 'Pichu',
			jp: 'ピチュー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/172/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/172/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 20,
			atk: 40,
			def: 15,
			spe_atk: 35,
			spe_def: 35,
			vit: 60,
		},
		category: 'Pokémon Minisouris',
		generation: 2,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 173,
		name: {
			fr: 'Mélo',
			en: 'Cleffa',
			jp: 'ピィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/173/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/173/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 50,
			atk: 25,
			def: 28,
			spe_atk: 45,
			spe_def: 55,
			vit: 15,
		},
		category: 'Pokémon Étoile',
		generation: 2,
		catch_rate: 150,
		rareté: 1,
	},
	{
		pokedex_id: 174,
		name: {
			fr: 'Toudoudou',
			en: 'Igglybuff',
			jp: 'ププリン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/174/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/174/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 90,
			atk: 30,
			def: 15,
			spe_atk: 40,
			spe_def: 20,
			vit: 15,
		},
		category: 'Pokémon Bouboule',
		generation: 2,
		catch_rate: 170,
		rareté: 2,
	},
	{
		pokedex_id: 175,
		name: {
			fr: 'Togepi',
			en: 'Togepi',
			jp: 'トゲピー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/175/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/175/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 35,
			atk: 20,
			def: 65,
			spe_atk: 40,
			spe_def: 65,
			vit: 20,
		},
		category: 'Pokémon Balle Pic',
		generation: 2,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 176,
		name: {
			fr: 'Togetic',
			en: 'Togetic',
			jp: 'トゲチック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/176/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/176/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 40,
			def: 85,
			spe_atk: 80,
			spe_def: 105,
			vit: 40,
		},
		category: 'Pokémon Bonheur',
		generation: 2,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 177,
		name: {
			fr: 'Natu',
			en: 'Natu',
			jp: 'ネイティ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/177/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/177/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 50,
			def: 45,
			spe_atk: 70,
			spe_def: 45,
			vit: 70,
		},
		category: 'Pokémon Minoiseau',
		generation: 2,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 178,
		name: {
			fr: 'Xatu',
			en: 'Xatu',
			jp: 'ネイティオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/178/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/178/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 65,
			atk: 75,
			def: 70,
			spe_atk: 95,
			spe_def: 70,
			vit: 95,
		},
		category: 'Pokémon Mystique',
		generation: 2,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 179,
		name: {
			fr: 'Wattouat',
			en: 'Mareep',
			jp: 'メリープ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/179/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/179/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 55,
			atk: 40,
			def: 40,
			spe_atk: 65,
			spe_def: 45,
			vit: 35,
		},
		category: 'Pokémon Laine',
		generation: 2,
		catch_rate: 235,
		rareté: 1,
	},
	{
		pokedex_id: 180,
		name: {
			fr: 'Lainergie',
			en: 'Flaaffy',
			jp: 'モココ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/180/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/180/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 70,
			atk: 55,
			def: 55,
			spe_atk: 80,
			spe_def: 60,
			vit: 45,
		},
		category: 'Pokémon Laine',
		generation: 2,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 181,
		name: {
			fr: 'Pharamp',
			en: 'Ampharos',
			jp: 'デンリュウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/181/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/181/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 90,
			atk: 75,
			def: 85,
			spe_atk: 115,
			spe_def: 90,
			vit: 55,
		},
		category: 'Pokémon Lumière',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 182,
		name: {
			fr: 'Joliflor',
			en: 'Bellossom',
			jp: 'キレイハナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/182/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/182/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 80,
			def: 95,
			spe_atk: 90,
			spe_def: 100,
			vit: 50,
		},
		category: 'Pokémon Fleur',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 183,
		name: {
			fr: 'Marill',
			en: 'Marill',
			jp: 'マリル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/183/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/183/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 70,
			atk: 20,
			def: 50,
			spe_atk: 20,
			spe_def: 50,
			vit: 40,
		},
		category: 'Pokémon Aquasouris',
		generation: 2,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 184,
		name: {
			fr: 'Azumarill',
			en: 'Azumarill',
			jp: 'マリルリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/184/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/184/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 100,
			atk: 50,
			def: 80,
			spe_atk: 60,
			spe_def: 80,
			vit: 50,
		},
		category: 'Pokémon Aqualapin',
		generation: 2,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 185,
		name: {
			fr: 'Simularbre',
			en: 'Sudowoodo',
			jp: 'ウソッキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/185/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/185/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 70,
			atk: 100,
			def: 115,
			spe_atk: 30,
			spe_def: 65,
			vit: 30,
		},
		category: 'Pokémon Imitation',
		generation: 2,
		catch_rate: 65,
		rareté: 2,
	},
	{
		pokedex_id: 186,
		name: {
			fr: 'Tarpaud',
			en: 'Politoed',
			jp: 'ニョロトノ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/186/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/186/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 90,
			atk: 75,
			def: 75,
			spe_atk: 90,
			spe_def: 100,
			vit: 70,
		},
		category: 'Pokémon Grenouille',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 187,
		name: {
			fr: 'Granivol',
			en: 'Hoppip',
			jp: 'ハネッコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/187/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/187/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 35,
			atk: 35,
			def: 40,
			spe_atk: 35,
			spe_def: 55,
			vit: 50,
		},
		category: 'Pokémon Pissenlit',
		generation: 2,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 188,
		name: {
			fr: 'Floravol',
			en: 'Skiploom',
			jp: 'ポポッコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/188/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/188/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 45,
			def: 50,
			spe_atk: 45,
			spe_def: 65,
			vit: 80,
		},
		category: 'Pokémon Pissenlit',
		generation: 2,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 189,
		name: {
			fr: 'Cotovol',
			en: 'Jumpluff',
			jp: 'ワタッコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/189/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/189/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 55,
			def: 70,
			spe_atk: 55,
			spe_def: 95,
			vit: 110,
		},
		category: 'Pokémon Pissenlit',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 190,
		name: {
			fr: 'Capumain',
			en: 'Aipom',
			jp: 'エイパム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/190/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/190/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 55,
			atk: 70,
			def: 55,
			spe_atk: 40,
			spe_def: 55,
			vit: 85,
		},
		category: 'Pokémon Longqueue',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 191,
		name: {
			fr: 'Tournegrin',
			en: 'Sunkern',
			jp: 'ヒマナッツ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/191/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/191/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 30,
			atk: 30,
			def: 30,
			spe_atk: 30,
			spe_def: 30,
			vit: 30,
		},
		category: 'Pokémon Graine',
		generation: 2,
		catch_rate: 235,
		rareté: 1,
	},
	{
		pokedex_id: 192,
		name: {
			fr: 'Héliatronc',
			en: 'Sunflora',
			jp: 'キマワリ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/192/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/192/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 75,
			def: 55,
			spe_atk: 105,
			spe_def: 85,
			vit: 30,
		},
		category: 'Pokémon Soleil',
		generation: 2,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 193,
		name: {
			fr: 'Yanma',
			en: 'Yanma',
			jp: 'ヤンヤンマ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/193/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/193/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 65,
			atk: 65,
			def: 45,
			spe_atk: 75,
			spe_def: 45,
			vit: 95,
		},
		category: 'Pokémon Translaile',
		generation: 2,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 194,
		name: {
			fr: 'Axoloto',
			en: 'Wooper',
			jp: 'ウパー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/194/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/194/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 45,
			def: 45,
			spe_atk: 25,
			spe_def: 25,
			vit: 15,
		},
		category: 'Pokémon Poisson',
		generation: 2,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 195,
		name: {
			fr: 'Maraiste',
			en: 'Quagsire',
			jp: 'ヌオー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/195/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/195/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 95,
			atk: 85,
			def: 85,
			spe_atk: 65,
			spe_def: 65,
			vit: 35,
		},
		category: 'Pokémon Poisson',
		generation: 2,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 196,
		name: {
			fr: 'Mentali',
			en: 'Espeon',
			jp: 'エーフィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/196/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/196/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 65,
			atk: 65,
			def: 60,
			spe_atk: 130,
			spe_def: 95,
			vit: 110,
		},
		category: 'Pokémon Soleil',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 197,
		name: {
			fr: 'Noctali',
			en: 'Umbreon',
			jp: 'ブラッキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/197/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/197/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 95,
			atk: 65,
			def: 110,
			spe_atk: 60,
			spe_def: 130,
			vit: 65,
		},
		category: 'Pokémon Lune',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 198,
		name: {
			fr: 'Cornèbre',
			en: 'Murkrow',
			jp: 'ヤミカラス ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/198/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/198/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 85,
			def: 42,
			spe_atk: 85,
			spe_def: 42,
			vit: 91,
		},
		category: 'Pokémon Obscurité',
		generation: 2,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 199,
		name: {
			fr: 'Roigada',
			en: 'Slowking',
			jp: 'ヤドキング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/199/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/199/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 95,
			atk: 75,
			def: 80,
			spe_atk: 100,
			spe_def: 110,
			vit: 30,
		},
		category: 'Pokémon Royal',
		generation: 2,
		catch_rate: 70,
		rareté: 1,
	},
	{
		pokedex_id: 200,
		name: {
			fr: 'Feuforêve',
			en: 'Misdreavus',
			jp: 'ムウマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/200/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/200/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 60,
			spe_atk: 85,
			spe_def: 85,
			vit: 85,
		},
		category: 'Pokémon Strident',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 201,
		name: {
			fr: 'Zarbi',
			en: 'Unown',
			jp: 'アンノーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/201/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/201/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 48,
			atk: 72,
			def: 48,
			spe_atk: 72,
			spe_def: 48,
			vit: 48,
		},
		category: 'Pokémon Symbolique',
		generation: 2,
		catch_rate: 225,
		rareté: 2,
	},
	{
		pokedex_id: 202,
		name: {
			fr: 'Qulbutoké',
			en: 'Wobbuffet',
			jp: 'ソーナンス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/202/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/202/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 190,
			atk: 33,
			def: 58,
			spe_atk: 33,
			spe_def: 58,
			vit: 33,
		},
		category: 'Pokémon Patient',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 203,
		name: {
			fr: 'Girafarig',
			en: 'Girafarig',
			jp: 'キリンリキ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/203/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/203/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 70,
			atk: 80,
			def: 65,
			spe_atk: 90,
			spe_def: 65,
			vit: 85,
		},
		category: 'Pokémon Long-Cou',
		generation: 2,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 204,
		name: {
			fr: 'Pomdepik',
			en: 'Pineco',
			jp: 'クヌギダマ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/204/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/204/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 65,
			def: 90,
			spe_atk: 35,
			spe_def: 35,
			vit: 15,
		},
		category: 'Pokémon Ver Caché',
		generation: 2,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 205,
		name: {
			fr: 'Foretress',
			en: 'Forretress',
			jp: 'フォレトス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/205/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/205/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 75,
			atk: 90,
			def: 140,
			spe_atk: 60,
			spe_def: 60,
			vit: 40,
		},
		category: 'Pokémon Ver Caché',
		generation: 2,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 206,
		name: {
			fr: 'Insolourdo',
			en: 'Dunsparce',
			jp: 'ノコッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/206/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/206/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 100,
			atk: 70,
			def: 70,
			spe_atk: 65,
			spe_def: 65,
			vit: 45,
		},
		category: 'Pokémon Serpent',
		generation: 2,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 207,
		name: {
			fr: 'Scorplane',
			en: 'Gligar',
			jp: 'グライガー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/207/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/207/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 65,
			atk: 75,
			def: 105,
			spe_atk: 35,
			spe_def: 65,
			vit: 85,
		},
		category: 'Pokémon Scorpivol',
		generation: 2,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 208,
		name: {
			fr: 'Steelix',
			en: 'Steelix',
			jp: 'ハガネール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/208/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/208/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 85,
			def: 200,
			spe_atk: 55,
			spe_def: 65,
			vit: 30,
		},
		category: 'Pokémon Serpenfer',
		generation: 2,
		catch_rate: 25,
		rareté: 1,
	},
	{
		pokedex_id: 209,
		name: {
			fr: 'Snubbull',
			en: 'Snubbull',
			jp: 'ブルー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/209/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/209/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 60,
			atk: 80,
			def: 50,
			spe_atk: 40,
			spe_def: 40,
			vit: 30,
		},
		category: 'Pokémon Fée',
		generation: 2,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 210,
		name: {
			fr: 'Granbull',
			en: 'Granbull',
			jp: 'グランブル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/210/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/210/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 90,
			atk: 120,
			def: 75,
			spe_atk: 60,
			spe_def: 60,
			vit: 45,
		},
		category: 'Pokémon Fée',
		generation: 2,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 211,
		name: {
			fr: 'Qwilfish',
			en: 'Qwilfish',
			jp: 'ハリーセン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/211/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/211/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 65,
			atk: 95,
			def: 85,
			spe_atk: 55,
			spe_def: 55,
			vit: 85,
		},
		category: 'Pokémon Bouboule',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 212,
		name: {
			fr: 'Cizayox',
			en: 'Scizor',
			jp: 'ハッサム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/212/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/212/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 70,
			atk: 130,
			def: 100,
			spe_atk: 55,
			spe_def: 80,
			vit: 65,
		},
		category: 'Pokémon Pince',
		generation: 2,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 213,
		name: {
			fr: 'Caratroc',
			en: 'Shuckle',
			jp: 'ツボツボ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/213/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/213/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 20,
			atk: 10,
			def: 230,
			spe_atk: 10,
			spe_def: 230,
			vit: 5,
		},
		category: 'Pokémon Pourri',
		generation: 2,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 214,
		name: {
			fr: 'Scarhino',
			en: 'Heracross',
			jp: 'ヘラクロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/214/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/214/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 80,
			atk: 125,
			def: 75,
			spe_atk: 40,
			spe_def: 95,
			vit: 85,
		},
		category: 'Pokémon Unicorne',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 215,
		name: {
			fr: 'Farfuret',
			en: 'Sneasel',
			jp: 'ニューラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/215/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/215/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 55,
			atk: 95,
			def: 55,
			spe_atk: 35,
			spe_def: 75,
			vit: 115,
		},
		category: 'Pokémon Grifacérée',
		generation: 2,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 216,
		name: {
			fr: 'Teddiursa',
			en: 'Teddiursa',
			jp: 'ヒメグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/216/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/216/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 60,
			atk: 80,
			def: 50,
			spe_atk: 50,
			spe_def: 50,
			vit: 40,
		},
		category: 'Pokémon Mini Ours',
		generation: 2,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 217,
		name: {
			fr: 'Ursaring',
			en: 'Ursaring',
			jp: 'リングマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/217/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/217/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 90,
			atk: 130,
			def: 75,
			spe_atk: 75,
			spe_def: 75,
			vit: 55,
		},
		category: 'Pokémon Hibernant',
		generation: 2,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 218,
		name: {
			fr: 'Limagma',
			en: 'Slugma',
			jp: 'マグマッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/218/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/218/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 40,
			spe_atk: 70,
			spe_def: 40,
			vit: 20,
		},
		category: 'Pokémon Lave',
		generation: 2,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 219,
		name: {
			fr: 'Volcaropod',
			en: 'Magcargo',
			jp: 'マグカルゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/219/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/219/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 120,
			spe_atk: 90,
			spe_def: 80,
			vit: 30,
		},
		category: 'Pokémon Lave',
		generation: 2,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 220,
		name: {
			fr: 'Marcacrin',
			en: 'Swinub',
			jp: 'ウリムー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/220/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/220/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 40,
			spe_atk: 30,
			spe_def: 30,
			vit: 50,
		},
		category: 'Pokémon Cochon',
		generation: 2,
		catch_rate: 225,
		rareté: 2,
	},
	{
		pokedex_id: 221,
		name: {
			fr: 'Cochignon',
			en: 'Piloswine',
			jp: 'イノムー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/221/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/221/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 80,
			spe_atk: 60,
			spe_def: 60,
			vit: 50,
		},
		category: 'Pokémon Porc',
		generation: 2,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 222,
		name: {
			fr: 'Corayon',
			en: 'Corsola',
			jp: 'サニーゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/222/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/222/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 65,
			atk: 55,
			def: 95,
			spe_atk: 65,
			spe_def: 95,
			vit: 35,
		},
		category: 'Pokémon Corail',
		generation: 2,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 223,
		name: {
			fr: 'Rémoraid',
			en: 'Remoraid',
			jp: 'テッポウオ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/223/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/223/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 35,
			atk: 65,
			def: 35,
			spe_atk: 65,
			spe_def: 35,
			vit: 65,
		},
		category: 'Pokémon Jet',
		generation: 2,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 224,
		name: {
			fr: 'Octillery',
			en: 'Octillery',
			jp: 'オクタン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/224/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/224/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 75,
			atk: 105,
			def: 75,
			spe_atk: 105,
			spe_def: 75,
			vit: 45,
		},
		category: 'Pokémon Jet',
		generation: 2,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 225,
		name: {
			fr: 'Cadoizo',
			en: 'Delibird',
			jp: 'デリバード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/225/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/225/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 45,
			atk: 55,
			def: 45,
			spe_atk: 65,
			spe_def: 45,
			vit: 75,
		},
		category: 'Pokémon Livraison',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 226,
		name: {
			fr: 'Démanta',
			en: 'Mantine',
			jp: 'マンタイン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/226/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/226/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 40,
			def: 70,
			spe_atk: 80,
			spe_def: 140,
			vit: 70,
		},
		category: 'Pokémon Cervolant',
		generation: 2,
		catch_rate: 25,
		rareté: 1,
	},
	{
		pokedex_id: 227,
		name: {
			fr: 'Airmure',
			en: 'Skarmory',
			jp: 'エアームド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/227/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/227/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 65,
			atk: 80,
			def: 140,
			spe_atk: 40,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Armoiseau',
		generation: 2,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 228,
		name: {
			fr: 'Malosse',
			en: 'Houndour',
			jp: 'デルビル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/228/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/228/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 45,
			atk: 60,
			def: 30,
			spe_atk: 80,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Sombre',
		generation: 2,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 229,
		name: {
			fr: 'Démolosse',
			en: 'Houndoom',
			jp: 'ヘルガー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/229/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/229/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 75,
			atk: 90,
			def: 50,
			spe_atk: 110,
			spe_def: 80,
			vit: 95,
		},
		category: 'Pokémon Sombre',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 230,
		name: {
			fr: 'Hyporoi',
			en: 'Kingdra',
			jp: 'キングドラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/230/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/230/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 75,
			atk: 95,
			def: 95,
			spe_atk: 95,
			spe_def: 95,
			vit: 85,
		},
		category: 'Pokémon Dragon',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 231,
		name: {
			fr: 'Phanpy',
			en: 'Phanpy',
			jp: 'ゴマゾウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/231/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/231/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 60,
			def: 60,
			spe_atk: 40,
			spe_def: 40,
			vit: 40,
		},
		category: 'Pokémon Long-Nez',
		generation: 2,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 232,
		name: {
			fr: 'Donphan',
			en: 'Donphan',
			jp: 'ドンファン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/232/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/232/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 120,
			def: 120,
			spe_atk: 60,
			spe_def: 60,
			vit: 50,
		},
		category: 'Pokémon Armure',
		generation: 2,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 233,
		name: {
			fr: 'Porygon2',
			en: 'Porygon2',
			jp: 'ポリゴン2',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/233/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/233/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 85,
			atk: 80,
			def: 90,
			spe_atk: 105,
			spe_def: 95,
			vit: 60,
		},
		category: 'Pokémon Virtuel',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 234,
		name: {
			fr: 'Cerfrousse',
			en: 'Stantler',
			jp: 'オドシシ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/234/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/234/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 73,
			atk: 95,
			def: 62,
			spe_atk: 85,
			spe_def: 65,
			vit: 85,
		},
		category: 'Pokémon Maxi Corne',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 235,
		name: {
			fr: 'Queulorior',
			en: 'Smeargle',
			jp: 'ドーブル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/235/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/235/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 55,
			atk: 20,
			def: 35,
			spe_atk: 20,
			spe_def: 45,
			vit: 75,
		},
		category: 'Pokémon Peintre',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 236,
		name: {
			fr: 'Debugant',
			en: 'Tyrogue',
			jp: 'バルキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/236/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/236/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 35,
			atk: 35,
			def: 35,
			spe_atk: 35,
			spe_def: 35,
			vit: 35,
		},
		category: 'Pokémon Bagarreur',
		generation: 2,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 237,
		name: {
			fr: 'Kapoera',
			en: 'Hitmontop',
			jp: 'カポエラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/237/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/237/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 50,
			atk: 95,
			def: 95,
			spe_atk: 35,
			spe_def: 110,
			vit: 70,
		},
		category: 'Pokémon Poirier',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 238,
		name: {
			fr: 'Lippouti',
			en: 'Smoochum',
			jp: 'ムチュール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/238/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/238/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 45,
			atk: 30,
			def: 15,
			spe_atk: 85,
			spe_def: 65,
			vit: 65,
		},
		category: 'Pokémon Bisou',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 239,
		name: {
			fr: 'Élekid',
			en: 'Elekid',
			jp: 'エレキッド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/239/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/239/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 45,
			atk: 63,
			def: 37,
			spe_atk: 65,
			spe_def: 55,
			vit: 95,
		},
		category: 'Pokémon Électrique',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 240,
		name: {
			fr: 'Magby',
			en: 'Magby',
			jp: 'ブビィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/240/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/240/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 45,
			atk: 75,
			def: 37,
			spe_atk: 70,
			spe_def: 55,
			vit: 83,
		},
		category: 'Pokémon Charbon',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 241,
		name: {
			fr: 'Écrémeuh',
			en: 'Miltank',
			jp: 'ミルタンク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/241/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/241/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 95,
			atk: 80,
			def: 105,
			spe_atk: 40,
			spe_def: 70,
			vit: 100,
		},
		category: 'Pokémon Vachalait',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 242,
		name: {
			fr: 'Leuphorie',
			en: 'Blissey',
			jp: 'ハピナス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/242/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/242/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 255,
			atk: 10,
			def: 10,
			spe_atk: 75,
			spe_def: 135,
			vit: 55,
		},
		category: 'Pokémon Bonheur',
		generation: 2,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 243,
		name: {
			fr: 'Raikou',
			en: 'Raikou',
			jp: 'ライコウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/243/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/243/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 90,
			atk: 85,
			def: 75,
			spe_atk: 115,
			spe_def: 100,
			vit: 115,
		},
		category: 'Pokémon Foudre',
		generation: 2,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 244,
		name: {
			fr: 'Entei',
			en: 'Entei',
			jp: 'エンテイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/244/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/244/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 115,
			atk: 115,
			def: 85,
			spe_atk: 90,
			spe_def: 75,
			vit: 100,
		},
		category: 'Pokémon Volcan',
		generation: 2,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 245,
		name: {
			fr: 'Suicune',
			en: 'Suicune',
			jp: 'スイクン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/245/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/245/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 100,
			atk: 75,
			def: 115,
			spe_atk: 90,
			spe_def: 115,
			vit: 85,
		},
		category: 'Pokémon Aurore',
		generation: 2,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 246,
		name: {
			fr: 'Embrylex',
			en: 'Larvitar',
			jp: 'ヨーギラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/246/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/246/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 50,
			atk: 64,
			def: 50,
			spe_atk: 45,
			spe_def: 50,
			vit: 41,
		},
		category: 'Pokémon Peaupierre',
		generation: 2,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 247,
		name: {
			fr: 'Ymphect',
			en: 'Pupitar',
			jp: 'サナギラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/247/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/247/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 84,
			def: 70,
			spe_atk: 65,
			spe_def: 70,
			vit: 51,
		},
		category: 'Pokémon Carapadure',
		generation: 2,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 248,
		name: {
			fr: 'Tyranocif',
			en: 'Tyranitar',
			jp: 'バンギラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/248/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/248/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 100,
			atk: 134,
			def: 110,
			spe_atk: 95,
			spe_def: 100,
			vit: 61,
		},
		category: 'Pokémon Armure',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 249,
		name: {
			fr: 'Lugia',
			en: 'Lugia',
			jp: 'ルギア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/249/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/249/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 106,
			atk: 90,
			def: 130,
			spe_atk: 90,
			spe_def: 154,
			vit: 110,
		},
		category: 'Pokémon Plongeon',
		generation: 2,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 250,
		name: {
			fr: 'Ho-Oh',
			en: 'Ho-Oh',
			jp: 'ホウオウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/250/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/250/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 106,
			atk: 130,
			def: 90,
			spe_atk: 110,
			spe_def: 154,
			vit: 90,
		},
		category: 'Pokémon Arc-en-ciel',
		generation: 2,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 251,
		name: {
			fr: 'Celebi',
			en: 'Celebi',
			jp: 'セレビィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/251/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/251/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 100,
			spe_atk: 100,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Temporel',
		generation: 2,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 252,
		name: {
			fr: 'Arcko',
			en: 'Treecko',
			jp: 'キモリ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/252/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/252/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 35,
			spe_atk: 65,
			spe_def: 55,
			vit: 70,
		},
		category: 'Pokémon Bois Gecko',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 253,
		name: {
			fr: 'Massko',
			en: 'Grovyle',
			jp: 'ジュプトル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/253/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/253/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 50,
			atk: 65,
			def: 45,
			spe_atk: 85,
			spe_def: 65,
			vit: 95,
		},
		category: 'Pokémon Bois Gecko',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 254,
		name: {
			fr: 'Jungko',
			en: 'Sceptile',
			jp: 'ジュカイン ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/254/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/254/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 65,
			spe_atk: 105,
			spe_def: 85,
			vit: 120,
		},
		category: 'Pokémon Forêt',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 255,
		name: {
			fr: 'Poussifeu',
			en: 'Torchic',
			jp: 'アチャモ ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/255/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/255/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 45,
			atk: 60,
			def: 40,
			spe_atk: 70,
			spe_def: 50,
			vit: 45,
		},
		category: 'Pokémon Poussin',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 256,
		name: {
			fr: 'Galifeu',
			en: 'Combusken',
			jp: 'ワカシャモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/256/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/256/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 60,
			atk: 85,
			def: 60,
			spe_atk: 85,
			spe_def: 60,
			vit: 55,
		},
		category: 'Pokémon Poulet',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 257,
		name: {
			fr: 'Braségali',
			en: 'Blaziken',
			jp: 'バシャーモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/257/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/257/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 70,
			spe_atk: 110,
			spe_def: 70,
			vit: 80,
		},
		category: 'Pokémon Ardent',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 258,
		name: {
			fr: 'Gobou',
			en: 'Mudkip',
			jp: 'ミズゴロウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/258/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/258/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 70,
			def: 50,
			spe_atk: 50,
			spe_def: 50,
			vit: 40,
		},
		category: 'Pokémon Poissonboue',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 259,
		name: {
			fr: 'Flobio',
			en: 'Marshtomp',
			jp: 'ヌマクロー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/259/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/259/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 70,
			spe_atk: 60,
			spe_def: 70,
			vit: 50,
		},
		category: 'Pokémon Poissonboue',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 260,
		name: {
			fr: 'Laggron',
			en: 'Swampert',
			jp: 'ラグラージ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/260/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/260/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 110,
			def: 90,
			spe_atk: 85,
			spe_def: 90,
			vit: 60,
		},
		category: 'Pokémon Poissonboue',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 261,
		name: {
			fr: 'Medhyèna',
			en: 'Poochyena',
			jp: 'ポチエナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/261/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/261/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 35,
			atk: 55,
			def: 35,
			spe_atk: 30,
			spe_def: 30,
			vit: 35,
		},
		category: 'Pokémon Morsure',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 262,
		name: {
			fr: 'Grahyèna',
			en: 'Mightyena',
			jp: 'グラエナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/262/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/262/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 90,
			def: 70,
			spe_atk: 60,
			spe_def: 60,
			vit: 70,
		},
		category: 'Pokémon Morsure',
		generation: 3,
		catch_rate: 127,
		rareté: 2,
	},
	{
		pokedex_id: 263,
		name: {
			fr: 'Zigzaton',
			en: 'Zigzagoon',
			jp: 'ジグザグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/263/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/263/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 38,
			atk: 30,
			def: 41,
			spe_atk: 30,
			spe_def: 41,
			vit: 60,
		},
		category: 'Pokémon Petit Raton',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 264,
		name: {
			fr: 'Linéon',
			en: 'Linoone',
			jp: 'マッスグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/264/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/264/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 78,
			atk: 70,
			def: 61,
			spe_atk: 50,
			spe_def: 61,
			vit: 100,
		},
		category: 'Pokémon Fonceur',
		generation: 3,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 265,
		name: {
			fr: 'Chenipotte',
			en: 'Wurmple',
			jp: 'ケムッソ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/265/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/265/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 45,
			atk: 45,
			def: 35,
			spe_atk: 20,
			spe_def: 30,
			vit: 20,
		},
		category: 'Pokémon Ver',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 266,
		name: {
			fr: 'Armulys',
			en: 'Silcoon',
			jp: 'カラサリス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/266/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/266/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 35,
			def: 55,
			spe_atk: 25,
			spe_def: 25,
			vit: 15,
		},
		category: 'Pokémon Cocon',
		generation: 3,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 267,
		name: {
			fr: 'Charmillon',
			en: 'Beautifly',
			jp: 'アゲハント',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/267/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/267/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 70,
			def: 50,
			spe_atk: 100,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Papillon',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 268,
		name: {
			fr: 'Blindalys',
			en: 'Cascoon',
			jp: 'マユルド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/268/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/268/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 35,
			def: 55,
			spe_atk: 25,
			spe_def: 25,
			vit: 15,
		},
		category: 'Pokémon Cocon',
		generation: 3,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 269,
		name: {
			fr: 'Papinox',
			en: 'Dustox',
			jp: 'ドクケイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/269/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/269/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 70,
			spe_atk: 50,
			spe_def: 90,
			vit: 65,
		},
		category: 'Pokémon Papipoison',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 270,
		name: {
			fr: 'Nénupiot',
			en: 'Lotad',
			jp: 'ハスボー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/270/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/270/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 30,
			def: 30,
			spe_atk: 40,
			spe_def: 50,
			vit: 30,
		},
		category: 'Pokémon Aquaplante',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 271,
		name: {
			fr: 'Lombre',
			en: 'Lombre',
			jp: 'ハスブレロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/271/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/271/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 50,
			spe_atk: 60,
			spe_def: 70,
			vit: 50,
		},
		category: 'Pokémon Jovial',
		generation: 3,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 272,
		name: {
			fr: 'Ludicolo',
			en: 'Ludicolo',
			jp: 'ルンパッパ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/272/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/272/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 80,
			atk: 70,
			def: 70,
			spe_atk: 90,
			spe_def: 100,
			vit: 70,
		},
		category: 'Pokémon Insouciant',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 273,
		name: {
			fr: 'Grainipiot',
			en: 'Seedot',
			jp: 'タネボー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/273/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/273/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 50,
			spe_atk: 30,
			spe_def: 30,
			vit: 30,
		},
		category: 'Pokémon Gland',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 274,
		name: {
			fr: 'Pifeuil',
			en: 'Nuzleaf',
			jp: 'コノハナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/274/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/274/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 70,
			def: 40,
			spe_atk: 60,
			spe_def: 40,
			vit: 60,
		},
		category: 'Pokémon Malin',
		generation: 3,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 275,
		name: {
			fr: 'Tengalice',
			en: 'Shiftry',
			jp: 'ダーテング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/275/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/275/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 90,
			atk: 100,
			def: 60,
			spe_atk: 90,
			spe_def: 60,
			vit: 80,
		},
		category: 'Pokémon Malveillant',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 276,
		name: {
			fr: 'Nirondelle',
			en: 'Taillow',
			jp: 'スバメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/276/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/276/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 55,
			def: 30,
			spe_atk: 30,
			spe_def: 30,
			vit: 85,
		},
		category: 'Pokémon Minirondel',
		generation: 3,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 277,
		name: {
			fr: 'Hélédelle',
			en: 'Swellow',
			jp: 'オオスバメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/277/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/277/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 85,
			def: 60,
			spe_atk: 75,
			spe_def: 50,
			vit: 125,
		},
		category: 'Pokémon Hirondelle',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 278,
		name: {
			fr: 'Goélise',
			en: 'Wingull',
			jp: 'キャモメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/278/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/278/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 30,
			def: 30,
			spe_atk: 55,
			spe_def: 30,
			vit: 85,
		},
		category: 'Pokémon Mouette',
		generation: 3,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 279,
		name: {
			fr: 'Bekipan',
			en: 'Pelipper',
			jp: 'ペリッパー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/279/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/279/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 100,
			spe_atk: 95,
			spe_def: 70,
			vit: 65,
		},
		category: 'Pokémon Oiseaudo',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 280,
		name: {
			fr: 'Tarsal',
			en: 'Ralts',
			jp: 'ラルトス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/280/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/280/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 28,
			atk: 25,
			def: 25,
			spe_atk: 45,
			spe_def: 35,
			vit: 40,
		},
		category: 'Pokémon Sentiment',
		generation: 3,
		catch_rate: 235,
		rareté: 2,
	},
	{
		pokedex_id: 281,
		name: {
			fr: 'Kirlia',
			en: 'Kirlia',
			jp: 'キルリア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/281/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/281/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 38,
			atk: 35,
			def: 35,
			spe_atk: 65,
			spe_def: 55,
			vit: 50,
		},
		category: 'Pokémon Émotion',
		generation: 3,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 282,
		name: {
			fr: 'Gardevoir',
			en: 'Gardevoir',
			jp: 'サーナイト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/282/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/282/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 68,
			atk: 65,
			def: 65,
			spe_atk: 125,
			spe_def: 115,
			vit: 80,
		},
		category: 'Pokémon Étreinte',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 283,
		name: {
			fr: 'Arakdo',
			en: 'Surskit',
			jp: 'アメタマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/283/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/283/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 40,
			atk: 30,
			def: 32,
			spe_atk: 50,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Maresurfeur',
		generation: 3,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 284,
		name: {
			fr: 'Maskadra',
			en: 'Masquerain',
			jp: 'アメモース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/284/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/284/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 60,
			def: 62,
			spe_atk: 100,
			spe_def: 82,
			vit: 80,
		},
		category: 'Pokémon Boule Œil',
		generation: 3,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 285,
		name: {
			fr: 'Balignon',
			en: 'Shroomish',
			jp: 'キノココ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/285/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/285/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 40,
			def: 60,
			spe_atk: 40,
			spe_def: 60,
			vit: 35,
		},
		category: 'Pokémon Champignon',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 286,
		name: {
			fr: 'Chapignon',
			en: 'Breloom',
			jp: 'キノガッサ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/286/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/286/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 60,
			atk: 130,
			def: 80,
			spe_atk: 60,
			spe_def: 60,
			vit: 70,
		},
		category: 'Pokémon Champignon',
		generation: 3,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 287,
		name: {
			fr: 'Parecool',
			en: 'Slakoth',
			jp: 'ナマケロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/287/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/287/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 60,
			spe_atk: 35,
			spe_def: 35,
			vit: 30,
		},
		category: 'Pokémon Flâneur',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 288,
		name: {
			fr: 'Vigoroth',
			en: 'Vigoroth',
			jp: 'ヤルキモノ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/288/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/288/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 80,
			atk: 80,
			def: 80,
			spe_atk: 55,
			spe_def: 55,
			vit: 90,
		},
		category: 'Pokémon Turbusinge',
		generation: 3,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 289,
		name: {
			fr: 'Monaflèmit',
			en: 'Slaking',
			jp: 'ケッキング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/289/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/289/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 150,
			atk: 160,
			def: 100,
			spe_atk: 95,
			spe_def: 65,
			vit: 100,
		},
		category: 'Pokémon Fainéant',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 290,
		name: {
			fr: 'Ningale',
			en: 'Nincada',
			jp: 'ツチニン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/290/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/290/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 31,
			atk: 45,
			def: 90,
			spe_atk: 30,
			spe_def: 30,
			vit: 40,
		},
		category: 'Pokémon Apprenti',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 291,
		name: {
			fr: 'Ninjask',
			en: 'Ninjask',
			jp: 'テッカニン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/291/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/291/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 61,
			atk: 90,
			def: 45,
			spe_atk: 50,
			spe_def: 50,
			vit: 160,
		},
		category: 'Pokémon Ninja',
		generation: 3,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 292,
		name: {
			fr: 'Munja',
			en: 'Shedinja',
			jp: 'ヌケニン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/292/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/292/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 1,
			atk: 90,
			def: 45,
			spe_atk: 30,
			spe_def: 30,
			vit: 40,
		},
		category: 'Pokémon Exuvie',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 293,
		name: {
			fr: 'Chuchmur',
			en: 'Whismur',
			jp: 'ゴニョニョ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/293/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/293/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 64,
			atk: 51,
			def: 23,
			spe_atk: 51,
			spe_def: 23,
			vit: 28,
		},
		category: 'Pokémon Chuchoteur',
		generation: 3,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 294,
		name: {
			fr: 'Ramboum',
			en: 'Loudred',
			jp: 'ドゴーム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/294/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/294/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 84,
			atk: 71,
			def: 43,
			spe_atk: 71,
			spe_def: 43,
			vit: 48,
		},
		category: 'Pokémon Grosse Voix',
		generation: 3,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 295,
		name: {
			fr: 'Brouhabam',
			en: 'Exploud',
			jp: 'バクオング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/295/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/295/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 104,
			atk: 91,
			def: 63,
			spe_atk: 91,
			spe_def: 73,
			vit: 68,
		},
		category: 'Pokémon Bruit Sourd',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 296,
		name: {
			fr: 'Makuhita',
			en: 'Makuhita',
			jp: 'マクノシタ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/296/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/296/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 72,
			atk: 60,
			def: 30,
			spe_atk: 20,
			spe_def: 30,
			vit: 25,
		},
		category: 'Pokémon Tenace',
		generation: 3,
		catch_rate: 180,
		rareté: 1,
	},
	{
		pokedex_id: 297,
		name: {
			fr: 'Hariyama',
			en: 'Hariyama',
			jp: 'ハリテヤマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/297/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/297/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 144,
			atk: 120,
			def: 60,
			spe_atk: 40,
			spe_def: 60,
			vit: 50,
		},
		category: 'Pokémon Cogneur',
		generation: 3,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 298,
		name: {
			fr: 'Azurill',
			en: 'Azurill',
			jp: 'ルリリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/298/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/298/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 50,
			atk: 20,
			def: 40,
			spe_atk: 20,
			spe_def: 40,
			vit: 20,
		},
		category: 'Pokémon Point Polka',
		generation: 3,
		catch_rate: 150,
		rareté: 1,
	},
	{
		pokedex_id: 299,
		name: {
			fr: 'Tarinor',
			en: 'Nosepass',
			jp: 'ノズパス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/299/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/299/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 30,
			atk: 45,
			def: 135,
			spe_atk: 45,
			spe_def: 90,
			vit: 30,
		},
		category: 'Pokémon Boussole',
		generation: 3,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 300,
		name: {
			fr: 'Skitty',
			en: 'Skitty',
			jp: 'エネコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/300/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/300/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 50,
			atk: 45,
			def: 45,
			spe_atk: 35,
			spe_def: 35,
			vit: 50,
		},
		category: 'Pokémon Chaton',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 301,
		name: {
			fr: 'Delcatty',
			en: 'Delcatty',
			jp: 'エネコロロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/301/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/301/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 70,
			atk: 65,
			def: 65,
			spe_atk: 55,
			spe_def: 55,
			vit: 90,
		},
		category: 'Pokémon Guindé',
		generation: 3,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 302,
		name: {
			fr: 'Ténéfix',
			en: 'Sableye',
			jp: 'ヤミラミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/302/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/302/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 50,
			atk: 75,
			def: 75,
			spe_atk: 65,
			spe_def: 65,
			vit: 50,
		},
		category: 'Pokémon Obscurité',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 303,
		name: {
			fr: 'Mysdibule',
			en: 'Mawile',
			jp: 'クチート',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/303/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/303/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 50,
			atk: 85,
			def: 85,
			spe_atk: 55,
			spe_def: 55,
			vit: 50,
		},
		category: 'Pokémon Trompeur',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 304,
		name: {
			fr: 'Galekid',
			en: 'Aron',
			jp: 'ココドラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/304/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/304/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 50,
			atk: 70,
			def: 100,
			spe_atk: 40,
			spe_def: 40,
			vit: 30,
		},
		category: 'Pokémon Armurfer',
		generation: 3,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 305,
		name: {
			fr: 'Galegon',
			en: 'Lairon',
			jp: 'コドラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/305/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/305/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 60,
			atk: 90,
			def: 140,
			spe_atk: 50,
			spe_def: 50,
			vit: 40,
		},
		category: 'Pokémon Armurfer',
		generation: 3,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 306,
		name: {
			fr: 'Galeking',
			en: 'Aggron',
			jp: 'ボスゴドラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/306/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/306/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 70,
			atk: 110,
			def: 180,
			spe_atk: 60,
			spe_def: 60,
			vit: 50,
		},
		category: 'Pokémon Armurfer',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 307,
		name: {
			fr: 'Méditikka',
			en: 'Meditite',
			jp: 'アサナン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/307/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/307/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 30,
			atk: 40,
			def: 55,
			spe_atk: 40,
			spe_def: 55,
			vit: 60,
		},
		category: 'Pokémon Méditation',
		generation: 3,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 308,
		name: {
			fr: 'Charmina',
			en: 'Medicham',
			jp: 'チャーレム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/308/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/308/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 75,
			spe_atk: 60,
			spe_def: 75,
			vit: 80,
		},
		category: 'Pokémon Méditation',
		generation: 3,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 309,
		name: {
			fr: 'Dynavolt',
			en: 'Electrike',
			jp: 'ラクライ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/309/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/309/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 40,
			spe_atk: 65,
			spe_def: 40,
			vit: 65,
		},
		category: 'Pokémon Orage',
		generation: 3,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 310,
		name: {
			fr: 'Élecsprint',
			en: 'Manectric',
			jp: 'ライボルト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/310/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/310/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 70,
			atk: 75,
			def: 60,
			spe_atk: 105,
			spe_def: 60,
			vit: 105,
		},
		category: 'Pokémon Décharge',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 311,
		name: {
			fr: 'Posipi',
			en: 'Plusle',
			jp: 'プラスル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/311/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/311/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 40,
			spe_atk: 85,
			spe_def: 75,
			vit: 95,
		},
		category: 'Pokémon Acclameur',
		generation: 3,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 312,
		name: {
			fr: 'Négapi',
			en: 'Minun',
			jp: 'マイナン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/312/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/312/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 60,
			atk: 40,
			def: 50,
			spe_atk: 75,
			spe_def: 85,
			vit: 95,
		},
		category: 'Pokémon Acclameur',
		generation: 3,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 313,
		name: {
			fr: 'Muciole',
			en: 'Volbeat',
			jp: 'バルビート',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/313/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/313/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 65,
			atk: 73,
			def: 75,
			spe_atk: 47,
			spe_def: 85,
			vit: 85,
		},
		category: 'Pokémon Luciole',
		generation: 3,
		catch_rate: 150,
		rareté: 3,
	},
	{
		pokedex_id: 314,
		name: {
			fr: 'Lumivole',
			en: 'Illumise',
			jp: 'イルミーゼ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/314/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/314/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 65,
			atk: 47,
			def: 75,
			spe_atk: 73,
			spe_def: 85,
			vit: 85,
		},
		category: 'Pokémon Luciole',
		generation: 3,
		catch_rate: 150,
		rareté: 3,
	},
	{
		pokedex_id: 315,
		name: {
			fr: 'Rosélia',
			en: 'Roselia',
			jp: 'ロゼリア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/315/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/315/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 50,
			atk: 60,
			def: 45,
			spe_atk: 100,
			spe_def: 80,
			vit: 65,
		},
		category: 'Pokémon Épine',
		generation: 3,
		catch_rate: 150,
		rareté: 2,
	},
	{
		pokedex_id: 316,
		name: {
			fr: 'Gloupti',
			en: 'Gulpin',
			jp: 'ゴクリン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/316/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/316/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 70,
			atk: 43,
			def: 53,
			spe_atk: 43,
			spe_def: 53,
			vit: 40,
		},
		category: 'Pokémon Estomac',
		generation: 3,
		catch_rate: 225,
		rareté: 3,
	},
	{
		pokedex_id: 317,
		name: {
			fr: 'Avaltout',
			en: 'Swalot',
			jp: 'マルノーム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/317/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/317/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 100,
			atk: 73,
			def: 83,
			spe_atk: 73,
			spe_def: 83,
			vit: 55,
		},
		category: 'Pokémon Sac Poison',
		generation: 3,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 318,
		name: {
			fr: 'Carvanha',
			en: 'Carvanha',
			jp: 'キバニア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/318/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/318/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 45,
			atk: 90,
			def: 20,
			spe_atk: 65,
			spe_def: 20,
			vit: 65,
		},
		category: 'Pokémon Féroce',
		generation: 3,
		catch_rate: 225,
		rareté: 1,
	},
	{
		pokedex_id: 319,
		name: {
			fr: 'Sharpedo',
			en: 'Sharpedo',
			jp: 'サメハダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/319/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/319/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 120,
			def: 40,
			spe_atk: 95,
			spe_def: 40,
			vit: 95,
		},
		category: 'Pokémon Brutal',
		generation: 3,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 320,
		name: {
			fr: 'Wailmer',
			en: 'Wailmer',
			jp: 'ホエルコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/320/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/320/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 130,
			atk: 70,
			def: 35,
			spe_atk: 70,
			spe_def: 35,
			vit: 60,
		},
		category: 'Pokémon Baleinboule',
		generation: 3,
		catch_rate: 125,
		rareté: 1,
	},
	{
		pokedex_id: 321,
		name: {
			fr: 'Wailord',
			en: 'Wailord',
			jp: 'ホエルオー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/321/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/321/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 170,
			atk: 90,
			def: 45,
			spe_atk: 90,
			spe_def: 45,
			vit: 60,
		},
		category: 'Pokémon Cachabouée',
		generation: 3,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 322,
		name: {
			fr: 'Chamallot',
			en: 'Numel',
			jp: 'ドンメル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/322/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/322/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 40,
			spe_atk: 65,
			spe_def: 45,
			vit: 35,
		},
		category: 'Pokémon Engourdi',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 323,
		name: {
			fr: 'Camérupt',
			en: 'Camerupt',
			jp: 'バクーダ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/323/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/323/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 100,
			def: 70,
			spe_atk: 105,
			spe_def: 75,
			vit: 40,
		},
		category: 'Pokémon Éruption',
		generation: 3,
		catch_rate: 150,
		rareté: 1,
	},
	{
		pokedex_id: 324,
		name: {
			fr: 'Chartor',
			en: 'Torkoal',
			jp: 'コータス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/324/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/324/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 140,
			spe_atk: 85,
			spe_def: 70,
			vit: 20,
		},
		category: 'Pokémon Charbon',
		generation: 3,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 325,
		name: {
			fr: 'Spoink',
			en: 'Spoink',
			jp: 'バネブー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/325/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/325/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 25,
			def: 35,
			spe_atk: 70,
			spe_def: 80,
			vit: 60,
		},
		category: 'Pokémon Rebond',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 326,
		name: {
			fr: 'Groret',
			en: 'Grumpig',
			jp: 'ブーピッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/326/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/326/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 80,
			atk: 45,
			def: 65,
			spe_atk: 90,
			spe_def: 110,
			vit: 80,
		},
		category: 'Pokémon Magouilleur',
		generation: 3,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 327,
		name: {
			fr: 'Spinda',
			en: 'Spinda',
			jp: 'パッチール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/327/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/327/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 60,
			spe_atk: 60,
			spe_def: 60,
			vit: 60,
		},
		category: 'Pokémon Panda Tache',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 328,
		name: {
			fr: 'Kraknoix',
			en: 'Trapinch',
			jp: 'ナックラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/328/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/328/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 45,
			atk: 100,
			def: 45,
			spe_atk: 45,
			spe_def: 45,
			vit: 10,
		},
		category: 'Pokémon Piégeur',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 329,
		name: {
			fr: 'Vibraninf',
			en: 'Vibrava',
			jp: 'ビブラーバ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/329/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/329/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 50,
			atk: 70,
			def: 50,
			spe_atk: 50,
			spe_def: 50,
			vit: 70,
		},
		category: 'Pokémon Vibration',
		generation: 3,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 330,
		name: {
			fr: 'Libégon',
			en: 'Flygon',
			jp: 'フライゴン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/330/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/330/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 80,
			atk: 100,
			def: 80,
			spe_atk: 80,
			spe_def: 80,
			vit: 100,
		},
		category: 'Pokémon Mystique',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 331,
		name: {
			fr: 'Cacnea',
			en: 'Cacnea',
			jp: 'サボネア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/331/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/331/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 50,
			atk: 85,
			def: 40,
			spe_atk: 85,
			spe_def: 40,
			vit: 35,
		},
		category: 'Pokémon Cactus',
		generation: 3,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 332,
		name: {
			fr: 'Cacturne',
			en: 'Cacturne',
			jp: 'ノクタス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/332/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/332/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 115,
			def: 60,
			spe_atk: 115,
			spe_def: 60,
			vit: 55,
		},
		category: 'Pokémon Épouvantail',
		generation: 3,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 333,
		name: {
			fr: 'Tylton',
			en: 'Swablu',
			jp: 'チルット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/333/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/333/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 45,
			atk: 40,
			def: 60,
			spe_atk: 40,
			spe_def: 75,
			vit: 50,
		},
		category: 'Pokémon Oiseaucoton',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 334,
		name: {
			fr: 'Altaria',
			en: 'Altaria',
			jp: 'チルタリス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/334/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/334/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 70,
			def: 90,
			spe_atk: 70,
			spe_def: 105,
			vit: 80,
		},
		category: 'Pokémon Virevolteur',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 335,
		name: {
			fr: 'Mangriff',
			en: 'Zangoose',
			jp: 'ザングース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/335/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/335/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 73,
			atk: 115,
			def: 60,
			spe_atk: 60,
			spe_def: 60,
			vit: 90,
		},
		category: 'Pokémon Chat Furet',
		generation: 3,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 336,
		name: {
			fr: 'Séviper',
			en: 'Seviper',
			jp: 'ハブネーク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/336/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/336/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 73,
			atk: 100,
			def: 60,
			spe_atk: 100,
			spe_def: 60,
			vit: 65,
		},
		category: 'Pokémon Serpacroc',
		generation: 3,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 337,
		name: {
			fr: 'Séléroc',
			en: 'Lunatone',
			jp: 'ルナトーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/337/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/337/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 55,
			def: 65,
			spe_atk: 95,
			spe_def: 85,
			vit: 70,
		},
		category: 'Pokémon Météorite',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 338,
		name: {
			fr: 'Solaroc',
			en: 'Solrock',
			jp: 'ソルロック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/338/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/338/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 95,
			def: 85,
			spe_atk: 55,
			spe_def: 65,
			vit: 70,
		},
		category: 'Pokémon Météorite',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 339,
		name: {
			fr: 'Barloche',
			en: 'Barboach',
			jp: 'ドジョッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/339/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/339/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 50,
			atk: 48,
			def: 43,
			spe_atk: 46,
			spe_def: 41,
			vit: 60,
		},
		category: 'Pokémon Barbillon',
		generation: 3,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 340,
		name: {
			fr: 'Barbicha',
			en: 'Whiscash',
			jp: 'ナマズン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/340/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/340/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 110,
			atk: 78,
			def: 73,
			spe_atk: 76,
			spe_def: 71,
			vit: 60,
		},
		category: 'Pokémon Barbillon',
		generation: 3,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 341,
		name: {
			fr: 'Écrapince',
			en: 'Corphish',
			jp: 'ヘイガニ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/341/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/341/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 43,
			atk: 80,
			def: 65,
			spe_atk: 50,
			spe_def: 35,
			vit: 35,
		},
		category: 'Pokémon Brute',
		generation: 3,
		catch_rate: 205,
		rareté: 2,
	},
	{
		pokedex_id: 342,
		name: {
			fr: 'Colhomard',
			en: 'Crawdaunt',
			jp: 'シザリガー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/342/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/342/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 63,
			atk: 120,
			def: 85,
			spe_atk: 90,
			spe_def: 55,
			vit: 55,
		},
		category: 'Pokémon Crapule',
		generation: 3,
		catch_rate: 155,
		rareté: 2,
	},
	{
		pokedex_id: 343,
		name: {
			fr: 'Balbuto',
			en: 'Baltoy',
			jp: 'ヤジロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/343/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/343/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 55,
			spe_atk: 40,
			spe_def: 70,
			vit: 55,
		},
		category: 'Pokémon Poupargile',
		generation: 3,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 344,
		name: {
			fr: 'Kaorine',
			en: 'Claydol',
			jp: 'ネンドール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/344/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/344/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 70,
			def: 105,
			spe_atk: 70,
			spe_def: 120,
			vit: 75,
		},
		category: 'Pokémon Poupargile',
		generation: 3,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 345,
		name: {
			fr: 'Lilia',
			en: 'Lileep',
			jp: 'リリーラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/345/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/345/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 66,
			atk: 41,
			def: 77,
			spe_atk: 61,
			spe_def: 87,
			vit: 23,
		},
		category: "Pokémon Lis d'Eau",
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 346,
		name: {
			fr: 'Vacilys',
			en: 'Cradily',
			jp: 'ユレイドル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/346/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/346/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 86,
			atk: 81,
			def: 97,
			spe_atk: 81,
			spe_def: 107,
			vit: 43,
		},
		category: 'Pokémon Bernacle',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 347,
		name: {
			fr: 'Anorith',
			en: 'Anorith',
			jp: 'アノプス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/347/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/347/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 45,
			atk: 95,
			def: 50,
			spe_atk: 40,
			spe_def: 50,
			vit: 75,
		},
		category: 'Pokémon Crustage',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 348,
		name: {
			fr: 'Armaldo',
			en: 'Armaldo',
			jp: 'アーマルド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/348/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/348/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 75,
			atk: 125,
			def: 100,
			spe_atk: 70,
			spe_def: 80,
			vit: 45,
		},
		category: 'Pokémon Blindage',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 349,
		name: {
			fr: 'Barpau',
			en: 'Feebas',
			jp: 'ヒンバス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/349/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/349/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 20,
			atk: 15,
			def: 20,
			spe_atk: 10,
			spe_def: 55,
			vit: 80,
		},
		category: 'Pokémon Poisson',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 350,
		name: {
			fr: 'Milobellus',
			en: 'Milotic',
			jp: 'ミロカロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/350/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/350/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 95,
			atk: 60,
			def: 79,
			spe_atk: 100,
			spe_def: 125,
			vit: 81,
		},
		category: 'Pokémon Tendre',
		generation: 3,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 351,
		name: {
			fr: 'Morphéo',
			en: 'Castform',
			jp: 'ポワルン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/351/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/351/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 70,
			def: 70,
			spe_atk: 70,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Climat',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 352,
		name: {
			fr: 'Kecleon',
			en: 'Kecleon',
			jp: 'カクレオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/352/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/352/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 60,
			atk: 90,
			def: 70,
			spe_atk: 60,
			spe_def: 120,
			vit: 40,
		},
		category: 'Pokémon Multicolor',
		generation: 3,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 353,
		name: {
			fr: 'Polichombr',
			en: 'Shuppet',
			jp: 'カゲボウズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/353/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/353/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 44,
			atk: 75,
			def: 35,
			spe_atk: 63,
			spe_def: 33,
			vit: 45,
		},
		category: 'Pokémon Poupée',
		generation: 3,
		catch_rate: 225,
		rareté: 3,
	},
	{
		pokedex_id: 354,
		name: {
			fr: 'Branette',
			en: 'Banette',
			jp: 'ジュペッタ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/354/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/354/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 64,
			atk: 115,
			def: 65,
			spe_atk: 83,
			spe_def: 63,
			vit: 65,
		},
		category: 'Pokémon Marionnette',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 355,
		name: {
			fr: 'Skelénox',
			en: 'Duskull',
			jp: 'ヨマワル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/355/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/355/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 20,
			atk: 40,
			def: 90,
			spe_atk: 30,
			spe_def: 90,
			vit: 25,
		},
		category: 'Pokémon Requiem',
		generation: 3,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 356,
		name: {
			fr: 'Téraclope',
			en: 'Dusclops',
			jp: 'サマヨール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/356/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/356/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 40,
			atk: 70,
			def: 130,
			spe_atk: 60,
			spe_def: 130,
			vit: 25,
		},
		category: 'Pokémon Appel',
		generation: 3,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 357,
		name: {
			fr: 'Tropius',
			en: 'Tropius',
			jp: 'トロピウス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/357/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/357/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 99,
			atk: 68,
			def: 83,
			spe_atk: 72,
			spe_def: 87,
			vit: 51,
		},
		category: 'Pokémon Fruit',
		generation: 3,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 358,
		name: {
			fr: 'Éoko',
			en: 'Chimecho',
			jp: 'チリーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/358/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/358/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 75,
			atk: 50,
			def: 80,
			spe_atk: 95,
			spe_def: 90,
			vit: 65,
		},
		category: 'Pokémon Carillon',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 359,
		name: {
			fr: 'Absol',
			en: 'Absol',
			jp: 'アブソル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/359/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/359/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 65,
			atk: 130,
			def: 60,
			spe_atk: 75,
			spe_def: 60,
			vit: 75,
		},
		category: 'Pokémon Désastre',
		generation: 3,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 360,
		name: {
			fr: 'Okéoké',
			en: 'Wynaut',
			jp: 'ソーナノ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/360/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/360/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 95,
			atk: 23,
			def: 48,
			spe_atk: 23,
			spe_def: 48,
			vit: 23,
		},
		category: 'Pokémon Ravi',
		generation: 3,
		catch_rate: 125,
		rareté: 2,
	},
	{
		pokedex_id: 361,
		name: {
			fr: 'Stalgamin',
			en: 'Snorunt',
			jp: 'ユキワラシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/361/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/361/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 50,
			spe_atk: 50,
			spe_def: 50,
			vit: 50,
		},
		category: 'Pokémon Capuche',
		generation: 3,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 362,
		name: {
			fr: 'Oniglali',
			en: 'Glalie',
			jp: 'オニゴーリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/362/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/362/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 80,
			atk: 80,
			def: 80,
			spe_atk: 80,
			spe_def: 80,
			vit: 80,
		},
		category: 'Pokémon Face',
		generation: 3,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 363,
		name: {
			fr: 'Obalie',
			en: 'Spheal',
			jp: 'タマザラシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/363/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/363/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 40,
			def: 50,
			spe_atk: 55,
			spe_def: 50,
			vit: 25,
		},
		category: 'Pokémon Clap Clap',
		generation: 3,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 364,
		name: {
			fr: 'Phogleur',
			en: 'Sealeo',
			jp: 'トドグラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/364/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/364/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 90,
			atk: 60,
			def: 70,
			spe_atk: 75,
			spe_def: 70,
			vit: 45,
		},
		category: 'Pokémon Roule Boule',
		generation: 3,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 365,
		name: {
			fr: 'Kaimorse',
			en: 'Walrein',
			jp: 'トドゼルガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/365/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/365/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 110,
			atk: 80,
			def: 90,
			spe_atk: 95,
			spe_def: 90,
			vit: 65,
		},
		category: 'Pokémon Brise Glace',
		generation: 3,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 366,
		name: {
			fr: 'Coquiperl',
			en: 'Clamperl',
			jp: 'パールル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/366/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/366/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 35,
			atk: 64,
			def: 85,
			spe_atk: 74,
			spe_def: 55,
			vit: 32,
		},
		category: 'Pokémon Bivalve',
		generation: 3,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 367,
		name: {
			fr: 'Serpang',
			en: 'Huntail',
			jp: 'ハンテール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/367/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/367/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 104,
			def: 105,
			spe_atk: 94,
			spe_def: 75,
			vit: 52,
		},
		category: 'Pokémon Abysse',
		generation: 3,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 368,
		name: {
			fr: 'Rosabyss',
			en: 'Gorebyss',
			jp: 'サクラビス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/368/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/368/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 84,
			def: 105,
			spe_atk: 114,
			spe_def: 75,
			vit: 52,
		},
		category: 'Pokémon Mer du Sud',
		generation: 3,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 369,
		name: {
			fr: 'Relicanth',
			en: 'Relicanth',
			jp: 'ジーランス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/369/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/369/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 100,
			atk: 90,
			def: 130,
			spe_atk: 45,
			spe_def: 65,
			vit: 55,
		},
		category: 'Pokémon Longévité',
		generation: 3,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 370,
		name: {
			fr: 'Lovdisc',
			en: 'Luvdisc',
			jp: 'ラブカス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/370/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/370/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 43,
			atk: 30,
			def: 55,
			spe_atk: 40,
			spe_def: 65,
			vit: 97,
		},
		category: 'Pokémon Rendezvous',
		generation: 3,
		catch_rate: 225,
		rareté: 2,
	},
	{
		pokedex_id: 371,
		name: {
			fr: 'Draby',
			en: 'Bagon',
			jp: 'タツベイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/371/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/371/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 45,
			atk: 75,
			def: 60,
			spe_atk: 40,
			spe_def: 30,
			vit: 50,
		},
		category: 'Pokémon Tête de Roc',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 372,
		name: {
			fr: 'Drackhaus',
			en: 'Shelgon',
			jp: 'コモルー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/372/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/372/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 65,
			atk: 95,
			def: 100,
			spe_atk: 60,
			spe_def: 50,
			vit: 50,
		},
		category: 'Pokémon Endurant',
		generation: 3,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 373,
		name: {
			fr: 'Drattak',
			en: 'Salamence',
			jp: 'ボーマンダ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/373/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/373/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 95,
			atk: 135,
			def: 80,
			spe_atk: 110,
			spe_def: 80,
			vit: 100,
		},
		category: 'Pokémon Dragon',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 374,
		name: {
			fr: 'Terhal',
			en: 'Beldum',
			jp: 'ダンバル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/374/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/374/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 40,
			atk: 55,
			def: 80,
			spe_atk: 35,
			spe_def: 60,
			vit: 30,
		},
		category: 'Pokémon Boulefer',
		generation: 3,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 375,
		name: {
			fr: 'Métang',
			en: 'Metang',
			jp: 'メタング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/375/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/375/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 75,
			def: 100,
			spe_atk: 55,
			spe_def: 80,
			vit: 50,
		},
		category: 'Pokémon Pincefer',
		generation: 3,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 376,
		name: {
			fr: 'Métalosse',
			en: 'Metagross',
			jp: 'メタグロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/376/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/376/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 80,
			atk: 135,
			def: 130,
			spe_atk: 95,
			spe_def: 90,
			vit: 70,
		},
		category: 'Pokémon Pattefer',
		generation: 3,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 377,
		name: {
			fr: 'Regirock',
			en: 'Regirock',
			jp: 'レジロック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/377/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/377/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 80,
			atk: 100,
			def: 200,
			spe_atk: 50,
			spe_def: 100,
			vit: 50,
		},
		category: 'Pokémon Pic Rocheux',
		generation: 3,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 378,
		name: {
			fr: 'Regice',
			en: 'Regice',
			jp: 'レジアイス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/378/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/378/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 80,
			atk: 50,
			def: 100,
			spe_atk: 100,
			spe_def: 200,
			vit: 50,
		},
		category: 'Pokémon Iceberg',
		generation: 3,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 379,
		name: {
			fr: 'Registeel',
			en: 'Registeel',
			jp: 'レジスチル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/379/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/379/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 80,
			atk: 75,
			def: 150,
			spe_atk: 75,
			spe_def: 150,
			vit: 50,
		},
		category: 'Pokémon Fer',
		generation: 3,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 380,
		name: {
			fr: 'Latias',
			en: 'Latias',
			jp: 'ラティアス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/380/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/380/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 80,
			atk: 80,
			def: 90,
			spe_atk: 110,
			spe_def: 130,
			vit: 110,
		},
		category: 'Pokémon Éon',
		generation: 3,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 381,
		name: {
			fr: 'Latios',
			en: 'Latios',
			jp: 'ラティオス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/381/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/381/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 80,
			atk: 90,
			def: 80,
			spe_atk: 130,
			spe_def: 110,
			vit: 110,
		},
		category: 'Pokémon Éon',
		generation: 3,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 382,
		name: {
			fr: 'Kyogre',
			en: 'Kyogre',
			jp: 'カイオーガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/382/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/382/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 90,
			spe_atk: 150,
			spe_def: 140,
			vit: 90,
		},
		category: 'Pokémon Bassinmarin',
		generation: 3,
		catch_rate: 5,
		rareté: 1,
	},
	{
		pokedex_id: 383,
		name: {
			fr: 'Groudon',
			en: 'Groudon',
			jp: 'グラードン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/383/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/383/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 150,
			def: 140,
			spe_atk: 100,
			spe_def: 90,
			vit: 90,
		},
		category: 'Pokémon Continent',
		generation: 3,
		catch_rate: 5,
		rareté: 1,
	},
	{
		pokedex_id: 384,
		name: {
			fr: 'Rayquaza',
			en: 'Rayquaza',
			jp: 'レックウザ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/384/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/384/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 105,
			atk: 150,
			def: 90,
			spe_atk: 150,
			spe_def: 90,
			vit: 95,
		},
		category: 'Pokémon Cieux',
		generation: 3,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 385,
		name: {
			fr: 'Jirachi',
			en: 'Jirachi',
			jp: 'ジラーチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/385/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/385/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 100,
			spe_atk: 100,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Souhait',
		generation: 3,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 386,
		name: {
			fr: 'Deoxys',
			en: 'Deoxys',
			jp: 'デオキシス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/386/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/386/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 50,
			atk: 95,
			def: 90,
			spe_atk: 95,
			spe_def: 90,
			vit: 180,
		},
		category: 'Pokémon ADN',
		generation: 3,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 387,
		name: {
			fr: 'Tortipouss',
			en: 'Turtwig',
			jp: 'ナエトル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/387/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/387/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 55,
			atk: 68,
			def: 64,
			spe_atk: 45,
			spe_def: 55,
			vit: 31,
		},
		category: 'Pokémon Minifeuille',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 388,
		name: {
			fr: 'Boskara',
			en: 'Grotle',
			jp: 'ハヤシガメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/388/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/388/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 89,
			def: 85,
			spe_atk: 55,
			spe_def: 65,
			vit: 36,
		},
		category: 'Pokémon Bosquet',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 389,
		name: {
			fr: 'Torterra',
			en: 'Torterra',
			jp: 'ドダイトス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/389/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/389/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 95,
			atk: 109,
			def: 105,
			spe_atk: 75,
			spe_def: 85,
			vit: 56,
		},
		category: 'Pokémon Continent',
		generation: 4,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 390,
		name: {
			fr: 'Ouisticram',
			en: 'Chimchar',
			jp: 'ヒコザル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/390/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/390/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 44,
			atk: 58,
			def: 44,
			spe_atk: 58,
			spe_def: 44,
			vit: 61,
		},
		category: 'Pokémon Chimpanzé',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 391,
		name: {
			fr: 'Chimpenfeu',
			en: 'Monferno',
			jp: 'モウカザル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/391/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/391/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 64,
			atk: 78,
			def: 52,
			spe_atk: 78,
			spe_def: 52,
			vit: 81,
		},
		category: 'Pokémon Garnement',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 392,
		name: {
			fr: 'Simiabraz',
			en: 'Infernape',
			jp: 'ゴウカザル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/392/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/392/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 76,
			atk: 104,
			def: 71,
			spe_atk: 104,
			spe_def: 71,
			vit: 108,
		},
		category: 'Pokémon Flamme',
		generation: 4,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 393,
		name: {
			fr: 'Tiplouf',
			en: 'Piplup',
			jp: 'ポッチャマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/393/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/393/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 53,
			atk: 51,
			def: 53,
			spe_atk: 61,
			spe_def: 56,
			vit: 40,
		},
		category: 'Pokémon Pingouin',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 394,
		name: {
			fr: 'Prinplouf',
			en: 'Prinplup',
			jp: 'ポッタイシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/394/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/394/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 64,
			atk: 66,
			def: 68,
			spe_atk: 81,
			spe_def: 76,
			vit: 50,
		},
		category: 'Pokémon Pingouin',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 395,
		name: {
			fr: 'Pingoléon',
			en: 'Empoleon',
			jp: 'エンペルト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/395/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/395/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 84,
			atk: 86,
			def: 88,
			spe_atk: 111,
			spe_def: 101,
			vit: 60,
		},
		category: 'Pokémon Empereur',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 396,
		name: {
			fr: 'Étourmi',
			en: 'Starly',
			jp: 'ムックル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/396/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/396/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 55,
			def: 30,
			spe_atk: 30,
			spe_def: 30,
			vit: 60,
		},
		category: 'Pokémon Étourneau',
		generation: 4,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 397,
		name: {
			fr: 'Étourvol',
			en: 'Staravia',
			jp: 'ムクバード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/397/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/397/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 75,
			def: 50,
			spe_atk: 40,
			spe_def: 40,
			vit: 80,
		},
		category: 'Pokémon Étourneau',
		generation: 4,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 398,
		name: {
			fr: 'Étouraptor',
			en: 'Staraptor',
			jp: 'ムクホーク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/398/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/398/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 120,
			def: 70,
			spe_atk: 50,
			spe_def: 60,
			vit: 100,
		},
		category: 'Pokémon Rapace',
		generation: 4,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 399,
		name: {
			fr: 'Keunotor',
			en: 'Bidoof',
			jp: 'ビッパ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/399/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/399/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 59,
			atk: 45,
			def: 40,
			spe_atk: 35,
			spe_def: 40,
			vit: 31,
		},
		category: 'Pokémon Souridodue',
		generation: 4,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 400,
		name: {
			fr: 'Castorno',
			en: 'Bibarel',
			jp: 'ビーダル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/400/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/400/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 79,
			atk: 85,
			def: 60,
			spe_atk: 55,
			spe_def: 60,
			vit: 71,
		},
		category: 'Pokémon Castor',
		generation: 4,
		catch_rate: 127,
		rareté: 3,
	},
	{
		pokedex_id: 401,
		name: {
			fr: 'Crikzik',
			en: 'Kricketot',
			jp: 'コロボーシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/401/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/401/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 37,
			atk: 25,
			def: 41,
			spe_atk: 25,
			spe_def: 41,
			vit: 25,
		},
		category: 'Pokémon Criquet',
		generation: 4,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 402,
		name: {
			fr: 'Mélokrik',
			en: 'Kricketune',
			jp: 'コロトック',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/402/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/402/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 77,
			atk: 85,
			def: 51,
			spe_atk: 55,
			spe_def: 51,
			vit: 65,
		},
		category: 'Pokémon Criquet',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 403,
		name: {
			fr: 'Lixy',
			en: 'Shinx',
			jp: 'コリンク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/403/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/403/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 45,
			atk: 65,
			def: 34,
			spe_atk: 40,
			spe_def: 34,
			vit: 45,
		},
		category: 'Pokémon Flash',
		generation: 4,
		catch_rate: 235,
		rareté: 1,
	},
	{
		pokedex_id: 404,
		name: {
			fr: 'Luxio',
			en: 'Luxio',
			jp: 'ルクシオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/404/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/404/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 60,
			atk: 85,
			def: 49,
			spe_atk: 60,
			spe_def: 49,
			vit: 60,
		},
		category: 'Pokémon Étincelle',
		generation: 4,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 405,
		name: {
			fr: 'Luxray',
			en: 'Luxray',
			jp: 'レントラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/405/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/405/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 79,
			spe_atk: 95,
			spe_def: 79,
			vit: 70,
		},
		category: 'Pokémon Brilloeil',
		generation: 4,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 406,
		name: {
			fr: 'Rozbouton',
			en: 'Budew',
			jp: 'スボミー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/406/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/406/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 30,
			def: 35,
			spe_atk: 50,
			spe_def: 70,
			vit: 55,
		},
		category: 'Pokémon Bourgeon',
		generation: 4,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 407,
		name: {
			fr: 'Roserade',
			en: 'Roserade',
			jp: 'ロズレイド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/407/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/407/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 70,
			def: 65,
			spe_atk: 125,
			spe_def: 105,
			vit: 90,
		},
		category: 'Pokémon Bouquet',
		generation: 4,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 408,
		name: {
			fr: 'Kranidos',
			en: 'Cranidos',
			jp: 'ズガイドス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/408/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/408/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 67,
			atk: 125,
			def: 40,
			spe_atk: 30,
			spe_def: 30,
			vit: 58,
		},
		category: "Pokémon Coud'Boule",
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 409,
		name: {
			fr: 'Charkos',
			en: 'Rampardos',
			jp: 'ラムパルド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/409/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/409/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 97,
			atk: 165,
			def: 60,
			spe_atk: 65,
			spe_def: 50,
			vit: 58,
		},
		category: "Pokémon Coud'Boule",
		generation: 4,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 410,
		name: {
			fr: 'Dinoclier',
			en: 'Shieldon',
			jp: 'タテトプス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/410/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/410/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 30,
			atk: 42,
			def: 118,
			spe_atk: 42,
			spe_def: 88,
			vit: 30,
		},
		category: 'Pokémon Bouclier',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 411,
		name: {
			fr: 'Bastiodon',
			en: 'Bastiodon',
			jp: 'トリデプス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/411/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/411/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 60,
			atk: 52,
			def: 168,
			spe_atk: 47,
			spe_def: 138,
			vit: 30,
		},
		category: 'Pokémon Bouclier',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 412,
		name: {
			fr: 'Cheniti',
			en: 'Burmy',
			jp: 'ミノムッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/412/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/412/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 40,
			atk: 29,
			def: 45,
			spe_atk: 29,
			spe_def: 45,
			vit: 36,
		},
		category: 'Pokémon Ver Caché',
		generation: 4,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 413,
		name: {
			fr: 'Cheniselle',
			en: 'Wormadam',
			jp: 'ミノマダム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/413/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/413/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 59,
			def: 85,
			spe_atk: 79,
			spe_def: 105,
			vit: 36,
		},
		category: 'Pokémon Ver Caché',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 414,
		name: {
			fr: 'Papilord',
			en: 'Mothim',
			jp: 'ガーメイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/414/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/414/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 94,
			def: 50,
			spe_atk: 94,
			spe_def: 50,
			vit: 66,
		},
		category: 'Pokémon Phalène',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 415,
		name: {
			fr: 'Apitrini',
			en: 'Combee',
			jp: 'ミツハニー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/415/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/415/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 30,
			atk: 30,
			def: 42,
			spe_atk: 30,
			spe_def: 42,
			vit: 70,
		},
		category: 'Pokémon Miniabeille',
		generation: 4,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 416,
		name: {
			fr: 'Apireine',
			en: 'Vespiquen',
			jp: 'ビークイン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/416/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/416/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 80,
			def: 102,
			spe_atk: 80,
			spe_def: 102,
			vit: 40,
		},
		category: 'Pokémon Ruche',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 417,
		name: {
			fr: 'Pachirisu',
			en: 'Pachirisu',
			jp: 'パチリス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/417/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/417/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 60,
			atk: 45,
			def: 70,
			spe_atk: 45,
			spe_def: 90,
			vit: 95,
		},
		category: 'Pokémon Ecurélec',
		generation: 4,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 418,
		name: {
			fr: 'Mustébouée',
			en: 'Buizel',
			jp: 'ブイゼル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/418/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/418/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 65,
			def: 35,
			spe_atk: 60,
			spe_def: 30,
			vit: 85,
		},
		category: 'Pokémon Aquabelette',
		generation: 4,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 419,
		name: {
			fr: 'Mustéflott',
			en: 'Floatzel',
			jp: 'フローゼル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/419/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/419/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 85,
			atk: 105,
			def: 55,
			spe_atk: 85,
			spe_def: 50,
			vit: 115,
		},
		category: 'Pokémon Aquabelette',
		generation: 4,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 420,
		name: {
			fr: 'Ceribou',
			en: 'Cherubi',
			jp: 'チェリンボ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/420/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/420/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 45,
			atk: 35,
			def: 45,
			spe_atk: 62,
			spe_def: 53,
			vit: 35,
		},
		category: 'Pokémon Cerise',
		generation: 4,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 421,
		name: {
			fr: 'Ceriflor',
			en: 'Cherrim',
			jp: 'チェリム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/421/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/421/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 70,
			atk: 60,
			def: 70,
			spe_atk: 87,
			spe_def: 78,
			vit: 85,
		},
		category: 'Pokémon Floraison',
		generation: 4,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 422,
		name: {
			fr: 'Sancoki',
			en: 'Shellos',
			jp: 'カラナクシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/422/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/422/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 76,
			atk: 48,
			def: 48,
			spe_atk: 57,
			spe_def: 62,
			vit: 34,
		},
		category: 'Pokémon Aqualimace',
		generation: 4,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 423,
		name: {
			fr: 'Tritosor',
			en: 'Gastrodon',
			jp: 'トリトドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/423/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/423/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 111,
			atk: 83,
			def: 68,
			spe_atk: 92,
			spe_def: 82,
			vit: 39,
		},
		category: 'Pokémon Aqualimace',
		generation: 4,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 424,
		name: {
			fr: 'Capidextre',
			en: 'Ambipom',
			jp: 'エテボース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/424/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/424/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 75,
			atk: 100,
			def: 66,
			spe_atk: 60,
			spe_def: 66,
			vit: 115,
		},
		category: 'Pokémon Longqueue',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 425,
		name: {
			fr: 'Baudrive',
			en: 'Drifloon',
			jp: 'フワンテ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/425/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/425/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 90,
			atk: 50,
			def: 34,
			spe_atk: 60,
			spe_def: 44,
			vit: 70,
		},
		category: 'Pokémon Bouboule',
		generation: 4,
		catch_rate: 125,
		rareté: 2,
	},
	{
		pokedex_id: 426,
		name: {
			fr: 'Grodrive',
			en: 'Drifblim',
			jp: 'フワライド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/426/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/426/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 150,
			atk: 80,
			def: 44,
			spe_atk: 90,
			spe_def: 54,
			vit: 80,
		},
		category: 'Pokémon Ballon',
		generation: 4,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 427,
		name: {
			fr: 'Laporeille',
			en: 'Buneary',
			jp: 'ミミロル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/427/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/427/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 55,
			atk: 66,
			def: 44,
			spe_atk: 44,
			spe_def: 56,
			vit: 85,
		},
		category: 'Pokémon Lapin',
		generation: 4,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 428,
		name: {
			fr: 'Lockpin',
			en: 'Lopunny',
			jp: 'ミミロップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/428/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/428/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 65,
			atk: 76,
			def: 84,
			spe_atk: 54,
			spe_def: 96,
			vit: 105,
		},
		category: 'Pokémon Lapin',
		generation: 4,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 429,
		name: {
			fr: 'Magirêve',
			en: 'Mismagius',
			jp: 'ムウマージ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/429/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/429/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 60,
			spe_atk: 105,
			spe_def: 105,
			vit: 105,
		},
		category: 'Pokémon Magique',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 430,
		name: {
			fr: 'Corboss',
			en: 'Honchkrow',
			jp: 'ドンカラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/430/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/430/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 125,
			def: 52,
			spe_atk: 105,
			spe_def: 52,
			vit: 71,
		},
		category: 'Pokémon Big Boss',
		generation: 4,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 431,
		name: {
			fr: 'Chaglam',
			en: 'Glameow',
			jp: 'ニャルマー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/431/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/431/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 49,
			atk: 55,
			def: 42,
			spe_atk: 42,
			spe_def: 37,
			vit: 85,
		},
		category: 'Pokémon Chafouin',
		generation: 4,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 432,
		name: {
			fr: 'Chaffreux',
			en: 'Purugly',
			jp: 'ブニャット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/432/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/432/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 71,
			atk: 82,
			def: 64,
			spe_atk: 64,
			spe_def: 59,
			vit: 112,
		},
		category: 'Pokémon Chatigre',
		generation: 4,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 433,
		name: {
			fr: 'Korillon',
			en: 'Chingling',
			jp: 'リーシャン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/433/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/433/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 45,
			atk: 30,
			def: 50,
			spe_atk: 65,
			spe_def: 50,
			vit: 45,
		},
		category: 'Pokémon Clochette',
		generation: 4,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 434,
		name: {
			fr: 'Moufouette',
			en: 'Stunky',
			jp: 'スカンプー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/434/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/434/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 63,
			atk: 63,
			def: 47,
			spe_atk: 41,
			spe_def: 41,
			vit: 74,
		},
		category: 'Pokémon Moufette',
		generation: 4,
		catch_rate: 225,
		rareté: 3,
	},
	{
		pokedex_id: 435,
		name: {
			fr: 'Moufflair',
			en: 'Skuntank',
			jp: 'スカタンク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/435/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/435/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 103,
			atk: 93,
			def: 67,
			spe_atk: 71,
			spe_def: 61,
			vit: 84,
		},
		category: 'Pokémon Moufette',
		generation: 4,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 436,
		name: {
			fr: 'Archéomire',
			en: 'Bronzor',
			jp: 'ドーミラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/436/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/436/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 57,
			atk: 24,
			def: 86,
			spe_atk: 24,
			spe_def: 86,
			vit: 23,
		},
		category: 'Pokémon Bronze',
		generation: 4,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 437,
		name: {
			fr: 'Archéodong',
			en: 'Bronzong',
			jp: 'ドータクン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/437/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/437/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 67,
			atk: 89,
			def: 116,
			spe_atk: 79,
			spe_def: 116,
			vit: 33,
		},
		category: 'Pokémon Clochebronze',
		generation: 4,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 438,
		name: {
			fr: 'Manzaï',
			en: 'Bonsly',
			jp: 'ウソハチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/438/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/438/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 50,
			atk: 80,
			def: 95,
			spe_atk: 10,
			spe_def: 45,
			vit: 10,
		},
		category: 'Pokémon Bonsaï',
		generation: 4,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 439,
		name: {
			fr: 'Mime Jr.',
			en: 'Mime Jr.',
			jp: 'マネネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/439/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/439/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 20,
			atk: 25,
			def: 45,
			spe_atk: 70,
			spe_def: 90,
			vit: 60,
		},
		category: 'Pokémon Mime',
		generation: 4,
		catch_rate: 145,
		rareté: 1,
	},
	{
		pokedex_id: 440,
		name: {
			fr: 'Ptiravi',
			en: 'Happiny',
			jp: 'ピンプク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/440/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/440/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 100,
			atk: 5,
			def: 5,
			spe_atk: 15,
			spe_def: 65,
			vit: 30,
		},
		category: 'Pokémon Maisonjouet',
		generation: 4,
		catch_rate: 130,
		rareté: 2,
	},
	{
		pokedex_id: 441,
		name: {
			fr: 'Pijako',
			en: 'Chatot',
			jp: 'ペラップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/441/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/441/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 76,
			atk: 65,
			def: 45,
			spe_atk: 92,
			spe_def: 42,
			vit: 91,
		},
		category: 'Pokémon Note Musique',
		generation: 4,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 442,
		name: {
			fr: 'Spiritomb',
			en: 'Spiritomb',
			jp: 'ミカルゲ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/442/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/442/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 50,
			atk: 92,
			def: 108,
			spe_atk: 92,
			spe_def: 108,
			vit: 35,
		},
		category: 'Pokémon Interdit',
		generation: 4,
		catch_rate: 100,
		rareté: 3,
	},
	{
		pokedex_id: 443,
		name: {
			fr: 'Griknot',
			en: 'Gible',
			jp: 'フカマル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/443/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/443/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 58,
			atk: 70,
			def: 45,
			spe_atk: 40,
			spe_def: 45,
			vit: 42,
		},
		category: 'Pokémon Terrequin',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 444,
		name: {
			fr: 'Carmache',
			en: 'Gabite',
			jp: 'ガバイト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/444/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/444/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 68,
			atk: 90,
			def: 65,
			spe_atk: 50,
			spe_def: 55,
			vit: 82,
		},
		category: 'Pokémon Caverne',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 445,
		name: {
			fr: 'Carchacrok',
			en: 'Garchomp',
			jp: 'ガブリアス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/445/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/445/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 108,
			atk: 130,
			def: 95,
			spe_atk: 80,
			spe_def: 85,
			vit: 102,
		},
		category: 'Pokémon Supersonic',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 446,
		name: {
			fr: 'Goinfrex',
			en: 'Munchlax',
			jp: 'ゴンベ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/446/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/446/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 135,
			atk: 85,
			def: 40,
			spe_atk: 40,
			spe_def: 85,
			vit: 5,
		},
		category: 'Pokémon Goinfre',
		generation: 4,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 447,
		name: {
			fr: 'Riolu',
			en: 'Riolu',
			jp: 'リオル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/447/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/447/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 40,
			atk: 70,
			def: 40,
			spe_atk: 35,
			spe_def: 40,
			vit: 60,
		},
		category: 'Pokémon Émanation',
		generation: 4,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 448,
		name: {
			fr: 'Lucario',
			en: 'Lucario',
			jp: 'ルカリオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/448/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/448/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 70,
			atk: 110,
			def: 70,
			spe_atk: 115,
			spe_def: 70,
			vit: 90,
		},
		category: 'Pokémon Aura',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 449,
		name: {
			fr: 'Hippopotas',
			en: 'Hippopotas',
			jp: 'ヒポポタス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/449/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/449/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 68,
			atk: 72,
			def: 78,
			spe_atk: 38,
			spe_def: 42,
			vit: 32,
		},
		category: 'Pokémon Hippo',
		generation: 4,
		catch_rate: 140,
		rareté: 1,
	},
	{
		pokedex_id: 450,
		name: {
			fr: 'Hippodocus',
			en: 'Hippowdon',
			jp: 'カバルドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/450/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/450/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 108,
			atk: 112,
			def: 118,
			spe_atk: 68,
			spe_def: 72,
			vit: 47,
		},
		category: 'Pokémon Poids Lourd',
		generation: 4,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 451,
		name: {
			fr: 'Rapion',
			en: 'Skorupi',
			jp: 'スコルピ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/451/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/451/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 40,
			atk: 50,
			def: 90,
			spe_atk: 30,
			spe_def: 55,
			vit: 65,
		},
		category: 'Pokémon Scorpion',
		generation: 4,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 452,
		name: {
			fr: 'Drascore',
			en: 'Drapion',
			jp: 'ドラピオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/452/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/452/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 90,
			def: 110,
			spe_atk: 60,
			spe_def: 75,
			vit: 95,
		},
		category: 'Pokémon Scorpogre',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 453,
		name: {
			fr: 'Cradopaud',
			en: 'Croagunk',
			jp: 'グレッグル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/453/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/453/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 48,
			atk: 61,
			def: 40,
			spe_atk: 61,
			spe_def: 40,
			vit: 50,
		},
		category: 'Pokémon Toxique',
		generation: 4,
		catch_rate: 140,
		rareté: 3,
	},
	{
		pokedex_id: 454,
		name: {
			fr: 'Coatox',
			en: 'Toxicroak',
			jp: 'ドクロッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/454/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/454/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 83,
			atk: 106,
			def: 65,
			spe_atk: 86,
			spe_def: 65,
			vit: 85,
		},
		category: 'Pokémon Toxique',
		generation: 4,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 455,
		name: {
			fr: 'Vortente',
			en: 'Carnivine',
			jp: 'マスキッパ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/455/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/455/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 74,
			atk: 100,
			def: 72,
			spe_atk: 90,
			spe_def: 72,
			vit: 46,
		},
		category: 'Pokémon Chopinsecte',
		generation: 4,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 456,
		name: {
			fr: 'Écayon',
			en: 'Finneon',
			jp: 'ケイコウオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/456/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/456/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 49,
			atk: 49,
			def: 56,
			spe_atk: 49,
			spe_def: 61,
			vit: 66,
		},
		category: 'Pokémon Poisson Ailé',
		generation: 4,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 457,
		name: {
			fr: 'Luminéon',
			en: 'Lumineon',
			jp: 'ネオラント',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/457/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/457/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 69,
			atk: 69,
			def: 76,
			spe_atk: 69,
			spe_def: 86,
			vit: 91,
		},
		category: 'Pokémon Néon',
		generation: 4,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 458,
		name: {
			fr: 'Babimanta',
			en: 'Mantyke',
			jp: 'タマンタ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/458/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/458/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 45,
			atk: 20,
			def: 50,
			spe_atk: 60,
			spe_def: 120,
			vit: 50,
		},
		category: 'Pokémon Cervolant',
		generation: 4,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 459,
		name: {
			fr: 'Blizzi',
			en: 'Snover',
			jp: 'ユキカブリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/459/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/459/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 60,
			atk: 62,
			def: 50,
			spe_atk: 60,
			spe_def: 62,
			vit: 40,
		},
		category: 'Pokémon Arbregelé',
		generation: 4,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 460,
		name: {
			fr: 'Blizzaroi',
			en: 'Abomasnow',
			jp: 'ユキノオー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/460/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/460/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 90,
			atk: 92,
			def: 75,
			spe_atk: 92,
			spe_def: 85,
			vit: 60,
		},
		category: 'Pokémon Arbregelé',
		generation: 4,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 461,
		name: {
			fr: 'Dimoret',
			en: 'Weavile',
			jp: 'マニューラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/461/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/461/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 70,
			atk: 120,
			def: 65,
			spe_atk: 45,
			spe_def: 85,
			vit: 125,
		},
		category: 'Pokémon Grifacérée',
		generation: 4,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 462,
		name: {
			fr: 'Magnézone',
			en: 'Magnezone',
			jp: 'ジバコイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/462/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/462/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 70,
			atk: 70,
			def: 115,
			spe_atk: 130,
			spe_def: 90,
			vit: 60,
		},
		category: 'Pokémon Aimant',
		generation: 4,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 463,
		name: {
			fr: 'Coudlangue',
			en: 'Lickilicky',
			jp: 'ベロベルト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/463/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/463/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 110,
			atk: 85,
			def: 95,
			spe_atk: 80,
			spe_def: 95,
			vit: 50,
		},
		category: 'Pokémon Lécheur',
		generation: 4,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 464,
		name: {
			fr: 'Rhinastoc',
			en: 'Rhyperior',
			jp: 'ドサイドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/464/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/464/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 115,
			atk: 140,
			def: 130,
			spe_atk: 55,
			spe_def: 55,
			vit: 40,
		},
		category: 'Pokémon Perceur',
		generation: 4,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 465,
		name: {
			fr: 'Bouldeneu',
			en: 'Tangrowth',
			jp: 'モジャンボ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/465/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/465/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 125,
			spe_atk: 110,
			spe_def: 50,
			vit: 50,
		},
		category: 'Pokémon Vigne',
		generation: 4,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 466,
		name: {
			fr: 'Élekable',
			en: 'Electivire',
			jp: 'エレキブル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/466/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/466/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 75,
			atk: 123,
			def: 67,
			spe_atk: 95,
			spe_def: 85,
			vit: 95,
		},
		category: 'Pokémon Foudrélec',
		generation: 4,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 467,
		name: {
			fr: 'Maganon',
			en: 'Magmortar',
			jp: 'ブーバーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/467/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/467/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 75,
			atk: 95,
			def: 67,
			spe_atk: 125,
			spe_def: 95,
			vit: 83,
		},
		category: 'Pokémon Explosion',
		generation: 4,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 468,
		name: {
			fr: 'Togekiss',
			en: 'Togekiss',
			jp: 'トゲキッス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/468/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/468/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 50,
			def: 95,
			spe_atk: 120,
			spe_def: 115,
			vit: 80,
		},
		category: 'Pokémon Célébration',
		generation: 4,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 469,
		name: {
			fr: 'Yanmega',
			en: 'Yanmega',
			jp: 'メガヤンマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/469/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/469/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 86,
			atk: 76,
			def: 86,
			spe_atk: 116,
			spe_def: 56,
			vit: 95,
		},
		category: 'Pokémon Libellogre',
		generation: 4,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 470,
		name: {
			fr: 'Phyllali',
			en: 'Leafeon',
			jp: 'リーフィア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/470/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/470/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 65,
			atk: 110,
			def: 130,
			spe_atk: 60,
			spe_def: 65,
			vit: 95,
		},
		category: 'Pokémon Verdoyant',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 471,
		name: {
			fr: 'Givrali',
			en: 'Glaceon',
			jp: 'グレイシア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/471/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/471/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 65,
			atk: 60,
			def: 110,
			spe_atk: 130,
			spe_def: 95,
			vit: 65,
		},
		category: 'Pokémon Poudreuse',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 472,
		name: {
			fr: 'Scorvol',
			en: 'Gliscor',
			jp: 'グライオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/472/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/472/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 95,
			def: 125,
			spe_atk: 45,
			spe_def: 75,
			vit: 95,
		},
		category: 'Pokémon Scorpicroc',
		generation: 4,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 473,
		name: {
			fr: 'Mammochon',
			en: 'Mamoswine',
			jp: 'マンムー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/473/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/473/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 110,
			atk: 130,
			def: 80,
			spe_atk: 70,
			spe_def: 60,
			vit: 80,
		},
		category: 'Pokémon Deudéfenses',
		generation: 4,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 474,
		name: {
			fr: 'Porygon-Z',
			en: 'Porygon-Z',
			jp: 'ポリゴンZ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/474/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/474/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 85,
			atk: 80,
			def: 70,
			spe_atk: 135,
			spe_def: 75,
			vit: 90,
		},
		category: 'Pokémon Virtuel',
		generation: 4,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 475,
		name: {
			fr: 'Gallame',
			en: 'Gallade',
			jp: 'エルレイド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/475/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/475/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 68,
			atk: 125,
			def: 65,
			spe_atk: 65,
			spe_def: 115,
			vit: 80,
		},
		category: 'Pokémon Lame',
		generation: 4,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 476,
		name: {
			fr: 'Tarinorme',
			en: 'Probopass',
			jp: 'ダイノーズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/476/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/476/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 60,
			atk: 55,
			def: 145,
			spe_atk: 75,
			spe_def: 150,
			vit: 40,
		},
		category: 'Pokémon Boussole',
		generation: 4,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 477,
		name: {
			fr: 'Noctunoir',
			en: 'Dusknoir',
			jp: 'ヨノワール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/477/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/477/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 45,
			atk: 100,
			def: 135,
			spe_atk: 65,
			spe_def: 135,
			vit: 45,
		},
		category: 'Pokémon Mainpince',
		generation: 4,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 478,
		name: {
			fr: 'Momartik',
			en: 'Froslass',
			jp: 'ユキメノコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/478/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/478/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 70,
			atk: 80,
			def: 70,
			spe_atk: 80,
			spe_def: 70,
			vit: 110,
		},
		category: 'Pokémon Enneigement',
		generation: 4,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 479,
		name: {
			fr: 'Motisma',
			en: 'Rotom',
			jp: 'ロトム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/479/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/479/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 77,
			spe_atk: 95,
			spe_def: 77,
			vit: 91,
		},
		category: 'Pokémon Plasma',
		generation: 4,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 480,
		name: {
			fr: 'Créhelf',
			en: 'Uxie',
			jp: 'ユクシー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/480/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/480/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 75,
			atk: 75,
			def: 130,
			spe_atk: 75,
			spe_def: 130,
			vit: 95,
		},
		category: 'Pokémon Savoir',
		generation: 4,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 481,
		name: {
			fr: 'Créfollet',
			en: 'Mesprit',
			jp: 'エムリット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/481/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/481/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 80,
			atk: 105,
			def: 105,
			spe_atk: 105,
			spe_def: 105,
			vit: 80,
		},
		category: 'Pokémon Émotion',
		generation: 4,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 482,
		name: {
			fr: 'Créfadet',
			en: 'Azelf',
			jp: 'アグノム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/482/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/482/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 75,
			atk: 125,
			def: 70,
			spe_atk: 125,
			spe_def: 70,
			vit: 115,
		},
		category: 'Pokémon Volonté',
		generation: 4,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 483,
		name: {
			fr: 'Dialga',
			en: 'Dialga',
			jp: 'ディアルガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/483/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/483/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 100,
			atk: 120,
			def: 120,
			spe_atk: 150,
			spe_def: 100,
			vit: 90,
		},
		category: 'Pokémon Temps',
		generation: 4,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 484,
		name: {
			fr: 'Palkia',
			en: 'Palkia',
			jp: 'パルキア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/484/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/484/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 90,
			atk: 120,
			def: 100,
			spe_atk: 150,
			spe_def: 120,
			vit: 100,
		},
		category: 'Pokémon Espace',
		generation: 4,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 485,
		name: {
			fr: 'Heatran',
			en: 'Heatran',
			jp: 'ヒードラン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/485/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/485/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 91,
			atk: 90,
			def: 106,
			spe_atk: 130,
			spe_def: 106,
			vit: 77,
		},
		category: 'Pokémon Caldeira',
		generation: 4,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 486,
		name: {
			fr: 'Regigigas',
			en: 'Regigigas',
			jp: 'レジギガス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/486/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/486/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 110,
			atk: 160,
			def: 110,
			spe_atk: 80,
			spe_def: 110,
			vit: 100,
		},
		category: 'Pokémon Prodigieux',
		generation: 4,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 487,
		name: {
			fr: 'Giratina',
			en: 'Giratina',
			jp: 'ギラティナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/487/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/487/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 150,
			atk: 100,
			def: 120,
			spe_atk: 100,
			spe_def: 120,
			vit: 90,
		},
		category: 'Pokémon Regénat',
		generation: 4,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 488,
		name: {
			fr: 'Cresselia',
			en: 'Cresselia',
			jp: 'クレセリア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/488/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/488/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 120,
			atk: 70,
			def: 120,
			spe_atk: 75,
			spe_def: 130,
			vit: 85,
		},
		category: 'Pokémon Lunaire',
		generation: 4,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 489,
		name: {
			fr: 'Phione',
			en: 'Phione',
			jp: 'フィオネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/489/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/489/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 80,
			atk: 80,
			def: 80,
			spe_atk: 80,
			spe_def: 80,
			vit: 80,
		},
		category: 'Pokémon Dérivenmer',
		generation: 4,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 490,
		name: {
			fr: 'Manaphy',
			en: 'Manaphy',
			jp: 'マナフィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/490/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/490/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 100,
			spe_atk: 100,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Voyagenmer',
		generation: 4,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 491,
		name: {
			fr: 'Darkrai',
			en: 'Darkrai',
			jp: 'ダークライ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/491/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/491/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 90,
			def: 90,
			spe_atk: 135,
			spe_def: 90,
			vit: 125,
		},
		category: 'Pokémon Noirtotal',
		generation: 4,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 492,
		name: {
			fr: 'Shaymin',
			en: 'Shaymin',
			jp: 'シェイミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/492/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/492/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 100,
			spe_atk: 100,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Gratitude',
		generation: 4,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 493,
		name: {
			fr: 'Arceus',
			en: 'Arceus',
			jp: 'アルセウス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/493/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/493/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 120,
			atk: 120,
			def: 120,
			spe_atk: 120,
			spe_def: 120,
			vit: 120,
		},
		category: 'Pokémon Alpha',
		generation: 4,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 494,
		name: {
			fr: 'Victini',
			en: 'Victini',
			jp: 'ビクティニ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/494/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 100,
			spe_atk: 100,
			spe_def: 100,
			vit: 100,
		},
		category: 'Pokémon Victoire',
		generation: 5,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 495,
		name: {
			fr: 'Vipélierre',
			en: 'Snivy',
			jp: 'ツタージャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/495/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/495/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 45,
			atk: 45,
			def: 55,
			spe_atk: 45,
			spe_def: 55,
			vit: 63,
		},
		category: 'Pokémon Serpenterbe',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 496,
		name: {
			fr: 'Lianaja',
			en: 'Servine',
			jp: 'ジャノビー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/496/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/496/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 75,
			spe_atk: 60,
			spe_def: 75,
			vit: 83,
		},
		category: 'Pokémon Serpenterbe',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 497,
		name: {
			fr: 'Majaspic',
			en: 'Serperior',
			jp: 'ジャローダ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/497/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/497/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 75,
			def: 95,
			spe_atk: 75,
			spe_def: 95,
			vit: 113,
		},
		category: 'Pokémon Majestueux',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 498,
		name: {
			fr: 'Gruikui',
			en: 'Tepig',
			jp: 'ポカブ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/498/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/498/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 63,
			def: 45,
			spe_atk: 45,
			spe_def: 45,
			vit: 45,
		},
		category: 'Pokémon Cochon Feu',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 499,
		name: {
			fr: 'Grotichon',
			en: 'Pignite',
			jp: 'チャオブー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/499/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/499/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 90,
			atk: 93,
			def: 55,
			spe_atk: 70,
			spe_def: 55,
			vit: 55,
		},
		category: 'Pokémon Cochon Feu',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 500,
		name: {
			fr: 'Roitiflam',
			en: 'Emboar',
			jp: 'エンブオー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/500/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/500/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 110,
			atk: 123,
			def: 65,
			spe_atk: 100,
			spe_def: 65,
			vit: 65,
		},
		category: 'Pokémon Grochon Feu',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 501,
		name: {
			fr: 'Moustillon',
			en: 'Oshawott',
			jp: 'ミジュマル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/501/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/501/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 55,
			def: 45,
			spe_atk: 63,
			spe_def: 45,
			vit: 45,
		},
		category: 'Pokémon Loutre',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 502,
		name: {
			fr: 'Mateloutre',
			en: 'Dewott',
			jp: 'フタチマル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/502/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/502/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 75,
			atk: 75,
			def: 60,
			spe_atk: 83,
			spe_def: 60,
			vit: 60,
		},
		category: 'Pokémon Entraînement',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 503,
		name: {
			fr: 'Clamiral',
			en: 'Samurott',
			jp: 'ダイケンキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/503/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/503/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 95,
			atk: 100,
			def: 85,
			spe_atk: 108,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Dignitaire',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 504,
		name: {
			fr: 'Ratentif',
			en: 'Patrat',
			jp: 'ミネズミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/504/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/504/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 45,
			atk: 55,
			def: 39,
			spe_atk: 35,
			spe_def: 39,
			vit: 42,
		},
		category: 'Pokémon Espion',
		generation: 5,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 505,
		name: {
			fr: 'Miradar',
			en: 'Watchog',
			jp: 'ミルホッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/505/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/505/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 60,
			atk: 85,
			def: 69,
			spe_atk: 60,
			spe_def: 69,
			vit: 77,
		},
		category: 'Pokémon Vigilant',
		generation: 5,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 506,
		name: {
			fr: 'Ponchiot',
			en: 'Lillipup',
			jp: 'ヨーテリー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/506/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/506/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 45,
			atk: 60,
			def: 45,
			spe_atk: 25,
			spe_def: 45,
			vit: 55,
		},
		category: 'Pokémon Chiot',
		generation: 5,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 507,
		name: {
			fr: 'Ponchien',
			en: 'Herdier',
			jp: 'ハーデリア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/507/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/507/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 65,
			atk: 80,
			def: 65,
			spe_atk: 35,
			spe_def: 65,
			vit: 60,
		},
		category: 'Pokémon Chien Fidèle',
		generation: 5,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 508,
		name: {
			fr: 'Mastouffe',
			en: 'Stoutland',
			jp: 'ムーランド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/508/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/508/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 85,
			atk: 110,
			def: 90,
			spe_atk: 45,
			spe_def: 90,
			vit: 80,
		},
		category: 'Pokémon Magnanime',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 509,
		name: {
			fr: 'Chacripan',
			en: 'Purrloin',
			jp: 'チョロネコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/509/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/509/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 41,
			atk: 50,
			def: 37,
			spe_atk: 50,
			spe_def: 37,
			vit: 66,
		},
		category: 'Pokémon Scélérat',
		generation: 5,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 510,
		name: {
			fr: 'Léopardus',
			en: 'Liepard',
			jp: 'レパルダス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/510/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/510/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 64,
			atk: 88,
			def: 50,
			spe_atk: 88,
			spe_def: 50,
			vit: 106,
		},
		category: 'Pokémon Implacable',
		generation: 5,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 511,
		name: {
			fr: 'Feuillajou',
			en: 'Pansage',
			jp: 'ヤナップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/511/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/511/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 50,
			atk: 53,
			def: 48,
			spe_atk: 53,
			spe_def: 48,
			vit: 64,
		},
		category: 'Pokémon Singe Herbe',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 512,
		name: {
			fr: 'Feuiloutan',
			en: 'Simisage',
			jp: 'ヤナッキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/512/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/512/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 98,
			def: 63,
			spe_atk: 98,
			spe_def: 63,
			vit: 101,
		},
		category: 'Pokémon Singépine',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 513,
		name: {
			fr: 'Flamajou',
			en: 'Pansear',
			jp: 'バオップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/513/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/513/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 50,
			atk: 53,
			def: 48,
			spe_atk: 53,
			spe_def: 48,
			vit: 64,
		},
		category: 'Pokémon Brûlant',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 514,
		name: {
			fr: 'Flamoutan',
			en: 'Simisear',
			jp: 'バオッキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/514/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/514/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 75,
			atk: 98,
			def: 63,
			spe_atk: 98,
			spe_def: 63,
			vit: 101,
		},
		category: 'Pokémon Braise',
		generation: 5,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 515,
		name: {
			fr: 'Flotajou',
			en: 'Panpour',
			jp: 'ヒヤップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/515/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/515/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 53,
			def: 48,
			spe_atk: 53,
			spe_def: 48,
			vit: 64,
		},
		category: "Pokémon Jet d'Eau",
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 516,
		name: {
			fr: 'Flotoutan',
			en: 'Simipour',
			jp: 'ヒヤッキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/516/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/516/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 75,
			atk: 98,
			def: 63,
			spe_atk: 98,
			spe_def: 63,
			vit: 101,
		},
		category: 'Pokémon Drainage',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 517,
		name: {
			fr: 'Munna',
			en: 'Munna',
			jp: 'ムンナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/517/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/517/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 76,
			atk: 25,
			def: 45,
			spe_atk: 67,
			spe_def: 55,
			vit: 24,
		},
		category: 'Pokémon Mangerêve',
		generation: 5,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 518,
		name: {
			fr: 'Mushana',
			en: 'Musharna',
			jp: 'ムシャーナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/518/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/518/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 116,
			atk: 55,
			def: 85,
			spe_atk: 107,
			spe_def: 95,
			vit: 29,
		},
		category: 'Pokémon Rêveur',
		generation: 5,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 519,
		name: {
			fr: 'Poichigeon',
			en: 'Pidove',
			jp: 'マメパト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/519/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/519/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 50,
			atk: 55,
			def: 50,
			spe_atk: 36,
			spe_def: 30,
			vit: 43,
		},
		category: 'Pokémon Tipigeon',
		generation: 5,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 520,
		name: {
			fr: 'Colombeau',
			en: 'Tranquill',
			jp: 'ハトーボー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/520/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/520/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 62,
			atk: 77,
			def: 62,
			spe_atk: 50,
			spe_def: 42,
			vit: 65,
		},
		category: 'Pokémon Sauvapigeon',
		generation: 5,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 521,
		name: {
			fr: 'Déflaisan',
			en: 'Unfezant',
			jp: 'ケンホロウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/521/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/521/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 80,
			atk: 115,
			def: 80,
			spe_atk: 65,
			spe_def: 55,
			vit: 93,
		},
		category: 'Pokémon Fier',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 522,
		name: {
			fr: 'Zébibron',
			en: 'Blitzle',
			jp: 'シママ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/522/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/522/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 45,
			atk: 60,
			def: 32,
			spe_atk: 50,
			spe_def: 32,
			vit: 76,
		},
		category: 'Pokémon Étincélec',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 523,
		name: {
			fr: 'Zéblitz',
			en: 'Zebstrika',
			jp: 'ゼブライカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/523/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/523/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 75,
			atk: 100,
			def: 63,
			spe_atk: 80,
			spe_def: 63,
			vit: 116,
		},
		category: 'Pokémon Foudrélec',
		generation: 5,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 524,
		name: {
			fr: 'Nodulithe',
			en: 'Roggenrola',
			jp: 'ダンゴロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/524/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/524/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 55,
			atk: 75,
			def: 85,
			spe_atk: 25,
			spe_def: 25,
			vit: 15,
		},
		category: 'Pokémon Manteau',
		generation: 5,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 525,
		name: {
			fr: 'Géolithe',
			en: 'Boldore',
			jp: 'ガントル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/525/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/525/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 70,
			atk: 105,
			def: 105,
			spe_atk: 50,
			spe_def: 40,
			vit: 20,
		},
		category: 'Pokémon Minerai',
		generation: 5,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 526,
		name: {
			fr: 'Gigalithe',
			en: 'Gigalith',
			jp: 'ギガイアス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/526/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/526/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 85,
			atk: 135,
			def: 130,
			spe_atk: 60,
			spe_def: 80,
			vit: 25,
		},
		category: 'Pokémon Surpression',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 527,
		name: {
			fr: 'Chovsourir',
			en: 'Woobat',
			jp: 'コロモリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/527/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/527/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 65,
			atk: 45,
			def: 43,
			spe_atk: 55,
			spe_def: 43,
			vit: 72,
		},
		category: 'Pokémon Chovsouris',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 528,
		name: {
			fr: 'Rhinolove',
			en: 'Swoobat',
			jp: 'ココロモリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/528/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/528/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 67,
			atk: 57,
			def: 55,
			spe_atk: 77,
			spe_def: 55,
			vit: 114,
		},
		category: 'Pokémon Cupidon',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 529,
		name: {
			fr: 'Rototaupe',
			en: 'Drilbur',
			jp: 'モグリュー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/529/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/529/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 85,
			def: 40,
			spe_atk: 30,
			spe_def: 45,
			vit: 68,
		},
		category: 'Pokémon Taupe',
		generation: 5,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 530,
		name: {
			fr: 'Minotaupe',
			en: 'Excadrill',
			jp: 'ドリュウズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/530/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/530/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 110,
			atk: 135,
			def: 60,
			spe_atk: 50,
			spe_def: 65,
			vit: 88,
		},
		category: 'Pokémon Souterrain',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 531,
		name: {
			fr: 'Nanméouïe',
			en: 'Audino',
			jp: 'タブンネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/531/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/531/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 103,
			atk: 60,
			def: 86,
			spe_atk: 60,
			spe_def: 86,
			vit: 50,
		},
		category: 'Pokémon Audition',
		generation: 5,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 532,
		name: {
			fr: 'Charpenti',
			en: 'Timburr',
			jp: 'ドッコラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/532/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/532/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 75,
			atk: 80,
			def: 55,
			spe_atk: 25,
			spe_def: 35,
			vit: 35,
		},
		category: 'Pokémon Costaud',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 533,
		name: {
			fr: 'Ouvrifier',
			en: 'Gurdurr',
			jp: 'ドテッコツ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/533/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/533/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 85,
			atk: 105,
			def: 85,
			spe_atk: 40,
			spe_def: 50,
			vit: 40,
		},
		category: 'Pokémon Costaud',
		generation: 5,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 534,
		name: {
			fr: 'Bétochef',
			en: 'Conkeldurr',
			jp: 'ローブシン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/534/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/534/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 105,
			atk: 140,
			def: 95,
			spe_atk: 55,
			spe_def: 65,
			vit: 45,
		},
		category: 'Pokémon Costaud',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 535,
		name: {
			fr: 'Tritonde',
			en: 'Tympole',
			jp: 'オタマロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/535/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/535/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 40,
			spe_atk: 50,
			spe_def: 40,
			vit: 64,
		},
		category: 'Pokémon Têtard',
		generation: 5,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 536,
		name: {
			fr: 'Batracné',
			en: 'Palpitoad',
			jp: 'ガマガル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/536/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/536/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 65,
			def: 55,
			spe_atk: 65,
			spe_def: 55,
			vit: 69,
		},
		category: 'Pokémon Vibration',
		generation: 5,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 537,
		name: {
			fr: 'Crapustule',
			en: 'Seismitoad',
			jp: 'ガマゲロゲ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/537/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/537/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 105,
			atk: 95,
			def: 75,
			spe_atk: 85,
			spe_def: 75,
			vit: 74,
		},
		category: 'Pokémon Vibration',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 538,
		name: {
			fr: 'Judokrak',
			en: 'Throh',
			jp: 'ナゲキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/538/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/538/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 120,
			atk: 100,
			def: 85,
			spe_atk: 30,
			spe_def: 85,
			vit: 45,
		},
		category: 'Pokémon Judo',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 539,
		name: {
			fr: 'Karaclée',
			en: 'Sawk',
			jp: 'ダゲキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/539/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/539/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 75,
			atk: 125,
			def: 75,
			spe_atk: 30,
			spe_def: 75,
			vit: 85,
		},
		category: 'Pokémon Karaté',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 540,
		name: {
			fr: 'Larveyette',
			en: 'Sewaddle',
			jp: 'クルミル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/540/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/540/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 45,
			atk: 53,
			def: 70,
			spe_atk: 40,
			spe_def: 60,
			vit: 42,
		},
		category: 'Pokémon Couture',
		generation: 5,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 541,
		name: {
			fr: 'Couverdure',
			en: 'Swadloon',
			jp: 'クルマユ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/541/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/541/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 55,
			atk: 63,
			def: 90,
			spe_atk: 50,
			spe_def: 80,
			vit: 42,
		},
		category: 'Pokémon Capefeuille',
		generation: 5,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 542,
		name: {
			fr: 'Manternel',
			en: 'Leavanny',
			jp: 'ハハコモリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/542/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/542/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 103,
			def: 80,
			spe_atk: 70,
			spe_def: 80,
			vit: 92,
		},
		category: 'Pokémon Précepteur',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 543,
		name: {
			fr: 'Venipatte',
			en: 'Venipede',
			jp: 'フシデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/543/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/543/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 30,
			atk: 45,
			def: 59,
			spe_atk: 30,
			spe_def: 39,
			vit: 57,
		},
		category: 'Pokémon Chilopode',
		generation: 5,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 544,
		name: {
			fr: 'Scobolide',
			en: 'Whirlipede',
			jp: 'ホイーガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/544/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/544/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 55,
			def: 99,
			spe_atk: 40,
			spe_def: 79,
			vit: 47,
		},
		category: 'Pokémon Coconplopode',
		generation: 5,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 545,
		name: {
			fr: 'Brutapode',
			en: 'Scolipede',
			jp: 'ペンドラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/545/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/545/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 60,
			atk: 100,
			def: 89,
			spe_atk: 55,
			spe_def: 69,
			vit: 112,
		},
		category: 'Pokémon Mégaplopode',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 546,
		name: {
			fr: 'Doudouvet',
			en: 'Cottonee',
			jp: 'モンメン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/546/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/546/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 40,
			atk: 27,
			def: 60,
			spe_atk: 37,
			spe_def: 50,
			vit: 66,
		},
		category: 'Pokémon Boule Coton',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 547,
		name: {
			fr: 'Farfaduvet',
			en: 'Whimsicott',
			jp: 'エルフーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/547/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/547/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 60,
			atk: 67,
			def: 85,
			spe_atk: 77,
			spe_def: 75,
			vit: 116,
		},
		category: 'Pokémon Vole Vent',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 548,
		name: {
			fr: 'Chlorobule',
			en: 'Petilil',
			jp: 'チュリネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/548/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/548/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 45,
			atk: 35,
			def: 50,
			spe_atk: 70,
			spe_def: 50,
			vit: 30,
		},
		category: 'Pokémon Racine',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 549,
		name: {
			fr: 'Fragilady',
			en: 'Lilligant',
			jp: 'ドレディア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/549/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/549/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 70,
			atk: 60,
			def: 75,
			spe_atk: 110,
			spe_def: 75,
			vit: 90,
		},
		category: 'Pokémon Chef-Fleur',
		generation: 5,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 550,
		name: {
			fr: 'Bargantua',
			en: 'Basculin',
			jp: 'バスラオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/550/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/550/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 92,
			def: 65,
			spe_atk: 80,
			spe_def: 55,
			vit: 98,
		},
		category: 'Pokémon Violent',
		generation: 5,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 551,
		name: {
			fr: 'Mascaïman',
			en: 'Sandile',
			jp: 'メグロコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/551/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/551/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 50,
			atk: 72,
			def: 35,
			spe_atk: 35,
			spe_def: 35,
			vit: 65,
		},
		category: 'Pokémon Croco Sable',
		generation: 5,
		catch_rate: 180,
		rareté: 3,
	},
	{
		pokedex_id: 552,
		name: {
			fr: 'Escroco',
			en: 'Krokorok',
			jp: 'ワルビル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/552/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/552/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 60,
			atk: 82,
			def: 45,
			spe_atk: 45,
			spe_def: 45,
			vit: 74,
		},
		category: 'Pokémon Croco Sable',
		generation: 5,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 553,
		name: {
			fr: 'Crocorible',
			en: 'Krookodile',
			jp: 'ワルビアル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/553/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/553/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 95,
			atk: 117,
			def: 80,
			spe_atk: 65,
			spe_def: 70,
			vit: 92,
		},
		category: 'Pokémon Intimidation',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 554,
		name: {
			fr: 'Darumarond',
			en: 'Darumaka',
			jp: 'ダルマッカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/554/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/554/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 70,
			atk: 90,
			def: 45,
			spe_atk: 15,
			spe_def: 45,
			vit: 50,
		},
		category: 'Pokémon Daruma',
		generation: 5,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 555,
		name: {
			fr: 'Darumacho',
			en: 'Darmanitan',
			jp: 'ヒヒダルマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/555/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/555/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 105,
			atk: 140,
			def: 55,
			spe_atk: 30,
			spe_def: 55,
			vit: 95,
		},
		category: 'Pokémon Enflammé',
		generation: 5,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 556,
		name: {
			fr: 'Maracachi',
			en: 'Maractus',
			jp: 'マラカッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/556/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/556/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 86,
			def: 67,
			spe_atk: 106,
			spe_def: 67,
			vit: 60,
		},
		category: 'Pokémon Cactus',
		generation: 5,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 557,
		name: {
			fr: 'Crabicoque',
			en: 'Dwebble',
			jp: 'イシズマイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/557/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/557/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 50,
			atk: 65,
			def: 85,
			spe_atk: 35,
			spe_def: 35,
			vit: 55,
		},
		category: 'Pokémon Lithicole',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 558,
		name: {
			fr: 'Crabaraque',
			en: 'Crustle',
			jp: 'イワパレス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/558/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/558/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 70,
			atk: 105,
			def: 125,
			spe_atk: 65,
			spe_def: 75,
			vit: 45,
		},
		category: 'Pokémon Lapidicole',
		generation: 5,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 559,
		name: {
			fr: 'Baggiguane',
			en: 'Scraggy',
			jp: 'ズルッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/559/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/559/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 50,
			atk: 75,
			def: 70,
			spe_atk: 35,
			spe_def: 70,
			vit: 48,
		},
		category: 'Pokémon Mue',
		generation: 5,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 560,
		name: {
			fr: 'Baggaïd',
			en: 'Scrafty',
			jp: 'ズルズキン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/560/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/560/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 65,
			atk: 90,
			def: 115,
			spe_atk: 45,
			spe_def: 115,
			vit: 58,
		},
		category: 'Pokémon Gang',
		generation: 5,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 561,
		name: {
			fr: 'Cryptéro',
			en: 'Sigilyph',
			jp: 'シンボラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/561/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/561/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 72,
			atk: 58,
			def: 80,
			spe_atk: 103,
			spe_def: 80,
			vit: 97,
		},
		category: 'Pokémon Similoiseau',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 562,
		name: {
			fr: 'Tutafeh',
			en: 'Yamask',
			jp: 'デスマス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/562/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/562/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 38,
			atk: 30,
			def: 85,
			spe_atk: 55,
			spe_def: 65,
			vit: 30,
		},
		category: 'Pokémon Âme',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 563,
		name: {
			fr: 'Tutankafer',
			en: 'Cofagrigus',
			jp: 'デスカーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/563/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/563/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 58,
			atk: 50,
			def: 145,
			spe_atk: 95,
			spe_def: 105,
			vit: 30,
		},
		category: 'Pokémon Cercueil',
		generation: 5,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 564,
		name: {
			fr: 'Carapagos',
			en: 'Tirtouga',
			jp: 'プロトーガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/564/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/564/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 54,
			atk: 78,
			def: 103,
			spe_atk: 53,
			spe_def: 45,
			vit: 22,
		},
		category: 'Pokémon Tortantique',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 565,
		name: {
			fr: 'Mégapagos',
			en: 'Carracosta',
			jp: 'アバゴーラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/565/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/565/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 74,
			atk: 108,
			def: 133,
			spe_atk: 83,
			spe_def: 65,
			vit: 32,
		},
		category: 'Pokémon Tortantique',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 566,
		name: {
			fr: 'Arkéapti',
			en: 'Archen',
			jp: 'アーケン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/566/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/566/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 112,
			def: 45,
			spe_atk: 74,
			spe_def: 45,
			vit: 70,
		},
		category: 'Pokémon Oisancien',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 567,
		name: {
			fr: 'Aéroptéryx',
			en: 'Archeops',
			jp: 'アーケオス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/567/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/567/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 140,
			def: 65,
			spe_atk: 112,
			spe_def: 65,
			vit: 110,
		},
		category: 'Pokémon Oisancien',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 568,
		name: {
			fr: 'Miamiasme',
			en: 'Trubbish',
			jp: 'ヤブクロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/568/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/568/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 62,
			spe_atk: 40,
			spe_def: 62,
			vit: 65,
		},
		category: 'Pokémon Sac Poubelle',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 569,
		name: {
			fr: 'Miasmax',
			en: 'Garbodor',
			jp: 'ダストダス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/569/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/569/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/569/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/569/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 95,
			def: 82,
			spe_atk: 60,
			spe_def: 82,
			vit: 75,
		},
		category: 'Pokémon Dépotoir',
		generation: 5,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 570,
		name: {
			fr: 'Zorua',
			en: 'Zorua',
			jp: 'ゾロア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/570/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/570/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 40,
			atk: 65,
			def: 40,
			spe_atk: 80,
			spe_def: 40,
			vit: 65,
		},
		category: 'Pokémon Sombrenard',
		generation: 5,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 571,
		name: {
			fr: 'Zoroark',
			en: 'Zoroark',
			jp: 'ゾロアーク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/571/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/571/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 60,
			atk: 105,
			def: 60,
			spe_atk: 120,
			spe_def: 60,
			vit: 105,
		},
		category: 'Pokémon Polymorfox',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 572,
		name: {
			fr: 'Chinchidou',
			en: 'Minccino',
			jp: 'チラーミィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/572/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/572/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 55,
			atk: 50,
			def: 40,
			spe_atk: 40,
			spe_def: 40,
			vit: 75,
		},
		category: 'Pokémon Chinchilla',
		generation: 5,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 573,
		name: {
			fr: 'Pashmilla',
			en: 'Cinccino',
			jp: 'チラチーノ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/573/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/573/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 75,
			atk: 95,
			def: 60,
			spe_atk: 65,
			spe_def: 60,
			vit: 115,
		},
		category: 'Pokémon Écharpe',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 574,
		name: {
			fr: 'Scrutella',
			en: 'Gothita',
			jp: 'ゴチム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/574/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/574/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 45,
			atk: 30,
			def: 50,
			spe_atk: 65,
			spe_def: 55,
			vit: 45,
		},
		category: 'Pokémon Dévisageur',
		generation: 5,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 575,
		name: {
			fr: 'Mesmérella',
			en: 'Gothorita',
			jp: 'ゴチミル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/575/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/575/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 45,
			def: 70,
			spe_atk: 75,
			spe_def: 85,
			vit: 55,
		},
		category: 'Pokémon Magouilleur',
		generation: 5,
		catch_rate: 100,
		rareté: 1,
	},
	{
		pokedex_id: 576,
		name: {
			fr: 'Sidérella',
			en: 'Gothitelle',
			jp: 'ゴチルゼル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/576/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/576/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 70,
			atk: 55,
			def: 95,
			spe_atk: 95,
			spe_def: 110,
			vit: 65,
		},
		category: 'Pokémon Cosmique',
		generation: 5,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 577,
		name: {
			fr: 'Nucléos',
			en: 'Solosis',
			jp: 'ユニラン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/577/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/577/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 45,
			atk: 30,
			def: 40,
			spe_atk: 105,
			spe_def: 50,
			vit: 20,
		},
		category: 'Pokémon Cellule',
		generation: 5,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 578,
		name: {
			fr: 'Méios',
			en: 'Duosion',
			jp: 'ダブラン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/578/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/578/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 65,
			atk: 40,
			def: 50,
			spe_atk: 125,
			spe_def: 60,
			vit: 30,
		},
		category: 'Pokémon Divisé',
		generation: 5,
		catch_rate: 100,
		rareté: 2,
	},
	{
		pokedex_id: 579,
		name: {
			fr: 'Symbios',
			en: 'Reuniclus',
			jp: 'ランクルス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/579/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/579/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 110,
			atk: 65,
			def: 75,
			spe_atk: 125,
			spe_def: 85,
			vit: 30,
		},
		category: 'Pokémon Multiplé',
		generation: 5,
		catch_rate: 50,
		rareté: 1,
	},
	{
		pokedex_id: 580,
		name: {
			fr: 'Couaneton',
			en: 'Ducklett',
			jp: 'コアルヒー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/580/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/580/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 62,
			atk: 44,
			def: 50,
			spe_atk: 44,
			spe_def: 50,
			vit: 55,
		},
		category: 'Pokémon Oiseaudo',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 581,
		name: {
			fr: 'Lakmécygne',
			en: 'Swanna',
			jp: 'スワンナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/581/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/581/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 87,
			def: 63,
			spe_atk: 87,
			spe_def: 63,
			vit: 98,
		},
		category: 'Pokémon Cygne',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 582,
		name: {
			fr: 'Sorbébé',
			en: 'Vanillite',
			jp: 'バニプッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/582/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/582/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 36,
			atk: 50,
			def: 50,
			spe_atk: 65,
			spe_def: 60,
			vit: 44,
		},
		category: 'Pokémon Poudreuse',
		generation: 5,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 583,
		name: {
			fr: 'Sorboul',
			en: 'Vanillish',
			jp: 'バニリッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/583/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/583/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 51,
			atk: 65,
			def: 65,
			spe_atk: 80,
			spe_def: 75,
			vit: 59,
		},
		category: 'Pokémon Grêle',
		generation: 5,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 584,
		name: {
			fr: 'Sorbouboul',
			en: 'Vanilluxe',
			jp: 'バイバニラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/584/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/584/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 71,
			atk: 95,
			def: 85,
			spe_atk: 110,
			spe_def: 95,
			vit: 79,
		},
		category: 'Pokémon Congère',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 585,
		name: {
			fr: 'Vivaldaim',
			en: 'Deerling',
			jp: 'シキジカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/585/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/585/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 50,
			spe_atk: 40,
			spe_def: 50,
			vit: 75,
		},
		category: 'Pokémon Saison',
		generation: 5,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 586,
		name: {
			fr: 'Haydaim',
			en: 'Sawsbuck',
			jp: 'メブキジカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/586/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/586/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 80,
			atk: 100,
			def: 70,
			spe_atk: 60,
			spe_def: 70,
			vit: 95,
		},
		category: 'Pokémon Saison',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 587,
		name: {
			fr: 'Emolga',
			en: 'Emolga',
			jp: 'エモンガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/587/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/587/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 75,
			def: 60,
			spe_atk: 75,
			spe_def: 60,
			vit: 103,
		},
		category: 'Pokémon Pteromys',
		generation: 5,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 588,
		name: {
			fr: 'Carabing',
			en: 'Karrablast',
			jp: 'カブルモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/588/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/588/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 75,
			def: 45,
			spe_atk: 40,
			spe_def: 45,
			vit: 60,
		},
		category: 'Pokémon Carabe',
		generation: 5,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 589,
		name: {
			fr: 'Lançargot',
			en: 'Escavalier',
			jp: 'シュバルゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/589/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/589/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 70,
			atk: 135,
			def: 105,
			spe_atk: 60,
			spe_def: 105,
			vit: 20,
		},
		category: 'Pokémon Chevalier',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 590,
		name: {
			fr: 'Trompignon',
			en: 'Foongus',
			jp: 'タマゲタケ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/590/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/590/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 69,
			atk: 55,
			def: 45,
			spe_atk: 55,
			spe_def: 55,
			vit: 15,
		},
		category: 'Pokémon Champignon',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 591,
		name: {
			fr: 'Gaulet',
			en: 'Amoonguss',
			jp: 'モロバレル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/591/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/591/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 114,
			atk: 85,
			def: 70,
			spe_atk: 85,
			spe_def: 80,
			vit: 30,
		},
		category: 'Pokémon Champignon',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 592,
		name: {
			fr: 'Viskuse',
			en: 'Frillish',
			jp: 'プルリル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/592/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/592/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 55,
			atk: 40,
			def: 50,
			spe_atk: 65,
			spe_def: 85,
			vit: 40,
		},
		category: 'Pokémon Flottaison',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 593,
		name: {
			fr: 'Moyade',
			en: 'Jellicent',
			jp: 'ブルンゲル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/593/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/593/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 100,
			atk: 60,
			def: 70,
			spe_atk: 85,
			spe_def: 105,
			vit: 60,
		},
		category: 'Pokémon Flottaison',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 594,
		name: {
			fr: 'Mamanbo',
			en: 'Alomomola',
			jp: 'ママンボウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/594/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/594/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 165,
			atk: 75,
			def: 80,
			spe_atk: 40,
			spe_def: 45,
			vit: 65,
		},
		category: 'Pokémon Soigneur',
		generation: 5,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 595,
		name: {
			fr: 'Statitik',
			en: 'Joltik',
			jp: 'バチュル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/595/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/595/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 50,
			atk: 47,
			def: 50,
			spe_atk: 57,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Crampon',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 596,
		name: {
			fr: 'Mygavolt',
			en: 'Galvantula',
			jp: 'デンチュラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/596/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/596/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 70,
			atk: 77,
			def: 60,
			spe_atk: 97,
			spe_def: 60,
			vit: 108,
		},
		category: 'Pokémon Araclectrik',
		generation: 5,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 597,
		name: {
			fr: 'Grindur',
			en: 'Ferroseed',
			jp: 'テッシード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/597/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/597/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 44,
			atk: 50,
			def: 91,
			spe_atk: 24,
			spe_def: 86,
			vit: 10,
		},
		category: 'Pokémon Graine Épine',
		generation: 5,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 598,
		name: {
			fr: 'Noacier',
			en: 'Ferrothorn',
			jp: 'ナットレイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/598/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/598/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 74,
			atk: 94,
			def: 131,
			spe_atk: 54,
			spe_def: 116,
			vit: 20,
		},
		category: 'Pokémon Boule Épine',
		generation: 5,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 599,
		name: {
			fr: 'Tic',
			en: 'Klink',
			jp: 'ギアル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/599/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/599/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 40,
			atk: 55,
			def: 70,
			spe_atk: 45,
			spe_def: 60,
			vit: 30,
		},
		category: 'Pokémon Engrenage',
		generation: 5,
		catch_rate: 130,
		rareté: 2,
	},
	{
		pokedex_id: 600,
		name: {
			fr: 'Clic',
			en: 'Klang',
			jp: 'ギギアル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/600/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/600/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 60,
			atk: 80,
			def: 95,
			spe_atk: 70,
			spe_def: 85,
			vit: 50,
		},
		category: 'Pokémon Engrenage',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 601,
		name: {
			fr: 'Cliticlic',
			en: 'Klinklang',
			jp: 'ギギギアル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/601/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/601/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 60,
			atk: 100,
			def: 115,
			spe_atk: 70,
			spe_def: 85,
			vit: 90,
		},
		category: 'Pokémon Engrenage',
		generation: 5,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 602,
		name: {
			fr: 'Anchwatt',
			en: 'Tynamo',
			jp: 'シビシラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/602/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/602/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 35,
			atk: 55,
			def: 40,
			spe_atk: 45,
			spe_def: 40,
			vit: 60,
		},
		category: 'Pokémon Électrophore',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 603,
		name: {
			fr: 'Lampéroie',
			en: 'Eelektrik',
			jp: 'シビビール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/603/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/603/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 65,
			atk: 85,
			def: 70,
			spe_atk: 75,
			spe_def: 70,
			vit: 40,
		},
		category: 'Pokémon Électrophore',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 604,
		name: {
			fr: 'Ohmassacre',
			en: 'Eelektross',
			jp: 'シビルドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/604/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/604/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 85,
			atk: 115,
			def: 80,
			spe_atk: 105,
			spe_def: 80,
			vit: 50,
		},
		category: 'Pokémon Électrophore',
		generation: 5,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 605,
		name: {
			fr: 'Lewsor',
			en: 'Elgyem',
			jp: 'リグレー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/605/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/605/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 55,
			atk: 55,
			def: 55,
			spe_atk: 85,
			spe_def: 55,
			vit: 30,
		},
		category: 'Pokémon Cerveau',
		generation: 5,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 606,
		name: {
			fr: 'Neitram',
			en: 'Beheeyem',
			jp: 'オーベム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/606/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/606/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 75,
			atk: 75,
			def: 75,
			spe_atk: 125,
			spe_def: 95,
			vit: 40,
		},
		category: 'Pokémon Cerveau',
		generation: 5,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 607,
		name: {
			fr: 'Funécire',
			en: 'Litwick',
			jp: 'ヒトモシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/607/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/607/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 50,
			atk: 30,
			def: 55,
			spe_atk: 65,
			spe_def: 55,
			vit: 20,
		},
		category: 'Pokémon Chandelle',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 608,
		name: {
			fr: 'Mélancolux',
			en: 'Lampent',
			jp: 'ランプラー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/608/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/608/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 60,
			atk: 40,
			def: 60,
			spe_atk: 95,
			spe_def: 60,
			vit: 55,
		},
		category: 'Pokémon Lampe',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 609,
		name: {
			fr: 'Lugulabre',
			en: 'Chandelure',
			jp: 'シャンデラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/609/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/609/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 60,
			atk: 55,
			def: 90,
			spe_atk: 145,
			spe_def: 90,
			vit: 80,
		},
		category: 'Pokémon Invitation',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 610,
		name: {
			fr: 'Coupenotte',
			en: 'Axew',
			jp: 'キバゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/610/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/610/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 46,
			atk: 87,
			def: 60,
			spe_atk: 30,
			spe_def: 40,
			vit: 57,
		},
		category: 'Pokémon Crocs',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 611,
		name: {
			fr: 'Incisache',
			en: 'Fraxure',
			jp: 'オノンド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/611/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/611/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 66,
			atk: 117,
			def: 70,
			spe_atk: 40,
			spe_def: 50,
			vit: 67,
		},
		category: 'Pokémon Hachomenton',
		generation: 5,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 612,
		name: {
			fr: 'Tranchodon',
			en: 'Haxorus',
			jp: 'オノノクス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/612/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/612/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 76,
			atk: 147,
			def: 90,
			spe_atk: 60,
			spe_def: 70,
			vit: 97,
		},
		category: 'Pokémon Hachomenton',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 613,
		name: {
			fr: 'Polarhume',
			en: 'Cubchoo',
			jp: 'クマシュン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/613/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/613/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 55,
			atk: 70,
			def: 40,
			spe_atk: 60,
			spe_def: 40,
			vit: 40,
		},
		category: 'Pokémon Gelé',
		generation: 5,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 614,
		name: {
			fr: 'Polagriffe',
			en: 'Beartic',
			jp: 'ツンベアー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/614/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/614/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 95,
			atk: 130,
			def: 80,
			spe_atk: 70,
			spe_def: 80,
			vit: 50,
		},
		category: 'Pokémon Congelé',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 615,
		name: {
			fr: 'Hexagel',
			en: 'Cryogonal',
			jp: 'フリージオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/615/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/615/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 80,
			atk: 50,
			def: 50,
			spe_atk: 95,
			spe_def: 135,
			vit: 105,
		},
		category: 'Pokémon Cristal',
		generation: 5,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 616,
		name: {
			fr: 'Escargaume',
			en: 'Shelmet',
			jp: 'チョボマキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/616/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/616/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 40,
			def: 85,
			spe_atk: 40,
			spe_def: 65,
			vit: 25,
		},
		category: 'Pokémon Escargot',
		generation: 5,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 617,
		name: {
			fr: 'Limaspeed',
			en: 'Accelgor',
			jp: 'アギルダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/617/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/617/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 80,
			atk: 70,
			def: 40,
			spe_atk: 100,
			spe_def: 60,
			vit: 145,
		},
		category: 'Pokémon Exuviateur',
		generation: 5,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 618,
		name: {
			fr: 'Limonde',
			en: 'Stunfisk',
			jp: 'マッギョ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/618/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/618/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 109,
			atk: 66,
			def: 84,
			spe_atk: 81,
			spe_def: 99,
			vit: 32,
		},
		category: 'Pokémon Piège',
		generation: 5,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 619,
		name: {
			fr: 'Kungfouine',
			en: 'Mienfoo',
			jp: 'コジョフー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/619/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/619/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 45,
			atk: 85,
			def: 50,
			spe_atk: 55,
			spe_def: 50,
			vit: 65,
		},
		category: 'Pokémon Art Martial',
		generation: 5,
		catch_rate: 180,
		rareté: 3,
	},
	{
		pokedex_id: 620,
		name: {
			fr: 'Shaofouine',
			en: 'Mienshao',
			jp: 'コジョンド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/620/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/620/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 65,
			atk: 125,
			def: 60,
			spe_atk: 95,
			spe_def: 60,
			vit: 105,
		},
		category: 'Pokémon Art Martial',
		generation: 5,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 621,
		name: {
			fr: 'Drakkarmin',
			en: 'Druddigon',
			jp: 'クリムガン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/621/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/621/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 77,
			atk: 120,
			def: 90,
			spe_atk: 60,
			spe_def: 90,
			vit: 48,
		},
		category: 'Pokémon Caverne',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 622,
		name: {
			fr: 'Gringolem',
			en: 'Golett',
			jp: 'ゴビット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/622/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/622/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 59,
			atk: 74,
			def: 50,
			spe_atk: 35,
			spe_def: 50,
			vit: 35,
		},
		category: 'Pokémon Golem Ancien',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 623,
		name: {
			fr: 'Golemastoc',
			en: 'Golurk',
			jp: 'ゴルーグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/623/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/623/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 89,
			atk: 124,
			def: 80,
			spe_atk: 55,
			spe_def: 80,
			vit: 55,
		},
		category: 'Pokémon Golem Ancien',
		generation: 5,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 624,
		name: {
			fr: 'Scalpion',
			en: 'Pawniard',
			jp: 'コマタナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/624/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/624/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 45,
			atk: 85,
			def: 70,
			spe_atk: 40,
			spe_def: 40,
			vit: 60,
		},
		category: 'Pokémon Coupant',
		generation: 5,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 625,
		name: {
			fr: 'Scalproie',
			en: 'Bisharp',
			jp: 'キリキザン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/625/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/625/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 65,
			atk: 125,
			def: 100,
			spe_atk: 60,
			spe_def: 70,
			vit: 70,
		},
		category: 'Pokémon Tranchant',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 626,
		name: {
			fr: 'Frison',
			en: 'Bouffalant',
			jp: 'バッフロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/626/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/626/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 95,
			atk: 110,
			def: 95,
			spe_atk: 40,
			spe_def: 95,
			vit: 55,
		},
		category: "Pokémon Coup d'BŒuf",
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 627,
		name: {
			fr: 'Furaiglon',
			en: 'Rufflet',
			jp: 'ワシボン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/627/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/627/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 83,
			def: 50,
			spe_atk: 37,
			spe_def: 50,
			vit: 60,
		},
		category: 'Pokémon Aiglon',
		generation: 5,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 628,
		name: {
			fr: 'Gueriaigle',
			en: 'Braviary',
			jp: 'ウォーグル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/628/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/628/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 123,
			def: 75,
			spe_atk: 57,
			spe_def: 75,
			vit: 80,
		},
		category: 'Pokémon Vaillant',
		generation: 5,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 629,
		name: {
			fr: 'Vostourno',
			en: 'Vullaby',
			jp: 'バルチャイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/629/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/629/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 55,
			def: 75,
			spe_atk: 45,
			spe_def: 65,
			vit: 60,
		},
		category: 'Pokémon Couche',
		generation: 5,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 630,
		name: {
			fr: 'Vaututrice',
			en: 'Mandibuzz',
			jp: 'バルジーナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/630/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/630/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 110,
			atk: 65,
			def: 105,
			spe_atk: 55,
			spe_def: 95,
			vit: 80,
		},
		category: 'Pokémon Vostour',
		generation: 5,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 631,
		name: {
			fr: 'Aflamanoir',
			en: 'Heatmor',
			jp: 'クイタラン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/631/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/631/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 85,
			atk: 97,
			def: 66,
			spe_atk: 105,
			spe_def: 66,
			vit: 65,
		},
		category: 'Pokémon Tamanoir',
		generation: 5,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 632,
		name: {
			fr: 'Fermite',
			en: 'Durant',
			jp: 'アイアント',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/632/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/632/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 58,
			atk: 109,
			def: 112,
			spe_atk: 48,
			spe_def: 48,
			vit: 109,
		},
		category: 'Pokémon Fourmi Dure',
		generation: 5,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 633,
		name: {
			fr: 'Solochi',
			en: 'Deino',
			jp: 'モノズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/633/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/633/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 52,
			atk: 65,
			def: 50,
			spe_atk: 45,
			spe_def: 50,
			vit: 38,
		},
		category: 'Pokémon Rude',
		generation: 5,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 634,
		name: {
			fr: 'Diamat',
			en: 'Zweilous',
			jp: 'ジヘッド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/634/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/634/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 72,
			atk: 85,
			def: 70,
			spe_atk: 65,
			spe_def: 70,
			vit: 58,
		},
		category: 'Pokémon Violent',
		generation: 5,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 635,
		name: {
			fr: 'Trioxhydre',
			en: 'Hydreigon',
			jp: 'サザンドラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/635/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/635/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 92,
			atk: 105,
			def: 90,
			spe_atk: 125,
			spe_def: 90,
			vit: 98,
		},
		category: 'Pokémon Brutal',
		generation: 5,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 636,
		name: {
			fr: 'Pyronille',
			en: 'Larvesta',
			jp: 'メラルバ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/636/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/636/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 55,
			atk: 85,
			def: 55,
			spe_atk: 50,
			spe_def: 55,
			vit: 60,
		},
		category: 'Pokémon Torche',
		generation: 5,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 637,
		name: {
			fr: 'Pyrax',
			en: 'Volcarona',
			jp: 'ウルガモス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/637/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/637/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 85,
			atk: 60,
			def: 65,
			spe_atk: 135,
			spe_def: 105,
			vit: 100,
		},
		category: 'Pokémon Soleil',
		generation: 5,
		catch_rate: 15,
		rareté: 2,
	},
	{
		pokedex_id: 638,
		name: {
			fr: 'Cobaltium',
			en: 'Cobalion',
			jp: 'コバルオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/638/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/638/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 91,
			atk: 90,
			def: 129,
			spe_atk: 90,
			spe_def: 72,
			vit: 108,
		},
		category: 'Pokémon Cœur de Fer',
		generation: 5,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 639,
		name: {
			fr: 'Terrakium',
			en: 'Terrakion',
			jp: 'テラキオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/639/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/639/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 91,
			atk: 129,
			def: 90,
			spe_atk: 72,
			spe_def: 90,
			vit: 108,
		},
		category: 'Pokémon Grotte',
		generation: 5,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 640,
		name: {
			fr: 'Viridium',
			en: 'Virizion',
			jp: 'ビリジオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/640/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/640/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 91,
			atk: 90,
			def: 72,
			spe_atk: 90,
			spe_def: 129,
			vit: 108,
		},
		category: 'Pokémon Plaine Verte',
		generation: 5,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 641,
		name: {
			fr: 'Boréas',
			en: 'Tornadus',
			jp: 'トルネロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/641/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/641/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 79,
			atk: 115,
			def: 70,
			spe_atk: 125,
			spe_def: 80,
			vit: 111,
		},
		category: 'Pokémon Tornade',
		generation: 5,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 642,
		name: {
			fr: 'Fulguris',
			en: 'Thundurus',
			jp: 'ボルトロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/642/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/642/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 79,
			atk: 115,
			def: 70,
			spe_atk: 125,
			spe_def: 80,
			vit: 111,
		},
		category: 'Pokémon Foudroyeur',
		generation: 5,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 643,
		name: {
			fr: 'Reshiram',
			en: 'Reshiram',
			jp: 'レシラム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/643/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/643/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 100,
			atk: 120,
			def: 100,
			spe_atk: 150,
			spe_def: 120,
			vit: 90,
		},
		category: 'Pokémon Blanc Réel',
		generation: 5,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 644,
		name: {
			fr: 'Zekrom',
			en: 'Zekrom',
			jp: 'ゼクロム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/644/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/644/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 100,
			atk: 150,
			def: 120,
			spe_atk: 120,
			spe_def: 100,
			vit: 90,
		},
		category: 'Pokémon Noir Idéal',
		generation: 5,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 645,
		name: {
			fr: 'Démétéros',
			en: 'Landorus',
			jp: 'ランドロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/645/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/645/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 89,
			atk: 125,
			def: 90,
			spe_atk: 115,
			spe_def: 80,
			vit: 101,
		},
		category: 'Pokémon Fertilié',
		generation: 5,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 646,
		name: {
			fr: 'Kyurem',
			en: 'Kyurem',
			jp: 'キュレム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/646/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/646/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 125,
			atk: 170,
			def: 100,
			spe_atk: 120,
			spe_def: 90,
			vit: 95,
		},
		category: 'Pokémon Frontière',
		generation: 5,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 647,
		name: {
			fr: 'Keldeo',
			en: 'Keldeo',
			jp: 'ケルディオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/647/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 91,
			atk: 72,
			def: 90,
			spe_atk: 129,
			spe_def: 90,
			vit: 108,
		},
		category: 'Pokémon Poulain',
		generation: 5,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 648,
		name: {
			fr: 'Meloetta',
			en: 'Meloetta',
			jp: 'メロエッタ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/648/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 100,
			atk: 77,
			def: 77,
			spe_atk: 128,
			spe_def: 128,
			vit: 90,
		},
		category: 'Pokémon Mélodie',
		generation: 5,
		catch_rate: 5,
		rareté: 1,
	},
	{
		pokedex_id: 649,
		name: {
			fr: 'Genesect',
			en: 'Genesect',
			jp: 'ゲノセクト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/649/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/649/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 71,
			atk: 120,
			def: 95,
			spe_atk: 120,
			spe_def: 95,
			vit: 99,
		},
		category: 'Pokémon Paléozoïque',
		generation: 5,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 650,
		name: {
			fr: 'Marisson',
			en: 'Chespin',
			jp: 'ハリマロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/650/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/650/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 56,
			atk: 61,
			def: 65,
			spe_atk: 48,
			spe_def: 45,
			vit: 38,
		},
		category: 'Pokémon Bogue',
		generation: 6,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 651,
		name: {
			fr: 'Boguérisse',
			en: 'Quilladin',
			jp: 'ハリボーグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/651/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/651/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 61,
			atk: 78,
			def: 95,
			spe_atk: 56,
			spe_def: 58,
			vit: 57,
		},
		category: 'Pokémon Épinarmure',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 652,
		name: {
			fr: 'Blindépique',
			en: 'Chesnaught',
			jp: 'ブリガロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/652/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/652/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 88,
			atk: 107,
			def: 122,
			spe_atk: 74,
			spe_def: 75,
			vit: 64,
		},
		category: 'Pokémon Épinarmure',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 653,
		name: {
			fr: 'Feunnec',
			en: 'Fennekin',
			jp: 'フォッコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/653/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/653/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 40,
			spe_atk: 62,
			spe_def: 60,
			vit: 60,
		},
		category: 'Pokémon Renard',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 654,
		name: {
			fr: 'Roussil',
			en: 'Braixen',
			jp: 'テールナー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/654/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/654/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 59,
			atk: 59,
			def: 58,
			spe_atk: 90,
			spe_def: 70,
			vit: 73,
		},
		category: 'Pokémon Renard',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 655,
		name: {
			fr: 'Goupelin',
			en: 'Delphox',
			jp: 'マフォクシー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/655/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/655/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 75,
			atk: 69,
			def: 72,
			spe_atk: 114,
			spe_def: 100,
			vit: 104,
		},
		category: 'Pokémon Renard',
		generation: 6,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 656,
		name: {
			fr: 'Grenousse',
			en: 'Froakie',
			jp: 'ケロマツ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/656/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/656/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 41,
			atk: 56,
			def: 40,
			spe_atk: 62,
			spe_def: 44,
			vit: 71,
		},
		category: 'Pokémon Crapobulle',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 657,
		name: {
			fr: 'Croâporal',
			en: 'Frogadier',
			jp: 'ゲコガシラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/657/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/657/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 54,
			atk: 63,
			def: 52,
			spe_atk: 83,
			spe_def: 56,
			vit: 97,
		},
		category: 'Pokémon Crapobulle',
		generation: 6,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 658,
		name: {
			fr: 'Amphinobi',
			en: 'Greninja',
			jp: 'ゲッコウガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/658/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/658/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 72,
			atk: 145,
			def: 67,
			spe_atk: 153,
			spe_def: 71,
			vit: 132,
		},
		category: 'Pokémon Ninja',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 659,
		name: {
			fr: 'Sapereau',
			en: 'Bunnelby',
			jp: 'ホルビー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/659/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/659/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 38,
			atk: 36,
			def: 38,
			spe_atk: 32,
			spe_def: 36,
			vit: 57,
		},
		category: 'Pokémon Fouisseur',
		generation: 6,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 660,
		name: {
			fr: 'Excavarenne',
			en: 'Diggersby',
			jp: 'ホルード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/660/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/660/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 56,
			def: 77,
			spe_atk: 50,
			spe_def: 77,
			vit: 78,
		},
		category: 'Pokémon Fouisseur',
		generation: 6,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 661,
		name: {
			fr: 'Passerouge',
			en: 'Fletchling',
			jp: 'ヤヤコマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/661/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/661/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 45,
			atk: 50,
			def: 43,
			spe_atk: 40,
			spe_def: 38,
			vit: 62,
		},
		category: 'Pokémon Rougegorge',
		generation: 6,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 662,
		name: {
			fr: 'Braisillon',
			en: 'Fletchinder',
			jp: 'ヒノヤコマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/662/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/662/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 62,
			atk: 73,
			def: 55,
			spe_atk: 56,
			spe_def: 52,
			vit: 84,
		},
		category: 'Pokémon Braise',
		generation: 6,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 663,
		name: {
			fr: 'Flambusard',
			en: 'Talonflame',
			jp: 'ファイアロー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/663/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/663/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 78,
			atk: 81,
			def: 71,
			spe_atk: 74,
			spe_def: 69,
			vit: 126,
		},
		category: 'Pokémon Fournaise',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 664,
		name: {
			fr: 'Lépidonille',
			en: 'Scatterbug',
			jp: 'コフキムシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/664/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/664/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 38,
			atk: 35,
			def: 40,
			spe_atk: 27,
			spe_def: 25,
			vit: 35,
		},
		category: 'Pokémon Exhalécaille',
		generation: 6,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 665,
		name: {
			fr: 'Pérégrain',
			en: 'Spewpa',
			jp: 'コフーライ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/665/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/665/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 45,
			atk: 22,
			def: 60,
			spe_atk: 27,
			spe_def: 30,
			vit: 29,
		},
		category: 'Pokémon Exhalécaille',
		generation: 6,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 666,
		name: {
			fr: 'Prismillon',
			en: 'Vivillon',
			jp: 'ビビヨン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/666/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/666/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 80,
			atk: 52,
			def: 50,
			spe_atk: 90,
			spe_def: 50,
			vit: 89,
		},
		category: 'Pokémon Lépidécaille',
		generation: 6,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 667,
		name: {
			fr: 'Hélionceau',
			en: 'Litleo',
			jp: 'シシコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/667/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/667/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 62,
			atk: 50,
			def: 58,
			spe_atk: 73,
			spe_def: 54,
			vit: 72,
		},
		category: 'Pokémon Lionceau',
		generation: 6,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 668,
		name: {
			fr: 'Némélios',
			en: 'Pyroar',
			jp: 'カエンジシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/668/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/668/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 86,
			atk: 68,
			def: 72,
			spe_atk: 109,
			spe_def: 66,
			vit: 106,
		},
		category: 'Pokémon Royal',
		generation: 6,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 669,
		name: {
			fr: 'Flabébé',
			en: 'Flabébé',
			jp: 'フラベベ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/669/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/669/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 44,
			atk: 38,
			def: 39,
			spe_atk: 61,
			spe_def: 79,
			vit: 42,
		},
		category: 'Pokémon Uniflore',
		generation: 6,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 670,
		name: {
			fr: 'Floette',
			en: 'Floette',
			jp: 'フラエッテ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/670/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/670/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 54,
			atk: 45,
			def: 47,
			spe_atk: 75,
			spe_def: 98,
			vit: 52,
		},
		category: 'Pokémon Uniflore',
		generation: 6,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 671,
		name: {
			fr: 'Florges',
			en: 'Florges',
			jp: 'フラージェス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/671/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/671/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 78,
			atk: 65,
			def: 68,
			spe_atk: 112,
			spe_def: 154,
			vit: 75,
		},
		category: 'Pokémon Jardin',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 672,
		name: {
			fr: 'Cabriolaine',
			en: 'Skiddo',
			jp: 'メェークル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/672/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/672/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 66,
			atk: 65,
			def: 48,
			spe_atk: 62,
			spe_def: 57,
			vit: 52,
		},
		category: 'Pokémon Monture',
		generation: 6,
		catch_rate: 160,
		rareté: 3,
	},
	{
		pokedex_id: 673,
		name: {
			fr: 'Chevroum',
			en: 'Gogoat',
			jp: 'ゴーゴート',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/673/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/673/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 123,
			atk: 100,
			def: 62,
			spe_atk: 97,
			spe_def: 81,
			vit: 68,
		},
		category: 'Pokémon Monture',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 674,
		name: {
			fr: 'Pandespiègle',
			en: 'Pancham',
			jp: 'ヤンチャム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/674/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/674/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 67,
			atk: 82,
			def: 62,
			spe_atk: 46,
			spe_def: 48,
			vit: 43,
		},
		category: 'Pokémon Garnement',
		generation: 6,
		catch_rate: 220,
		rareté: 3,
	},
	{
		pokedex_id: 675,
		name: {
			fr: 'Pandarbare',
			en: 'Pangoro',
			jp: 'ゴロンダ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/675/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/675/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 95,
			atk: 124,
			def: 78,
			spe_atk: 69,
			spe_def: 71,
			vit: 58,
		},
		category: 'Pokémon Patibulaire',
		generation: 6,
		catch_rate: 65,
		rareté: 3,
	},
	{
		pokedex_id: 676,
		name: {
			fr: 'Couafarel',
			en: 'Furfrou',
			jp: 'トリミアン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/676/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/676/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 75,
			atk: 80,
			def: 60,
			spe_atk: 65,
			spe_def: 90,
			vit: 102,
		},
		category: 'Pokémon Caniche',
		generation: 6,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 677,
		name: {
			fr: 'Psystigri',
			en: 'Espurr',
			jp: 'ニャスパー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/677/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/677/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 62,
			atk: 48,
			def: 54,
			spe_atk: 63,
			spe_def: 60,
			vit: 68,
		},
		category: 'Pokémon Retenue',
		generation: 6,
		catch_rate: 228,
		rareté: 3,
	},
	{
		pokedex_id: 678,
		name: {
			fr: 'Mistigrix',
			en: 'Meowstic',
			jp: 'ニャオニクス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/678/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/678/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 74,
			atk: 48,
			def: 76,
			spe_atk: 83,
			spe_def: 81,
			vit: 104,
		},
		category: 'Pokémon SelfContrôle',
		generation: 6,
		catch_rate: 228,
		rareté: 2,
	},
	{
		pokedex_id: 679,
		name: {
			fr: 'Monorpale',
			en: 'Honedge',
			jp: 'ヒトツキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/679/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/679/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 45,
			atk: 80,
			def: 100,
			spe_atk: 35,
			spe_def: 37,
			vit: 28,
		},
		category: 'Pokémon Glaive',
		generation: 6,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 680,
		name: {
			fr: 'Dimoclès',
			en: 'Doublade',
			jp: 'ニダンギル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/680/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/680/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 59,
			atk: 110,
			def: 150,
			spe_atk: 45,
			spe_def: 49,
			vit: 35,
		},
		category: 'Pokémon Glaive',
		generation: 6,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 681,
		name: {
			fr: 'Exagide',
			en: 'Aegislash',
			jp: 'ギルガルド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/681/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/681/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 140,
			spe_atk: 50,
			spe_def: 140,
			vit: 60,
		},
		category: 'Pokémon Noble Lame',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 682,
		name: {
			fr: 'Fluvetin',
			en: 'Spritzee',
			jp: 'シュシュプ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/682/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/682/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 78,
			atk: 52,
			def: 60,
			spe_atk: 63,
			spe_def: 65,
			vit: 23,
		},
		category: 'Pokémon Fragrance',
		generation: 6,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 683,
		name: {
			fr: 'Cocotine',
			en: 'Aromatisse',
			jp: 'フレフワン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/683/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/683/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 101,
			atk: 72,
			def: 72,
			spe_atk: 99,
			spe_def: 89,
			vit: 29,
		},
		category: 'Pokémon Parfum',
		generation: 6,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 684,
		name: {
			fr: 'Sucroquin',
			en: 'Swirlix',
			jp: 'ペロッパフ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/684/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/684/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 62,
			atk: 48,
			def: 66,
			spe_atk: 59,
			spe_def: 57,
			vit: 49,
		},
		category: 'Pokémon Confiserie',
		generation: 6,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 685,
		name: {
			fr: 'Cupcanaille',
			en: 'Slurpuff',
			jp: 'ペロリーム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/685/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/685/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 82,
			atk: 80,
			def: 86,
			spe_atk: 85,
			spe_def: 75,
			vit: 72,
		},
		category: 'Pokémon Mousseline',
		generation: 6,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 686,
		name: {
			fr: 'Sepiatop',
			en: 'Inkay',
			jp: 'マーイーカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/686/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/686/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 53,
			atk: 54,
			def: 53,
			spe_atk: 37,
			spe_def: 46,
			vit: 45,
		},
		category: 'Pokémon Rotation',
		generation: 6,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 687,
		name: {
			fr: 'Sepiatroce',
			en: 'Malamar',
			jp: 'カラマネロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/687/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/687/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 86,
			atk: 92,
			def: 88,
			spe_atk: 68,
			spe_def: 75,
			vit: 73,
		},
		category: 'Pokémon Révolution',
		generation: 6,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 688,
		name: {
			fr: 'Opermine',
			en: 'Binacle',
			jp: 'カメテテ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/688/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/688/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 42,
			atk: 52,
			def: 67,
			spe_atk: 39,
			spe_def: 56,
			vit: 50,
		},
		category: 'Pokémon Bimane',
		generation: 6,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 689,
		name: {
			fr: 'Golgopathe',
			en: 'Barbaracle',
			jp: 'ガメノデス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/689/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/689/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 72,
			atk: 105,
			def: 115,
			spe_atk: 55,
			spe_def: 86,
			vit: 68,
		},
		category: 'Pokémon Assemblage',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 690,
		name: {
			fr: 'Venalgue',
			en: 'Skrelp',
			jp: 'クズモー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/690/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/690/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 60,
			def: 60,
			spe_atk: 60,
			spe_def: 60,
			vit: 30,
		},
		category: 'Pokémon Simulalgue',
		generation: 6,
		catch_rate: 225,
		rareté: 1,
	},
	{
		pokedex_id: 691,
		name: {
			fr: 'Kravarech',
			en: 'Dragalge',
			jp: 'ドラミドロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/691/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/691/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 65,
			atk: 75,
			def: 90,
			spe_atk: 97,
			spe_def: 123,
			vit: 44,
		},
		category: 'Pokémon Simulalgue',
		generation: 6,
		catch_rate: 225,
		rareté: 1,
	},
	{
		pokedex_id: 692,
		name: {
			fr: 'Flingouste',
			en: 'Clauncher',
			jp: 'ウデッポウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/692/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/692/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 53,
			def: 62,
			spe_atk: 58,
			spe_def: 63,
			vit: 44,
		},
		category: 'Pokémon Lance à Eau',
		generation: 6,
		catch_rate: 155,
		rareté: 2,
	},
	{
		pokedex_id: 693,
		name: {
			fr: 'Gamblast',
			en: 'Clawitzer',
			jp: 'ブロスター',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/693/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/693/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 71,
			atk: 73,
			def: 88,
			spe_atk: 120,
			spe_def: 89,
			vit: 59,
		},
		category: 'Pokémon Blaster',
		generation: 6,
		catch_rate: 155,
		rareté: 1,
	},
	{
		pokedex_id: 694,
		name: {
			fr: 'Galvaran',
			en: 'Helioptile',
			jp: 'エリキテル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/694/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/694/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 44,
			atk: 38,
			def: 33,
			spe_atk: 61,
			spe_def: 43,
			vit: 70,
		},
		category: 'Pokémon Générateur',
		generation: 6,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 695,
		name: {
			fr: 'Iguolta',
			en: 'Heliolisk',
			jp: 'エレザード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/695/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/695/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 62,
			atk: 55,
			def: 52,
			spe_atk: 109,
			spe_def: 94,
			vit: 109,
		},
		category: 'Pokémon Générateur',
		generation: 6,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 696,
		name: {
			fr: 'Ptyranidur',
			en: 'Tyrunt',
			jp: 'チゴラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/696/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/696/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 58,
			atk: 89,
			def: 77,
			spe_atk: 45,
			spe_def: 45,
			vit: 48,
		},
		category: 'Pokémon Prince',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 697,
		name: {
			fr: 'Rexillius',
			en: 'Tyrantrum',
			jp: 'ガチゴラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/697/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/697/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 82,
			atk: 121,
			def: 119,
			spe_atk: 69,
			spe_def: 59,
			vit: 71,
		},
		category: 'Pokémon Tyran',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 698,
		name: {
			fr: 'Amagara',
			en: 'Amaura',
			jp: 'アマルス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/698/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/698/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 77,
			atk: 59,
			def: 50,
			spe_atk: 67,
			spe_def: 63,
			vit: 46,
		},
		category: 'Pokémon Toundra',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 699,
		name: {
			fr: 'Dragmara',
			en: 'Aurorus',
			jp: 'アマルルガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/699/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/699/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 123,
			atk: 77,
			def: 72,
			spe_atk: 99,
			spe_def: 92,
			vit: 58,
		},
		category: 'Pokémon Toundra',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 700,
		name: {
			fr: 'Nymphali',
			en: 'Sylveon',
			jp: 'ニンフィア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/700/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/700/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 95,
			atk: 65,
			def: 65,
			spe_atk: 110,
			spe_def: 130,
			vit: 60,
		},
		category: 'Pokémon Attachant',
		generation: 6,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 701,
		name: {
			fr: 'Brutalibré',
			en: 'Hawlucha',
			jp: 'ルチャブル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/701/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/701/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 78,
			atk: 92,
			def: 75,
			spe_atk: 74,
			spe_def: 63,
			vit: 118,
		},
		category: 'Pokémon Catcheur',
		generation: 6,
		catch_rate: 100,
		rareté: 3,
	},
	{
		pokedex_id: 702,
		name: {
			fr: 'Dedenne',
			en: 'Dedenne',
			jp: 'デデンネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/702/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/702/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 67,
			atk: 58,
			def: 57,
			spe_atk: 81,
			spe_def: 67,
			vit: 101,
		},
		category: 'Pokémon Antenne',
		generation: 6,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 703,
		name: {
			fr: 'Strassie',
			en: 'Carbink',
			jp: 'メレシー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/703/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/703/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 150,
			spe_atk: 50,
			spe_def: 150,
			vit: 50,
		},
		category: 'Pokémon Joyau',
		generation: 6,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 704,
		name: {
			fr: 'Mucuscule',
			en: 'Goomy',
			jp: 'ヌメラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/704/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/704/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 45,
			atk: 50,
			def: 35,
			spe_atk: 55,
			spe_def: 75,
			vit: 40,
		},
		category: 'Pokémon Mollusque',
		generation: 6,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 705,
		name: {
			fr: 'Colimucus',
			en: 'Sliggoo',
			jp: 'ヌメイル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/705/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/705/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 68,
			atk: 75,
			def: 53,
			spe_atk: 83,
			spe_def: 113,
			vit: 60,
		},
		category: 'Pokémon Mollusque',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 706,
		name: {
			fr: 'Muplodocus',
			en: 'Goodra',
			jp: 'ヌメルゴン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/706/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/706/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 90,
			atk: 100,
			def: 70,
			spe_atk: 110,
			spe_def: 150,
			vit: 80,
		},
		category: 'Pokémon Dragon',
		generation: 6,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 707,
		name: {
			fr: 'Trousselin',
			en: 'Klefki',
			jp: 'クレッフィ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/707/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/707/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 57,
			atk: 80,
			def: 91,
			spe_atk: 80,
			spe_def: 87,
			vit: 75,
		},
		category: 'Pokémon Trousseau',
		generation: 6,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 708,
		name: {
			fr: 'Brocélôme',
			en: 'Phantump',
			jp: 'ボクレー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/708/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/708/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 43,
			atk: 70,
			def: 48,
			spe_atk: 50,
			spe_def: 60,
			vit: 38,
		},
		category: 'Pokémon Souche',
		generation: 6,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 709,
		name: {
			fr: 'Desséliande',
			en: 'Trevenant',
			jp: 'オーロット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/709/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/709/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 85,
			atk: 110,
			def: 76,
			spe_atk: 65,
			spe_def: 82,
			vit: 56,
		},
		category: 'Pokémon Vieillarbre',
		generation: 6,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 710,
		name: {
			fr: 'Pitrouille',
			en: 'Pumpkaboo',
			jp: 'バケッチャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/710/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/710/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 55,
			atk: 66,
			def: 70,
			spe_atk: 44,
			spe_def: 55,
			vit: 46,
		},
		category: 'Pokémon Citrouille',
		generation: 6,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 711,
		name: {
			fr: 'Banshitrouye',
			en: 'Gourgeist',
			jp: 'パンプジン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/711/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/711/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 75,
			atk: 95,
			def: 122,
			spe_atk: 58,
			spe_def: 75,
			vit: 69,
		},
		category: 'Pokémon Citrouille',
		generation: 6,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 712,
		name: {
			fr: 'Grelaçon',
			en: 'Bergmite',
			jp: 'カチコール',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/712/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/712/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 55,
			atk: 69,
			def: 85,
			spe_atk: 32,
			spe_def: 35,
			vit: 28,
		},
		category: 'Pokémon Glaçon',
		generation: 6,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 713,
		name: {
			fr: 'Séracrawl',
			en: 'Avalugg',
			jp: 'クレベース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/713/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/713/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 95,
			atk: 117,
			def: 184,
			spe_atk: 44,
			spe_def: 46,
			vit: 28,
		},
		category: 'Pokémon Iceberg',
		generation: 6,
		catch_rate: 55,
		rareté: 1,
	},
	{
		pokedex_id: 714,
		name: {
			fr: 'Sonistrelle',
			en: 'Noibat',
			jp: 'オンバット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/714/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/714/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 40,
			atk: 30,
			def: 35,
			spe_atk: 45,
			spe_def: 40,
			vit: 55,
		},
		category: 'Pokémon Ondes',
		generation: 6,
		catch_rate: 200,
		rareté: 3,
	},
	{
		pokedex_id: 715,
		name: {
			fr: 'Bruyverne',
			en: 'Noivern',
			jp: 'オンバーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/715/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/715/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 85,
			atk: 70,
			def: 80,
			spe_atk: 97,
			spe_def: 80,
			vit: 123,
		},
		category: 'Pokémon Ondes',
		generation: 6,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 716,
		name: {
			fr: 'Xerneas',
			en: 'Xerneas',
			jp: 'ゼルネアス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/716/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/716/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 126,
			atk: 131,
			def: 95,
			spe_atk: 131,
			spe_def: 98,
			vit: 99,
		},
		category: 'Pokémon Existence',
		generation: 6,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 717,
		name: {
			fr: 'Yveltal',
			en: 'Yveltal',
			jp: 'イベルタル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/717/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/717/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 126,
			atk: 131,
			def: 95,
			spe_atk: 131,
			spe_def: 98,
			vit: 99,
		},
		category: 'Pokémon Annihilation',
		generation: 6,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 718,
		name: {
			fr: 'Zygarde',
			en: 'Zygarde',
			jp: 'ジガルデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/718/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/718/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 108,
			atk: 100,
			def: 121,
			spe_atk: 81,
			spe_def: 95,
			vit: 95,
		},
		category: 'Pokémon Équilibre',
		generation: 6,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 719,
		name: {
			fr: 'Diancie',
			en: 'Diancie',
			jp: 'ディアンシー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/719/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/719/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 50,
			atk: 100,
			def: 150,
			spe_atk: 100,
			spe_def: 150,
			vit: 50,
		},
		category: 'Pokémon Joyau',
		generation: 6,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 720,
		name: {
			fr: 'Hoopa',
			en: 'Hoopa',
			jp: 'フーパ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/720/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 80,
			atk: 110,
			def: 60,
			spe_atk: 150,
			spe_def: 130,
			vit: 70,
		},
		category: 'Pokémon Chenapan',
		generation: 6,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 721,
		name: {
			fr: 'Volcanion',
			en: 'Volcanion',
			jp: 'ボルケニオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/721/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 80,
			atk: 110,
			def: 120,
			spe_atk: 130,
			spe_def: 90,
			vit: 70,
		},
		category: 'Pokémon Vapeur',
		generation: 6,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 722,
		name: {
			fr: 'Brindibou',
			en: 'Rowlet',
			jp: 'モクロー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/722/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/722/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 68,
			atk: 55,
			def: 55,
			spe_atk: 50,
			spe_def: 50,
			vit: 42,
		},
		category: 'Pokémon Plumefeuille',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 723,
		name: {
			fr: 'Efflèche',
			en: 'Dartrix',
			jp: 'フクスロー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/723/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/723/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 78,
			atk: 75,
			def: 75,
			spe_atk: 70,
			spe_def: 70,
			vit: 52,
		},
		category: "Pokémon Plum'acérée",
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 724,
		name: {
			fr: 'Archéduc',
			en: 'Decidueye',
			jp: 'ジュナイパー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/724/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/724/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 78,
			atk: 107,
			def: 75,
			spe_atk: 100,
			spe_def: 100,
			vit: 70,
		},
		category: 'Pokémon Plumeflèche',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 725,
		name: {
			fr: 'Flamiaou',
			en: 'Litten',
			jp: 'ニャビー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/725/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/725/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 45,
			atk: 65,
			def: 40,
			spe_atk: 60,
			spe_def: 40,
			vit: 70,
		},
		category: 'Pokémon Chat Feu',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 726,
		name: {
			fr: 'Matoufeu',
			en: 'Torracat',
			jp: 'ニャヒート',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/726/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/726/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 85,
			def: 50,
			spe_atk: 80,
			spe_def: 50,
			vit: 90,
		},
		category: 'Pokémon Chat Feu',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 727,
		name: {
			fr: 'Félinferno',
			en: 'Incineroar',
			jp: 'ガオガエン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/727/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/727/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 95,
			atk: 115,
			def: 90,
			spe_atk: 80,
			spe_def: 90,
			vit: 60,
		},
		category: 'Pokémon Vil Catcheur',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 728,
		name: {
			fr: 'Otaquin',
			en: 'Popplio',
			jp: 'アシマリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/728/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/728/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 54,
			def: 54,
			spe_atk: 66,
			spe_def: 56,
			vit: 40,
		},
		category: 'Pokémon Otarie',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 729,
		name: {
			fr: 'Otarlette',
			en: 'Brionne',
			jp: 'オシャマリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/729/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/729/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 60,
			atk: 69,
			def: 69,
			spe_atk: 91,
			spe_def: 81,
			vit: 50,
		},
		category: 'Pokémon Starlette',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 730,
		name: {
			fr: 'Oratoria',
			en: 'Primarina',
			jp: 'アシレーヌ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/730/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/730/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 80,
			atk: 74,
			def: 74,
			spe_atk: 126,
			spe_def: 116,
			vit: 60,
		},
		category: 'Pokémon Soliste',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 731,
		name: {
			fr: 'Picassaut',
			en: 'Pikipek',
			jp: 'ツツケラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/731/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/731/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 35,
			atk: 75,
			def: 30,
			spe_atk: 30,
			spe_def: 30,
			vit: 65,
		},
		category: 'Pokémon Pivert',
		generation: 7,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 732,
		name: {
			fr: 'Piclairon',
			en: 'Trumbeak',
			jp: 'ケララッパ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/732/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/732/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 85,
			def: 50,
			spe_atk: 40,
			spe_def: 50,
			vit: 75,
		},
		category: 'Pokémon Bec Clairon',
		generation: 7,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 733,
		name: {
			fr: 'Bazoucan',
			en: 'Toucannon',
			jp: 'ドデカバシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/733/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/733/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 75,
			spe_atk: 75,
			spe_def: 75,
			vit: 60,
		},
		category: 'Pokémon Canon',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 734,
		name: {
			fr: 'Manglouton',
			en: 'Yungoos',
			jp: 'ヤングース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/734/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/734/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 48,
			atk: 70,
			def: 30,
			spe_atk: 30,
			spe_def: 30,
			vit: 45,
		},
		category: 'Pokémon Patrouille',
		generation: 7,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 735,
		name: {
			fr: 'Argouste',
			en: 'Gumshoos',
			jp: 'デカグース',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/735/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/735/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 88,
			atk: 110,
			def: 60,
			spe_atk: 55,
			spe_def: 60,
			vit: 45,
		},
		category: 'Pokémon Filature',
		generation: 7,
		catch_rate: 127,
		rareté: 1,
	},
	{
		pokedex_id: 736,
		name: {
			fr: 'Larvibule',
			en: 'Grubbin',
			jp: 'アゴジムシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/736/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/736/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 47,
			atk: 62,
			def: 45,
			spe_atk: 55,
			spe_def: 45,
			vit: 46,
		},
		category: 'Pokémon Larve',
		generation: 7,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 737,
		name: {
			fr: 'Chrysapile',
			en: 'Charjabug',
			jp: 'デンヂムシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/737/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/737/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 57,
			atk: 82,
			def: 95,
			spe_atk: 55,
			spe_def: 75,
			vit: 36,
		},
		category: 'Pokémon Batterie',
		generation: 7,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 738,
		name: {
			fr: 'Lucanon',
			en: 'Vikavolt',
			jp: 'クワガノン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/738/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/738/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 77,
			atk: 70,
			def: 90,
			spe_atk: 145,
			spe_def: 75,
			vit: 43,
		},
		category: 'Pokémon Scarabée',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 739,
		name: {
			fr: 'Crabagarre',
			en: 'Crabrawler',
			jp: 'マケンカニ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/739/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/739/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 47,
			atk: 82,
			def: 57,
			spe_atk: 42,
			spe_def: 47,
			vit: 63,
		},
		category: 'Pokémon Boxeur',
		generation: 7,
		catch_rate: 225,
		rareté: 2,
	},
	{
		pokedex_id: 740,
		name: {
			fr: 'Crabominable',
			en: 'Crabominable',
			jp: 'ケケンカニ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/740/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/740/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 97,
			atk: 132,
			def: 77,
			spe_atk: 62,
			spe_def: 67,
			vit: 43,
		},
		category: 'Pokémon Crabe Velu',
		generation: 7,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 741,
		name: {
			fr: 'Plumeline',
			en: 'Oricorio',
			jp: 'オドリドリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/741/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/741/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 75,
			atk: 70,
			def: 70,
			spe_atk: 98,
			spe_def: 70,
			vit: 93,
		},
		category: 'Pokémon Danse',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 742,
		name: {
			fr: 'Bombydou',
			en: 'Cutiefly',
			jp: 'アブリー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/742/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/742/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 40,
			spe_atk: 55,
			spe_def: 40,
			vit: 84,
		},
		category: 'Pokémon Bombyle',
		generation: 7,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 743,
		name: {
			fr: 'Rubombelle',
			en: 'Ribombee',
			jp: 'アブリボン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/743/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/743/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 60,
			atk: 55,
			def: 60,
			spe_atk: 95,
			spe_def: 70,
			vit: 124,
		},
		category: 'Pokémon Bombyle',
		generation: 7,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 744,
		name: {
			fr: 'Rocabot',
			en: 'Rockruff',
			jp: 'イワンコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/744/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/744/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 45,
			atk: 65,
			def: 40,
			spe_atk: 30,
			spe_def: 40,
			vit: 60,
		},
		category: 'Pokémon Chiot',
		generation: 7,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 745,
		name: {
			fr: 'Lougaroc',
			en: 'Lycanroc',
			jp: 'ルガルガン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/745/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/745/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 75,
			atk: 115,
			def: 65,
			spe_atk: 55,
			spe_def: 65,
			vit: 112,
		},
		category: 'Pokémon Loup',
		generation: 7,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 746,
		name: {
			fr: 'Froussardine',
			en: 'Wishiwashi',
			jp: 'ヨワシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/746/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/746/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 45,
			atk: 20,
			def: 20,
			spe_atk: 25,
			spe_def: 25,
			vit: 40,
		},
		category: 'Pokémon Minipoisson',
		generation: 7,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 747,
		name: {
			fr: 'Vorastérie',
			en: 'Mareanie',
			jp: 'ヒドイデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/747/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/747/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 53,
			def: 62,
			spe_atk: 43,
			spe_def: 52,
			vit: 45,
		},
		category: 'Pokémon Cruel',
		generation: 7,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 748,
		name: {
			fr: 'Prédastérie',
			en: 'Toxapex',
			jp: 'ドヒドイデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/748/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/748/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 63,
			def: 152,
			spe_atk: 53,
			spe_def: 142,
			vit: 35,
		},
		category: 'Pokémon Cruel',
		generation: 7,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 749,
		name: {
			fr: 'Tiboudet',
			en: 'Mudbray',
			jp: 'ドロバンコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/749/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/749/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 100,
			def: 70,
			spe_atk: 45,
			spe_def: 55,
			vit: 45,
		},
		category: 'Pokémon Âne',
		generation: 7,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 750,
		name: {
			fr: 'Bourrinos',
			en: 'Mudsdale',
			jp: 'バンバドロ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/750/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/750/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 100,
			atk: 125,
			def: 100,
			spe_atk: 55,
			spe_def: 85,
			vit: 35,
		},
		category: 'Pokémon Cheval Trait',
		generation: 7,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 751,
		name: {
			fr: 'Araqua',
			en: 'Dewpider',
			jp: 'シズクモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/751/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/751/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 38,
			atk: 40,
			def: 52,
			spe_atk: 40,
			spe_def: 72,
			vit: 27,
		},
		category: 'Pokémon Aquabulle',
		generation: 7,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 752,
		name: {
			fr: 'Tarenbulle',
			en: 'Araquanid',
			jp: 'オニシズクモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/752/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/752/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 68,
			atk: 70,
			def: 92,
			spe_atk: 50,
			spe_def: 132,
			vit: 42,
		},
		category: 'Pokémon Aquabulle',
		generation: 7,
		catch_rate: 100,
		rareté: 2,
	},
	{
		pokedex_id: 753,
		name: {
			fr: 'Mimantis',
			en: 'Fomantis',
			jp: 'カリキリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/753/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/753/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 55,
			def: 35,
			spe_atk: 50,
			spe_def: 35,
			vit: 35,
		},
		category: "Pokémon Fauch'Herbe",
		generation: 7,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 754,
		name: {
			fr: 'Floramantis',
			en: 'Lurantis',
			jp: 'ラランテス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/754/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/754/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 70,
			atk: 105,
			def: 90,
			spe_atk: 80,
			spe_def: 90,
			vit: 45,
		},
		category: "Pokémon Fauch'Fleur",
		generation: 7,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 755,
		name: {
			fr: 'Spododo',
			en: 'Morelull',
			jp: 'ネマシュ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/755/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/755/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 40,
			atk: 35,
			def: 55,
			spe_atk: 65,
			spe_def: 75,
			vit: 15,
		},
		category: 'Pokémon Luminescent',
		generation: 7,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 756,
		name: {
			fr: 'Lampignon',
			en: 'Shiinotic',
			jp: 'マシェード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/756/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/756/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 60,
			atk: 45,
			def: 80,
			spe_atk: 90,
			spe_def: 100,
			vit: 30,
		},
		category: 'Pokémon Luminescent',
		generation: 7,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 757,
		name: {
			fr: 'Tritox',
			en: 'Salandit',
			jp: 'ヤトウモリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/757/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/757/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 48,
			atk: 44,
			def: 40,
			spe_atk: 71,
			spe_def: 40,
			vit: 77,
		},
		category: 'Pokémon Toxilézard',
		generation: 7,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 758,
		name: {
			fr: 'Malamandre',
			en: 'Salazzle',
			jp: 'エンニュート',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/758/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/758/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 68,
			atk: 64,
			def: 60,
			spe_atk: 111,
			spe_def: 60,
			vit: 117,
		},
		category: 'Pokémon Toxilézard',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 759,
		name: {
			fr: 'Nounourson',
			en: 'Stufful',
			jp: 'ヌイコグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/759/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/759/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 70,
			atk: 75,
			def: 50,
			spe_atk: 45,
			spe_def: 50,
			vit: 50,
		},
		category: 'Pokémon Gigoteur',
		generation: 7,
		catch_rate: 140,
		rareté: 2,
	},
	{
		pokedex_id: 760,
		name: {
			fr: 'Chelours',
			en: 'Bewear',
			jp: 'キテルグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/760/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/760/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 120,
			atk: 125,
			def: 80,
			spe_atk: 55,
			spe_def: 60,
			vit: 60,
		},
		category: 'Pokémon Biscoteaux',
		generation: 7,
		catch_rate: 70,
		rareté: 2,
	},
	{
		pokedex_id: 761,
		name: {
			fr: 'Croquine',
			en: 'Bounsweet',
			jp: 'アマカジ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/761/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/761/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 42,
			atk: 30,
			def: 38,
			spe_atk: 30,
			spe_def: 38,
			vit: 32,
		},
		category: 'Pokémon Fruit',
		generation: 7,
		catch_rate: 235,
		rareté: 3,
	},
	{
		pokedex_id: 762,
		name: {
			fr: 'Candine',
			en: 'Steenee',
			jp: 'アママイコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/762/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/762/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 52,
			atk: 40,
			def: 48,
			spe_atk: 40,
			spe_def: 48,
			vit: 62,
		},
		category: 'Pokémon Fruit',
		generation: 7,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 763,
		name: {
			fr: 'Sucreine',
			en: 'Tsareena',
			jp: 'アマージョ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/763/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/763/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 72,
			atk: 120,
			def: 98,
			spe_atk: 50,
			spe_def: 98,
			vit: 72,
		},
		category: 'Pokémon Fruit',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 764,
		name: {
			fr: 'Guérilande',
			en: 'Comfey',
			jp: 'キュワワー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/764/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/764/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 51,
			atk: 52,
			def: 90,
			spe_atk: 82,
			spe_def: 110,
			vit: 100,
		},
		category: 'Pokémon Tressefleur',
		generation: 7,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 765,
		name: {
			fr: 'Gouroutan',
			en: 'Oranguru',
			jp: 'ヤレユータン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/765/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/765/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 60,
			def: 80,
			spe_atk: 90,
			spe_def: 110,
			vit: 60,
		},
		category: 'Pokémon Grand Sage',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 766,
		name: {
			fr: 'Quartermac',
			en: 'Passimian',
			jp: 'ナゲツケサル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/766/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/766/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 100,
			atk: 120,
			def: 90,
			spe_atk: 40,
			spe_def: 60,
			vit: 80,
		},
		category: 'Pokémon Coopération',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 767,
		name: {
			fr: 'Sovkipou',
			en: 'Wimpod',
			jp: 'コソクムシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/767/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/767/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 25,
			atk: 35,
			def: 40,
			spe_atk: 20,
			spe_def: 30,
			vit: 80,
		},
		category: 'Pokémon Cavaleur',
		generation: 7,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 768,
		name: {
			fr: 'Sarmuraï',
			en: 'Golisopod',
			jp: 'グソクムシャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/768/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/768/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 75,
			atk: 125,
			def: 140,
			spe_atk: 60,
			spe_def: 90,
			vit: 40,
		},
		category: 'Pokémon Blindé',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 769,
		name: {
			fr: 'Bacabouh',
			en: 'Sandygast',
			jp: 'スナバァ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/769/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/769/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 55,
			atk: 55,
			def: 80,
			spe_atk: 70,
			spe_def: 45,
			vit: 15,
		},
		category: "Pokémon Pâtéd'Sable",
		generation: 7,
		catch_rate: 140,
		rareté: 3,
	},
	{
		pokedex_id: 770,
		name: {
			fr: 'Trépassable',
			en: 'Palossand',
			jp: 'シロデスナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/770/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/770/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 75,
			def: 110,
			spe_atk: 100,
			spe_def: 75,
			vit: 35,
		},
		category: "Pokémon Châtod'Sable",
		generation: 7,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 771,
		name: {
			fr: 'Concombaffe',
			en: 'Pyukumuku',
			jp: 'ナマコブシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/771/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/771/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 60,
			def: 130,
			spe_atk: 30,
			spe_def: 130,
			vit: 5,
		},
		category: 'Pokémon Holothurie',
		generation: 7,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 772,
		name: {
			fr: 'Type:0',
			en: 'Type: Null',
			jp: 'タイプ：ヌル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/772/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/772/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 95,
			atk: 95,
			def: 95,
			spe_atk: 95,
			spe_def: 95,
			vit: 59,
		},
		category: 'Pokémon Multigénome',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 773,
		name: {
			fr: 'Silvallié',
			en: 'Silvally',
			jp: 'シルヴァディ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/773/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/773/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 95,
			atk: 95,
			def: 95,
			spe_atk: 95,
			spe_def: 95,
			vit: 95,
		},
		category: 'Pokémon Multigénome',
		generation: 7,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 774,
		name: {
			fr: 'Météno',
			en: 'Minior',
			jp: 'メテノ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/774/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/774/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 60,
			atk: 100,
			def: 60,
			spe_atk: 100,
			spe_def: 60,
			vit: 120,
		},
		category: 'Pokémon Météore',
		generation: 7,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 775,
		name: {
			fr: 'Dodoala',
			en: 'Komala',
			jp: 'ネッコアラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/775/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/775/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 65,
			atk: 115,
			def: 65,
			spe_atk: 75,
			spe_def: 95,
			vit: 65,
		},
		category: 'Pokémon Rêveur',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 776,
		name: {
			fr: 'Boumata',
			en: 'Turtonator',
			jp: 'バクガメス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/776/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/776/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 60,
			atk: 78,
			def: 135,
			spe_atk: 91,
			spe_def: 85,
			vit: 36,
		},
		category: 'Pokémon Tortue Boum',
		generation: 7,
		catch_rate: 70,
		rareté: 3,
	},
	{
		pokedex_id: 777,
		name: {
			fr: 'Togedemaru',
			en: 'Togedemaru',
			jp: 'トゲデマル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/777/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/777/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 65,
			atk: 98,
			def: 63,
			spe_atk: 40,
			spe_def: 73,
			vit: 96,
		},
		category: 'Pokémon Roulenboule',
		generation: 7,
		catch_rate: 180,
		rareté: 3,
	},
	{
		pokedex_id: 778,
		name: {
			fr: 'Mimiqui',
			en: 'Mimikyu',
			jp: 'ミミッキュ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/778/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/778/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 55,
			atk: 90,
			def: 80,
			spe_atk: 50,
			spe_def: 105,
			vit: 96,
		},
		category: 'Pokémon Fantômasque',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 779,
		name: {
			fr: 'Denticrisse',
			en: 'Bruxish',
			jp: 'ハギギシリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/779/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/779/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 68,
			atk: 105,
			def: 70,
			spe_atk: 70,
			spe_def: 70,
			vit: 92,
		},
		category: 'Pokémon Grincedent',
		generation: 7,
		catch_rate: 80,
		rareté: 1,
	},
	{
		pokedex_id: 780,
		name: {
			fr: 'Draïeul',
			en: 'Drampa',
			jp: 'ジジーロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/780/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/780/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 78,
			atk: 60,
			def: 85,
			spe_atk: 135,
			spe_def: 91,
			vit: 36,
		},
		category: 'Pokémon Nonchalant',
		generation: 7,
		catch_rate: 70,
		rareté: 3,
	},
	{
		pokedex_id: 781,
		name: {
			fr: 'Sinistrail',
			en: 'Dhelmise',
			jp: 'ダダリン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/781/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/781/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 70,
			atk: 131,
			def: 100,
			spe_atk: 86,
			spe_def: 90,
			vit: 40,
		},
		category: 'Pokémon Varech',
		generation: 7,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 782,
		name: {
			fr: 'Bébécaille',
			en: 'Jangmo-o',
			jp: 'ジャラコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/782/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/782/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 45,
			atk: 55,
			def: 65,
			spe_atk: 45,
			spe_def: 45,
			vit: 45,
		},
		category: 'Pokémon Écailles',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 783,
		name: {
			fr: 'Écaïd',
			en: 'Hakamo-o',
			jp: 'ジャランゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/783/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/783/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 55,
			atk: 75,
			def: 90,
			spe_atk: 65,
			spe_def: 70,
			vit: 65,
		},
		category: 'Pokémon Écailles',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 784,
		name: {
			fr: 'Ékaïser',
			en: 'Kommo-o',
			jp: 'ジャラランガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/784/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/784/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 75,
			atk: 110,
			def: 125,
			spe_atk: 100,
			spe_def: 105,
			vit: 85,
		},
		category: 'Pokémon Écailles',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 785,
		name: {
			fr: 'Tokorico',
			en: 'Tapu Koko',
			jp: 'カプ・コケコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/785/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/785/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 70,
			atk: 115,
			def: 85,
			spe_atk: 95,
			spe_def: 75,
			vit: 130,
		},
		category: 'Pokémon Tutélaire',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 786,
		name: {
			fr: 'Tokopiyon',
			en: 'Tapu Lele',
			jp: 'カプ・テテフ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/786/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/786/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 75,
			spe_atk: 130,
			spe_def: 115,
			vit: 95,
		},
		category: 'Pokémon Tutélaire',
		generation: 7,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 787,
		name: {
			fr: 'Tokotoro',
			en: 'Tapu Bulu',
			jp: 'カプ・ブルル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/787/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/787/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 70,
			atk: 130,
			def: 115,
			spe_atk: 85,
			spe_def: 95,
			vit: 75,
		},
		category: 'Pokémon Tutélaire',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 788,
		name: {
			fr: 'Tokopisco',
			en: 'Tapu Fini',
			jp: 'カプ・レヒレ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/788/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/788/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 70,
			atk: 75,
			def: 115,
			spe_atk: 95,
			spe_def: 130,
			vit: 85,
		},
		category: 'Pokémon Tutélaire',
		generation: 7,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 789,
		name: {
			fr: 'Cosmog',
			en: 'Cosmog',
			jp: 'コスモッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/789/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 43,
			atk: 29,
			def: 31,
			spe_atk: 29,
			spe_def: 31,
			vit: 37,
		},
		category: 'Pokémon Nébuleuse',
		generation: 7,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 790,
		name: {
			fr: 'Cosmovum',
			en: 'Cosmoem',
			jp: 'コスモウム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/790/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 43,
			atk: 29,
			def: 131,
			spe_atk: 29,
			spe_def: 131,
			vit: 37,
		},
		category: 'Pokémon Proto-Étoile',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 791,
		name: {
			fr: 'Solgaleo',
			en: 'Solgaleo',
			jp: 'ソルガレオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/791/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/791/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 137,
			atk: 137,
			def: 107,
			spe_atk: 113,
			spe_def: 89,
			vit: 97,
		},
		category: 'Pokémon Halo Solaire',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 792,
		name: {
			fr: 'Lunala',
			en: 'Lunala',
			jp: 'ルナアーラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/792/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/792/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 137,
			atk: 113,
			def: 89,
			spe_atk: 137,
			spe_def: 107,
			vit: 97,
		},
		category: 'Pokémon Halo Lunaire',
		generation: 7,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 793,
		name: {
			fr: 'Zéroïd',
			en: 'Nihilego',
			jp: 'ウツロイド',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/793/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/793/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 109,
			atk: 53,
			def: 47,
			spe_atk: 127,
			spe_def: 131,
			vit: 103,
		},
		category: 'Pokémon Parasite',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 794,
		name: {
			fr: 'Mouscoto',
			en: 'Buzzwole',
			jp: 'マッシブーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/794/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/794/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 107,
			atk: 139,
			def: 139,
			spe_atk: 53,
			spe_def: 53,
			vit: 79,
		},
		category: 'Pokémon Enflé',
		generation: 7,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 795,
		name: {
			fr: 'Cancrelove',
			en: 'Pheromosa',
			jp: 'フェローチェ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/795/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/795/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 71,
			atk: 137,
			def: 37,
			spe_atk: 137,
			spe_def: 37,
			vit: 151,
		},
		category: 'Pokémon Gracile',
		generation: 7,
		catch_rate: 25,
		rareté: 1,
	},
	{
		pokedex_id: 796,
		name: {
			fr: 'Câblifère',
			en: 'Xurkitree',
			jp: 'デンジュモク',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/796/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/796/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 83,
			atk: 89,
			def: 71,
			spe_atk: 173,
			spe_def: 71,
			vit: 83,
		},
		category: 'Pokémon Luminaire',
		generation: 7,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 797,
		name: {
			fr: 'Bamboiselle',
			en: 'Celesteela',
			jp: 'テッカグヤ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/797/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/797/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 97,
			atk: 101,
			def: 103,
			spe_atk: 107,
			spe_def: 101,
			vit: 61,
		},
		category: 'Pokémon Décollage',
		generation: 7,
		catch_rate: 25,
		rareté: 1,
	},
	{
		pokedex_id: 798,
		name: {
			fr: 'Katagami',
			en: 'Kartana',
			jp: 'カミツルギ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/798/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/798/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 59,
			atk: 181,
			def: 131,
			spe_atk: 59,
			spe_def: 31,
			vit: 109,
		},
		category: 'Pokémon Battô',
		generation: 7,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 799,
		name: {
			fr: 'Engloutyran',
			en: 'Guzzlord',
			jp: 'アクジキング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/799/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/799/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 223,
			atk: 101,
			def: 53,
			spe_atk: 97,
			spe_def: 53,
			vit: 43,
		},
		category: 'Pokémon Bizarrovore',
		generation: 7,
		catch_rate: 15,
		rareté: 2,
	},
	{
		pokedex_id: 800,
		name: {
			fr: 'Necrozma',
			en: 'Necrozma',
			jp: 'ネクロズマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/800/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/800/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 97,
			atk: 107,
			def: 101,
			spe_atk: 127,
			spe_def: 89,
			vit: 79,
		},
		category: 'Pokémon Prisme',
		generation: 7,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 801,
		name: {
			fr: 'Magearna',
			en: 'Magearna',
			jp: 'マギアナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/801/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 80,
			atk: 95,
			def: 115,
			spe_atk: 130,
			spe_def: 115,
			vit: 65,
		},
		category: 'Pokémon Artificiel',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 802,
		name: {
			fr: 'Marshadow',
			en: 'Marshadow',
			jp: 'マーシャドー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/802/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 90,
			atk: 125,
			def: 80,
			spe_atk: 90,
			spe_def: 90,
			vit: 125,
		},
		category: 'Pokémon Ombrefuge',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 803,
		name: {
			fr: 'Vémini',
			en: 'Poipole',
			jp: 'ベベノム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/803/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/803/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 67,
			atk: 73,
			def: 67,
			spe_atk: 73,
			spe_def: 67,
			vit: 73,
		},
		category: 'Pokémon Artificiel',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 804,
		name: {
			fr: 'Mandrillon',
			en: 'Naganadel',
			jp: 'アーゴヨン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/804/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/804/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 73,
			atk: 73,
			def: 73,
			spe_atk: 127,
			spe_def: 73,
			vit: 121,
		},
		category: 'Pokémon Vénépic',
		generation: 7,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 805,
		name: {
			fr: 'Ama-ama',
			en: 'Stakataka',
			jp: 'ツンデツンデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/805/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/805/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 61,
			atk: 131,
			def: 211,
			spe_atk: 53,
			spe_def: 101,
			vit: 13,
		},
		category: 'Pokémon Muraille',
		generation: 7,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 806,
		name: {
			fr: 'Pierroteknik',
			en: 'Blacephalon',
			jp: 'ズガドーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/806/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/806/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 53,
			atk: 127,
			def: 53,
			spe_atk: 151,
			spe_def: 79,
			vit: 107,
		},
		category: 'Pokémon Artificier',
		generation: 7,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 807,
		name: {
			fr: 'Zeraora',
			en: 'Zeraora',
			jp: 'ゼラオラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/807/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/807/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 88,
			atk: 112,
			def: 75,
			spe_atk: 102,
			spe_def: 80,
			vit: 143,
		},
		category: 'Pokémon Vif Éclair',
		generation: 7,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 808,
		name: {
			fr: 'Meltan',
			en: 'Meltan',
			jp: 'メルタン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/808/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/808/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 46,
			atk: 65,
			def: 65,
			spe_atk: 55,
			spe_def: 35,
			vit: 34,
		},
		category: 'Pokémon Écrou',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 809,
		name: {
			fr: 'Melmetal',
			en: 'Melmetal',
			jp: 'メルメタル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/809/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/809/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/809/gmax-regular.png',
				shiny: null,
			},
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 135,
			atk: 143,
			def: 143,
			spe_atk: 80,
			spe_def: 65,
			vit: 34,
		},
		category: 'Pokémon Écrou',
		generation: 7,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 810,
		name: {
			fr: 'Ouistempo',
			en: 'Grookey',
			jp: 'サルノリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/810/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/810/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 50,
			atk: 65,
			def: 50,
			spe_atk: 40,
			spe_def: 40,
			vit: 65,
		},
		category: 'Pokémon Chimpanzé',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 811,
		name: {
			fr: 'Badabouin',
			en: 'Thwackey',
			jp: 'バチンキー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/811/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/811/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 70,
			spe_atk: 55,
			spe_def: 60,
			vit: 80,
		},
		category: 'Pokémon Percussions',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 812,
		name: {
			fr: 'Gorythmic',
			en: 'Rillaboom',
			jp: 'ゴリランダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/812/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/812/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/812/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/812/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 100,
			atk: 125,
			def: 90,
			spe_atk: 60,
			spe_def: 70,
			vit: 85,
		},
		category: 'Pokémon Batteur',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 813,
		name: {
			fr: 'Flambino',
			en: 'Scorbunny',
			jp: 'ヒバニー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/813/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/813/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 50,
			atk: 71,
			def: 40,
			spe_atk: 40,
			spe_def: 40,
			vit: 69,
		},
		category: 'Pokémon Lapin',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 814,
		name: {
			fr: 'Lapyro',
			en: 'Raboot',
			jp: 'ラビフット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/814/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/814/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 86,
			def: 60,
			spe_atk: 55,
			spe_def: 60,
			vit: 94,
		},
		category: 'Pokémon Lapin',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 815,
		name: {
			fr: 'Pyrobut',
			en: 'Cinderace',
			jp: 'エースバーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/815/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/815/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/815/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/815/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 80,
			atk: 116,
			def: 75,
			spe_atk: 65,
			spe_def: 75,
			vit: 119,
		},
		category: 'Pokémon Buteur',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 816,
		name: {
			fr: 'Larméléon',
			en: 'Sobble',
			jp: 'メッソン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/816/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/816/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 40,
			def: 40,
			spe_atk: 70,
			spe_def: 40,
			vit: 70,
		},
		category: "Pokémon Lézard'Eau",
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 817,
		name: {
			fr: 'Arrozard',
			en: 'Drizzile',
			jp: 'ジメレオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/817/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/817/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 65,
			atk: 60,
			def: 55,
			spe_atk: 95,
			spe_def: 55,
			vit: 90,
		},
		category: "Pokémon Lézard'Eau",
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 818,
		name: {
			fr: 'Lézargus',
			en: 'Inteleon',
			jp: 'インテレオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/818/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/818/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/818/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/818/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 65,
			spe_atk: 125,
			spe_def: 65,
			vit: 120,
		},
		category: 'Pokémon Agent Secret',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 819,
		name: {
			fr: 'Rongourmand',
			en: 'Skwovet',
			jp: 'ホシガリス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/819/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/819/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 70,
			atk: 55,
			def: 55,
			spe_atk: 35,
			spe_def: 35,
			vit: 25,
		},
		category: 'Pokémon Joufflu',
		generation: 8,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 820,
		name: {
			fr: 'Rongrigou',
			en: 'Greedent',
			jp: 'ヨクバリス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/820/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/820/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 120,
			atk: 95,
			def: 95,
			spe_atk: 55,
			spe_def: 75,
			vit: 20,
		},
		category: 'Pokémon Goulu',
		generation: 8,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 821,
		name: {
			fr: 'Minisange',
			en: 'Rookidee',
			jp: 'ココガラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/821/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/821/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 38,
			atk: 47,
			def: 35,
			spe_atk: 33,
			spe_def: 35,
			vit: 57,
		},
		category: 'Pokémon Minioiseau',
		generation: 8,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 822,
		name: {
			fr: 'Bleuseille',
			en: 'Corvisquire',
			jp: 'アオガラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/822/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/822/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 68,
			atk: 67,
			def: 55,
			spe_atk: 43,
			spe_def: 55,
			vit: 77,
		},
		category: 'Pokémon Corbeau',
		generation: 8,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 823,
		name: {
			fr: 'Corvaillus',
			en: 'Corviknight',
			jp: 'アーマーガア',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/823/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/823/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/823/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/823/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 98,
			atk: 87,
			def: 105,
			spe_atk: 53,
			spe_def: 85,
			vit: 67,
		},
		category: 'Pokémon Corbeau',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 824,
		name: {
			fr: 'Larvadar',
			en: 'Blipbug',
			jp: 'サッチムシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/824/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/824/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 28,
			atk: 20,
			def: 20,
			spe_atk: 25,
			spe_def: 45,
			vit: 45,
		},
		category: 'Pokémon Larve',
		generation: 8,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 825,
		name: {
			fr: 'Coléodôme',
			en: 'Dottler',
			jp: 'レドームシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/825/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/825/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 50,
			atk: 35,
			def: 80,
			spe_atk: 50,
			spe_def: 95,
			vit: 30,
		},
		category: 'Pokémon Radôme',
		generation: 8,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 826,
		name: {
			fr: 'Astronelle',
			en: 'Orbeetle',
			jp: 'イオルブ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/826/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/826/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/826/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/826/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 60,
			atk: 45,
			def: 110,
			spe_atk: 80,
			spe_def: 120,
			vit: 90,
		},
		category: 'Pokémon Sept points',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 827,
		name: {
			fr: 'Goupilou',
			en: 'Nickit',
			jp: 'クスネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/827/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/827/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 40,
			atk: 28,
			def: 28,
			spe_atk: 47,
			spe_def: 52,
			vit: 50,
		},
		category: 'Pokémon Renard',
		generation: 8,
		catch_rate: 225,
		rareté: 3,
	},
	{
		pokedex_id: 828,
		name: {
			fr: 'Roublenard',
			en: 'Thievul',
			jp: 'フォクスライ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/828/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/828/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 58,
			def: 58,
			spe_atk: 87,
			spe_def: 92,
			vit: 90,
		},
		category: 'Pokémon Renard',
		generation: 8,
		catch_rate: 127,
		rareté: 3,
	},
	{
		pokedex_id: 829,
		name: {
			fr: 'Tournicoton',
			en: 'Gossifleur',
			jp: 'ヒメンカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/829/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/829/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 60,
			spe_atk: 40,
			spe_def: 60,
			vit: 10,
		},
		category: 'Pokémon Chef-Fleur',
		generation: 8,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 830,
		name: {
			fr: 'Blancoton',
			en: 'Eldegoss',
			jp: 'ワタシラガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/830/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/830/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 60,
			atk: 50,
			def: 90,
			spe_atk: 80,
			spe_def: 120,
			vit: 60,
		},
		category: 'Pokémon Chef-Coton',
		generation: 8,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 831,
		name: {
			fr: 'Moumouton',
			en: 'Wooloo',
			jp: 'ウールー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/831/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/831/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 42,
			atk: 40,
			def: 55,
			spe_atk: 40,
			spe_def: 45,
			vit: 48,
		},
		category: 'Pokémon Mouton',
		generation: 8,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 832,
		name: {
			fr: 'Moumouflon',
			en: 'Dubwool',
			jp: 'バイウールー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/832/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/832/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 72,
			atk: 80,
			def: 100,
			spe_atk: 60,
			spe_def: 90,
			vit: 88,
		},
		category: 'Pokémon Mouton',
		generation: 8,
		catch_rate: 127,
		rareté: 1,
	},
	{
		pokedex_id: 833,
		name: {
			fr: 'Khélocrok',
			en: 'Chewtle',
			jp: 'カムカメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/833/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/833/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 50,
			atk: 64,
			def: 50,
			spe_atk: 38,
			spe_def: 38,
			vit: 44,
		},
		category: 'Pokémon Mordillage',
		generation: 8,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 834,
		name: {
			fr: 'Torgamord',
			en: 'Drednaw',
			jp: 'カジリガメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/834/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/834/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/834/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/834/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 90,
			atk: 115,
			def: 90,
			spe_atk: 48,
			spe_def: 68,
			vit: 74,
		},
		category: 'Pokémon Morsure',
		generation: 8,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 835,
		name: {
			fr: 'Voltoutou',
			en: 'Yamper',
			jp: 'ワンパチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/835/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/835/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 59,
			atk: 45,
			def: 50,
			spe_atk: 40,
			spe_def: 50,
			vit: 26,
		},
		category: 'Pokémon Chiot',
		generation: 8,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 836,
		name: {
			fr: 'Fulgudog',
			en: 'Boltund',
			jp: 'パルスワン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/836/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/836/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 69,
			atk: 90,
			def: 60,
			spe_atk: 90,
			spe_def: 60,
			vit: 121,
		},
		category: 'Pokémon Chien',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 837,
		name: {
			fr: 'Charbi',
			en: 'Rolycoly',
			jp: 'タンドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/837/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/837/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 30,
			atk: 40,
			def: 50,
			spe_atk: 40,
			spe_def: 50,
			vit: 30,
		},
		category: 'Pokémon Charbon',
		generation: 8,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 838,
		name: {
			fr: 'Wagomine',
			en: 'Carkol',
			jp: 'トロッゴン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/838/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/838/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 80,
			atk: 60,
			def: 90,
			spe_atk: 60,
			spe_def: 70,
			vit: 50,
		},
		category: 'Pokémon Charbon',
		generation: 8,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 839,
		name: {
			fr: 'Monthracite',
			en: 'Coalossal',
			jp: 'セキタンザン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/839/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/839/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/839/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/839/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 110,
			atk: 80,
			def: 120,
			spe_atk: 80,
			spe_def: 90,
			vit: 30,
		},
		category: 'Pokémon Charbon',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 840,
		name: {
			fr: 'Verpom',
			en: 'Applin',
			jp: 'カジッチュ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/840/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/840/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 80,
			spe_atk: 40,
			spe_def: 40,
			vit: 20,
		},
		category: 'Pokémon Nid Pomme',
		generation: 8,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 841,
		name: {
			fr: 'Pomdrapi',
			en: 'Flapple',
			jp: 'アップリュー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/841/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/841/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/841/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/841/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 70,
			atk: 110,
			def: 80,
			spe_atk: 95,
			spe_def: 60,
			vit: 70,
		},
		category: 'Pokémon Ailes Pomme',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 842,
		name: {
			fr: 'Dratatin',
			en: 'Appletun',
			jp: 'タルップル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/842/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/842/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/842/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/842/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 110,
			atk: 85,
			def: 80,
			spe_atk: 100,
			spe_def: 80,
			vit: 30,
		},
		category: 'Pokémon Jus Pomme',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 843,
		name: {
			fr: 'Dunaja',
			en: 'Silicobra',
			jp: 'スナヘビ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/843/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/843/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 52,
			atk: 57,
			def: 75,
			spe_atk: 35,
			spe_def: 50,
			vit: 46,
		},
		category: 'Pokémon Serpensable',
		generation: 8,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 844,
		name: {
			fr: 'Dunaconda',
			en: 'Sandaconda',
			jp: 'サダイジャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/844/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/844/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/844/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/844/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 72,
			atk: 107,
			def: 125,
			spe_atk: 65,
			spe_def: 70,
			vit: 71,
		},
		category: 'Pokémon Serpensable',
		generation: 8,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 845,
		name: {
			fr: 'Nigosier',
			en: 'Cramorant',
			jp: 'ウッウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/845/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/845/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 55,
			spe_atk: 85,
			spe_def: 95,
			vit: 85,
		},
		category: 'Pokémon Avaltouron',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 846,
		name: {
			fr: 'Embrochet',
			en: 'Arrokuda',
			jp: 'サシカマス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/846/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/846/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 41,
			atk: 63,
			def: 40,
			spe_atk: 40,
			spe_def: 30,
			vit: 66,
		},
		category: 'Pokémon Fonceur',
		generation: 8,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 847,
		name: {
			fr: 'Hastacuda',
			en: 'Barraskewda',
			jp: 'カマスジョー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/847/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/847/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 61,
			atk: 123,
			def: 60,
			spe_atk: 60,
			spe_def: 50,
			vit: 136,
		},
		category: 'Pokémon Transperceur',
		generation: 8,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 848,
		name: {
			fr: 'Toxizap',
			en: 'Toxel',
			jp: 'エレズン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/848/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/848/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 40,
			atk: 38,
			def: 35,
			spe_atk: 54,
			spe_def: 35,
			vit: 40,
		},
		category: 'Pokémon Poupon',
		generation: 8,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 849,
		name: {
			fr: 'Salarsen',
			en: 'Toxtricity',
			jp: 'ストリンダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/849/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/849/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/849/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/849/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 75,
			atk: 98,
			def: 70,
			spe_atk: 114,
			spe_def: 70,
			vit: 75,
		},
		category: 'Pokémon Punk',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 850,
		name: {
			fr: 'Grillepattes',
			en: 'Sizzlipede',
			jp: 'ヤクデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/850/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/850/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 50,
			atk: 65,
			def: 45,
			spe_atk: 50,
			spe_def: 50,
			vit: 45,
		},
		category: 'Pokémon Calorifère',
		generation: 8,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 851,
		name: {
			fr: 'Scolocendre',
			en: 'Centiskorch',
			jp: 'マルヤクデ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/851/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/851/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/851/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/851/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 100,
			atk: 115,
			def: 65,
			spe_atk: 90,
			spe_def: 90,
			vit: 65,
		},
		category: 'Pokémon Calorifère',
		generation: 8,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 852,
		name: {
			fr: 'Poulpaf',
			en: 'Clobbopus',
			jp: 'タタッコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/852/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/852/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 50,
			atk: 68,
			def: 60,
			spe_atk: 50,
			spe_def: 50,
			vit: 32,
		},
		category: 'Pokémon Caprice',
		generation: 8,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 853,
		name: {
			fr: 'Krakos',
			en: 'Grapploct',
			jp: 'オトスパス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/853/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/853/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 80,
			atk: 118,
			def: 90,
			spe_atk: 70,
			spe_def: 80,
			vit: 42,
		},
		category: 'Pokémon Jujitsu',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 854,
		name: {
			fr: 'Théffroi',
			en: 'Sinistea',
			jp: 'ヤバチャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/854/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/854/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 45,
			spe_atk: 74,
			spe_def: 54,
			vit: 50,
		},
		category: 'Pokémon Thé Noir',
		generation: 8,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 855,
		name: {
			fr: 'Polthégeist',
			en: 'Polteageist',
			jp: 'ポットデス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/855/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/855/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 60,
			atk: 65,
			def: 65,
			spe_atk: 134,
			spe_def: 114,
			vit: 70,
		},
		category: 'Pokémon Thé Noir',
		generation: 8,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 856,
		name: {
			fr: 'Bibichut',
			en: 'Hatenna',
			jp: 'ミブリム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/856/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/856/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 42,
			atk: 30,
			def: 45,
			spe_atk: 56,
			spe_def: 53,
			vit: 39,
		},
		category: 'Pokémon Calme',
		generation: 8,
		catch_rate: 235,
		rareté: 3,
	},
	{
		pokedex_id: 857,
		name: {
			fr: 'Chapotus',
			en: 'Hattrem',
			jp: 'テブリム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/857/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/857/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 57,
			atk: 40,
			def: 65,
			spe_atk: 86,
			spe_def: 73,
			vit: 49,
		},
		category: 'Pokémon Serein',
		generation: 8,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 858,
		name: {
			fr: 'Sorcilence',
			en: 'Hatterene',
			jp: 'ブリムオン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/858/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/858/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/858/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/858/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 57,
			atk: 90,
			def: 95,
			spe_atk: 136,
			spe_def: 103,
			vit: 29,
		},
		category: 'Pokémon Silencieux',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 859,
		name: {
			fr: 'Grimalin',
			en: 'Impidimp',
			jp: 'ベロバー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/859/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/859/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 45,
			atk: 45,
			def: 30,
			spe_atk: 55,
			spe_def: 40,
			vit: 50,
		},
		category: 'Pokémon Malin',
		generation: 8,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 860,
		name: {
			fr: 'Fourbelin',
			en: 'Morgrem',
			jp: 'ギモー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/860/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/860/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 65,
			atk: 60,
			def: 45,
			spe_atk: 75,
			spe_def: 55,
			vit: 70,
		},
		category: 'Pokémon Scélérat',
		generation: 8,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 861,
		name: {
			fr: 'Angoliath',
			en: 'Grimmsnarl',
			jp: 'オーロンゲ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/861/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/861/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/861/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/861/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 95,
			atk: 120,
			def: 65,
			spe_atk: 95,
			spe_def: 75,
			vit: 60,
		},
		category: 'Pokémon Gonflette',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 862,
		name: {
			fr: 'Ixon',
			en: 'Obstagoon',
			jp: 'タチフサグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/862/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/862/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 93,
			atk: 90,
			def: 101,
			spe_atk: 60,
			spe_def: 81,
			vit: 95,
		},
		category: 'Pokémon Barrage',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 863,
		name: {
			fr: 'Berserkatt',
			en: 'Perrserker',
			jp: 'ニャイキング',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/863/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/863/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 70,
			atk: 110,
			def: 100,
			spe_atk: 50,
			spe_def: 60,
			vit: 50,
		},
		category: 'Pokémon Viking',
		generation: 8,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 864,
		name: {
			fr: 'Corayôme',
			en: 'Cursola',
			jp: 'サニゴーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/864/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/864/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 60,
			atk: 95,
			def: 50,
			spe_atk: 145,
			spe_def: 130,
			vit: 30,
		},
		category: 'Pokémon Corail',
		generation: 8,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 865,
		name: {
			fr: 'Palarticho',
			en: "Sirfetch'd",
			jp: 'ネギガナイト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/865/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/865/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 62,
			atk: 135,
			def: 95,
			spe_atk: 68,
			spe_def: 82,
			vit: 65,
		},
		category: 'Pokémon Canard Fou',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 866,
		name: {
			fr: 'M. Glaquette',
			en: 'Mr.Rime',
			jp: 'バリコオル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/866/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/866/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 80,
			atk: 85,
			def: 75,
			spe_atk: 110,
			spe_def: 100,
			vit: 70,
		},
		category: 'Pokémon Comédien',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 867,
		name: {
			fr: 'Tutétékri',
			en: 'Runerigus',
			jp: 'デスバーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/867/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/867/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 58,
			atk: 95,
			def: 145,
			spe_atk: 50,
			spe_def: 105,
			vit: 30,
		},
		category: 'Pokémon Rancune',
		generation: 8,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 868,
		name: {
			fr: 'Crèmy',
			en: 'Milcery',
			jp: 'マホミル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/868/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/868/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 45,
			atk: 40,
			def: 40,
			spe_atk: 50,
			spe_def: 61,
			vit: 34,
		},
		category: 'Pokémon Crème',
		generation: 8,
		catch_rate: 200,
		rareté: 2,
	},
	{
		pokedex_id: 869,
		name: {
			fr: 'Charmilly',
			en: 'Alcremie',
			jp: 'マホイップ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/869/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/869/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/869/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/869/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 65,
			atk: 60,
			def: 75,
			spe_atk: 110,
			spe_def: 121,
			vit: 64,
		},
		category: 'Pokémon Crème',
		generation: 8,
		catch_rate: 100,
		rareté: 1,
	},
	{
		pokedex_id: 870,
		name: {
			fr: 'Hexadron',
			en: 'Falinks',
			jp: 'タイレーツ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/870/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/870/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 65,
			atk: 100,
			def: 100,
			spe_atk: 70,
			spe_def: 60,
			vit: 75,
		},
		category: 'Pokémon Escadron',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 871,
		name: {
			fr: 'Wattapik',
			en: 'Pincurchin',
			jp: 'バチンウニ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/871/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/871/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 48,
			atk: 101,
			def: 95,
			spe_atk: 91,
			spe_def: 85,
			vit: 15,
		},
		category: 'Pokémon Oursin',
		generation: 8,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 872,
		name: {
			fr: 'Frissonille',
			en: 'Snom',
			jp: 'ユキハミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/872/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/872/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 30,
			atk: 25,
			def: 35,
			spe_atk: 45,
			spe_def: 30,
			vit: 20,
		},
		category: 'Pokémon Ver',
		generation: 8,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 873,
		name: {
			fr: 'Beldeneige',
			en: 'Frosmoth',
			jp: 'モスノウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/873/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/873/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 70,
			atk: 65,
			def: 60,
			spe_atk: 125,
			spe_def: 90,
			vit: 65,
		},
		category: 'Pokémon Mite Givre',
		generation: 8,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 874,
		name: {
			fr: 'Dolman',
			en: 'Stonjourner',
			jp: 'イシヘンジン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/874/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/874/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 100,
			atk: 125,
			def: 135,
			spe_atk: 20,
			spe_def: 20,
			vit: 70,
		},
		category: 'Pokémon Mégalithe',
		generation: 8,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 875,
		name: {
			fr: 'Bekaglaçon',
			en: 'Eiscue',
			jp: 'コオリッポ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/875/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/875/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 75,
			atk: 80,
			def: 110,
			spe_atk: 65,
			spe_def: 90,
			vit: 50,
		},
		category: 'Pokémon Pingouin',
		generation: 8,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 876,
		name: {
			fr: 'Wimessir',
			en: 'Indeedee',
			jp: 'イエッサン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/876/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/876/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 70,
			atk: 55,
			def: 65,
			spe_atk: 95,
			spe_def: 105,
			vit: 85,
		},
		category: 'Pokémon Émotion',
		generation: 8,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 877,
		name: {
			fr: 'Morpeko',
			en: 'Morpeko',
			jp: 'モルペコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/877/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/877/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 58,
			atk: 95,
			def: 58,
			spe_atk: 70,
			spe_def: 58,
			vit: 97,
		},
		category: 'Pokémon Volt Face',
		generation: 8,
		catch_rate: 180,
		rareté: 2,
	},
	{
		pokedex_id: 878,
		name: {
			fr: 'Charibari',
			en: 'Cufant',
			jp: 'ゾウドウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/878/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/878/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 72,
			atk: 80,
			def: 49,
			spe_atk: 40,
			spe_def: 49,
			vit: 40,
		},
		category: 'Pokémon Pachycuivre',
		generation: 8,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 879,
		name: {
			fr: 'Pachyradjah',
			en: 'Copperajah',
			jp: 'ダイオウドウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/879/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/879/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/879/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/879/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 122,
			atk: 130,
			def: 69,
			spe_atk: 80,
			spe_def: 69,
			vit: 30,
		},
		category: 'Pokémon Pachycuivre',
		generation: 8,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 880,
		name: {
			fr: 'Galvagon',
			en: 'Dracozolt',
			jp: 'パッチラゴン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/880/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/880/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 90,
			atk: 100,
			def: 90,
			spe_atk: 80,
			spe_def: 70,
			vit: 75,
		},
		category: 'Pokémon Fossile',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 881,
		name: {
			fr: 'Galvagla',
			en: 'Arctozolt',
			jp: 'パッチルドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/881/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/881/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 90,
			atk: 100,
			def: 90,
			spe_atk: 90,
			spe_def: 80,
			vit: 55,
		},
		category: 'Pokémon Fossile',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 882,
		name: {
			fr: 'Hydragon',
			en: 'Dracovish',
			jp: 'ウオノラゴン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/882/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/882/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 90,
			atk: 90,
			def: 100,
			spe_atk: 70,
			spe_def: 80,
			vit: 75,
		},
		category: 'Pokémon Fossile',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 883,
		name: {
			fr: 'Hydragla',
			en: 'Arctovish',
			jp: 'ウオチルドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/883/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/883/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 90,
			atk: 90,
			def: 100,
			spe_atk: 80,
			spe_def: 90,
			vit: 55,
		},
		category: 'Pokémon Fossile',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 884,
		name: {
			fr: 'Duralugon',
			en: 'Duraludon',
			jp: 'ジュラルドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/884/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/884/shiny.png',
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/884/gmax-regular.png',
				shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/884/gmax-shiny.png',
			},
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 70,
			atk: 95,
			def: 115,
			spe_atk: 120,
			spe_def: 50,
			vit: 85,
		},
		category: 'Pokémon Alliage',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 885,
		name: {
			fr: 'Fantyrm',
			en: 'Dreepy',
			jp: 'ドラメシヤ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/885/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/885/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 28,
			atk: 60,
			def: 30,
			spe_atk: 40,
			spe_def: 30,
			vit: 82,
		},
		category: 'Pokémon Åme Errante',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 886,
		name: {
			fr: 'Dispareptil',
			en: 'Drakloak',
			jp: 'ドロンチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/886/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/886/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 68,
			atk: 80,
			def: 50,
			spe_atk: 60,
			spe_def: 50,
			vit: 102,
		},
		category: 'Pokémon Baby-Sitter',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 887,
		name: {
			fr: 'Lanssorien',
			en: 'Dragapult',
			jp: 'ドラパルト',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/887/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/887/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 88,
			atk: 120,
			def: 75,
			spe_atk: 100,
			spe_def: 75,
			vit: 142,
		},
		category: 'Pokémon Furtif',
		generation: 8,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 888,
		name: {
			fr: 'Zacian',
			en: 'Zacian',
			jp: 'ザシアン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/888/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/888/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 92,
			atk: 170,
			def: 115,
			spe_atk: 80,
			spe_def: 115,
			vit: 148,
		},
		category: 'Pokémon Valeureux',
		generation: 8,
		catch_rate: 10,
		rareté: 2,
	},
	{
		pokedex_id: 889,
		name: {
			fr: 'Zamazenta',
			en: 'Zamazenta',
			jp: 'ザマゼンタ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/889/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/889/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 92,
			atk: 130,
			def: 145,
			spe_atk: 80,
			spe_def: 145,
			vit: 128,
		},
		category: 'Pokémon Valeureux',
		generation: 8,
		catch_rate: 10,
		rareté: 1,
	},
	{
		pokedex_id: 890,
		name: {
			fr: 'Éthernatos',
			en: 'Eternatus',
			jp: 'ムゲンダイナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/890/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/890/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 140,
			atk: 85,
			def: 95,
			spe_atk: 145,
			spe_def: 95,
			vit: 130,
		},
		category: 'Pokémon Giga',
		generation: 8,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 891,
		name: {
			fr: 'Wushours',
			en: 'Kubfu',
			jp: 'ダクマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/891/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 60,
			atk: 90,
			def: 60,
			spe_atk: 53,
			spe_def: 50,
			vit: 72,
		},
		category: 'Pokémon Kung-fu',
		generation: 8,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 892,
		name: {
			fr: 'Shifours',
			en: 'Shifours',
			jp: 'ウーラオス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/892/regular.png',
			shiny: null,
			gmax: {
				regular:
					'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/892/gmax-regular.png',
				shiny: null,
			},
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 100,
			atk: 130,
			def: 100,
			spe_atk: 63,
			spe_def: 60,
			vit: 97,
		},
		category: 'Pokémon Kung-fu',
		generation: 8,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 893,
		name: {
			fr: 'Zarude',
			en: 'Zarude',
			jp: 'ザルード',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/893/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 105,
			atk: 120,
			def: 105,
			spe_atk: 70,
			spe_def: 95,
			vit: 105,
		},
		category: 'Pokémon Vilain Singe',
		generation: 8,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 894,
		name: {
			fr: 'Regieleki',
			en: 'Regieleki',
			jp: 'レジエレキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/894/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/894/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 80,
			atk: 100,
			def: 50,
			spe_atk: 100,
			spe_def: 50,
			vit: 200,
		},
		category: 'Pokémon Électron',
		generation: 8,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 895,
		name: {
			fr: 'Regidrago',
			en: 'Regidrago',
			jp: 'レジドラゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/895/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/895/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 200,
			atk: 100,
			def: 50,
			spe_atk: 100,
			spe_def: 50,
			vit: 80,
		},
		category: 'Pokémon Boule Dragon',
		generation: 8,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 896,
		name: {
			fr: 'Blizzeval',
			en: 'Glastrier',
			jp: 'ブリザポス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/896/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 100,
			atk: 145,
			def: 130,
			spe_atk: 65,
			spe_def: 110,
			vit: 30,
		},
		category: 'Pokémon Cheval Rétif',
		generation: 8,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 897,
		name: {
			fr: 'Spectreval',
			en: 'Spectrier',
			jp: 'レイスポス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/897/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 100,
			atk: 65,
			def: 60,
			spe_atk: 145,
			spe_def: 80,
			vit: 130,
		},
		category: 'Pokémon Cheval Vif',
		generation: 8,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 898,
		name: {
			fr: 'Sylveroy',
			en: 'Calyrex',
			jp: 'バドレックス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/898/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 100,
			atk: 80,
			def: 80,
			spe_atk: 80,
			spe_def: 80,
			vit: 80,
		},
		category: 'Pokémon Roi',
		generation: 8,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 899,
		name: {
			fr: 'Cerbyllin',
			en: 'Wyrdeer',
			jp: 'アヤシシ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/899/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/899/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 103,
			atk: 105,
			def: 72,
			spe_atk: 105,
			spe_def: 75,
			vit: 65,
		},
		category: 'Pokémon Maxi Corne',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 900,
		name: {
			fr: 'Hachécateur',
			en: 'Kleavor',
			jp: 'バサギリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/900/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/900/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 70,
			atk: 135,
			def: 95,
			spe_atk: 45,
			spe_def: 70,
			vit: 85,
		},
		category: 'Pokémon Hache',
		generation: 8,
		catch_rate: 15,
		rareté: 1,
	},
	{
		pokedex_id: 901,
		name: {
			fr: 'Ursaking',
			en: 'Ursaluna',
			jp: 'ガチグマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/901/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/901/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 130,
			atk: 140,
			def: 105,
			spe_atk: 45,
			spe_def: 80,
			vit: 50,
		},
		category: 'Pokémon Tourbe',
		generation: 8,
		catch_rate: 20,
		rareté: 2,
	},
	{
		pokedex_id: 902,
		name: {
			fr: 'Paragruel',
			en: 'Basculegion',
			jp: 'イダイトウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/902/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/902/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 120,
			atk: 112,
			def: 65,
			spe_atk: 80,
			spe_def: 75,
			vit: 78,
		},
		category: 'Pokémon Poissigrand',
		generation: 8,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 903,
		name: {
			fr: 'Farfurex',
			en: 'Sneasler',
			jp: 'オオニューラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/903/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/903/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 130,
			def: 60,
			spe_atk: 40,
			spe_def: 80,
			vit: 120,
		},
		category: 'Pokémon Grimpeur',
		generation: 8,
		catch_rate: 20,
		rareté: 2,
	},
	{
		pokedex_id: 904,
		name: {
			fr: 'Qwilpik',
			en: 'Overqwil',
			jp: 'ハリーマン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/904/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/904/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 85,
			atk: 115,
			def: 95,
			spe_atk: 65,
			spe_def: 65,
			vit: 85,
		},
		category: 'Pokémon Épineux',
		generation: 8,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 905,
		name: {
			fr: 'Amovénus',
			en: 'Lovetolos',
			jp: 'ラブトロス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/905/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 74,
			atk: 115,
			def: 70,
			spe_atk: 135,
			spe_def: 80,
			vit: 106,
		},
		category: 'Pokémon Hainamour',
		generation: 8,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 906,
		name: {
			fr: 'Poussacha',
			en: 'Sprigatito',
			jp: 'ニャオハ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/906/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/906/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 61,
			def: 54,
			spe_atk: 45,
			spe_def: 45,
			vit: 65,
		},
		category: 'Pokémon Chat Plante',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 907,
		name: {
			fr: 'Matourgeon',
			en: 'Floragato',
			jp: 'ニャローテ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/907/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/907/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 61,
			atk: 80,
			def: 63,
			spe_atk: 60,
			spe_def: 63,
			vit: 83,
		},
		category: 'Pokémon Chat Plante',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 908,
		name: {
			fr: 'Miascarade',
			en: 'Meowscarada',
			jp: 'マスカーニャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/908/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/908/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 76,
			atk: 110,
			def: 70,
			spe_atk: 81,
			spe_def: 70,
			vit: 123,
		},
		category: 'Pokémon Magicien',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 909,
		name: {
			fr: 'Chochodile',
			en: 'Fuecoco',
			jp: 'ホゲータ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/909/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/909/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 67,
			atk: 45,
			def: 59,
			spe_atk: 63,
			spe_def: 40,
			vit: 36,
		},
		category: 'Pokémon Croco Feu',
		generation: 9,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 910,
		name: {
			fr: 'Crocogril',
			en: 'Crocalor',
			jp: 'アチゲータ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/910/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/910/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 81,
			atk: 55,
			def: 78,
			spe_atk: 90,
			spe_def: 58,
			vit: 49,
		},
		category: 'Pokémon Croco Feu',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 911,
		name: {
			fr: 'Flâmigator',
			en: 'Skeledirge',
			jp: 'ラウドボーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/911/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/911/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 104,
			atk: 75,
			def: 100,
			spe_atk: 110,
			spe_def: 75,
			vit: 66,
		},
		category: 'Pokémon Chanteur',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 912,
		name: {
			fr: 'Coiffeton',
			en: 'Quaxly',
			jp: 'クワッス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/912/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/912/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 55,
			atk: 65,
			def: 45,
			spe_atk: 50,
			spe_def: 45,
			vit: 50,
		},
		category: 'Pokémon Caneton',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 913,
		name: {
			fr: 'Canarbello',
			en: 'Quaxwell',
			jp: 'ウェルカモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/913/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/913/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 65,
			spe_atk: 65,
			spe_def: 60,
			vit: 65,
		},
		category: 'Pokémon Leçon',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 914,
		name: {
			fr: 'Palmaval',
			en: 'Quaquaval',
			jp: 'ウェーニバル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/914/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/914/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 85,
			atk: 120,
			def: 80,
			spe_atk: 85,
			spe_def: 75,
			vit: 85,
		},
		category: 'Pokémon Danseur',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 915,
		name: {
			fr: 'Gourmelet',
			en: 'Lechonk',
			jp: 'ウェーニバル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/915/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/915/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 54,
			atk: 45,
			def: 40,
			spe_atk: 35,
			spe_def: 45,
			vit: 35,
		},
		category: 'Pokémon Pourceau',
		generation: 9,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 916,
		name: {
			fr: 'Fragroin',
			en: 'Oinkologne',
			jp: 'パフュートン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/916/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/916/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 110,
			atk: 100,
			def: 75,
			spe_atk: 59,
			spe_def: 80,
			vit: 65,
		},
		category: 'Pokémon Pourceau',
		generation: 9,
		catch_rate: 100,
		rareté: 3,
	},
	{
		pokedex_id: 917,
		name: {
			fr: 'Tissenboule',
			en: 'Tarountula',
			jp: 'タマンチュラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/917/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/917/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 35,
			atk: 41,
			def: 45,
			spe_atk: 29,
			spe_def: 40,
			vit: 20,
		},
		category: 'Pokémon Boule de Fil',
		generation: 9,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 918,
		name: {
			fr: 'Filentrappe',
			en: 'Spidops',
			jp: 'ワナイダー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/918/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/918/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 60,
			atk: 79,
			def: 92,
			spe_atk: 52,
			spe_def: 86,
			vit: 35,
		},
		category: 'Pokémon Piège',
		generation: 9,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 919,
		name: {
			fr: 'Lilliterelle',
			en: 'Nymble',
			jp: 'マメバッタ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/919/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/919/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 33,
			atk: 46,
			def: 40,
			spe_atk: 21,
			spe_def: 25,
			vit: 45,
		},
		category: 'Pokémon Sauterelle',
		generation: 9,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 920,
		name: {
			fr: 'Gambex',
			en: 'Lokix',
			jp: 'エクスレッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/920/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/920/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 71,
			atk: 102,
			def: 78,
			spe_atk: 52,
			spe_def: 55,
			vit: 92,
		},
		category: 'Pokémon Sauterelle',
		generation: 9,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 921,
		name: {
			fr: 'Pohm',
			en: 'Pawmi',
			jp: 'パモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/921/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/921/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 45,
			atk: 50,
			def: 20,
			spe_atk: 40,
			spe_def: 25,
			vit: 60,
		},
		category: 'Pokémon Souris',
		generation: 9,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 922,
		name: {
			fr: 'Pohmotte',
			en: 'Pawmo',
			jp: 'パモット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/922/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/922/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 60,
			atk: 75,
			def: 40,
			spe_atk: 50,
			spe_def: 40,
			vit: 85,
		},
		category: 'Pokémon Souris',
		generation: 9,
		catch_rate: 80,
		rareté: 1,
	},
	{
		pokedex_id: 923,
		name: {
			fr: 'Pohmarmotte',
			en: 'Pawmot',
			jp: 'パーモット',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/923/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/923/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 70,
			atk: 115,
			def: 70,
			spe_atk: 70,
			spe_def: 60,
			vit: 105,
		},
		category: 'Pokémon Pose Paume',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 924,
		name: {
			fr: 'Compagnol',
			en: 'Tandemaus',
			jp: 'ワッカネズミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/924/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/924/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 50,
			atk: 50,
			def: 45,
			spe_atk: 40,
			spe_def: 45,
			vit: 75,
		},
		category: 'Pokémon Couple',
		generation: 9,
		catch_rate: 150,
		rareté: 2,
	},
	{
		pokedex_id: 925,
		name: {
			fr: 'Famignol',
			en: 'Maushold',
			jp: 'イッカネズミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/925/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/925/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 74,
			atk: 75,
			def: 70,
			spe_atk: 65,
			spe_def: 75,
			vit: 111,
		},
		category: 'Pokémon Famille',
		generation: 9,
		catch_rate: 75,
		rareté: 1,
	},
	{
		pokedex_id: 926,
		name: {
			fr: 'Pâtachiot',
			en: 'Fidough',
			jp: 'パピモッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/926/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/926/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 37,
			atk: 55,
			def: 70,
			spe_atk: 30,
			spe_def: 55,
			vit: 65,
		},
		category: 'Pokémon Chiot',
		generation: 9,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 927,
		name: {
			fr: 'Briochien',
			en: 'Dachsbun',
			jp: 'バウッツェル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/927/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/927/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 57,
			atk: 80,
			def: 115,
			spe_atk: 50,
			spe_def: 80,
			vit: 95,
		},
		category: 'Pokémon Chien',
		generation: 9,
		catch_rate: 90,
		rareté: 2,
	},
	{
		pokedex_id: 928,
		name: {
			fr: 'Olivini',
			en: 'Smoliv',
			jp: 'ミニーブ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/928/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/928/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 41,
			atk: 35,
			def: 45,
			spe_atk: 58,
			spe_def: 51,
			vit: 30,
		},
		category: 'Pokémon Olive',
		generation: 9,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 929,
		name: {
			fr: 'Olivado',
			en: 'Dolliv',
			jp: 'オリーニョ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/929/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/929/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 52,
			atk: 53,
			def: 60,
			spe_atk: 78,
			spe_def: 78,
			vit: 33,
		},
		category: 'Pokémon Olive',
		generation: 9,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 930,
		name: {
			fr: 'Arboliva',
			en: 'Arboliva',
			jp: 'オリーヴァ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/930/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/930/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 78,
			atk: 69,
			def: 90,
			spe_atk: 125,
			spe_def: 109,
			vit: 39,
		},
		category: 'Pokémon Olive',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 931,
		name: {
			fr: 'Tapatoès',
			en: 'Squawkabilly',
			jp: 'イキリンコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/931/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/931/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 82,
			atk: 96,
			def: 51,
			spe_atk: 45,
			spe_def: 51,
			vit: 95,
		},
		category: 'Pokémon Perroquet',
		generation: 9,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 932,
		name: {
			fr: 'Selutin',
			en: 'Nacli',
			jp: 'コジオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/932/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/932/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 55,
			atk: 55,
			def: 75,
			spe_atk: 35,
			spe_def: 35,
			vit: 25,
		},
		category: 'Pokémon Halite',
		generation: 9,
		catch_rate: 255,
		rareté: 2,
	},
	{
		pokedex_id: 933,
		name: {
			fr: 'Amassel',
			en: 'Naclstack',
			jp: 'ジオヅム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/933/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/933/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 60,
			atk: 60,
			def: 100,
			spe_atk: 35,
			spe_def: 65,
			vit: 35,
		},
		category: 'Pokémon Halite',
		generation: 9,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 934,
		name: {
			fr: 'Gigansel',
			en: 'Garganacl',
			jp: 'キョジオーン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/934/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/934/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 100,
			atk: 100,
			def: 130,
			spe_atk: 45,
			spe_def: 90,
			vit: 35,
		},
		category: 'Pokémon Halite',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 935,
		name: {
			fr: 'Charbambin',
			en: 'Charcadet',
			jp: 'カルボウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/935/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/935/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 40,
			atk: 50,
			def: 40,
			spe_atk: 50,
			spe_def: 40,
			vit: 35,
		},
		category: 'Pokémon Enfant Feu',
		generation: 9,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 936,
		name: {
			fr: 'Carmadura',
			en: 'Armarouge',
			jp: 'グレンアルマ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/936/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/936/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 85,
			atk: 60,
			def: 100,
			spe_atk: 125,
			spe_def: 80,
			vit: 75,
		},
		category: 'Pokémon Feu Guerrier',
		generation: 9,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 937,
		name: {
			fr: 'Malvalame',
			en: 'Ceruledge',
			jp: 'ソウブレイズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/937/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/937/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 75,
			atk: 125,
			def: 80,
			spe_atk: 60,
			spe_def: 100,
			vit: 85,
		},
		category: 'Pokémon Feu Bretteur',
		generation: 9,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 938,
		name: {
			fr: 'Têtampoule',
			en: 'Tadbulb',
			jp: 'ズピカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/938/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/938/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 61,
			atk: 31,
			def: 41,
			spe_atk: 59,
			spe_def: 35,
			vit: 45,
		},
		category: 'Pokémon Électêtard',
		generation: 9,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 939,
		name: {
			fr: 'Ampibidou',
			en: 'Bellibolt',
			jp: 'ハラバリー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/939/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/939/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 109,
			atk: 64,
			def: 91,
			spe_atk: 103,
			spe_def: 83,
			vit: 45,
		},
		category: 'Pokémon Élecrapaud',
		generation: 9,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 940,
		name: {
			fr: 'Zapétrel',
			en: 'Wattrel',
			jp: 'カイデン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/940/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/940/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 35,
			spe_atk: 55,
			spe_def: 40,
			vit: 70,
		},
		category: 'Pokémon Océanite',
		generation: 9,
		catch_rate: 180,
		rareté: 1,
	},
	{
		pokedex_id: 941,
		name: {
			fr: 'Fulgulairo',
			en: 'Kilowattrel',
			jp: 'タイカイデン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/941/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/941/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 70,
			atk: 70,
			def: 60,
			spe_atk: 105,
			spe_def: 60,
			vit: 125,
		},
		category: 'Pokémon Frégate',
		generation: 9,
		catch_rate: 90,
		rareté: 1,
	},
	{
		pokedex_id: 942,
		name: {
			fr: 'Grondogue',
			en: 'Maschiff',
			jp: 'オラチフ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/942/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/942/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 60,
			atk: 78,
			def: 60,
			spe_atk: 40,
			spe_def: 51,
			vit: 51,
		},
		category: 'Pokémon Jeunot',
		generation: 9,
		catch_rate: 150,
		rareté: 1,
	},
	{
		pokedex_id: 943,
		name: {
			fr: 'Dogrino',
			en: 'Mabosstiff',
			jp: 'マフィティフ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/943/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/943/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 90,
			spe_atk: 60,
			spe_def: 70,
			vit: 85,
		},
		category: 'Pokémon Parrain',
		generation: 9,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 944,
		name: {
			fr: 'Gribouraigne',
			en: 'Shroodle',
			jp: 'シルシュルー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/944/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/944/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 40,
			atk: 65,
			def: 35,
			spe_atk: 40,
			spe_def: 35,
			vit: 75,
		},
		category: 'Pokémon Souris Venin',
		generation: 9,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 945,
		name: {
			fr: 'Tag-Tag',
			en: 'Grafaiai',
			jp: 'タギングル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/945/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/945/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 40,
			atk: 65,
			def: 35,
			spe_atk: 40,
			spe_def: 35,
			vit: 75,
		},
		category: 'Pokémon Singe Venin',
		generation: 9,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 946,
		name: {
			fr: 'Virovent',
			en: 'Bramblin',
			jp: 'アノクサ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/946/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/946/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 40,
			atk: 65,
			def: 30,
			spe_atk: 45,
			spe_def: 35,
			vit: 60,
		},
		category: 'Pokémon Virevoltant',
		generation: 9,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 947,
		name: {
			fr: 'Virevorreur',
			en: 'Brambleghast',
			jp: 'アノホラグサ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/947/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/947/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 55,
			atk: 115,
			def: 70,
			spe_atk: 80,
			spe_def: 70,
			vit: 90,
		},
		category: 'Pokémon Virevoltant',
		generation: 9,
		catch_rate: 45,
		rareté: 1,
	},
	{
		pokedex_id: 948,
		name: {
			fr: 'Terracool',
			en: 'Toedscool',
			jp: 'ノノクラゲ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/948/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/948/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 40,
			atk: 40,
			def: 35,
			spe_atk: 50,
			spe_def: 100,
			vit: 70,
		},
		category: 'Pokémon Champiméduse',
		generation: 9,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 949,
		name: {
			fr: 'Terracruel',
			en: 'Toedscruel',
			jp: 'リククラゲ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/949/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/949/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 80,
			atk: 70,
			def: 65,
			spe_atk: 80,
			spe_def: 120,
			vit: 100,
		},
		category: 'Pokémon Champiméduse',
		generation: 9,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 950,
		name: {
			fr: 'Craparoi',
			en: 'Klawf',
			jp: 'ガケガニ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/950/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/950/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
		],
		stats: {
			hp: 50,
			atk: 100,
			def: 115,
			spe_atk: 35,
			spe_def: 55,
			vit: 75,
		},
		category: 'Pokémon Embuscade',
		generation: 9,
		catch_rate: 120,
		rareté: 2,
	},
	{
		pokedex_id: 951,
		name: {
			fr: 'Pimito',
			en: 'Capsakid',
			jp: 'カプサイジ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/951/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/951/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 52,
			atk: 62,
			def: 40,
			spe_atk: 62,
			spe_def: 40,
			vit: 50,
		},
		category: 'Pokémon Habanero',
		generation: 9,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 952,
		name: {
			fr: 'Scovilain',
			en: 'Scovillain',
			jp: 'スコヴィラン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/952/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/952/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 65,
			atk: 108,
			def: 65,
			spe_atk: 108,
			spe_def: 65,
			vit: 75,
		},
		category: 'Pokémon Habanero',
		generation: 9,
		catch_rate: 75,
		rareté: 2,
	},
	{
		pokedex_id: 953,
		name: {
			fr: 'Léboulérou',
			en: 'Rellor',
			jp: 'シガロコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/953/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/953/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
		],
		stats: {
			hp: 41,
			atk: 50,
			def: 60,
			spe_atk: 31,
			spe_def: 58,
			vit: 30,
		},
		category: 'Pokémon Rouleur',
		generation: 9,
		catch_rate: 190,
		rareté: 2,
	},
	{
		pokedex_id: 954,
		name: {
			fr: 'Bérasca',
			en: 'Rabsca',
			jp: 'ベラカス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/954/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/954/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 75,
			atk: 50,
			def: 85,
			spe_atk: 115,
			spe_def: 100,
			vit: 45,
		},
		category: 'Pokémon Rouleur',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 955,
		name: {
			fr: 'Flotillon',
			en: 'Flittle',
			jp: 'ヒラヒナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/955/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/955/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 30,
			atk: 35,
			def: 30,
			spe_atk: 55,
			spe_def: 30,
			vit: 75,
		},
		category: 'Pokémon Froufrou',
		generation: 9,
		catch_rate: 120,
		rareté: 1,
	},
	{
		pokedex_id: 956,
		name: {
			fr: 'Cléopsytra',
			en: 'Espathra',
			jp: 'クエスパトラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/956/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/956/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 95,
			atk: 60,
			def: 60,
			spe_atk: 101,
			spe_def: 60,
			vit: 105,
		},
		category: 'Pokémon Autruche',
		generation: 9,
		catch_rate: 60,
		rareté: 3,
	},
	{
		pokedex_id: 957,
		name: {
			fr: 'Forgerette',
			en: 'Tinkatink',
			jp: 'カヌチャン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/957/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/957/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 50,
			atk: 45,
			def: 45,
			spe_atk: 35,
			spe_def: 64,
			vit: 58,
		},
		category: 'Pokémon Forge',
		generation: 9,
		catch_rate: 190,
		rareté: 1,
	},
	{
		pokedex_id: 958,
		name: {
			fr: 'Forgella',
			en: 'Tinkatuff',
			jp: 'ナカヌチャン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/958/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/958/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 65,
			atk: 55,
			def: 55,
			spe_atk: 45,
			spe_def: 82,
			vit: 78,
		},
		category: 'Pokémon Marteau',
		generation: 9,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 959,
		name: {
			fr: 'Forgelina',
			en: 'Tinkaton',
			jp: 'デカヌチャン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/959/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/959/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 85,
			atk: 75,
			def: 77,
			spe_atk: 70,
			spe_def: 105,
			vit: 94,
		},
		category: 'Pokémon Marteau',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 960,
		name: {
			fr: 'Taupikeau',
			en: 'Wiglett',
			jp: 'ウミディグダ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/960/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/960/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 10,
			atk: 55,
			def: 25,
			spe_atk: 35,
			spe_def: 25,
			vit: 95,
		},
		category: 'Pokémon Congre',
		generation: 9,
		catch_rate: 255,
		rareté: 3,
	},
	{
		pokedex_id: 961,
		name: {
			fr: 'Triopikeau',
			en: 'Wugtrio',
			jp: 'ウミトリオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/961/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/961/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 35,
			atk: 100,
			def: 50,
			spe_atk: 50,
			spe_def: 70,
			vit: 120,
		},
		category: 'Pokémon Congre',
		generation: 9,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 962,
		name: {
			fr: 'Lestombaile',
			en: 'Bombirdier',
			jp: 'オトシドリ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/962/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/962/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 70,
			atk: 103,
			def: 85,
			spe_atk: 60,
			spe_def: 85,
			vit: 82,
		},
		category: 'Pokémon Délesteur',
		generation: 9,
		catch_rate: 25,
		rareté: 1,
	},
	{
		pokedex_id: 963,
		name: {
			fr: 'Dofin',
			en: 'Finizen',
			jp: 'ナミイルカ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/963/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/963/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 70,
			atk: 45,
			def: 40,
			spe_atk: 45,
			spe_def: 40,
			vit: 75,
		},
		category: 'Pokémon Dauphin',
		generation: 9,
		catch_rate: 200,
		rareté: 1,
	},
	{
		pokedex_id: 964,
		name: {
			fr: 'Superdofin',
			en: 'Palafin',
			jp: 'イルカマン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/964/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/964/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 100,
			atk: 70,
			def: 72,
			spe_atk: 53,
			spe_def: 62,
			vit: 100,
		},
		category: 'Pokémon Dauphin',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 965,
		name: {
			fr: 'Vrombi',
			en: 'Varoom',
			jp: 'ブロロン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/965/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/965/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 45,
			atk: 70,
			def: 63,
			spe_atk: 30,
			spe_def: 45,
			vit: 47,
		},
		category: 'Pokémon Monocylindre',
		generation: 9,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 966,
		name: {
			fr: 'Vrombotor',
			en: 'Revavroom',
			jp: 'ブロロローム',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/966/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/966/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 119,
			def: 90,
			spe_atk: 54,
			spe_def: 67,
			vit: 90,
		},
		category: 'Pokémon Polycylindre',
		generation: 9,
		catch_rate: 75,
		rareté: 3,
	},
	{
		pokedex_id: 967,
		name: {
			fr: 'Motorizard',
			en: 'Cyclizar',
			jp: 'モトトカゲ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/967/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/967/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 70,
			atk: 95,
			def: 65,
			spe_atk: 85,
			spe_def: 65,
			vit: 121,
		},
		category: 'Pokémon Monture',
		generation: 9,
		catch_rate: 190,
		rareté: 3,
	},
	{
		pokedex_id: 968,
		name: {
			fr: 'Ferdeter',
			en: 'Orthworm',
			jp: 'ミミズズ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/968/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/968/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 70,
			atk: 85,
			def: 145,
			spe_atk: 60,
			spe_def: 55,
			vit: 65,
		},
		category: 'Pokémon Ver de Terre',
		generation: 9,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 969,
		name: {
			fr: 'Germéclat',
			en: 'Glimmet',
			jp: 'キラーメ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/969/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/969/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 48,
			atk: 35,
			def: 42,
			spe_atk: 105,
			spe_def: 60,
			vit: 60,
		},
		category: 'Pokémon Minerai',
		generation: 9,
		catch_rate: 70,
		rareté: 2,
	},
	{
		pokedex_id: 970,
		name: {
			fr: 'Floréclat',
			en: 'Glimmora',
			jp: 'キラフロル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/970/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/970/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 83,
			atk: 55,
			def: 90,
			spe_atk: 130,
			spe_def: 81,
			vit: 86,
		},
		category: 'Pokémon Minerai',
		generation: 9,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 971,
		name: {
			fr: 'Toutombe',
			en: 'Greavard',
			jp: 'ボチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/971/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/971/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 50,
			atk: 61,
			def: 60,
			spe_atk: 30,
			spe_def: 55,
			vit: 34,
		},
		category: 'Pokémon Fantôchien',
		generation: 9,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 972,
		name: {
			fr: 'Tomberro',
			en: 'Houndstone',
			jp: 'ハカドッグ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/972/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/972/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 72,
			atk: 101,
			def: 100,
			spe_atk: 50,
			spe_def: 97,
			vit: 68,
		},
		category: 'Pokémon Fantôchien',
		generation: 9,
		catch_rate: 60,
		rareté: 1,
	},
	{
		pokedex_id: 973,
		name: {
			fr: 'Flamenroule',
			en: 'Flamigo',
			jp: 'カラミンゴ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/973/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/973/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 82,
			atk: 115,
			def: 74,
			spe_atk: 75,
			spe_def: 64,
			vit: 90,
		},
		category: 'Pokémon Synchro',
		generation: 9,
		catch_rate: 100,
		rareté: 1,
	},
	{
		pokedex_id: 974,
		name: {
			fr: 'Piétacé',
			en: 'Cetoddle',
			jp: 'アルクジラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/974/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/974/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 108,
			atk: 68,
			def: 45,
			spe_atk: 30,
			spe_def: 40,
			vit: 43,
		},
		category: 'Pokémon Baleinapied',
		generation: 9,
		catch_rate: 150,
		rareté: 2,
	},
	{
		pokedex_id: 975,
		name: {
			fr: 'Balbalèze',
			en: 'Cetitan',
			jp: 'ハルクジラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/975/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/975/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 170,
			atk: 113,
			def: 65,
			spe_atk: 45,
			spe_def: 55,
			vit: 73,
		},
		category: 'Pokémon Baleinapied',
		generation: 9,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 976,
		name: {
			fr: 'Délestin',
			en: 'Veluza',
			jp: 'ミガルーサ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/976/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/976/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 102,
			def: 73,
			spe_atk: 78,
			spe_def: 65,
			vit: 70,
		},
		category: 'Pokémon Décharné',
		generation: 9,
		catch_rate: 100,
		rareté: 3,
	},
	{
		pokedex_id: 977,
		name: {
			fr: 'Oyacata',
			en: 'Dondozo',
			jp: 'ヘイラッシャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/977/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/977/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 150,
			atk: 100,
			def: 115,
			spe_atk: 65,
			spe_def: 65,
			vit: 35,
		},
		category: 'Pokémon Grand Silure',
		generation: 9,
		catch_rate: 25,
		rareté: 2,
	},
	{
		pokedex_id: 978,
		name: {
			fr: 'Nigirigon',
			en: 'Tatsugiri',
			jp: 'シャリタツ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/978/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/978/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 68,
			atk: 50,
			def: 60,
			spe_atk: 120,
			spe_def: 95,
			vit: 82,
		},
		category: 'Pokémon Mimétisme',
		generation: 9,
		catch_rate: 100,
		rareté: 2,
	},
	{
		pokedex_id: 979,
		name: {
			fr: 'Courrousinge',
			en: 'Annihilape',
			jp: 'コノヨザル',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/979/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/979/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 100,
			atk: 115,
			def: 80,
			spe_atk: 50,
			spe_def: 90,
			vit: 90,
		},
		category: 'Pokémon Singe Furax',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 980,
		name: {
			fr: 'Terraiste',
			en: 'Clodsire',
			jp: 'ドオー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/980/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/980/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 130,
			atk: 75,
			def: 60,
			spe_atk: 45,
			spe_def: 100,
			vit: 20,
		},
		category: 'Pokémon Poissépine',
		generation: 9,
		catch_rate: 90,
		rareté: 3,
	},
	{
		pokedex_id: 981,
		name: {
			fr: 'Farigiraf',
			en: 'Farigiraf',
			jp: 'リキキリン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/981/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/981/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 120,
			atk: 90,
			def: 70,
			spe_atk: 110,
			spe_def: 70,
			vit: 60,
		},
		category: 'Pokémon Long-Cou',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 982,
		name: {
			fr: 'Deusolourdo',
			en: 'Dudunsparce',
			jp: 'ノココッチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/982/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/982/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 125,
			atk: 100,
			def: 80,
			spe_atk: 85,
			spe_def: 75,
			vit: 55,
		},
		category: 'Pokémon Serpent',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 983,
		name: {
			fr: 'Scalpereur',
			en: 'Kingambit',
			jp: 'ドドゲザン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/983/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/983/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 100,
			atk: 135,
			def: 120,
			spe_atk: 60,
			spe_def: 85,
			vit: 50,
		},
		category: 'Pokémon Pourfendant',
		generation: 9,
		catch_rate: 25,
		rareté: 1,
	},
	{
		pokedex_id: 984,
		name: {
			fr: 'Fort-Ivoire',
			en: 'Great Tusk',
			jp: 'イダイナキバ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/984/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/984/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 115,
			atk: 131,
			def: 131,
			spe_atk: 53,
			spe_def: 53,
			vit: 87,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 985,
		name: {
			fr: 'Hurle-Queue',
			en: 'Scream Tail',
			jp: 'サケブシッポ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/985/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/985/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 115,
			atk: 65,
			def: 99,
			spe_atk: 65,
			spe_def: 115,
			vit: 111,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 50,
		rareté: 3,
	},
	{
		pokedex_id: 986,
		name: {
			fr: 'Fongus-Furie',
			en: 'Brute Bonnet',
			jp: 'アラブルタケ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/986/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/986/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 111,
			atk: 127,
			def: 99,
			spe_atk: 79,
			spe_def: 99,
			vit: 55,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 50,
		rareté: 1,
	},
	{
		pokedex_id: 987,
		name: {
			fr: 'Flotte-Mèche',
			en: 'Flutter Mane',
			jp: 'ハバタクカミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/987/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/987/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 55,
			atk: 55,
			def: 55,
			spe_atk: 135,
			spe_def: 135,
			vit: 135,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 988,
		name: {
			fr: 'Rampe-Ailes',
			en: 'Slither Wing',
			jp: 'チヲハウハネ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/988/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/988/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Insecte',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/insecte.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 85,
			atk: 135,
			def: 79,
			spe_atk: 85,
			spe_def: 105,
			vit: 81,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 989,
		name: {
			fr: 'Pelage-Sablé',
			en: 'Sandy Shocks',
			jp: 'スナノケガワ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/989/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/989/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 85,
			atk: 81,
			def: 97,
			spe_atk: 121,
			spe_def: 85,
			vit: 101,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 990,
		name: {
			fr: 'Roue-de-Fer',
			en: 'Iron Treads',
			jp: 'テツノワダチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/990/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/990/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
		],
		stats: {
			hp: 90,
			atk: 112,
			def: 120,
			spe_atk: 72,
			spe_def: 70,
			vit: 106,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 991,
		name: {
			fr: 'Hotte-de-Fer',
			en: 'Iron Bundle',
			jp: 'テツノツツミ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/991/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/991/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
		],
		stats: {
			hp: 56,
			atk: 80,
			def: 114,
			spe_atk: 124,
			spe_def: 60,
			vit: 136,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 50,
		rareté: 1,
	},
	{
		pokedex_id: 992,
		name: {
			fr: 'Paume-de-Fer',
			en: 'Iron Hands',
			jp: 'テツノカイナ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/992/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/992/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 154,
			atk: 140,
			def: 108,
			spe_atk: 50,
			spe_def: 68,
			vit: 50,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 50,
		rareté: 1,
	},
	{
		pokedex_id: 993,
		name: {
			fr: 'Têtes-de-Fer',
			en: 'Iron Jugulis',
			jp: 'テツノコウベ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/993/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/993/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Vol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/vol.png',
			},
		],
		stats: {
			hp: 94,
			atk: 80,
			def: 86,
			spe_atk: 122,
			spe_def: 80,
			vit: 108,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 1,
	},
	{
		pokedex_id: 994,
		name: {
			fr: 'Mite-de-Fer',
			en: 'Iron Moth',
			jp: 'テツノドクガ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/994/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/994/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
		],
		stats: {
			hp: 80,
			atk: 70,
			def: 60,
			spe_atk: 140,
			spe_def: 110,
			vit: 110,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 2,
	},
	{
		pokedex_id: 995,
		name: {
			fr: 'Épine-de-Fer',
			en: 'Iron Thorns',
			jp: 'テツノイバラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/995/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/995/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
		],
		stats: {
			hp: 100,
			atk: 134,
			def: 110,
			spe_atk: 70,
			spe_def: 84,
			vit: 72,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 30,
		rareté: 3,
	},
	{
		pokedex_id: 996,
		name: {
			fr: 'Frigodo',
			en: 'Frigibax',
			jp: 'Sebie',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/996/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/996/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 65,
			atk: 75,
			def: 45,
			spe_atk: 35,
			spe_def: 45,
			vit: 55,
		},
		category: 'Pokémon Glaçaileron',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 997,
		name: {
			fr: 'Cryodo',
			en: 'Arctibax',
			jp: 'Segōru',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/997/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/997/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 90,
			atk: 95,
			def: 66,
			spe_atk: 45,
			spe_def: 65,
			vit: 62,
		},
		category: 'Pokémon Glaçaileron',
		generation: 9,
		catch_rate: 25,
		rareté: 3,
	},
	{
		pokedex_id: 998,
		name: {
			fr: 'Glaivodo',
			en: 'Baxcalibur',
			jp: 'Seglaive',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/998/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/998/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 115,
			atk: 145,
			def: 92,
			spe_atk: 75,
			spe_def: 86,
			vit: 87,
		},
		category: 'Pokémon Dragon Glace',
		generation: 9,
		catch_rate: 10,
		rareté: 1,
	},
	{
		pokedex_id: 999,
		name: {
			fr: 'Mordudor',
			en: 'Gimmighoul',
			jp: 'コレクレー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/999/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/999/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 45,
			atk: 30,
			def: 70,
			spe_atk: 75,
			spe_def: 70,
			vit: 10,
		},
		category: 'Pokémon Coffrotrésor',
		generation: 9,
		catch_rate: 45,
		rareté: 3,
	},
	{
		pokedex_id: 1000,
		name: {
			fr: 'Gromago',
			en: 'Gholdengo',
			jp: 'サーフゴー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1000/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1000/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 87,
			atk: 60,
			def: 95,
			spe_atk: 133,
			spe_def: 91,
			vit: 84,
		},
		category: 'Pokémon Trésor Animé',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 1001,
		name: {
			fr: 'Chongjian',
			en: 'Wo-Chien',
			jp: 'チオンジェン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1001/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 85,
			atk: 85,
			def: 100,
			spe_atk: 95,
			spe_def: 135,
			vit: 70,
		},
		category: 'Pokémon Fléau',
		generation: 9,
		catch_rate: 6,
		rareté: 1,
	},
	{
		pokedex_id: 1002,
		name: {
			fr: 'Baojian',
			en: 'Chien-Pao',
			jp: 'パオジアン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1002/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Glace',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/glace.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 80,
			spe_atk: 90,
			spe_def: 65,
			vit: 135,
		},
		category: 'Pokémon Fléau',
		generation: 9,
		catch_rate: 6,
		rareté: 3,
	},
	{
		pokedex_id: 1003,
		name: {
			fr: 'Dinglu',
			en: 'Ting-Lu',
			jp: 'ディンルー',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1003/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Sol',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/sol.png',
			},
		],
		stats: {
			hp: 155,
			atk: 110,
			def: 125,
			spe_atk: 55,
			spe_def: 80,
			vit: 45,
		},
		category: 'Pokémon Fléau',
		generation: 9,
		catch_rate: 6,
		rareté: 2,
	},
	{
		pokedex_id: 1004,
		name: {
			fr: 'Yuyu',
			en: 'Chi-Yu',
			jp: 'イーユイ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1004/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
		],
		stats: {
			hp: 55,
			atk: 80,
			def: 80,
			spe_atk: 135,
			spe_def: 120,
			vit: 100,
		},
		category: 'Pokémon Fléau',
		generation: 9,
		catch_rate: 6,
		rareté: 2,
	},
	{
		pokedex_id: 1005,
		name: {
			fr: 'Rugit-Lune',
			en: 'Roaring Moon',
			jp: 'トドロクツキ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1005/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1005/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
			{
				name: 'Ténèbres',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/tenebres.png',
			},
		],
		stats: {
			hp: 105,
			atk: 139,
			def: 71,
			spe_atk: 55,
			spe_def: 101,
			vit: 119,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 10,
		rareté: 2,
	},
	{
		pokedex_id: 1006,
		name: {
			fr: 'Garde-de-Fer',
			en: 'Iron Valiant',
			jp: 'テツノブジン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1006/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1006/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 74,
			atk: 130,
			def: 90,
			spe_atk: 120,
			spe_def: 60,
			vit: 116,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 10,
		rareté: 2,
	},
	{
		pokedex_id: 1007,
		name: {
			fr: 'Koraidon',
			en: 'Koraidon',
			jp: 'コライドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1007/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 100,
			atk: 135,
			def: 115,
			spe_atk: 85,
			spe_def: 100,
			vit: 135,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 3,
		rareté: 1,
	},
	{
		pokedex_id: 1008,
		name: {
			fr: 'Miraidon',
			en: 'Miraidon',
			jp: 'ミライドン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1008/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 100,
			atk: 85,
			def: 100,
			spe_atk: 135,
			spe_def: 115,
			vit: 135,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 1009,
		name: {
			fr: 'Serpente-Eau',
			en: 'Walking Wake',
			jp: 'ウネルミナモ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1009/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Eau',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/eau.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 99,
			atk: 83,
			def: 91,
			spe_atk: 125,
			spe_def: 83,
			vit: 109,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 5,
		rareté: 3,
	},
	{
		pokedex_id: 1010,
		name: {
			fr: 'Vert-de-Fer',
			en: 'Iron Leaves',
			jp: 'テツノイサハ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1010/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 130,
			def: 88,
			spe_atk: 70,
			spe_def: 108,
			vit: 104,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 5,
		rareté: 2,
	},
	{
		pokedex_id: 1011,
		name: {
			fr: 'Pomdramour',
			en: 'Dipplin',
			jp: 'カミッチュ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1011/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1011/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 80,
			atk: 80,
			def: 110,
			spe_atk: 95,
			spe_def: 80,
			vit: 40,
		},
		category: 'Pokémon Sirop Pomme',
		generation: 9,
		catch_rate: 45,
		rareté: 2,
	},
	{
		pokedex_id: 1012,
		name: {
			fr: 'Poltchageist',
			en: 'Poltchageist',
			jp: 'チャデス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1012/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1012/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 40,
			atk: 45,
			def: 45,
			spe_atk: 74,
			spe_def: 54,
			vit: 50,
		},
		category: 'Pokémon Matcha',
		generation: 9,
		catch_rate: 120,
		rareté: 3,
	},
	{
		pokedex_id: 1013,
		name: {
			fr: 'Théffroyable',
			en: 'Sinistcha',
			jp: 'ヤバソチャ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1013/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1013/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 71,
			atk: 60,
			def: 106,
			spe_atk: 121,
			spe_def: 80,
			vit: 70,
		},
		category: 'Pokémon Matcha',
		generation: 9,
		catch_rate: 60,
		rareté: 2,
	},
	{
		pokedex_id: 1014,
		name: {
			fr: 'Félicanis',
			en: 'Okidogi',
			jp: 'イイネイヌ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1014/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Combat',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/combat.png',
			},
		],
		stats: {
			hp: 88,
			atk: 128,
			def: 115,
			spe_atk: 58,
			spe_def: 86,
			vit: 80,
		},
		category: 'Pokémon Serviteur',
		generation: 9,
		catch_rate: 3,
		rareté: 3,
	},
	{
		pokedex_id: 1015,
		name: {
			fr: 'Fortusimia',
			en: 'Munkidori',
			jp: 'マシマシラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1015/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 88,
			atk: 75,
			def: 66,
			spe_atk: 130,
			spe_def: 90,
			vit: 106,
		},
		category: 'Pokémon Serviteur',
		generation: 9,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 1016,
		name: {
			fr: 'Favianos',
			en: 'Fezandipiti',
			jp: 'キチキギス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1016/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Fée',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/fee.png',
			},
		],
		stats: {
			hp: 88,
			atk: 91,
			def: 82,
			spe_atk: 70,
			spe_def: 125,
			vit: 99,
		},
		category: 'Pokémon Serviteur',
		generation: 9,
		catch_rate: 3,
		rareté: 2,
	},
	{
		pokedex_id: 1017,
		name: {
			fr: 'Ogerpon',
			en: 'Ogerpon',
			jp: 'オーガポン',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1017/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
		],
		stats: {
			hp: 80,
			atk: 120,
			def: 84,
			spe_atk: 60,
			spe_def: 96,
			vit: 110,
		},
		category: 'Pokémon Masque',
		generation: 9,
		catch_rate: 5,
		rareté: 3,
	},
	{
		pokedex_id: 1018,
		name: {
			fr: 'Pondralugon',
			en: 'Archaludon',
			jp: 'ブリジュラス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1018/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1018/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 90,
			atk: 105,
			def: 130,
			spe_atk: 125,
			spe_def: 65,
			vit: 85,
		},
		category: 'Pokémon Alliage',
		generation: 9,
		catch_rate: 10,
		rareté: 2,
	},
	{
		pokedex_id: 1019,
		name: {
			fr: 'Pomdorochi',
			en: 'Hydrapple',
			jp: 'カミツオロチ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1019/regular.png',
			shiny: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1019/shiny.png',
			gmax: null,
		},
		types: [
			{
				name: 'Plante',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/plante.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 106,
			atk: 80,
			def: 110,
			spe_atk: 120,
			spe_def: 80,
			vit: 44,
		},
		category: 'Pokémon Hydre Pomme',
		generation: 9,
		catch_rate: 10,
		rareté: 1,
	},
	{
		pokedex_id: 1020,
		name: {
			fr: 'Feu-Perçant',
			en: 'Gouging Fire',
			jp: 'ウガツホムラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1020/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Feu',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/feu.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 105,
			atk: 115,
			def: 121,
			spe_atk: 65,
			spe_def: 93,
			vit: 91,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 10,
		rareté: 3,
	},
	{
		pokedex_id: 1021,
		name: {
			fr: 'Ire-Foudre',
			en: 'Raging Bolt',
			jp: 'タケルライコ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1021/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Électrik',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/electrik.png',
			},
			{
				name: 'Dragon',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/dragon.png',
			},
		],
		stats: {
			hp: 125,
			atk: 73,
			def: 91,
			spe_atk: 137,
			spe_def: 89,
			vit: 75,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 10,
		rareté: 1,
	},
	{
		pokedex_id: 1022,
		name: {
			fr: 'Roc-de-Fer',
			en: 'Iron Boulder',
			jp: 'テツノイワオ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1022/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Roche',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/roche.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 120,
			def: 80,
			spe_atk: 68,
			spe_def: 108,
			vit: 124,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 10,
		rareté: 1,
	},
	{
		pokedex_id: 1023,
		name: {
			fr: 'Chef-de-Fer',
			en: 'Iron Crown',
			jp: 'テツノカシラ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1023/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Acier',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/acier.png',
			},
			{
				name: 'Psy',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/psy.png',
			},
		],
		stats: {
			hp: 90,
			atk: 72,
			def: 100,
			spe_atk: 122,
			spe_def: 108,
			vit: 98,
		},
		category: 'Pokémon Paradoxe',
		generation: 9,
		catch_rate: 10,
		rareté: 1,
	},
	{
		pokedex_id: 1024,
		name: {
			fr: 'Terapagos',
			en: 'Terapagos',
			jp: 'テラパゴス',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1024/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Normal',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/normal.png',
			},
		],
		stats: {
			hp: 90,
			atk: 65,
			def: 85,
			spe_atk: 65,
			spe_def: 85,
			vit: 60,
		},
		category: 'Pokémon Téracristal',
		generation: 9,
		catch_rate: 255,
		rareté: 1,
	},
	{
		pokedex_id: 1025,
		name: {
			fr: 'Pêchaminus',
			en: 'Pecharunt',
			jp: 'モモワロウ',
		},
		sprites: {
			regular:
				'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1025/regular.png',
			shiny: null,
			gmax: null,
		},
		types: [
			{
				name: 'Poison',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/poison.png',
			},
			{
				name: 'Spectre',
				image: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/types/spectre.png',
			},
		],
		stats: {
			hp: 88,
			atk: 88,
			def: 160,
			spe_atk: 88,
			spe_def: 88,
			vit: 88,
		},
		category: 'Pokémon Emprise',
		generation: 9,
		catch_rate: 3,
		rareté: 2,
	},
];

