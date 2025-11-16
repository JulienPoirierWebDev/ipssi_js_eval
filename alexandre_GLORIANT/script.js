"use strict";

//1
const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

//2
const $ = (selecteur) => document.querySelector(selecteur);

//3
const boutonLancer = $("#roll");
const boutonGarder = $("#hold");
const sectionJoueur1 = $("#player1");
const sectionJoueur2 = $("#player2");
const affichageScoreTotalJ1 = $("#p1-total");
const affichageScoreTotalJ2 = $("#p2-total");
const affichageScoreTourJ1 = $("#p1-round");
const affichageScoreTourJ2 = $("#p2-round");
const affichageDeJ1 = $("#p1-dice");
const affichageDeJ2 = $("#p2-dice");
const zoneMessage = $("#roundResult");

//4
let scoreTotalJ1 = 0;
let scoreTotalJ2 = 0;
let scoreTour = 0;
let joueurActif = 1;
let jeuEnCours = true;
let confirmationScore29 = false;

//5
let historiqueJ1 = [];
let historiqueJ2 = [];

//6
function lancerDe() {
  //7 //8
  const resultat = Math.floor(Math.random() * 6) + 1;

  //9
  return resultat;
}

//10
function ajouterAuHistorique(joueur, resultatDe) {
  //11 //12
  if (joueur === 1) {
    //13
    historiqueJ1.push(resultatDe);
  } else {
    historiqueJ2.push(resultatDe);
  }
}

//14
function afficherHistorique() {
  let zoneHistoriqueJ1 = $("#historique-j1");

  //15
  if (!zoneHistoriqueJ1) {
    //16
    zoneHistoriqueJ1 = document.createElement("div");

    zoneHistoriqueJ1.id = "historique-j1";

    //17
    zoneHistoriqueJ1.style.fontSize = "0.85rem";
    zoneHistoriqueJ1.style.marginTop = "0.5rem";
    zoneHistoriqueJ1.style.color = "#aaa";

    //18
    sectionJoueur1.appendChild(zoneHistoriqueJ1);
  }

  let zoneHistoriqueJ2 = $("#historique-j2");
  if (!zoneHistoriqueJ2) {
    zoneHistoriqueJ2 = document.createElement("div");
    zoneHistoriqueJ2.id = "historique-j2";
    zoneHistoriqueJ2.style.fontSize = "0.85rem";
    zoneHistoriqueJ2.style.marginTop = "0.5rem";
    zoneHistoriqueJ2.style.color = "#aaa";
    sectionJoueur2.appendChild(zoneHistoriqueJ2);
  }

  //19
  const derniersCoupsJ1 = historiqueJ1.slice(-5);
  const derniersCoupsJ2 = historiqueJ2.slice(-5);

  //20 //21 //22 //23
  zoneHistoriqueJ1.textContent =
    derniersCoupsJ1.length > 0
      ? `Derniers coups : ${derniersCoupsJ1.join(", ")}`
      : "Historique : aucun coup";

  zoneHistoriqueJ2.textContent =
    derniersCoupsJ2.length > 0
      ? `Derniers coups : ${derniersCoupsJ2.join(", ")}`
      : "Historique : aucun coup";
}

//24
function changerJoueur() {
  //25
  scoreTour = 0;
  confirmationScore29 = false;

  //26
  joueurActif = joueurActif === 1 ? 2 : 1;

  //27
  mettreAJourAffichage();
}

//28
function mettreAJourAffichage() {
  //29
  affichageScoreTotalJ1.textContent = scoreTotalJ1;
  affichageScoreTotalJ2.textContent = scoreTotalJ2;

  //30
  if (joueurActif === 1) {
    affichageScoreTourJ1.textContent = scoreTour;
    affichageScoreTourJ2.textContent = 0;
  } else {
    affichageScoreTourJ1.textContent = 0;
    affichageScoreTourJ2.textContent = scoreTour;
  }

  //31 //32
  sectionJoueur1.classList.remove("active");
  sectionJoueur2.classList.remove("active");

  //33
  if (joueurActif === 1) {
    sectionJoueur1.classList.add("active");
  } else {
    sectionJoueur2.classList.add("active");
  }

  afficherHistorique();
}

//48
function afficherGifDefaite() {
  //49
  const gifContainer = document.createElement("div");
  gifContainer.style.position = "fixed";
  gifContainer.style.top = "50%";
  gifContainer.style.left = "50%";
  gifContainer.style.transform = "translate(-50%, -50%)";
  gifContainer.style.zIndex = "1000";
  gifContainer.style.backgroundColor = "rgba(0, 0, 0, 0.9)";
  gifContainer.style.padding = "2rem";
  gifContainer.style.borderRadius = "10px";

  //50
  const gif = document.createElement("img");
  gif.src = "https://s3.fr-par.scw.cloud/media.trouvetonmeme.com/media/memes/side_eye.gif";
  gif.style.maxWidth = "90vw";
  gif.style.maxHeight = "80vh";
  gif.style.borderRadius = "8px";

  //51
  const boutonFermer = document.createElement("button");
  boutonFermer.textContent = "Clique ici pour confirmer que t'es vraiment pas très smart";
  boutonFermer.style.marginTop = "1rem";
  boutonFermer.style.display = "block";
  boutonFermer.style.marginLeft = "auto";
  boutonFermer.style.marginRight = "auto";

  //52
  boutonFermer.addEventListener("click", function () {
    document.body.removeChild(gifContainer);
  });

  gifContainer.appendChild(gif);
  gifContainer.appendChild(boutonFermer);
  document.body.appendChild(gifContainer);
}

//34
boutonLancer.addEventListener("click", function () {
  //35

  if (jeuEnCours) {
    const resultatDe = lancerDe();

    //36
    const emojiDe = faces[resultatDe - 1];

    ajouterAuHistorique(joueurActif, resultatDe);

    if (joueurActif === 1) {
      affichageDeJ1.textContent = emojiDe;
    } else {
      affichageDeJ2.textContent = emojiDe;
    }

    if (resultatDe === 1) {
      //37
      zoneMessage.textContent = `Dommage Joueur ${joueurActif}, vous avez fait 1... Tour suivant !`;

      changerJoueur();
    } else {
      //38
      scoreTour += resultatDe;

      zoneMessage.textContent = `Vous avez lance un ${resultatDe}. Score du tour : ${scoreTour}`;

      mettreAJourAffichage();
    }
  }
});

//39
boutonGarder.addEventListener("click", function () {
  if (jeuEnCours) {
    //45
    const scoreFutur =
      (joueurActif === 1 ? scoreTotalJ1 : scoreTotalJ2) + scoreTour;

    //46
    if (scoreFutur > 30) {
      zoneMessage.textContent = `Si tu gardes ${scoreFutur} points tu depasseras 30. Spam jusqu'à tomber sur 1 si tu veux pas perdre`;
      return;
    }

    //53
    if (scoreFutur === 29 && !confirmationScore29) {
      zoneMessage.innerHTML = `T'es pas tres fute fute hein ? Tu sais que si tu gardes 29 t'as litteralement perdu avant l'heure ? <br><button id="confirmer29" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Oui, je veux quand meme garder 29 (mauvaise idee hein)</button>`;

      //54
      const boutonConfirmer = document.getElementById("confirmer29");
      boutonConfirmer.addEventListener("click", function () {
        confirmationScore29 = true;
        boutonGarder.click();
      });

      return;
    }

    if (joueurActif === 1) {
      //40
      scoreTotalJ1 += scoreTour;
    } else {
      scoreTotalJ2 += scoreTour;
    }

    //41
    const scoreActuel = joueurActif === 1 ? scoreTotalJ1 : scoreTotalJ2;
    const scoreAvant = joueurActif === 1 ? scoreTotalJ1 - scoreTour : scoreTotalJ2 - scoreTour;

    //55
    if (scoreActuel === 29) {
      zoneMessage.textContent = `Joueur ${joueurActif} a garde 29 points... J'abandonne tu connais pas les règles`;
      afficherGifDefaite();
      changerJoueur();
      return;
    }

    //42 //47
    if (scoreActuel === 30) {
      //57
      if (scoreAvant === 0 && scoreTour === 30) {
        zoneMessage.textContent = `C'est ton jour de chance Joueur ${joueurActif}, tu devrais jouer au loto (si tu gagnes je veux ma com) !`;
      } else {
        zoneMessage.textContent = `Joueur ${joueurActif} a gagne avec exactement 30 points !`;
      }

      jeuEnCours = false;

      //43
      boutonLancer.disabled = true;
      boutonGarder.disabled = true;

      mettreAJourAffichage();
    } else if (scoreActuel >= 26 && scoreActuel < 29) {
      //56
      zoneMessage.textContent = `Ouh, ca devient interessant là ! Joueur ${joueurActif} a maintenant ${scoreActuel} points. Au tour du Joueur ${
        joueurActif === 1 ? 2 : 1
      }.`;

      changerJoueur();
    } else {
      zoneMessage.textContent = `Joueur ${joueurActif} garde ${scoreTour} points. Au tour du Joueur ${
        joueurActif === 1 ? 2 : 1
      }.`;

      changerJoueur();
    }
  }
});

//44
mettreAJourAffichage();

// Doc utilisee pour faire le tp :
// 1 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array
// 1 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/const

// 2 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Functions/Arrow_functions
// 2 - https://developer.mozilla.org/fr/docs/Web/API/Document/querySelector

// 3 - https://developer.mozilla.org/fr/docs/Web/API/Document/querySelector
// 3 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/const

// 4 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/let

// 5 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array
// 5 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/let

// 6 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 7 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Math/random

// 8 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Math/floor

// 9 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/return

// 10 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 11 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Strict_equality

// 12 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/if...else

// 13 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/push

// 14 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 15 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Logical_NOT

// 16 - https://developer.mozilla.org/fr/docs/Web/API/Document/createElement

// 17 - https://developer.mozilla.org/fr/docs/Web/API/HTMLElement/style

// 18 - https://developer.mozilla.org/fr/docs/Web/API/Node/appendChild

// 19 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/slice

// 20 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/length

// 21 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Conditional_operator

// 22 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Template_literals

// 23 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array/join

// 24 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 25 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Assignment

// 26 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Conditional_operator

// 27 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions#appeler_des_fonctions

// 28 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 29 - https://developer.mozilla.org/fr/docs/Web/API/Node/textContent

// 30 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Statements/if...else

// 31 - https://developer.mozilla.org/fr/docs/Web/API/Element/classList

// 32 - https://developer.mozilla.org/fr/docs/Web/API/DOMTokenList/remove

// 33 - https://developer.mozilla.org/fr/docs/Web/API/DOMTokenList/add

// 34 - https://developer.mozilla.org/fr/docs/Web/API/EventTarget/addEventListener

// 35 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 36 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Array#acceder_a_un_element_du_tableau

// 37 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Template_literals

// 38 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Addition_assignment

// 39 - https://developer.mozilla.org/fr/docs/Web/API/EventTarget/addEventListener

// 40 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Addition_assignment

// 41 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Conditional_operator

// 42 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Strict_equality

// 43 - https://developer.mozilla.org/fr/docs/Web/HTML/Attributes/disabled

// 44 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions#appeler_des_fonctions

// 45 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Conditional_operator

// 46 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Greater_than

// 47 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Strict_equality

// 48 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Guide/Functions

// 49 - https://developer.mozilla.org/fr/docs/Web/API/Document/createElement

// 50 - https://developer.mozilla.org/fr/docs/Web/API/HTMLImageElement/Image

// 51 - https://developer.mozilla.org/fr/docs/Web/API/Document/createElement

// 52 - https://developer.mozilla.org/fr/docs/Web/API/EventTarget/addEventListener

// 53 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Strict_equality

// 54 - https://developer.mozilla.org/fr/docs/Web/API/Document/getElementById

// 55 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Strict_equality

// 56 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Greater_than_or_equal

// 57 - https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Operators/Logical_AND