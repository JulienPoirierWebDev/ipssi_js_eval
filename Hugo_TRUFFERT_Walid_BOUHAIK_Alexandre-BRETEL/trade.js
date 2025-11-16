
let argent = 100;


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


let marché_actuel = marché_médiéval;


function renderMarket() {
  const tbody = document.getElementById('market');
  tbody.innerHTML = ''; 

  marché_actuel.forEach((item, index) => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.price}💲</td>
      <td>${item.qty}</td>
      <td>
        <button onclick="acheter(${index})">Acheter</button>
        <button onclick="vendre(${index})">Vendre</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById('money').innerText = ` Argent : ${argent}`;
}


function acheter(index) {
  const item = marché_actuel[index];
  if (argent >= item.price) {
    argent -= item.price;
    item.qty++;
  } else {
    alert("Pas assez d'argent !");
  }
  renderMarket();
  checkMarché();
}


function vendre(index) {
  const item = marché_actuel[index];
  if (item.qty > 0) {
    item.qty--;
    argent += item.price;
  }
  renderMarket();
}


setInterval(() => {
  marché_actuel.forEach(item => {
    const variation = Math.floor(Math.random() * 11) - 5; 
    item.price = Math.max(1, item.price + variation); 
  });
  renderMarket();
}, 2000);


function checkMarché() {
  if (argent > 300 && marché_actuel === marché_médiéval) {
    alert(' Marché Renaissance débloqué !');
    marché_actuel = marché_renaissance;
  } else if (argent > 1000 && marché_actuel === marché_renaissance) {
    alert(' Marché Modernité débloqué !');
    marché_actuel = marché_modernité;
  } else if (argent > 5000 && marché_actuel === marché_modernité) {
    alert(' Marché Futuriste débloqué !');
    marché_actuel = marché_futuriste;
  } else if (argent > 10000 && marché_actuel === marché_futuriste) {
    alert(' Marché Final débloqué !');
    marché_actuel = marché_final;
  }

  
  if (marché_actuel === marché_final && marché_actuel[0].qty > 0) {
    alert(' Bravo ! Tu as acheté l’objet mystère et gagné le jeu !');
  }

  renderMarket();
}


renderMarket();

