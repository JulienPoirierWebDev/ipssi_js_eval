
let argent = 100000;


const marché_médiéval = [
  { name: 'Potion', price: 10, qty: 0 },
  { name: 'Épée', price: 50, qty: 0 },
  { name: 'Bouclier', price: 40, qty: 0 },
  { name: 'Herbe', price: 5, qty: 0 },
  { name: 'Elixir', price: 100, qty: 0 },
];

const marché_renaissance = [
  { name: 'Pistolet', price: 70, qty: 0 },
  { name: 'Armure', price: 120, qty: 0 },
  { name: 'Carte', price: 30, qty: 0 },
  { name: 'Boussole', price: 25, qty: 0 },
  { name: 'Tonneau de poudre', price: 200, qty: 0 },
];

const marché_modernité = [
  { name: 'Smartphone', price: 300, qty: 0 },
  { name: 'Ordinateur', price: 800, qty: 0 },
  { name: 'Drone', price: 150, qty: 0 },
  { name: 'Casque VR', price: 400, qty: 0 },
  { name: 'Imprimante 3D', price: 600, qty: 0 },
];

const marché_futuriste = [
  { name: 'Téléporteur', price: 5000, qty: 0 },
  { name: 'Robot domestique', price: 3000, qty: 0 },
  { name: 'Exosquelette', price: 4000, qty: 0 },
  { name: 'Nanorobots', price: 2000, qty: 0 },
  { name: "Source d'énergie infinie", price: 10000, qty: 0 },
];

const marché_final = [{ name: 'Objet Mystère', price: 9999, qty: 0 }];
// avoir un tableau de marché débloqué au lieu d'une variable marché actuel
//let marché_actuel = marché_médiéval;
// Cela permet de garder la totalité des marchés dans une variable qui ne contient que ceux débloqués
const marchés_débloqués = [marché_médiéval];

function renderItem(item, index, parent) {
  const tr = document.createElement('tr');
  // les onclick dans le HTML, c'est pas top, mieux vaut faire des addEventListener en JS
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.price}💲</td>
      <td>${item.qty}</td>
      <td>
        <button class="btn-acheter">Acheter</button>
        <button class="btn-vendre">Vendre</button>
      </td>
    `;
  
  const btnAcheter = tr.querySelector('.btn-acheter');
  const btnVendre = tr.querySelector('.btn-vendre');

  btnAcheter.addEventListener('click', () => acheter(item));
  btnVendre.addEventListener('click', () => vendre(item));

  parent.appendChild(tr);
}

function renderMarket() {
  const tbody = document.getElementById('market');
  tbody.innerHTML = ''; 

  for (const marché of marchés_débloqués) {
      marché.forEach((item, index) => {
    renderItem(item, index, tbody);
  });
  }



  document.getElementById('money').innerText = ` Argent : ${argent}`;
}


function acheter(item) {
  if (argent >= item.price) {
    argent -= item.price;
    item.qty++;
  } else {
    alert("Pas assez d'argent !");
  }
  renderMarket();
  // Vous faites le checkMarché ici alors que forcement, après un achat, on ne peut pas avoir plus d'argent qu'avant l'achat, donc on ne devrait jamais débloquer un marché après un achat
  checkMarché();
}


function vendre(item) {
  if (item.qty > 0) {
    item.qty--;
    argent += item.price;
  }
  // A l'inverse, il manque checkMarché ici, car après une vente, on peut potentiellement avoir assez d'argent pour débloquer un marché
  renderMarket();
}


setInterval(() => {
  for (const marché of marchés_débloqués) {
      marché.forEach(item => {
    const variation = Math.floor(Math.random() * 11) - 5; 
    item.price = Math.max(1, item.price + variation); 
  });
  }

  renderMarket();
}, 2000);


function checkMarché() {
  // checkMarché débloque un marché mais après, on ne peut pas revenir en arrière. Que deviennent les objets achetés dans les marchés précédents ? Soit il faut les vendre automatiquement, soit il faut les garder mais dans ce cas, il faut permettre de revenir en arrière dans les marchés.
  if (argent > 300 && marchés_débloqués.length === 1) {
    alert(' Marché Renaissance débloqué !');
    marchés_débloqués.push(marché_renaissance);
  } else if (argent > 1000 && marchés_débloqués.length === 2) {
    alert(' Marché Modernité débloqué !');
    marchés_débloqués.push(marché_modernité);
  } else if (argent > 5000 && marchés_débloqués.length === 3) {
    alert(' Marché Futuriste débloqué !');
    marchés_débloqués.push(marché_futuriste);
  } else if (argent > 10000 && marchés_débloqués.length === 4) {
    alert(' Marché Final débloqué !');
    marchés_débloqués.push(marché_final);
  }

  
  if (marchés_débloqués.length === 5 && marché_final[0].qty > 0) {
    alert(' Bravo ! Tu as acheté l’objet mystère et gagné le jeu !');
  }

  renderMarket();
}


renderMarket();

