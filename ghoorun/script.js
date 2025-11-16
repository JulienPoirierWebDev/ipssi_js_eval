const marche_medieval = [
	{ nom: 'Potion', prix: 10, quantité: 0 },
	{ nom: 'Epee', prix: 50, quantité: 0 },
	{ nom: 'Bouclier', prix: 40, quantité: 0 },
	{ nom: 'Herbe', prix: 5, quantité: 0 },
	{ nom: 'Elixir', prix: 100, quantité: 0 },
];

const marche_renaissance = [
	{ nom: 'Pistolet', prix: 70, quantité: 0 },
	{ nom: 'Armure', prix: 120, quantité: 0 },
	{ nom: 'Carte', prix: 30, quantité: 0 },
	{ nom: 'Boussole', prix: 25, quantité: 0 },
	{ nom: 'Tonneau', prix: 200, quantité: 0 },
];

const marche_modernite = [
	{ nom: 'Smartphone', prix: 300, quantité: 0 },
	{ nom: 'Ordinateur', prix: 800, quantité: 0 },
	{ nom: 'Drone', prix: 150, quantité: 0 },
	{ nom: 'Casque VR', prix: 400, quantité: 0 },
	{ nom: 'Imprimante 3D', prix: 600, quantité: 0 },
];

const marche_futuriste = [
	{ nom: 'Teleporteur', prix: 5000, quantité: 0 },
	{ nom: 'Robot domestique', prix: 3000, quantité: 0 },
	{ nom: 'Exosquelette', prix: 4000, quantité: 0 },
	{ nom: 'Nanorobots', prix: 2000, quantité: 0 },
	{ nom: 'Source energie', prix: 10000, quantité: 0 },
];

const marche_final = [{ nom: 'Objet Mystere', prix: 9999, quantité: 0 }];

const niveauxNoms = [
	'Médiéval',
	'Renaissance',
	'Modernité',
	'Futuriste',
	'Mystère',
];

let argent = 100;
// malin !
let niveau = 0;
let marcheActuel = copieMarche(marche_medieval);
let intervalId;

const tbody = document.getElementById('market');
const affichageArgent = document.getElementById('money');
const affichageNiveau = document.getElementById('niveau-nom');
const deblocageZone = document.getElementById('deblocage-zone');

function copieMarche(source) {
	return source.map((objet) => ({
		nom: objet.nom,
		prix: objet.prix,
		quantité: objet.quantité,
	}));
}

function updateArgent() {
	affichageArgent.textContent = '💵 Argent : ' + argent;
}

function updateNiveau() {
	affichageNiveau.textContent = niveauxNoms[niveau];
	afficherBoutonDeblocage();
}

function afficherBoutonDeblocage() {
	deblocageZone.textContent = '';

	let coutDeblocage, bonusDeblocage, prochainNom;

	if (niveau === 0) {
		coutDeblocage = 200;
		bonusDeblocage = 100;
		prochainNom = 'Renaissance';
	} else if (niveau === 1) {
		coutDeblocage = 1000;
		bonusDeblocage = 500;
		prochainNom = 'Modernité';
	} else if (niveau === 2) {
		coutDeblocage = 5000;
		bonusDeblocage = 2000;
		prochainNom = 'Futuriste';
	} else if (niveau === 3) {
		coutDeblocage = 9999;
		bonusDeblocage = 0;
		prochainNom = 'Mystère';
	} else {
		return;
	}

	const bouton = document.createElement('button');
	bouton.style.padding = '0.5rem 1rem';
	bouton.style.fontSize = '1rem';
	bouton.textContent = `🔓 Débloquer ${prochainNom} (${coutDeblocage} 💵)`;

	if (bonusDeblocage > 0) {
		bouton.textContent += ` +${bonusDeblocage} 🎁`;
	}

	if (argent < coutDeblocage) {
		bouton.disabled = true;
		bouton.textContent = `🔒 ${prochainNom} (${coutDeblocage} 💵)`;
	}

	bouton.addEventListener('click', () => debloquerNiveau());
	deblocageZone.appendChild(bouton);
}

function creerBouton(texte) {
	const bouton = document.createElement('button');
	bouton.textContent = texte;
	return bouton;
}

function renderOneMarket(marché, parent) {
	for (let i = 0; i < marché.length; i++) {
		// j'aime pas trop les noms de variables composés d'une seule lettre. On ne sait jamais ce que ça représente.
		const p = marché[i];
		const tr = document.createElement('tr');

		const tdNom = document.createElement('td');
		tdNom.textContent = p.nom;
		tr.appendChild(tdNom);

		const tdPrix = document.createElement('td');
		tdPrix.textContent = p.prix + ' 💵';
		tr.appendChild(tdPrix);

		const tdQuantité = document.createElement('td');
		tdQuantité.textContent = p.quantité;
		tr.appendChild(tdQuantité);

		const tdActions = document.createElement('td');

		const boutonAcheter = creerBouton('Acheter');
		if (argent < p.prix) boutonAcheter.disabled = true;
		boutonAcheter.addEventListener('click', () => acheter(marché, i));

		const boutonVendre = creerBouton('Vendre');
		if (p.quantité === 0) boutonVendre.disabled = true;
		boutonVendre.addEventListener('click', () => vendre(marché,i));

		tdActions.appendChild(boutonAcheter);
		tdActions.appendChild(boutonVendre);
		tr.appendChild(tdActions);
		parent.appendChild(tr);
	}



}

function renderMarket() {
	tbody.textContent = '';
	
	renderOneMarket(marche_medieval, tbody);
	
	if (niveau > 0) {
		renderOneMarket(marche_renaissance, tbody);
	}
	if (niveau > 1) {
		renderOneMarket(marche_modernite, tbody);
	} 
	if (niveau > 2) {
		renderOneMarket(marche_futuriste, tbody);
	}
	if (niveau > 3) {
		renderOneMarket(marche_final, tbody);
	}
		updateArgent();
	updateNiveau();
}

function acheter(marché, i) {
	const item = marché[i];
	if (argent >= item.prix) {
		item.quantité = item.quantité + 1;
		argent = argent - item.prix;
		renderMarket();
		verifierDeblocage();
	} else {
		alert("Tu peu pas t'es pauvre.🤣");
	}
}

function vendre(marché, i) {
	const item = marché[i];
	if (item.quantité > 0) {
		item.quantité = item.quantité - 1;
		argent = argent + item.prix;
		renderMarket();
		verifierDeblocage();
	}
}

function variationDesPrixDesMarchés() {
		
	variationDesPrixDUnMarché(marche_medieval);
	
	if (niveau > 0) {
		variationDesPrixDUnMarché(marche_renaissance);
	} 
	if (niveau > 1) {
		variationDesPrixDUnMarché(marche_modernite);
	}
	if (niveau > 2) {
		variationDesPrixDUnMarché(marche_futuriste);
	}
	if (niveau > 3) {
		variationDesPrixDUnMarché(marche_final);
	}
}

function variationDesPrixDUnMarché(marché) {
	// Ce morceau de code n'est pas trés clair. Les noms des variables pourraient être améliorés.
	for (let i = 0; i < marché.length; i++) {
		const v = Math.floor(Math.random() * 11) - 5;
		let np = marché[i].prix + v;
		if (np < 1) np = 1;
		marché[i].prix = np;
	}
}

function demarrerVariationPrix() {
	if (intervalId) clearInterval(intervalId);
	
	intervalId = setInterval(() => {
		variationDesPrixDesMarchés();
		renderMarket();
	}, 2000);
}

function verifierDeblocage() {
	afficherBoutonDeblocage();
}

// Ce qui est dommage ici c'est que les objets achetés au niveau précédent sont perdus, on ne les garde pas. Donc soit vous les vendez automatiquement avant de débloquer le niveau suivant, soit vous faites en sortes que l'on puisse les garder pour les revendre plus tard.
function debloquerNiveau() {
	if (niveau === 0 && argent >= 200) {
		clearInterval(intervalId);
		argent = argent - 200 + 100;
		niveau = 1;
		marcheActuel = copieMarche(marche_renaissance);
		renderMarket();
		demarrerVariationPrix();
	} else if (niveau === 1 && argent >= 1000) {
		clearInterval(intervalId);
		argent = argent - 1000 + 500;
		niveau = 2;
		marcheActuel = copieMarche(marche_modernite);
		renderMarket();
		demarrerVariationPrix();
	} else if (niveau === 2 && argent >= 5000) {
		clearInterval(intervalId);
		argent = argent - 5000 + 2000;
		niveau = 3;
		marcheActuel = copieMarche(marche_futuriste);
		renderMarket();
		demarrerVariationPrix();
	} else if (niveau === 3 && argent >= 9999) {
		clearInterval(intervalId);
		argent = argent - 9999;
		niveau = 4;
		marcheActuel = copieMarche(marche_final);
		renderMarket();
		alert('🎉🎉🎉 BRAVO ! TU AS GAGNÉ ! 🎉🎉🎉');
	}
}

renderMarket();
demarrerVariationPrix();
