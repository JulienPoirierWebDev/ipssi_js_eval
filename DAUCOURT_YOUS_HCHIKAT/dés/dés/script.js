const facesDeDe = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const boutonLancerDe = document.getElementById('roll');
const boutonGarderScore = document.getElementById('hold');
const affichageResultat = document.getElementById('roundResult');
const boiteJoueur1 = document.getElementById('player1');
const boiteJoueur2 = document.getElementById('player2');
const scoreTotalJoueur1 = document.getElementById('p1-total');
const scoreTotalJoueur2 = document.getElementById('p2-total');
const scoreTourJoueur1 = document.getElementById('p1-round');
const scoreTourJoueur2 = document.getElementById('p2-round');

let scoresTotaux = [0, 0];
let scoreActuelDuTour = 0;
let numeroJoueurActif = 1;
const scoreVictoire = 30;


function changerDeJoueur() {
  scoreActuelDuTour = 0;
  document.getElementById(`p${numeroJoueurActif}-round`).textContent = 0;
  

  document.getElementById(`player${numeroJoueurActif}`).classList.remove('active');
  
 
  numeroJoueurActif = numeroJoueurActif === 1 ? 2 : 1;

  document.getElementById(`player${numeroJoueurActif}`).classList.add('active');
}


boutonLancerDe.addEventListener('click', () => {
  const valeurDe = lancerLeDé();
  
  mettreAJourLaValeurDuDé(valeurDe);  
  if (valeurDe !== 1) {
    leDéNeTombePasSurLe1(valeurDe);
  } else {
    leDéTombeSurLe1();
  }
   
});

function lancerLeDé() {
  return Math.floor(Math.random() * 6) + 1;
}

function mettreAJourLaValeurDuDé(valeurDe) {
  document.getElementById(`p${numeroJoueurActif}-dice`).textContent = facesDeDe[valeurDe - 1];
}

function leDéNeTombePasSurLe1(valeurDe) {
  scoreActuelDuTour += valeurDe;
  document.getElementById(`p${numeroJoueurActif}-round`).textContent = scoreActuelDuTour;
  affichageResultat.textContent = `Joueur ${numeroJoueurActif} a obtenu ${valeurDe}`;
}

function leDéTombeSurLe1() {
  affichageResultat.textContent = `Oh non ! Joueur ${numeroJoueurActif} a fait 1 :(`;
  changerDeJoueur();
}


boutonGarderScore.addEventListener('click', () => {
  mettreAJourLesScores();
  
  const jeuEstTerminé = vérifierSiLeJeuEstTerminé();
  if (jeuEstTerminé) {
    finirLeJeu();
  } else {
    changerDeJoueur();
  }
});

function mettreAJourLesScores() {
  scoresTotaux[numeroJoueurActif - 1] += scoreActuelDuTour;
  document.getElementById(`p${numeroJoueurActif}-total`).textContent = scoresTotaux[numeroJoueurActif - 1];
}

function vérifierSiLeJeuEstTerminé() {
  return scoresTotaux[numeroJoueurActif - 1] >= scoreVictoire
}
  
function finirLeJeu() {
  affichageResultat.textContent = `🏆 Joueur ${numeroJoueurActif} a gagné !`;
  boutonLancerDe.disabled = true;
  boutonGarderScore.disabled = true;
}


boiteJoueur1.classList.add('active');