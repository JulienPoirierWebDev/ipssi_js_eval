// Tous les marchés
const marché_médiéval = [
  { name: 'Potion', price: 10, qty: 0 },
  { name: 'Épée', price: 50, qty: 0 },
  { name: 'Bouclier', price: 40, qty: 0 },
  { name: 'Herbe', price: 5, qty: 0 },
  { name: 'Elixir', price: 100, qty: 0 },
  { name: 'Accès Renaissance', price: 200, qty: 0 }
];

const marché_renaissance = [
  { name: 'Pistolet', price: 70, qty: 0 },
  { name: 'Armure', price: 120, qty: 0 },
  { name: 'Carte', price: 30, qty: 0 },
  { name: 'Boussole', price: 25, qty: 0 },
  { name: 'Tonneau de poudre', price: 200, qty: 0 },
  { name: 'Accès Modernité', price: 1000, qty: 0 }
];

const marché_modernité = [
  { name: 'Smartphone', price: 300, qty: 0 },
  { name: 'Ordinateur', price: 800, qty: 0 },
  { name: 'Drone', price: 150, qty: 0 },
  { name: 'Casque VR', price: 400, qty: 0 },
  { name: 'Imprimante 3D', price: 600, qty: 0 },
  { name: 'Accès Futuriste', price: 3000, qty: 0 }
];

const marché_futuriste = [
  { name: 'Téléporteur', price: 5000, qty: 0 },
  { name: 'Robot domestique', price: 3000, qty: 0 },
  { name: 'Exosquelette', price: 4000, qty: 0 },
  { name: 'Nanorobots', price: 2000, qty: 0 },
  { name: "Source d'énergie infinie", price: 10000, qty: 0 },
  { name: 'Accès Final', price: 8000, qty: 0 }
];

const marché_final = [
  { name: 'Objet Mystère', price: 9999, qty: 0 }
];

// Variables du jeu
let argentDuJoueur = 100;
let marcheActuel = marché_médiéval;
let marchesDebloques = ["marché_médiéval"];

// Fonction principale pour pouvoir afficher le marché
function afficherMarche() {
  const corpsDuTableau = document.getElementById("tableau_marche");
  corpsDuTableau.innerHTML = "";

  for (let i = 0; i < marcheActuel.length; i++) {
    const produit = marcheActuel[i];
    const ligne = document.createElement("tr");

    const nom = document.createElement("td");
    nom.textContent = produit.name;
    ligne.appendChild(nom);

    const prix = document.createElement("td");
    prix.textContent = produit.price;
    ligne.appendChild(prix);

    const quantite = document.createElement("td");
    quantite.textContent = produit.qty;
    ligne.appendChild(quantite);

    const actions = document.createElement("td");

    const boutonAcheter = document.createElement("button");
    boutonAcheter.textContent = "Acheter";
    boutonAcheter.onclick = function() {
      acheterProduit(i);
    };
    actions.appendChild(boutonAcheter);

    const boutonVendre = document.createElement("button");
    boutonVendre.textContent = "Vendre";
    boutonVendre.onclick = function() {
      vendreProduit(i);
    };
    actions.appendChild(boutonVendre);

    ligne.appendChild(actions);
    corpsDuTableau.appendChild(ligne);
  }

  document.getElementById("argent").textContent = " Argent : " + argentDuJoueur;
}

// Acheter un produit
function acheterProduit(index) {
  const produit = marcheActuel[index];
  if (argentDuJoueur >= produit.price) {
    argentDuJoueur -= produit.price;
    produit.qty += 1;
    afficherMessage("Tu as acheté un(e) " + produit.name + ".");

    // c'est pour avoir un nouveau marché
    if (produit.name.includes("Accès")) {
      debloquerMarche(produit.name);
    }

    // on fait cette condition pour dire qu'on a gagner le jeu
    if (produit.name === "Objet Mystère") {
      afficherMessage(" Tu as acheté l’objet mystère ! Tu as gagné !");
    }

  } else {
    afficherMessage("Pas assez d’argent !");
  }
  afficherMarche();
}

// la fonction pour vendre un produit
function vendreProduit(index) {
  const produit = marcheActuel[index];
  if (produit.qty > 0) {
    argentDuJoueur += produit.price;
    produit.qty -= 1;
    afficherMessage("Tu as vendu un(e) " + produit.name + ".");
  } else {
    afficherMessage("Tu n’as rien à vendre !");
  }
  afficherMarche();
}

// Ca c'est la variation des prix toutes les 2 secondes
function faireVarierLesPrix() {
  for (let i = 0; i < marcheActuel.length; i++) {
    const produit = marcheActuel[i];
    const changement = Math.floor(Math.random() * 20) - 10;
    produit.price += changement;
// on a mit cette ligne pour pas que le marché soit en négatif et ne fasse tout buger
    if (produit.price < 1) produit.price = 1;
  }
  afficherMarche();
}
setInterval(faireVarierLesPrix, 2000);

// Pour avoir un nouveau marché(chaque marché a sa condition mais la structure est identique a chaque fois)
function debloquerMarche(nomAcces) {
  const select = document.getElementById("choixMarche");

  if (nomAcces === "Accès Renaissance" && !marchesDebloques.includes("marché_renaissance")) {
    marchesDebloques.push("marché_renaissance");
    select.innerHTML += "<option value='marché_renaissance'>Renaissance</option>";
    afficherMessage(" Marché Renaissance débloqué !");
  }

  if (nomAcces === "Accès Modernité" && !marchesDebloques.includes("marché_modernité")) {
    marchesDebloques.push("marché_modernité");
    select.innerHTML += "<option value='marché_modernité'>Modernité</option>";
    afficherMessage(" Marché Modernité débloqué !");
  }

  if (nomAcces === "Accès Futuriste" && !marchesDebloques.includes("marché_futuriste")) {
    marchesDebloques.push("marché_futuriste");
    select.innerHTML += "<option value='marché_futuriste'>Futuriste</option>";
    afficherMessage(" Marché Futuriste débloqué !");
  }

  if (nomAcces === "Accès Final" && !marchesDebloques.includes("marché_final")) {
    marchesDebloques.push("marché_final");
    select.innerHTML += "<option value='marché_final'>Final</option>";
    afficherMessage(" Marché Final débloqué !");
  }
}

// Pour Changer de marché via le menu
function changerDeMarche() {
  const valeur = document.getElementById("choixMarche").value;
  if (valeur === "marché_médiéval") marcheActuel = marché_médiéval;
  if (valeur === "marché_renaissance") marcheActuel = marché_renaissance;
  if (valeur === "marché_modernité") marcheActuel = marché_modernité;
  if (valeur === "marché_futuriste") marcheActuel = marché_futuriste;
  if (valeur === "marché_final") marcheActuel = marché_final;
  afficherMarche();
}

// Message temporaire qui change toute les deux secondes
function afficherMessage(texte) {
  const zone = document.getElementById("message");
  zone.textContent = texte;
  setTimeout(() => zone.textContent = "", 2000);
}

afficherMarche()