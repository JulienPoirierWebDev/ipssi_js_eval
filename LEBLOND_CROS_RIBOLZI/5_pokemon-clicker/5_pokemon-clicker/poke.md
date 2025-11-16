# ⚡ Clicker Pokémon – Cahier de conception / Plan de développement

---

## 🎯 Objectif

Créer un jeu **Clicker Pokémon** progressif, immersif et évolutif, avec :

-   des clics pour gagner des points,
-   des améliorations automatiques et manuelles,
-   des boosters de cartes Pokémon,
-   un système de niveaux et de succès,
-   un **mode combat** donnant des bonus uniques.

---

## Comment coder ce jeu :

Je vous conseille de découper en fonctionnalités.

Ici, la première fonctionnalité a faire, c'est le clicker.

Ensuite, ajouter les améliorations que l'on peut acheter.

Ensuite, ajouter les effets des améliorations sur le clicker.

Le deuxième bloc, ce sont les cartes.

Faire la fonction qui ouvre un paquet et qui choisi 3 pokemons au hasard.

Trois niveau de rareté : commune, rare, épique.

A vous de voir comment gérer ça mais je partirai sur 200/300 d'avoir une commune, 85/300 d'avoir une rare et 15/300 d'avoir une épique sur le bootster de base.
Voir pour changer ces ratios par type de booster.

// Étape 1️⃣ : initialiser une variable points = 0
// récupérer #clickBtn et #points

    		// Étape 2️⃣ : au clic, augmenter les points et mettre à jour l'affichage

    		// Étape 3️⃣ : créer un tableau d'améliorations (auto-click, multiplicateur)
    		// Chaque objet contient : name, cost, effect, owned, type, frequency
    		// Exemple : { name: 'Auto-click', cost: 50, effect: 1, owned: 0 }
    		// Si owned > 0, c'est que l'amélioration est déjà achetée.
    		// Avec type, on peut différencier les améliorations (auto-click, multiplicateur, etc.)

    		// Étape 4️⃣ : afficher dynamiquement les boutons d'achat dans #upgrades : ceux qui sont déjà achetés doivent être désactivés et celles qui ne sont pas encore dispo (peut être faut'il acheter un élement avant pour en débloquer un autre ?)
    		// Nom amélioration : effet | cout ACHETER

    		// Étape 5️⃣ : au clic sur une amélioration, vérifier si le joueur a assez de points
    		// appliquer son effet et mettre à jour l'affichage
    		// On peut lancer un nouveau interval pour un autoclick ou bien l'ajouter dans une fonction qui calcul tout déja lancé dans l'interval initial.

    		// Étape 6️⃣ : ajouter une section "packs de cartes"
    		// chaque pack coûte X points et permet d'ouvrir un booster de 3 cartes aléatoires (image, nom)
    		// Faire en sorte que les cartes apparaissent selon le niveau de rareté.
    		// Vous pouvez ajouter des animations en CSS ou en JS lors de l'ouverture du booster

    		// Exemple de carte : { name: 'Pikachu', image: 'pikachu.png', rarity: 'common' }
    		// Ajouter un onglet qui permettent de voir les cartes déjà obtenues. Celle en double doivent être retirées de l'affichage mais le nombre d'exemplaires doit être affiché.
    		// Par exemple : { name: 'Pikachu', image: 'pikachu.png', rarity: 'common', qty: 2 } --> Pikachu : total 2

    		// Étape 7️⃣ : bonus - sauvegarder les points et cartes dans localStorage

    		// Bonus :
    		// - Ajouter des animations CSS pour les boutons et cartes.
    		// - Ajouter un son à chaque clic ou achat.
    		// - Ajouter un compteur de temps pour voir combien de temps le joueur a passé à jouer.
    		// - Ajouter un système de niveaux : chaque X points, le joueur passe au niveau supérieur et débloque de nouvelles cartes ou améliorations.
    		// - Ajouter un système de succès : par exemple, "Acheter 10 améliorations", "Obtenir 50 cartes", etc.
    		// Avoir des effets visuels a chaque point gagné : un point = un pixel. Si le jeu rame trop, on peut faire un gros pixel pour 10 points. Ajouter des couleurs aléatoires pour chaque pixel.*/

## 🧩 Étapes de base (issues du HTML)

### 1️⃣ Initialisation

-   Variable `points = 0`
-   Sélecteurs : `#clickBtn`, `#points`
-   Au clic sur `#clickBtn` → +1 point

### 2️⃣ Améliorations

-   Tableau d’objets :

    ```js
    { name: 'Auto-click', cost: 50, effect: 1, owned: 0, type: 'auto' }
    ```

-   Types : `auto`, `multiplier`, `special`
-   Effets : gain de points, auto-click, réduction des coûts, chance critique, etc.

### 3️⃣ Affichage dynamique

-   Générer les boutons d’amélioration dans `#upgrades`
-   Les rendre interactifs selon le nombre de points
-   Verrouiller ou débloquer selon la progression

### 4️⃣ Boosters Pokémon

-   Chaque pack coûte X points
-   Contient 3 cartes aléatoires :

    ```js
    { name: 'Pikachu', image: 'pikachu.png', rarity: 'common' }
    ```

-   Raretés : `common`, `rare`, `epic`, `legendary`
-   Doubles gérés avec `qty` :

    ```js
    { name: 'Pikachu', image: 'pikachu.png', rarity: 'common', qty: 2 }
    ```

### 5️⃣ Sauvegarde

-   Sauvegarde automatique dans `localStorage`
-   Données : points, améliorations, cartes, succès

---

## 🏆 Liste de Succès

| Catégorie         | Nom               | Condition                | Récompense |
| ----------------- | ----------------- | ------------------------ | ---------- |
| 💪 Clics          | Dresseur débutant | 100 clics                |
|                   | Dresseur confirmé | 1 000 clics              |
|                   | Maître du clic    | 10 000 clics             |
| 💰 Points cumulés | Riche !           | 10 000 points            |
|                   | Millionnaire      | 1 000 000 points         |
| 🧠 Améliorations  | Ingénieux         | Acheter 5 améliorations  |
|                   | Stratège          | Acheter 15 améliorations |
| 🃏 Collection     | Collectionneur    | 10 cartes obtenues       |
|                   | Maître du Pokédex | toutes cartes communes   |
|                   | Légendaire        | 1 carte légendaire       |
| 🕒 Temps de jeu   | Persévérant       | 30 min de jeu            |
|                   | Insomniaque       | 2h de jeu                |
| ⚔️ Combat         | Premier duel      | 1 victoire               |
|                   | Champion          | 10 victoires             |
|                   | Maître Pokémon    | 100 victoires            |

---

## 🌳 Arbre d’Améliorations

### ⚡ Branche 1 : Clic et Réflexes

| Nom               | Effet                      | Coût   |
| ----------------- | -------------------------- | ------ |
| Doigt d’acier     | +1 point par clic          | 20     |
| Foudre de Pikachu | +10 points par clic        | 500    |
| Feu de dracaufeu  | +50 points par clic        | 2 500  |
| Clic critique     | 1% de chance de ×10 points | 10 000 |

---

### 🪙 Branche 2 : Gains passifs

| Nom                   | Effet         | Coût  |
| --------------------- | ------------- | ----- |
| Équipe automatique    | 1 point/sec   | 50    |
| Robot dresseur        | 5 points/sec  | 800   |
| PokéCentre industriel | 50 points/sec | 2 500 |

---

### 💎 Branche 3 : Booster et Rareté

| Nom                     | Effet                          | Coût  |
| ----------------------- | ------------------------------ | ----- |
| Booster novice          | débloque boosters communs      | 100   |
| Booster intermédiaire   | +5% carte rare                 | 500   |
| Booster expert          | +10% carte rare                | 1 500 |
| Collectionneur chanceux | doublons rapportent des points | 2 500 |
| Pokédex complet         | débloque boosters légendaires  | 5 000 |

---

## 🧮 Système de Niveaux

| Niveau | Titre                  | Bonus |
| ------ | ---------------------- | ----- |
| 1      | Dresseur débutant      | -     |
| 5      | Dresseur intermédiaire | -     |
| 10     | Dresseur expérimenté   | -     |
| 15     | Champion régional      | -     |
| 20     | Maître Pokémon         | -     |
| 25     | Dresseur suprême       | -     |

---

## ⚔️ Mode Combat Pokémon

### 🎮 Principe

-   Débloqué au niveau 10.
-   L’équipe du joueur = 3 Pokémon tirés de ses cartes.
-   Combat automatique selon :

    -   niveau du joueur,
    -   rareté des cartes,
    -   améliorations débloquées.

### 🧠 Améliorations exclusives de combat

| Nom              | Effet                          |
| ---------------- | ------------------------------ |
| Badge Foudre     | +10% auto-click                |
| Badge Volcan     | +25% clics                     |
| Badge Marais     | +5% carte rare                 |
| Badge Cascade    | double soin                    |
| Badge Terre      | +50% dégâts boss               |
| Pierre de Mewtwo | débloque Mewtwo (bonus global) |

---

## 🧱 Organisation du code en modules

```text
📁 /js
 ├── main.js          → boucle de jeu, DOM, clic principal
 ├── upgrades.js      → définitions + achats d'améliorations
 ├── cards.js         → cartes, boosters, Pokédex
 ├── levels.js        → système de progression et prestige
 ├── combat.js        → logique de combat + récompenses
 ├── achievements.js  → suivi et validation des succès
 ├── storage.js       → sauvegarde / chargement (localStorage)
 └── ui.js            → animations, sons, transitions
```

---

## 💡 Pistes Bonus

-   Animation de clic : éclairs jaunes ou `+1 ⚡` flottant.
-   Animation d’ouverture de booster. Une pochette d'où sort la carte.
-   Sons : clic, achat, victoire.
