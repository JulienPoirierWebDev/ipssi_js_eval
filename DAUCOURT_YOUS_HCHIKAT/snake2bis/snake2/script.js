// attention a l'indentation en javascript

let jeuLance = false;

let intervalJeu = null;


let serpent = [
  {x: 10, y: 10},
  {x: 9, y: 10},
  {x: 8, y: 10},
  {x: 7, y: 10}
];

let compteurTentatives = 0;
const jeu = document.getElementById("jeu");
const taille = 20;
const cases = [];


let direction = {x: 1, y: 0};
let nourriture = { x: 5, y: 5 };

créationDeLaGrille();
créerLesControlesDuJeu();

  
function créationDeLaGrille() {
      for (let i = 0; i < taille * taille; i++) {
      const cell = document.createElement("div");
      cell.classList.add("case");
      jeu.appendChild(cell);
      cases.push(cell);
    }
}

function remettreLeVisuelDeLaGrilleÀZéro() {
  for (let i = 0; i < cases.length; i++) {
    cases[i].className = "case";
  }
}

function ajouterLaNourritureSurLaGrille() {
  const indexNourriture = nourriture.y * taille + nourriture.x;
  cases[indexNourriture].classList.add("nourriture");
}

function créerLesControlesDuJeu() {
  document.addEventListener("keydown", event => {
    if (event.key === "ArrowUp" && direction.y !== 1) direction = { x: 0, y: -1 };
    if (event.key === "ArrowDown" && direction.y !== -1) direction = { x: 0, y: 1 };
    if (event.key === "ArrowLeft" && direction.x !== 1) direction = { x: -1, y: 0 };
    if (event.key === "ArrowRight" && direction.x !== -1) direction = { x: 1, y: 0 };
  });
}

function afficherLeSerpent() {
  for (let i = 0; i < serpent.length; i++) {
        const index = serpent[i].y * taille + serpent[i].x;
        cases[index].classList.add(i === 0 ? "teteSerpent" : "serpent");
      }
}

function afficher() {
      remettreLeVisuelDeLaGrilleÀZéro();
      ajouterLaNourritureSurLaGrille();
      afficherLeSerpent()
}

function verifierCollisionMur(tete) {
      return tete.x < 0 || tete.x >= taille || tete.y < 0 || tete.y >= taille;
}
    
function verifierCollisionCorps(tete) {
  return serpent.some(partie => partie.x === tete.x && partie.y === tete.y);
}

function leJeuEstPerdu() {
    alert("Perdu :(");
        jeuLance = false;
        //ici on doit reset le serpent
        serpent = [
          {x: 10, y: 10},
          {x: 9, y: 10},
          {x: 8, y: 10},
          {x: 7, y: 10}
        ];
        direction = {x: 1, y: 0};
        nourriture = créerUneNouvelleNourriture();

        compteurTentatives++;
        console.log("Nb de tentatives :", compteurTentatives);

        clearInterval(intervalJeu);
        remettreLeVisuelDeLaGrilleÀZéro();

}
 
function faireGrandirLeSerpent(tete) {
        serpent.unshift(tete);
}

function faireRetrecirLeSerpent() {
        serpent.pop();
}
    
function vérifierSiLeSerpentMangeLaNourriture(tete, nourriture) {
      return tete.x === nourriture.x && tete.y === nourriture.y;
}

function créerUneNouvelleNourriture() {
      return {x: Math.floor(Math.random() * taille), y: Math.floor(Math.random() * taille)};
}

function calculerTourDeJeu() {
      if (!jeuLance) return;
      const tete = {x: serpent[0].x + direction.x, y: serpent[0].y + direction.y};

      const collisionMur = verifierCollisionMur(tete);
      const collisionCorps = verifierCollisionCorps(tete);


  if (collisionMur || collisionCorps) {
       leJeuEstPerdu();
        return;
  }
  faireGrandirLeSerpent(tete);
  const serpentMangeNourriture = vérifierSiLeSerpentMangeLaNourriture(tete, nourriture);
      if (serpentMangeNourriture) {
        nourriture = créerUneNouvelleNourriture();
      } else {
        faireRetrecirLeSerpent();
      }
      afficher();
}

function initialiserJeu() {
      
  const boutonLancer = document.getElementById("lancerJeu");
  boutonLancer.addEventListener("click", () => {
    if (!jeuLance) {
      compteurTentatives++;
      jeuLance = true;
      console.log("Nb de tentatives :", compteurTentatives);
      afficher();
      intervalJeu = setInterval(calculerTourDeJeu, 300);
    }
  });
}

initialiserJeu();