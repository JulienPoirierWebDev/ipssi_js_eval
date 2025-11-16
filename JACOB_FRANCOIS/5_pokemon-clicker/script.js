let points = document.querySelector('.points');
const ppsDisplay = document.querySelector('.pps');
const conteneurCartes = document.querySelector('.cartes');
const levelDisplay = document.querySelector('#level-display');

const soundClick = document.getElementById('sound-click');
const soundPurchase = document.getElementById('sound-purchase');
const soundSuccess = document.getElementById('sound-success');
const soundVictory = document.getElementById('sound-victory');
const soundDefeat = document.getElementById('sound-defeat');
const soundReveal = document.getElementById('sound-reveal');
const soundMusicBg = document.getElementById('sound-music-bg');

soundMusicBg.volume = 0.4;
let musicStarted = false;

let parsedPoints = parseFloat(points.innerHTML);
let ppc = 1;
let pps = 0;
let inventaireCartes = [];
let equipeEnnemieActuelle = [];
let equipePourCombat = [null, null, null];

let niveau = 1;
let experience = parsedPoints;
let bonusPokedex = 1;

const paliersNiveau = [
    {
        niveau: 1,
        titre: 'Jeune Dresseur de Bourg Palette',
        pointsRequis: 0
    },
    {
        niveau: 2,
        titre: 'Explorateur de Route 1',
        pointsRequis: 1000
    },
    {
        niveau: 3,
        titre: 'Attrapeur de Pokémon Sauvages',
        pointsRequis: 5000
    },
    {
        niveau: 4,
        titre: 'Éleveur de Ronflex',
        pointsRequis: 20000
    },
    {
        niveau: 5,
        titre: 'Topdresseur de Johto',
        pointsRequis: 50000
    },
    {
        niveau: 6,
        titre: 'Vainqueur de l’Arène de Vermilava',
        pointsRequis: 100000
    },
    {
        niveau: 7,
        titre: 'Dresseur du Badge Cascade (Ondine)',
        pointsRequis: 250000
    },
    {
        niveau: 8,
        titre: 'Dresseur du Badge Foudre (Major Bob)',
        pointsRequis: 500000
    },
    {
        niveau: 9,
        titre: 'Dresseur du Badge Âme (Agatha)',
        pointsRequis: 750000
    },
    {
        niveau: 10,
        titre: 'Champion d’Arène de Kanto',
        pointsRequis: 1000000
    },
    {
        niveau: 11,
        titre: 'Maître des Badges de Sinnoh',
        pointsRequis: 2500000
    },
    {
        niveau: 12,
        titre: 'Conquérant de la Tour de Combat',
        pointsRequis: 5000000
    },
    {
        niveau: 13,
        titre: 'Rival de Blue',
        pointsRequis: 7500000
    },
    {
        niveau: 14,
        titre: 'Vainqueur du Tournoi de Kalos',
        pointsRequis: 10000000
    },
    {
        niveau: 15,
        titre: 'Membre du Conseil 4 (Lance)',
        pointsRequis: 15000000
    },
    {
        niveau: 16,
        titre: 'Membre du Conseil 4 (Cynthia)',
        pointsRequis: 30000000
    },
    {
        niveau: 17,
        titre: 'Membre du Conseil 4 (Aleria)',
        pointsRequis: 50000000
    },
    {
        niveau: 18,
        titre: 'Membre du Conseil 4 (Tarak)',
        pointsRequis: 75000000
    },
    {
        niveau: 19,
        titre: 'Aspirant Maître de la Ligue',
        pointsRequis: 85000000
    },
    {
        niveau: 20,
        titre: 'Maître de la Ligue Pokémon',
        pointsRequis: 100000000
    },
    {
        niveau: 21,
        titre: 'Grand Maître de la Ligue',
        pointsRequis: 175000000
    },
    {
        niveau: 22,
        titre: 'Héros de Galar',
        pointsRequis: 250000000
    },
    {
        niveau: 23,
        titre: 'Icône Mondiale Pokémon',
        pointsRequis: 325000000
    },
    {
        niveau: 24,
        titre: 'Mythe Vivant Pokémon',
        pointsRequis: 400000000
    },
    {
        niveau: 25,
        titre: 'Maître Pokémon Universel',
        pointsRequis: 500000000
    }
];

const tousLesSucces = {
    clic1: { 
        name: 'Dresseur débutant',
        description: 'Faire 100 clics',
        condition: { type: 'clics', valeur: 100 },
        debloque: false 
    },
    clic2: {
        name: 'Dresseur confirmé',
        description: 'Faire 1 000 clics',
        condition: { type: 'clics', valeur: 1000 },
        debloque: false },
    clic3: {
        name: 'Maître du clic',
        description: 'Faire 10 000 clics',
        condition: { type: 'clics', valeur: 10000 },
        debloque: false 
    },
    points1: {
        name: 'Riche !',
        description: 'Gagner 10 000 points',
        condition: { type: 'points', valeur: 10000 },
        debloque: false
    },
    points2: {
        name: 'Millionnaire',
        description: 'Gagner 1 000 000 points',
        condition: { type: 'points', valeur: 1000000 },
        debloque: false
    },
    amelioration1: {
        name: 'Ingénieux',
        description: 'Acheter 5 améliorations',
        condition: { type: 'ameliorations', valeur: 5 },
        debloque: false
    },
    amelioration2: {
        name: 'Stratège',
        description: 'Acheter 15 améliorations',
        condition: { type: 'ameliorations', valeur: 15 },
        debloque: false 
    },
    collection1: {
        name: 'Collectionneur',
        description: 'Obtenir 10 cartes',
        condition: { type: 'cartes', valeur: 10 },
        debloque: false
    },
    collection2: {
        name: 'Maître du Pokédex',
        description: 'Obtenir toutes les cartes communes (Rareté 1)',
        condition: { type: 'communes' },
        debloque: false
    },
    collection3: {
        name: 'Légendaire !',
        description: 'Obtenir 1 carte Légendaire (Rareté 4+)',
        condition: { type: 'legendaire' },
        debloque: false
    },
    combat1: {
        name: 'Premier Duel',
        description: 'Gagner 1 combat',
        condition: { type: 'combat', valeur: 1 },
        debloque: false
    },
    combat2: {
        name: 'Champion',
        description: 'Gagner 10 combats',
        condition: { type: 'combat', valeur: 10 },
        debloque: false
    },
    temps1: {
        name: 'Persévérant',
        description: 'Jouer pendant 30 minutes',
        condition: { type: 'temps', valeur: 1800 },
        debloque: false
    },
    temps2: {
        name: 'Insomniaque',
        description: 'Jouer pendant 2 heures',
        condition: { type: 'temps', valeur: 7200 },
        debloque: false
    },
};

let statistiquesSucces = {
    totalClics: 0,
    totalAmeliorationsAchetees: 0,
    totalCartesObtenues: 0,
    tempsDeJeu: 0,
    totalCombatsGagnes: 0
};

let toutesLesAmeliorations = [
  {
    id: 'doigt_acier',
    name: 'Doigt d’acier',
    description: 'Ajoute +0.1 point par clic.',
    cost: 25,
    effect: 0.1,
    owned: 0,
    type: 'click-bonus',
    frequency: null
  },
  {
    id: 'foudre_pikachu_clic',
    name: 'Foudre de Pikachu',
    description: 'Ajoute +0.5 point par clic.',
    cost: 150,
    effect: 0.5,
    owned: 0,
    type: 'click-bonus',
    frequency: null,
    conditionDeblocage: { idRequis: 'doigt_acier', niveauRequis: 3 }
  },
  {
    id: 'feu_dracaufeu_clic',
    name: 'Feu de Dracaufeu',
    description: '+2 points par clic.',
    cost: 1000,
    effect: 2,
    owned: 0,
    type: 'click-bonus',
    frequency: null,
    conditionDeblocage: { idRequis: 'foudre_pikachu_clic', niveauRequis: 2 }
  },
  {
    id: 'clic_critique',
    name: 'Coup Critique',
    description: 'Multiplie tous les points de clic par 1.2 (+20%).',
    cost: 5000,
    effect: 1.2,
    owned: 0,
    type: 'click-multiplier',
    frequency: null,
    conditionDeblocage: { idRequis: 'feu_dracaufeu_clic', niveauRequis: 2 }
  },
  {
    id: 'equipe_auto',
    name: 'Équipe automatique',
    description: 'Ajoute 0.1 point par seconde.',
    cost: 40,
    effect: 0.1,
    owned: 0,
    type: 'auto-click',
    frequency: 1000
  },
  {
    id: 'robot_dresseur',
    name: 'Robot Dresseur',
    description: 'Ajoute 0.5 point par seconde.',
    cost: 250,
    effect: 0.5,
    owned: 0,
    type: 'auto-click',
    frequency: 1000,
    conditionDeblocage: { idRequis: 'equipe_auto', niveauRequis: 3 }
  },
  {
    id: 'pokecentre_industriel',
    name: 'PokéCentre Industriel',
    description: 'Ajoute 2 points par seconde.',
    cost: 1500,
    effect: 2,
    owned: 0,
    type: 'auto-click',
    frequency: 1000,
    conditionDeblocage: { idRequis: 'robot_dresseur', niveauRequis: 2 }
  },
    {
    id: 'usine_a_pokeballs',
    name: 'Usine à Pokéballs',
    description: 'Multiplie tous les points par seconde par 1.2 (+20%).',
    cost: 7500,
    effect: 1.2,
    owned: 0,
    type: 'multiplier-auto',
    frequency: null,
    conditionDeblocage: { idRequis: 'pokecentre_industriel', niveauRequis: 2 }
  },
  {
    id: 'pichu',
    name: 'Pichu Agité',
    description: 'Évolution (Clic) : +0.2 point par clic.',
    cost: 100,
    effect: 0.2,
    owned: 0,
    type: 'click-bonus',
    frequency: null,
    conditionDeblocage: { idRequis: 'doigt_acier', niveauRequis: 2 },
    estEvolution: true
  },
  {
    id: 'pikachu',
    name: 'Pikachu Électrique',
    description: 'Évolution (Clic) : +1 point par clic.',
    cost: 600,
    effect: 1,
    owned: 0,
    type: 'click-bonus',
    frequency: null,
    conditionDeblocage: { idRequis: 'pichu', niveauRequis: 5 },
    estEvolution: true
  },
  {
    id: 'raichu',
    name: 'Raichu Foudroyant',
    description: 'Évolution (Clic) : Multiplie les points de clic par 1.1 (+10%).',
    cost: 4000,
    effect: 1.1,
    owned: 0,
    type: 'click-multiplier',
    frequency: null,
    conditionDeblocage: { idRequis: 'pikachu', niveauRequis: 10 },
    estEvolution: true
  },
  {
    id: 'salameche',
    name: 'Salamèche Fringant',
    description: 'Évolution (Clic) : +0.3 point par clic.',
    cost: 150,
    effect: 0.3,
    owned: 0,
    type: 'click-bonus',
    frequency: null,
    conditionDeblocage: { idRequis: 'doigt_acier', niveauRequis: 3 },
    estEvolution: true
  },
  {
    id: 'reptincel',
    name: 'Reptincel Ardent',
    description: 'Évolution (Clic) : +1.5 point par clic.',
    cost: 900,
    effect: 1.5,
    owned: 0,
    type: 'click-bonus',
    frequency: null,
    conditionDeblocage: { idRequis: 'salameche', niveauRequis: 5 },
    estEvolution: true
  },
  {
    id: 'dracaufeu_evo',
    name: 'Dracaufeu Enflammé',
    description: 'Évolution (Clic) : Multiplie les points de clic par 1.2 (+20%).',
    cost: 8000,
    effect: 1.2,
    owned: 0,
    type: 'click-multiplier',
    frequency: null,
    conditionDeblocage: { idRequis: 'reptincel', niveauRequis: 10 },
    estEvolution: true
  },
  {
    id: 'bulbizarre',
    name: 'Bulbizarre Paisible',
    description: 'Évolution (PPS) : +0.1 point par seconde.',
    cost: 80,
    effect: 0.1,
    owned: 0,
    type: 'auto-click',
    frequency: 1000,
    conditionDeblocage: { idRequis: 'equipe_auto', niveauRequis: 2 },
    estEvolution: true
  },
  {
    id: 'herbizarre',
    name: 'Herbizarre Tenace',
    description: 'Évolution (PPS) : +1 point par seconde.',
    cost: 700,
    effect: 1,
    owned: 0,
    type: 'auto-click',
    frequency: 1000,
    conditionDeblocage: { idRequis: 'bulbizarre', niveauRequis: 5 },
    estEvolution: true
  },
  {
    id: 'florizarre',
    name: 'Florizarre Solaire',
    description: 'Évolution (PPS) : Multiplie les points par seconde par 1.2 (+20%).',
    cost: 6000,
    effect: 1.2,
    owned: 0,
    type: 'multiplier-auto',
    frequency: null,
    conditionDeblocage: { idRequis: 'herbizarre', niveauRequis: 10 },
    estEvolution: true
  },
  {
    id: 'carapuce',
    name: 'Carapuce Calme',
    description: 'Évolution (PPS) : +0.2 point par seconde.',
    cost: 200,
    effect: 0.2,
    owned: 0,
    type: 'auto-click',
    frequency: 1000,
    conditionDeblocage: { idRequis: 'equipe_auto', niveauRequis: 3 },
    estEvolution: true
  },
  {
    id: 'carabaffe',
    name: 'Carabaffe Turbulent',
    description: 'Évolution (PPS) : +2 points par seconde.',
    cost: 1200,
    effect: 2,
    owned: 0,
    type: 'auto-click',
    frequency: 1000,
    conditionDeblocage: { idRequis: 'carapuce', niveauRequis: 5 },
    estEvolution: true
  },
  {
    id: 'tortank',
    name: 'Tortank Canon',
    description: 'Évolution (PPS) : Multiplie les points par seconde par 1.4 (+40%).',
    cost: 10000,
    effect: 1.4,
    owned: 0,
    type: 'multiplier-auto',
    frequency: null,
    conditionDeblocage: { idRequis: 'carabaffe', niveauRequis: 10 },
    estEvolution: true
  },
  {
    id: 'pack_reduction',
    name: 'Négociation',
    description: 'Réduit le coût des packs de 5%. (Cumulable)',
    cost: 3000,
    effect: 0.95,
    owned: 0,
    type: 'pack-cost-reducer',
    frequency: null
  },
  {
    id: 'booster_intermediaire',
    name: 'Booster Intermédiaire',
    description: 'Augmente les chances d\'obtenir des cartes rares de 5%.',
    cost: 5000,
    effect: 1.05,
    owned: 0,
    type: 'pack-luck',
    frequency: null,
    conditionDeblocage: { idRequis: 'pack_reduction', niveauRequis: 1 }
  },
  {
    id: 'booster_expert',
    name: 'Booster Expert',
    description: 'Augmente les chances d\'obtenir des cartes rares de 10%.',
    cost: 15000,
    effect: 1.10,
    owned: 0,
    type: 'pack-luck',
    frequency: null,
    conditionDeblocage: { idRequis: 'booster_intermediaire', niveauRequis: 1 }
  },
  {
    id: 'badge_foudre',
    name: 'Badge Foudre ⚡',
    description: 'Récompense de combat. Multiplie les PPS par 1.1 (+10%).',
    cost: 10000,
    effect: 1.1,
    owned: 0,
    type: 'multiplier-auto',
    debloque: false
  },
  {
    id: 'badge_volcan',
    name: 'Badge Volcan 🔥',
    description: 'Récompense de combat. Multiplie les clics par 1.15 (+15%).',
    cost: 10000,
    effect: 1.15,
    owned: 0,
    type: 'click-multiplier',
    debloque: false
  },
  {
    id: 'badge_marais',
    name: 'Badge Marais ☠️',
    description: 'Récompense de combat. Augmente la chance d\'obtenir des cartes rares de 5%.',
    cost: 10000,
    effect: 1.05,
    owned: 0,
    type: 'pack-luck',
    debloque: false
  },
  {
    id: 'badge_cascade',
    name: 'Badge Cascade 💧',
    description: 'Récompense de combat. Réduit le coût des packs de 10%.',
    cost: 10000,
    effect: 0.90,
    owned: 0,
    type: 'pack-cost-reducer',
    debloque: false
  },
  {
    id: 'badge_ame',
    name: 'Badge Âme 👻',
    description: 'Récompense de combat. Multiplie TOUS les gains (clics et pps) par 1.05 (+5%).',
    cost: 10000,
    effect: 1.05,
    owned: 0,
    type: 'global-multiplier',
    debloque: false
  }
];

let PACK_COUT_BASE = 1000;
let CARTES_PAR_PACK_BASE = 3; 

const navAmeliorations = document.querySelector('#ameliorations-nav-buttons');
const navPacks = document.querySelector('#packs-de-cartes-nav-buttons');
const navSucces = document.querySelector('#succes-nav-buttons');
const navCombat = document.querySelector('#combat-nav-buttons');
const packContainer = document.querySelector('#upgrade-container'); 
const conteneurAmeliorations = document.createElement('div');
conteneurAmeliorations.classList.add('ameliorations'); 

let vueActive = ''; 

function updatePointsDisplay() {
    points.textContent = parsedPoints.toFixed(1); 
}

function afficherAnimationClic(pointsGagnes, x, y) {
    const text = document.createElement('div');
    text.classList.add('floating-text');
    text.textContent = `+${pointsGagnes.toFixed(1)} ⚡`; 
    text.style.left = `${x}px`;
    text.style.top = `${y}px`;

    document.body.appendChild(text);

    setTimeout(() => {
        text.remove();
    }, 1000);
}

function incrementation(event) {
    if (!musicStarted) {
        soundMusicBg.play();
        musicStarted = true;
    }

    let pointsGagnes = ppc;
    parsedPoints += pointsGagnes;
    experience += pointsGagnes;

    statistiquesSucces.totalClics++;
    verifierSucces();
    
    updatePointsDisplay();
    afficherAnimationClic(pointsGagnes, event.pageX, event.pageY); 
    
    const newSound = soundClick.cloneNode();
    newSound.play();
    
    if (vueActive === 'ameliorations') {
        mettreAJourEtatBoutons(); 
    }
}

function debloquerOngletPack() {
    if (navPacks) {
        navPacks.classList.remove('hidden-tab');
    }
}

function acheterAmeliorations(idAmeliorations) {
    const amelioration = toutesLesAmeliorations.find(aml => aml.id === idAmeliorations);
    if (!amelioration) return; 

    let coutActuel = Math.ceil(amelioration.cost * Math.pow(1.15, amelioration.owned));

    if (parsedPoints >= coutActuel) {
        parsedPoints -= coutActuel;
        amelioration.owned++;
        
        if (soundPurchase) {
            soundPurchase.currentTime = 0;
            soundPurchase.play();
        }
        
        if (amelioration.type === 'deblocage-pack') {
            debloquerOngletPack();
        }

        statistiquesSucces.totalAmeliorationsAchetees++;
        verifierSucces();

        majPPC();
        majPPS();
        updatePointsDisplay();
        
        afficherAmeliorations(); 
    
    } else {
        console.warn("Achat échoué : Pas assez de points !");
    }
}

function mettreAJourEtatBoutons() {
    const boutons = conteneurAmeliorations.querySelectorAll('.bouton-amelioration');
    boutons.forEach(bouton => {
        const id = bouton.dataset.id;
        const amelioration = toutesLesAmeliorations.find(aml => aml.id === id);
        
        if (amelioration) {
            let coutActuel = Math.ceil(amelioration.cost * Math.pow(1.15, amelioration.owned));
            bouton.disabled = parsedPoints < coutActuel;
            bouton.querySelector('.cost').textContent = `Coût : ${coutActuel}`;
            bouton.querySelector('strong').textContent = `${amelioration.name} (Niv. ${amelioration.owned})`;
        }
    });
}

function afficherAmeliorations() {
    while (conteneurAmeliorations.firstChild) {
        conteneurAmeliorations.removeChild(conteneurAmeliorations.firstChild);
    } 

    const estDébloqué = (aml) => {
        if (typeof aml.debloque === 'boolean') {
            return aml.debloque;
        }

        if (aml.conditionDeblocage) {
            const idRequis = aml.conditionDeblocage.idRequis;
            const niveauRequis = aml.conditionDeblocage.niveauRequis || 0;
            const ameliorationRequise = toutesLesAmeliorations.find(a => a.id === idRequis);
            
            const reqAmlRemplie = ameliorationRequise && ameliorationRequise.owned >= (niveauRequis || 1);
            return reqAmlRemplie;
        }
        
        return true;
    };

    let ameliorationsDebloquees = toutesLesAmeliorations.filter(estDébloqué);
    
    const idsDesEvolutionsDebloquees = ameliorationsDebloquees
        .filter(aml => aml.conditionDeblocage) 
        .map(aml => aml.conditionDeblocage.idRequis);

    let ameliorationsFinales = ameliorationsDebloquees.filter(aml => {
        const estUnPrerequis = idsDesEvolutionsDebloquees.includes(aml.id);
        const estUneEvolution = aml.estEvolution === true;

        if (estUnPrerequis && estUneEvolution) {
            return false;
        }

        return true;
    });

    ameliorationsFinales.forEach(amelioration => {
        let coutActuel = Math.ceil(amelioration.cost * Math.pow(1.15, amelioration.owned));

        const bouton = document.createElement('button');
        const strong = document.createElement('strong');
        const small = document.createElement('small');
        const costSpan = document.createElement('span');

        bouton.classList.add('bouton-amelioration');
        bouton.dataset.id = amelioration.id; 
        costSpan.classList.add('cost');
        
        strong.textContent = `${amelioration.name} (Niv. ${amelioration.owned})`;
        small.textContent = amelioration.description;
        costSpan.textContent = `Coût : ${coutActuel}`;

        bouton.appendChild(strong);
        bouton.appendChild(small);
        bouton.appendChild(costSpan);

        bouton.disabled = parsedPoints < coutActuel;
        bouton.addEventListener('click', () => acheterAmeliorations(amelioration.id));
        conteneurAmeliorations.appendChild(bouton); 
    });
}

function majPPC() {
    let baseClic = 1;
    let bonusClic = 0;
    let multiplicateurClic = 1;
    let multiplicateurGlobal = bonusPokedex;

    toutesLesAmeliorations.forEach(aml => {
        if (aml.owned > 0) {
            if (aml.type === 'click-bonus') {
                bonusClic += (aml.effect * aml.owned);
            }
            if (aml.type === 'click-multiplier'){
                multiplicateurClic *= Math.pow(aml.effect, aml.owned);
            }
            if (aml.type === 'global-multiplier') { 
                multiplicateurGlobal *= Math.pow(aml.effect, aml.owned);
            }
        }
    });
    ppc = (baseClic + bonusClic) * multiplicateurClic * multiplicateurGlobal;
}

function majPPS() {
    let totalPPS = 0;
    let multiplicateurPPS = 1;
    let multiplicateurGlobal = bonusPokedex;

    toutesLesAmeliorations.forEach(aml => {
        if (aml.owned > 0) {
            if (aml.type === 'auto-click') {
                totalPPS += (aml.effect / (aml.frequency / 1000)) * aml.owned;
            }
            if (aml.type === 'multiplier-auto') {
                multiplicateurPPS *= Math.pow(aml.effect, aml.owned);
            }
            if (aml.type === 'global-multiplier') { 
                multiplicateurGlobal *= Math.pow(aml.effect, aml.owned);
            }
        }
    });
    pps = totalPPS * multiplicateurPPS * multiplicateurGlobal;
    ppsDisplay.textContent = pps.toFixed(1);
}

function majBonusPokedex() {
    const pokemonsUniques = inventaireCartes.length;
    bonusPokedex = 1 + (pokemonsUniques * 0.01);
    
    majPPC();
    majPPS();
}

function basculerVue(nouvelleVue) {
    if (vueActive === nouvelleVue) return;

    navAmeliorations.classList.remove('active');
    navPacks.classList.remove('active');
    navSucces.classList.remove('active');
    navCombat.classList.remove('active');
    
    while (packContainer.firstChild) {
        packContainer.removeChild(packContainer.firstChild);
    }

    const createTitle = (text) => {
        const h2 = document.createElement('h2');
        h2.textContent = text;
        return h2;
    };

    if (nouvelleVue === 'ameliorations') {
        navAmeliorations.classList.add('active');
        packContainer.appendChild(createTitle('Améliorations'));
        packContainer.appendChild(conteneurAmeliorations);
        afficherAmeliorations(); 
    } else if (nouvelleVue === 'packs') {
        navPacks.classList.add('active');
        packContainer.appendChild(createTitle('Acheter des Packs'));
        afficherAchatPacks(); 
    } else if (nouvelleVue === 'succes') {
        navSucces.classList.add('active');
        packContainer.appendChild(createTitle('Succès'));
        afficherSucces();
    } else if (nouvelleVue === 'combat') {
        navCombat.classList.add('active');
        packContainer.appendChild(createTitle('Combat Pokémon'));
        afficherInterfaceCombat();
    }

    vueActive = nouvelleVue;
}

function getPackCost() {
    let coutActuel = PACK_COUT_BASE;
    toutesLesAmeliorations.forEach(aml => {
        if (aml.owned > 0 && aml.type === 'pack-cost-reducer') {
            coutActuel *= Math.pow(aml.effect, aml.owned);
        }
    });
    return Math.floor(coutActuel);
}

function getCartesParPack() {
    let cartes = CARTES_PAR_PACK_BASE;
    toutesLesAmeliorations.forEach(aml => {
        if (aml.owned > 0 && aml.type === 'pack-bonus-card') { 
            for(let i = 0; i < aml.owned; i++) {
                if (Math.random() < aml.effect) {
                    cartes++;
                }
            }
        }
    });
    return cartes;
}

function mettreAJourEtatBoutonPack() {
    const buyButton = document.querySelector('#buy-pack-button');
    if (buyButton) {
        buyButton.disabled = parsedPoints < getPackCost();
        buyButton.style.backgroundColor = buyButton.disabled ? '#555' : 'var(--pk-red)';
    }
}

function afficherAchatPacks() {
    const packInterface = document.createElement('div');
    packInterface.classList.add('pack-interface');
    packInterface.style.cssText = "text-align: center; padding: 20px;"; 
    
    const coutActuel = getPackCost();
    const cartesActuelles = getCartesParPack();

    const p1 = document.createElement('p');
    p1.innerHTML = `Ouvrez ce pack pour obtenir <strong>${cartesActuelles} cartes aléatoires</strong>.`;

    const p2 = document.createElement('p');
    p2.innerHTML = `Coût : <strong>${coutActuel} points</strong>`;

    const buyButton = document.createElement('button');
    buyButton.id = 'buy-pack-button';
    buyButton.classList.add('buy-button');
    buyButton.textContent = 'Acheter et Ouvrir';

    const resultatDiv = document.createElement('div');
    resultatDiv.id = 'resultat-pack';
    resultatDiv.style.cssText = "margin-top: 20px; min-height: 50px;"; 

    packInterface.appendChild(p1);
    packInterface.appendChild(p2);
    packInterface.appendChild(buyButton);
    packInterface.appendChild(resultatDiv);
    packContainer.appendChild(packInterface);

    buyButton.addEventListener('click', acheterEtOuvrirPack);
    mettreAJourEtatBoutonPack();
}

function tirerCarteAleatoire() {
    let listePonderee = [];
    let chanceRareBonus = 1;
    
    toutesLesAmeliorations.forEach(aml => {
        if (aml.owned > 0 && aml.type === 'pack-luck') {
            chanceRareBonus *= Math.pow(aml.effect, aml.owned);
        }
    });
    
    const maxRarity = Math.max(...pokemons.map(p => p.rareté));

    pokemons.forEach(pokemon => {
        let weight = maxRarity - pokemon.rareté + 1;
        if (pokemon.rareté > 1) { 
            weight *= chanceRareBonus;
        }
        for (let i = 0; i < Math.round(weight); i++) {
            listePonderee.push(pokemon.pokedex_id);
        }
    });

    const randomIndex = Math.floor(Math.random() * listePonderee.length);
    const pokedexId = listePonderee[randomIndex];
    return pokemons.find(p => p.pokedex_id === pokedexId);
}

function acheterEtOuvrirPack() {
    const resultatDiv = document.querySelector('#resultat-pack');
    const coutActuel = getPackCost();
    
    if (soundPurchase) {
        soundPurchase.currentTime = 0;
        soundPurchase.play();
    }

    if (parsedPoints < coutActuel) {
        resultatDiv.textContent = 'Points insuffisants pour acheter ce pack !';
        resultatDiv.style.color = '#FF0000';
        return;
    }

    parsedPoints -= coutActuel;
    updatePointsDisplay(); 
    resultatDiv.style.color = '';
    
    const namebreCartes = getCartesParPack();
    let cartesObtenues = [];

    for (let i = 0; i < namebreCartes; i++) {
        const nouvelleCarte = tirerCarteAleatoire();
        cartesObtenues.push(nouvelleCarte);
        ajouterCarte(nouvelleCarte.pokedex_id);
    }

    afficherResultatsPackAnonyme(cartesObtenues); 
    mettreAJourEtatBoutonPack();
}

function afficherResultatsPackAnonyme(cartesObtenues) {
    const resultatDiv = document.querySelector('#resultat-pack');
    const boutonAchat = document.querySelector('#buy-pack-button');
    
    if (boutonAchat) boutonAchat.style.display = 'none';
    
    while (resultatDiv.firstChild) {
        resultatDiv.removeChild(resultatDiv.firstChild);
    }

    const h4 = document.createElement('h4');
    h4.textContent = 'Cliquez sur les cartes pour les révéler !';
    resultatDiv.appendChild(h4);

    const cardsContainer = document.createElement('div');
    cardsContainer.classList.add('pack-animation-container');
    
    let cartesRevelees = 0;

    cartesObtenues.forEach(pokemon => {
        const carteAnim = document.createElement('div');
        carteAnim.classList.add('pack-carte-animee');
        
        const faceDos = document.createElement('div');
        faceDos.classList.add('pack-carte-face', 'pack-carte-dos');
        faceDos.textContent = '?';

        const faceRecto = document.createElement('div');
        faceRecto.classList.add('pack-carte-face', 'pack-carte-recto');
        faceRecto.innerHTML = `
            <img src="${pokemon.sprites.regular}" alt="${pokemon.name.fr}">
            <strong>${pokemon.name.fr}</strong>
        `;

        carteAnim.appendChild(faceDos);
        carteAnim.appendChild(faceRecto);
        
        carteAnim.addEventListener('click', () => {
            if (carteAnim.classList.contains('revelee')) return;
            
            if (soundReveal) {
                soundReveal.currentTime = 0;
                soundReveal.play();
            }
            
            carteAnim.classList.add('revelee');
            cartesRevelees++;

            if (cartesRevelees === cartesObtenues.length) {
                h4.textContent = 'Pack terminé !';
                
                const continueBtn = document.createElement('button');
                continueBtn.id = 'continue-pack-btn';
                continueBtn.textContent = 'Ajouter à ma collection';
                continueBtn.classList.add('buy-button');
                continueBtn.style.marginTop = '20px';
                
                continueBtn.addEventListener('click', () => {
                    afficherCartes();
                    resetPackInterface();
                });
                
                resultatDiv.appendChild(continueBtn);
            }
        }, { once: true });

        cardsContainer.appendChild(carteAnim);
    });
    
    resultatDiv.appendChild(cardsContainer);
}

function resetPackInterface() {
    const resultatDiv = document.querySelector('#resultat-pack');
    const oldContinueBtn = document.querySelector('#continue-pack-btn');
    const packInterface = document.querySelector('.pack-interface');
    if (!resultatDiv || !packInterface) return;

    while (resultatDiv.firstChild) {
        resultatDiv.removeChild(resultatDiv.firstChild);
    }
    
    const buyButton = document.querySelector('#buy-pack-button');
    if (buyButton) {
        buyButton.style.display = 'inline-block';
    }
    
    mettreAJourEtatBoutonPack();
}

function ajouterCarte(pokedexId) {
    let estNouvelle = false;
    const carteExistante = inventaireCartes.find(item => item.id === pokedexId);
    
    if (carteExistante) {
        carteExistante.count = (carteExistante.count || 1) + 1;
    } else {
        inventaireCartes.push({ id: pokedexId, count: 1 });
        estNouvelle = true;
    }

    statistiquesSucces.totalCartesObtenues++;
    verifierSucces();
    
    if (estNouvelle) {
        majBonusPokedex();
    }
}

function afficherCartes() {
    while (conteneurCartes.firstChild) {
        conteneurCartes.removeChild(conteneurCartes.firstChild);
    }

    if (inventaireCartes.length === 0) {
        const p = document.createElement('p');
        p.style.color = '#ccc';
        p.textContent = 'Votre collection est vide.';
        conteneurCartes.appendChild(p);
        return;
    }

    inventaireCartes.sort((a, b) => a.id - b.id);

    inventaireCartes.forEach(item => {
        const pokemon = pokemons.find(p => p.pokedex_id === item.id);
        if (!pokemon) return; 
        
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('pokemon-card');

        const img = document.createElement('img');
        img.src = pokemon.sprites.regular;
        img.alt = pokemon.name.fr;
        img.classList.add('pokemon-sprite');

        const h3 = document.createElement('h3');
        h3.textContent = `N°${pokemon.pokedex_id} ${pokemon.name.fr}`;
        
        const pRarity = document.createElement('p');
        pRarity.textContent = `Rareté: ${pokemon.rareté}`;
        
        cardDiv.appendChild(img);
        cardDiv.appendChild(h3);
        cardDiv.appendChild(pRarity);

        if (item.count > 1) {
            const spanCount = document.createElement('span');
            spanCount.classList.add('card-count');
            spanCount.textContent = `x${item.count}`;
            cardDiv.appendChild(spanCount);
        }
        
        conteneurCartes.appendChild(cardDiv);
    });
}

function save() {
    const donneesSauvegarde = {
        points: parsedPoints,
        experience: experience,
        niveau: niveau,
        ameliorations: toutesLesAmeliorations.map(aml => ({
            id: aml.id,
            owned: aml.owned,
            debloque: aml.debloque 
        })),
        cards: inventaireCartes,
        statistiquesSucces: statistiquesSucces,
        succesDebloques: Object.keys(tousLesSucces).filter(key => tousLesSucces[key].debloque)
    };

    try {
        localStorage.setItem('pokemonClickerSave', JSON.stringify(donneesSauvegarde));
        alert("Jeu sauvegardé !");
    } catch (e) {
        console.error(e);
        alert("Erreur lors de la sauvegarde.");
    }
}

function load() {
    const savedData = localStorage.getItem('pokemonClickerSave');
    
    if (!savedData) {
        alert("Aucune sauvegarde trouvée.");
        return;
    }

    try {
        const donneesChargees = JSON.parse(savedData);

        parsedPoints = donneesChargees.points;
        experience = donneesChargees.experience || 0;
        niveau = donneesChargees.niveau || 1;
        updatePointsDisplay();

        if (donneesChargees.ameliorations) {
            donneesChargees.ameliorations.forEach(savedAml => {
                const currentAml = toutesLesAmeliorations.find(aml => aml.id === savedAml.id);
                if (currentAml) {
                    currentAml.owned = savedAml.owned;
                    if (typeof savedAml.debloque === 'boolean') {
                        currentAml.debloque = savedAml.debloque;
                    }
                }
            });
        }

        inventaireCartes = donneesChargees.cards || [];

        if (donneesChargees.statistiquesSucces) {
            statistiquesSucces = donneesChargees.statistiquesSucces;
        }
        if (donneesChargees.succesDebloques) {
            donneesChargees.succesDebloques.forEach(key => {
                if (tousLesSucces[key]) {
                    tousLesSucces[key].debloque = true;
                }
            });
        }

        majBonusPokedex();
        majPPC();
        majPPS();
        
        if (vueActive === 'ameliorations') {
            afficherAmeliorations();
        }
        afficherCartes();
        verifierPassageNiveau(true);
        resetEquipeCombat();

        alert("Jeu chargé avec succès !");

    } catch (e) {
        console.error(e);
        alert("Erreur lors du chargement.");
    }
}

function verifierPassageNiveau(forceUpdate = false) {
    let nouveauPalier = paliersNiveau[0];
    for (let i = paliersNiveau.length - 1; i >= 0; i--) {
        if (experience >= paliersNiveau[i].pointsRequis) {
            nouveauPalier = paliersNiveau[i];
            break;
        }
    }

    if (nouveauPalier.niveau > niveau || forceUpdate) {
        niveau = nouveauPalier.niveau;
        
        if (levelDisplay) {
            levelDisplay.textContent = `Niv. ${niveau} : ${nouveauPalier.titre}`;
        }
    }
    if (niveau >= 10 && navCombat) {
        navCombat.classList.remove('hidden-tab')
    }
    
    if (niveau >= 10 && navPacks) {
        navPacks.classList.remove('hidden-tab')
    }
}

function afficherAlerteSucces(name) {
    if (soundSuccess) {
        soundSuccess.currentTime = 0;
        soundSuccess.play();
    }

    const toastContainer = document.querySelector('#toast-container');
    if (!toastContainer) return;

    const succes = Object.values(tousLesSucces).find(s => s.name === name);
    if (!succes) return;

    const toast = document.createElement('div');
    toast.classList.add('toast-notification');
    toast.innerHTML = `
        <strong>🏆 Succès Débloqué !</strong>
        <span>${succes.name}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function verifierSucces() {
    for (const key in tousLesSucces) {
        const succes = tousLesSucces[key];

        if (succes.debloque) {
            continue; 
        }

        let conditionRemplie = false;

        switch (succes.condition.type) {
            case 'clics':
                conditionRemplie = statistiquesSucces.totalClics >= succes.condition.valeur;
                break;
            case 'points':
                conditionRemplie = experience >= succes.condition.valeur;
                break;
            case 'ameliorations':
                conditionRemplie = statistiquesSucces.totalAmeliorationsAchetees >= succes.condition.valeur;
                break;
            case 'cartes':
                conditionRemplie = statistiquesSucces.totalCartesObtenues >= succes.condition.valeur;
                break;
            case 'temps':
                conditionRemplie = statistiquesSucces.tempsDeJeu >= succes.condition.valeur;
                break;
            case 'combat':
                conditionRemplie = statistiquesSucces.totalCombatsGagnes >= succes.condition.valeur;
                break;
            case 'legendaire':
                conditionRemplie = inventaireCartes.some(item => {
                    const pokemon = pokemons.find(p => p.pokedex_id === item.id);
                    return pokemon && pokemon.rareté >= 4;
                });
                break;
            case 'communes':
                const totalCommunesJeu = pokemons.filter(p => p.rareté === 1).length;
                const communesPossedees = inventaireCartes.filter(item => {
                    const pokemon = pokemons.find(p => p.pokedex_id === item.id);
                    return pokemon && pokemon.rareté === 1;
                }).length;
                conditionRemplie = communesPossedees >= totalCommunesJeu;
                break;
        }

        if (conditionRemplie) {
            succes.debloque = true;
            afficherAlerteSucces(succes.name);
        }
    }
}

function afficherSucces() {
    const succesContainer = document.createElement('div');
    succesContainer.classList.add('succes-container');

    for (const key in tousLesSucces) {
        const succes = tousLesSucces[key];

        const itemDiv = document.createElement('div');
        itemDiv.classList.add('succes-item');

        if (succes.debloque) {
            itemDiv.classList.add('debloque');
        }

        const h4 = document.createElement('h4');
        h4.textContent = `🏆 ${succes.name}`;
        
        const p = document.createElement('p');
        p.textContent = succes.description;

        itemDiv.appendChild(h4);
        itemDiv.appendChild(p);
        succesContainer.appendChild(itemDiv);
    }

    packContainer.appendChild(succesContainer);
}

function afficherInterfaceCombat() {
    while (packContainer.firstChild) {
        packContainer.removeChild(packContainer.firstChild);
    }

    const interfaceCombat = document.createElement('div');
    interfaceCombat.classList.add('combat-interface');

    interfaceCombat.innerHTML = `
        <div class="combat-zone">
            <div class="combat-equipe">
                <h3>Ton équipe</h3>
                <div id="slot-equipe-1" class="combat-slot vide">?</div>
                <div id="slot-equipe-2" class="combat-slot vide">?</div>
                <div id="slot-equipe-3" class="combat-slot vide">?</div>
            </div>
            <span style="font-size: 24px; color: var(--pk-red);">VS</span>
            <div class="combat-adversaire">
                <h3>Adversaire</h3>
                <div id="slot-ennemi-1" class="combat-slot vide">?</div>
                <div id="slot-ennemi-2" class="combat-slot vide">?</div>
                <div id="slot-ennemi-3" class="combat-slot vide">?</div>
            </div>
        </div>
        <div class="combat-actions">
            <button id="lancer-combat-btn">Lancer le Combat !</button>
            <div id="combat-resultat"></div>
        </div>
        
        <div class="combat-selection-container">
            <div class="combat-selection-header">
                <h3>Choisis ton équipe</h3>
                <button id="reset-equipe-btn">Reset</button>
            </div>
            <div class="combat-collection-grille">
            </div>
        </div>
    `;

    packContainer.appendChild(interfaceCombat);
    const boutonCombat = document.querySelector('#lancer-combat-btn');
    const resultatDiv = document.querySelector('#combat-resultat');
    const grilleCollection = packContainer.querySelector('.combat-collection-grille');

    if (inventaireCartes.length < 3) {
        resultatDiv.textContent = "Il te faut au moins 3 cartes pour combattre !";
        boutonCombat.disabled = true;
        boutonCombat.style.backgroundColor = '#555';
        grilleCollection.innerHTML = `<p style="font-size: 9px; color: #AAA;">Achète des packs pour obtenir des cartes.</p>`;
        return;
    }

    if (equipeEnnemieActuelle.length === 0) {
        equipeEnnemieActuelle = genererEquipeEnnemie();
    }
    equipeEnnemieActuelle.forEach((pokemon, index) => {
        if (pokemon) {
            renderCombatSlot(document.querySelector(`#slot-ennemi-${index + 1}`), pokemon);
        }
    });

    renderEquipeSlots(); 

    inventaireCartes.forEach(item => {
        const pokemon = pokemons.find(p => p.pokedex_id === item.id);
        if (!pokemon) return;

        const carteBtn = document.createElement('div');
        carteBtn.classList.add('combat-carte-selection');
        carteBtn.dataset.pokedexId = pokemon.pokedex_id;
        carteBtn.innerHTML = `
            <img src="${pokemon.sprites.regular}" alt="${pokemon.name.fr}">
            <span>${pokemon.name.fr} (x${item.count})</span>
        `;
        
        if (equipePourCombat.some(p => p && p.pokedex_id === pokemon.pokedex_id)) {
            carteBtn.classList.add('selectionnee');
        }

        carteBtn.addEventListener('click', () => selectionnerCartePourCombat(pokemon.pokedex_id));
        grilleCollection.appendChild(carteBtn);
    });

    document.querySelector('#reset-equipe-btn').addEventListener('click', resetEquipeCombat);
    boutonCombat.addEventListener('click', () => lancerCombat(equipePourCombat, equipeEnnemieActuelle));
    
    mettreAJourBoutonCombat();
}

function renderEquipeSlots() {
    equipePourCombat.forEach((pokemon, index) => {
        const slot = document.querySelector(`#slot-equipe-${index + 1}`);
        if (pokemon) {
            renderCombatSlot(slot, pokemon);
        } else {
            slot.innerHTML = '?';
            slot.classList.add('vide');
        }
    });
}

function selectionnerCartePourCombat(pokedexId) {
    const indexSlotVide = equipePourCombat.findIndex(slot => slot === null);
    if (indexSlotVide === -1) {
        console.log("Ton équipe est déjà pleine !");
        return;
    }

    const estDejaSelectionne = equipePourCombat.some(p => p && p.pokedex_id === pokedexId);
    if (estDejaSelectionne) {
        console.log("Ce Pokémon est déjà dans ton équipe !");
        return;
    }

    const pokemonData = pokemons.find(p => p.pokedex_id === pokedexId);
    equipePourCombat[indexSlotVide] = pokemonData;

    renderEquipeSlots();

    const carteBtn = document.querySelector(`.combat-carte-selection[data-pokedex-id="${pokedexId}"]`);
    if (carteBtn) {
        carteBtn.classList.add('selectionnee');
    }

    mettreAJourBoutonCombat();
}

function resetEquipeCombat() {
    equipePourCombat = [null, null, null];
    if (vueActive === 'combat') { 
        renderEquipeSlots(); 
        document.querySelectorAll('.combat-carte-selection.selectionnee').forEach(btn => {
            btn.classList.remove('selectionnee');
        });
        mettreAJourBoutonCombat();
    }
}

function mettreAJourBoutonCombat() {
    const boutonCombat = document.querySelector('#lancer-combat-btn');
    if (!boutonCombat) return;

    const equipePleine = equipePourCombat.every(slot => slot !== null);
    
    boutonCombat.disabled = !equipePleine;
    if (boutonCombat.disabled) {
        boutonCombat.style.backgroundColor = '#555';
    } else {
        boutonCombat.style.backgroundColor = 'var(--pk-red)';
    }
}

function renderCombatSlot(slotElement, pokemon) {
    slotElement.innerHTML = `
        <img src="${pokemon.sprites.regular}" alt="${pokemon.name.fr}">
        <div class="combat-slot-info">
            <strong>${pokemon.name.fr}</strong>
            <span>Rareté: ${pokemon.rareté}</span>
        </div>
    `;
    slotElement.classList.remove('vide');
}

function selectionnerEquipeAuto() {
    const equipeComplete = inventaireCartes.map(item => {
        const pokemonData = pokemons.find(p => p.pokedex_id === item.id);
        return {
            ...pokemonData,
            count: item.count
        };
    });

    equipeComplete.sort((a, b) => b.rareté - a.rareté);

    return equipeComplete.slice(0, 3);
}

function genererEquipeEnnemie() {
    let equipeEnnemie = []
    for (let i = 0; i < 3; i++) {
        const indexAleatoire = Math.floor(Math.random() * pokemons.length);
    equipeEnnemie.push(pokemons[indexAleatoire])
    }
    return equipeEnnemie;
}

function lancerCombat(equipe, equipeEnnemie) {
    const resultatDiv = document.querySelector('#combat-resultat');
    const boutonCombat = document.querySelector('#lancer-combat-btn');
    if (!resultatDiv || !boutonCombat) return;

    if (equipe.some(slot => slot === null)) {
        resultatDiv.textContent = "Ton équipe n'est pas complète !";
        return;
    }

    resultatDiv.textContent = "Calcul de la puissance...";
    boutonCombat.disabled = true;

    let puissanceEquipe = equipe.reduce((total, pk) => {
        if (pk && pk.stats) {
            return total + pk.stats.atk + pk.stats.spe_atk;
        }
        return total;
    }, 0);
    puissanceEquipe += (niveau * 10);

    let puissanceEnnemie = equipeEnnemie.reduce((total, pk) => {
        if (pk && pk.stats) {
            return total + pk.stats.hp + pk.stats.def + pk.stats.spe_def;
        }
        return total;
    }, 0);
    puissanceEnnemie += (niveau * Math.floor(Math.random() * 10));

    setTimeout(() => {
        if (puissanceEquipe >= puissanceEnnemie) {
            resultatDiv.textContent = `Victoire ! (Puissance: ${puissanceEquipe} vs ${puissanceEnnemie})`;
            resultatDiv.style.color = 'var(--pk-yellow)';
            
            if (soundVictory) {
                soundVictory.currentTime = 0;
                soundVictory.play();
            }
            
            donnerRecompenseCombat();
            statistiquesSucces.totalCombatsGagnes++;
            verifierSucces();

        } else {
            resultatDiv.textContent = `Défaite... (Puissance: ${puissanceEquipe} vs ${puissanceEnnemie})`;
            resultatDiv.style.color = 'var(--pk-red)';
            
            if (soundDefeat) {
                soundDefeat.currentTime = 0;
                soundDefeat.play();
            }
        }

        resetEquipeCombat(); 
        
        equipeEnnemieActuelle = genererEquipeEnnemie();
        
        equipeEnnemieActuelle.forEach((pokemon, index) => {
            if (pokemon) {
                const slot = document.querySelector(`#slot-ennemi-${index + 1}`);
                renderCombatSlot(slot, pokemon);
            }
        });
        
        mettreAJourBoutonCombat();

    }, 2000);
}

function donnerRecompenseCombat() {
    const badgesCaches = toutesLesAmeliorations.filter(aml => 
        typeof aml.debloque === 'boolean' && 
        aml.debloque === false && 
        aml.owned === 0
    );

    if (badgesCaches.length === 0) {
        console.log("Toutes les récompenses de combat ont été débloquées !");
        const pointsBonus = 50 * niveau;
        parsedPoints += pointsBonus;
        afficherAlerteRecompense(`Bonus de ${pointsBonus.toFixed(0)} points !`);
        return;
    }

    const badgeADebloquer = badgesCaches[Math.floor(Math.random() * badgesCaches.length)];

    badgeADebloquer.debloque = true;

    afficherAlerteRecompense(badgeADebloquer.name);
    
    if (vueActive === 'ameliorations') {
        afficherAmeliorations();
    }
}

function afficherAlerteRecompense(name) {
    const toastContainer = document.querySelector('#toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.classList.add('toast-notification');
    
    toast.style.backgroundColor = 'var(--pk-blue)';
    toast.style.color = 'var(--pk-yellow)';
    toast.style.borderColor = 'var(--pk-yellow)';

    toast.innerHTML = `
        <strong>🏆 Récompense de Combat !</strong>
        <span>Vous avez débloqué : ${name}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

const vitesseTick = 50; 

setInterval(() => {
    let pointsGagnes = pps / (1000 / vitesseTick);
    parsedPoints += pointsGagnes;
    experience += pointsGagnes;

    updatePointsDisplay(); 
    verifierPassageNiveau();

    if (vueActive === 'ameliorations') {
        mettreAJourEtatBoutons();
    } else if (vueActive === 'packs') {
        mettreAJourEtatBoutonPack();
    }
}, vitesseTick);

setInterval(() => {
    statistiquesSucces.tempsDeJeu++;
    verifierSucces(); 
}, 1000);

majBonusPokedex();
majPPC();
majPPS();
afficherCartes(); 
basculerVue("ameliorations"); 

navAmeliorations.addEventListener('click', () => basculerVue('ameliorations'));
navPacks.addEventListener('click', () => basculerVue('packs'));
navSucces.addEventListener('click', () => basculerVue('succes'));
navCombat.addEventListener('click', () => basculerVue('combat'));