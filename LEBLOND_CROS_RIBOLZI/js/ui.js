// ========================================
// UI.JS - Interface utilisateur, animations, audio
// ========================================

/**
 * Gère le système audio (musique de fond et effets sonores)
 */
export class AudioManager {
  constructor() {
    this.sounds = {};
    this.bgm = null;
    this.bgmVolume = 0.3;
    this.sfxVolume = 0.6;
    this.muted = false;
    this.initialized = false;
  }
  
  /**
   * Initialise le système audio avec les sons fournis
   */
  async init(soundList) {
    if (this.initialized) return;
    
    for (const soundName of soundList) {
      try {
        const audio = new Audio(`sounds/${soundName}.mp3`);
        audio.volume = this.sfxVolume;
        this.sounds[soundName] = audio;
      } catch (error) {
        console.warn(`Impossible de charger le son: ${soundName}`, error);
      }
    }
    
    // Initialiser la musique de fond
    try {
      this.bgm = new Audio('sounds/pokemon_lofi.mp3');
      this.bgm.loop = true;
      this.bgm.volume = this.bgmVolume;
      
      // Démarrer la musique après une interaction utilisateur (requis par les navigateurs)
      document.addEventListener('click', () => this.startBGM(), { once: true });
    } catch (error) {
      console.warn('Impossible de charger la musique de fond:', error);
    }
    
    this.initialized = true;
  }
  
  /**
   * Démarre la musique de fond
   */
  startBGM() {
    if (this.bgm && !this.muted && this.bgm.paused) {
      this.bgm.play().catch(error => console.warn('Erreur lecture BGM:', error));
    }
  }
  
  /**
   * Active/désactive le mode muet
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.bgm) {
      this.bgm.volume = this.muted ? 0 : this.bgmVolume;
    }
    return this.muted;
  }
  
  /**
   * Joue un effet sonore
   */
  play(soundName) {
    if (!this.initialized || !this.sounds[soundName]) return;
    
    try {
      const sound = this.sounds[soundName].cloneNode();
      sound.volume = this.sfxVolume;
      sound.play().catch(error => console.warn('Erreur lecture son:', error));
    } catch (error) {
      console.warn('Erreur play:', error);
    }
  }
  
  /**
   * Ajuste le volume des effets sonores
   */
  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }
  
  /**
   * Ajuste le volume de la musique de fond
   */
  setBgmVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgm && !this.muted) {
      this.bgm.volume = this.bgmVolume;
    }
  }
}

/**
 * Gestion des onglets de navigation
 */
export function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-select');
  const tabsContainer = document.querySelector('.tabs-container');
  
  if (!tabsContainer) {
    console.error('❌ .tabs-container introuvable');
    return { switchToTab: () => {} };
  }
  
  let currentTabIndex = 0;
  
  function switchToTab(index) {
    // Mettre à jour l'état des boutons
    tabButtons.forEach((btn, i) => {
      if (i === index) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Animer le défilement horizontal
    tabsContainer.style.transform = `translateX(-${index * 100}vw)`;
    currentTabIndex = index;
  }
  
  // Ajouter les listeners
  tabButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      switchToTab(index);
    });
  });
  
  // Initialiser au premier onglet
  switchToTab(0);
  
  return { switchToTab };
}

/**
 * Affiche une notification de montée de niveau
 */
export function showLevelUpNotification(level, title) {
  const notification = document.createElement('div');
  notification.className = 'level-up-notification';
  
  const content = document.createElement('div');
  content.className = 'level-up-content';
  
  const heading = document.createElement('h2');
  heading.textContent = '🎉 NIVEAU SUPÉRIEUR ! 🎉';
  
  const paragraph = document.createElement('p');
  paragraph.textContent = 'Vous êtes maintenant niveau ';
  const strong = document.createElement('strong');
  strong.textContent = level;
  paragraph.appendChild(strong);
  
  content.appendChild(heading);
  content.appendChild(paragraph);
  
  // Ajouter le titre si c'est un palier important
  if (title) {
    paragraph.appendChild(document.createTextNode(' !'));
    const titleParagraph = document.createElement('p');
    titleParagraph.textContent = `⭐ ${title} ⭐`;
    titleParagraph.style.fontSize = '1.2rem';
    titleParagraph.style.marginTop = '0.5rem';
    titleParagraph.style.color = '#ffd700';
    content.appendChild(titleParagraph);
  } else {
    paragraph.appendChild(document.createTextNode(' !'));
  }
  
  notification.appendChild(content);
  document.body.appendChild(notification);
  
  // Animation d'apparition
  requestAnimationFrame(() => {
    notification.classList.add('show');
  });
  
  // Retrait automatique après 3 secondes
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Crée une animation de clic avec particule
 */
export function createClickAnimation(event, value) {
  const clickEffect = document.createElement('div');
  clickEffect.className = 'click-effect';
  clickEffect.textContent = `+${value}`;
  clickEffect.style.left = `${event.clientX}px`;
  clickEffect.style.top = `${event.clientY}px`;
  
  document.body.appendChild(clickEffect);
  
  // Retrait après animation
  setTimeout(() => clickEffect.remove(), 1000);
}

/**
 * Initialise le compteur de temps de jeu
 */
export function initializePlaytimeDisplay(gameState) {
  function formatPlaytime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  function updatePlaytimeDisplay() {
    const playtimeElement = document.getElementById('playtime');
    if (playtimeElement) {
      const currentPlaytime = gameState.totalPlaytime + (Date.now() - gameState.sessionStartTime);
      playtimeElement.textContent = formatPlaytime(currentPlaytime);
    }
  }
  
  // Mise à jour toutes les secondes
  const intervalId = setInterval(updatePlaytimeDisplay, 1000);
  updatePlaytimeDisplay(); // Affichage initial
  
  return intervalId;
}

/**
 * Initialise les contrôles de volume
 */
export function initializeVolumeControls(audioManager) {
  const bgmVolumeInput = document.getElementById('bgm-volume');
  const sfxVolumeInput = document.getElementById('sfx-volume');
  const bgmValueDisplay = document.getElementById('bgm-value');
  const sfxValueDisplay = document.getElementById('sfx-value');
  const toggleBtn = document.getElementById('toggle-audio');
  
  if (bgmVolumeInput) {
    bgmVolumeInput.addEventListener('input', (event) => {
      const volume = event.target.value / 100;
      audioManager.setBgmVolume(volume);
      if (bgmValueDisplay) {
        bgmValueDisplay.textContent = event.target.value;
      }
    });
  }
  
  if (sfxVolumeInput) {
    sfxVolumeInput.addEventListener('input', (event) => {
      const volume = event.target.value / 100;
      audioManager.setSfxVolume(volume);
      if (sfxValueDisplay) {
        sfxValueDisplay.textContent = event.target.value;
      }
    });
  }
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isMuted = audioManager.toggleMute();
      toggleBtn.textContent = isMuted ? '🔇' : '🔊';
      toggleBtn.classList.toggle('muted', isMuted);
    });
  }
}
