// --- DÉCLARATION DES DONNÉES POKÉMON ---
// Si vous n'avez pas de data.js, décommentez et utilisez ce tableau d'exemple :
const pokemons = [
    { pokedex_id: 1, name: { fr: 'Bulbizarre' }, sprites: { regular: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/1/regular.png' }, rareté: 1 },
    { pokedex_id: 25, name: { fr: 'Pikachu' }, sprites: { regular: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/25/regular.png' }, rareté: 2 },
    { pokedex_id: 150, name: { fr: 'Mewtwo' }, sprites: { regular: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/150/regular.png' }, rareté: 4 },
    { pokedex_id: 151, name: { fr: 'Mew' }, sprites: { regular: 'https://raw.githubusercontent.com/Yarkis01/TyraDex/images/sprites/151/regular.png' }, rareté: 5 }
];


// --- 1. VARIABLES DE JEU ET ÉLÉMENTS HTML ---

let points = 0;
let pointsParClic = 1;
let pps = 0; 
let collection = {}; // Collection de cartes { 'id': { pokemon: {...}, qty: 1 } }

const COUT_PACK_CARTE = 1500;
const CARTES_PAR_BOOSTER = 3;

const pointsElement = document.querySelector('.points');
const ppsElement = document.querySelector('.pps');
const ameliorationsContainer = document.querySelector('.ameliorations');
const saveButton = document.getElementById('saveButton');
const loadButton = document.getElementById('loadButton');
const cartesContainer = document.querySelector('.cartes');
const packCostElement = document.querySelector('.pack-cost');


// --- 2. DÉFINITION DES AMÉLIORATIONS ---

const upgrades = [
    { id: 'superClic', nom: 'Super Clic', description: 'Ajoute +1 point à vos clics manuels.', niveau: 0, coutBase: 50, effet: () => { pointsParClic += 1; }, type: 'clic' },
    { id: 'griffeMiaouss', nom: 'Griffe de Miaouss', description: 'Ajoute +2 points à vos clics manuels.', niveau: 0, coutBase: 150, effet: () => { pointsParClic += 2; }, type: 'clic' },
    { id: 'ronflexSomnolent', nom: 'Ronflex Somnolent', description: 'Ajoute +1 point toutes les 2 secondes.', niveau: 0, coutBase: 600, effet: () => { pps += 0.5; }, type: 'auto' },
    { id: 'badgeVolt', nom: 'Badge Volt', description: 'Multiplie les points de clic par 2.', niveau: 0, coutBase: 2000, effet: () => { pointsParClic *= 2; }, type: 'multiplicateur' }
];

function calculerCout(upgrade) {
    return upgrade.coutBase * (upgrade.niveau + 1);
}

// --- 3. LOGIQUE DU JEU (CLIC ET ACHAT) ---

// CORRECTION : Définie sur 'window' pour être accessible par l'attribut onclick dans le HTML
window.incrementation = function() {
    points += pointsParClic;
    mettreAJourAffichage();
};

function acheterAmelioration(upgradeId) {
    const upgrade = upgrades.find(u => u.id === upgradeId);
    if (!upgrade) return;

    const coutActuel = calculerCout(upgrade);

    if (points >= coutActuel) {
        points -= coutActuel;
        upgrade.niveau++;
        
        recalculerStats(); 

        mettreAJourAffichage();
        genererAmeliorationsHTML();
        sauvegarderJeu();
    } else {
        alert("Pas assez de points pour acheter cette amélioration !");
    }
}

// --- 4. LOGIQUE DES CARTES POKÉMON ---

const RARETE_POIDS = {
    1: 70,  
    2: 20,  
    3: 7,   
    4: 2.5, 
    5: 0.5  
};

function tirerCartePonderee() {
    let totalPoids = 0;
    if (!window.pokemons || pokemons.length === 0) {
        console.error("Le tableau 'pokemons' n'est pas chargé ou est vide. Impossible de tirer une carte.");
        return null;
    }
    
    const pokemonsDisponibles = pokemons.filter(p => p.rareté !== undefined && p.rareté !== null);
    
    const tirageListe = [];
    pokemonsDisponibles.forEach(p => {
        const poids = RARETE_POIDS[p.rareté] || 0;
        totalPoids += poids;
        tirageListe.push({ pokemon: p, poids: poids });
    });

    if (totalPoids === 0) return null;

    const rand = Math.random() * totalPoids;
    let poidsCumule = 0;

    for (const item of tirageListe) {
        poidsCumule += item.poids;
        if (rand < poidsCumule) {
            return item.pokemon;
        }
    }
    return pokemonsDisponibles[pokemonsDisponibles.length - 1]; 
}

function ajouterCarteACollection(pokemon) {
    const id = pokemon.pokedex_id;

    if (collection[id]) {
        collection[id].qty++;
    } else {
        collection[id] = {
            pokemon: pokemon,
            qty: 1
        };
    }
}

// CORRECTION : Définie sur 'window' pour être accessible par l'attribut onclick dans le HTML
window.ouvrirBooster = function() {
    if (points < COUT_PACK_CARTE) {
        alert("Pas assez de points pour acheter le Pack de Cartes Pokémon ! Coût : " + COUT_PACK_CARTE.toLocaleString());
        return;
    }
    
    points -= COUT_PACK_CARTE;
    mettreAJourAffichage();
    
    const cartesTirees = [];
    for (let i = 0; i < CARTES_PAR_BOOSTER; i++) {
        const nouvelleCarte = tirerCartePonderee();
        if (nouvelleCarte) {
            cartesTirees.push(nouvelleCarte);
            ajouterCarteACollection(nouvelleCarte);
        }
    }

    alert(`Vous avez tiré : ${cartesTirees.map(p => p.name.fr).join(', ')} !`);
    
    recalculerStats(); 
    genererCartesHTML();
    sauvegarderJeu();
}


// --- 5. CALCUL DES STATISTIQUES (UPDATES + CARTES) ---

function recalculerStats() {
    pointsParClic = 1; 
    pps = 0;

    upgrades.forEach(upgrade => {
        for (let i = 0; i < upgrade.niveau; i++) {
            if (upgrade.effet) upgrade.effet();
        }
    });

    const cartesUniques = Object.values(collection);
    
    cartesUniques.forEach(item => {
        const bonusBase = 0.1; 
        const ppsBonusParCarte = item.pokemon.rareté * bonusBase;
        
        pps += ppsBonusParCarte * item.qty;
    });
}

function mettreAJourAffichage() {
    pointsElement.textContent = Math.floor(points).toLocaleString();
    ppsElement.textContent = pps.toFixed(1); 
    packCostElement.textContent = COUT_PACK_CARTE.toLocaleString();
}

// Boucle de jeu automatique (PPS)
setInterval(() => {
    points += pps;
    mettreAJourAffichage();
}, 1000);


// --- 6. SAUVEGARDE ET CHARGEMENT ---

function sauvegarderJeu() {
    const gameState = {
        points: points,
        upgrades: upgrades.map(u => ({ id: u.id, niveau: u.niveau })),
        collection: Object.values(collection).map(item => ({ id: item.pokemon.pokedex_id, qty: item.qty }))
    };
    
    localStorage.setItem('pokemonClickerSave', JSON.stringify(gameState));
    alert("Jeu sauvegardé avec succès !");
}

function chargerJeu() {
    const savedState = localStorage.getItem('pokemonClickerSave');
    
    if (savedState) {
        const gameState = JSON.parse(savedState);
        
        points = gameState.points;
        
        gameState.upgrades.forEach(savedUpgrade => {
            const currentUpgrade = upgrades.find(u => u.id === savedUpgrade.id);
            if (currentUpgrade) {
                currentUpgrade.niveau = savedUpgrade.niveau;
            }
        });

        collection = {}; 
        if (gameState.collection) {
            gameState.collection.forEach(savedItem => {
                // Vérification cruciale que pokemons est chargé avant de tenter la recherche
                if (window.pokemons && pokemons.length > 0) { 
                    const pokemonData = pokemons.find(p => p.pokedex_id === savedItem.id);
                    if (pokemonData) {
                        collection[savedItem.id] = {
                            pokemon: pokemonData,
                            qty: savedItem.qty
                        };
                    }
                }
            });
        }
        
        recalculerStats();
        mettreAJourAffichage();
        genererAmeliorationsHTML();
        genererCartesHTML();
        alert("Jeu chargé avec succès !");
    } else {
        console.log("Aucune sauvegarde trouvée. Démarrage d'une nouvelle partie.");
        // Pas d'alerte ici, car c'est un démarrage normal.
    }
}


// --- 7. GÉNÉRATION D'HTML ---

function genererAmeliorationsHTML() {
    ameliorationsContainer.innerHTML = ''; 

    upgrades.forEach(upgrade => {
        const coutActuel = calculerCout(upgrade);
        const upgradeDiv = document.createElement('div');
        upgradeDiv.classList.add('upgrade-item');
        
        upgradeDiv.onclick = () => acheterAmelioration(upgrade.id);
        
        if (points >= coutActuel) {
            upgradeDiv.classList.add('achetable');
            upgradeDiv.style.opacity = '1';
        } else {
            upgradeDiv.style.opacity = '0.6'; 
        }

        upgradeDiv.innerHTML = `
            <div class="upgrade-info">
                <h3>${upgrade.nom} (Niv. ${upgrade.niveau})</h3>
                <p>${upgrade.description}</p>
            </div>
            <div class="upgrade-achat">
                <p>Coût : ${coutActuel.toLocaleString()}</p>
                <button style="display:none;">Acheter</button> 
            </div>
        `;
        ameliorationsContainer.appendChild(upgradeDiv);
    });
}

function genererCartesHTML() {
    cartesContainer.innerHTML = ''; 
    const cartesUniques = Object.values(collection).sort((a, b) => a.pokemon.pokedex_id - b.pokemon.pokedex_id);

    if (cartesUniques.length === 0) {
        cartesContainer.innerHTML = '<p>Votre collection est vide. Achetez un Pack de Cartes pour commencer !</p>';
        return;
    }

    cartesUniques.forEach(item => {
        const carteDiv = document.createElement('div');
        carteDiv.classList.add('pokemon-card');
        carteDiv.classList.add(`rarity-${item.pokemon.rareté}`);
        
        carteDiv.innerHTML = `
            <img src="${item.pokemon.sprites.regular}" alt="${item.pokemon.name.fr}" class="card-sprite">
            <div class="card-info">
                <h4>#${item.pokemon.pokedex_id} ${item.pokemon.name.fr}</h4>
                <p>Rareté : ${item.pokemon.rareté}</p>
                <p class="card-qty">Total : ${item.qty}</p>
            </div>
        `;
        cartesContainer.appendChild(carteDiv);
    });
}


// --- 8. INITIALISATION ---

window.onload = () => {
    // 1. Lier les fonctions aux boutons
    saveButton.addEventListener('click', sauvegarderJeu);
    loadButton.addEventListener('click', chargerJeu);
    
    // 2. Tenter de charger une partie existante au démarrage
    chargerJeu(); 
    
    // 3. Mise à jour finale si aucune sauvegarde trouvée
    mettreAJourAffichage();
    genererAmeliorationsHTML();
    genererCartesHTML(); // Affiche la collection même si vide
};