// Étape 1️⃣ : créer un tableau d'objets pour les produits
// Exemple : { name: 'Potion', price: 10, qty: 0 }

// Étape 2️⃣ : écrire une fonction renderMarket()
// Elle crée dynamiquement le tableau <tr> pour chaque objet

// Étape 3️⃣ : ajouter des boutons "Acheter" et "Vendre"
// Au clic, modifier la quantité et l'argent du joueur

// Étape 4️⃣ : faire varier les prix toutes les 2 secondes
// Exemple : ajouter ou retirer quelques unités aléatoires

// Etape 5️⃣ : Permettre d'acheter l'accès a un nouveau marché avec plus d'objets : marché_renaissance, marché_modernité, marché_futuriste

// Etape 6 : Quand on achète l'objet mystère, on a gagné !

// Étape 7 : bonus - empêcher d'acheter si argent insuffisant

const marché_médiéval=[{name:'Potion',price:10,qty:0},{name:'Épée',price:50,qty:0},{name:'Bouclier',price:40,qty:0},{name:'Herbe',price:5,qty:0},{name:'Elixir',price:100,qty:0}];
const marché_renaissance=[{name:'Pistolet',price:70,qty:0},{name:'Armure',price:120,qty:0},{name:'Carte',price:30,qty:0},{name:'Boussole',price:25,qty:0},{name:'Tonneau de poudre',price:200,qty:0}];
const marché_modernité=[{name:'Smartphone',price:300,qty:0},{name:'Ordinateur',price:800,qty:0},{name:'Drone',price:150,qty:0},{name:'Casque VR',price:400,qty:0},{name:'Imprimante 3D',price:600,qty:0}];
const marché_futuriste=[{name:'Téléporteur',price:5000,qty:0},{name:'Robot domestique',price:3000,qty:0},{name:'Exosquelette',price:4000,qty:0},{name:'Nanorobots',price:2000,qty:0},{name:"Source d'énergie infinie",price:10000,qty:0}];
const marché_final=[{name:'Objet Mystère',price:9999,qty:0}];


let money=100;
let currentMarket="medieval";
let unlocked={medieval:true,renaissance:false,modernité:false,futuriste:false,final:false};


const tbody=document.getElementById("market");
const moneyDisplay=document.getElementById("money");
const buySound=document.getElementById("buySound");
const sellSound=document.getElementById("sellSound");


function getMarket(){
    switch(currentMarket){
        case"medieval": return marché_médiéval;
        case"renaissance": return marché_renaissance;
        case"modernité": return marché_modernité;
        case"futuriste": return marché_futuriste;
        case"final": return marché_final;
    }
}


function renderMarket(){
    const market=getMarket();
    tbody.innerHTML="";
    market.forEach((item,index)=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${item.name}</td><td>${item.price}</td><td>${item.qty}</td><td><button onclick="buyItem(${index})">Acheter</button><button onclick="sellItem(${index})">Vendre</button></td>`;
        tbody.appendChild(tr);
    });
    moneyDisplay.textContent="💵 Argent : "+money;
}

function buyItem(i){
    const market=getMarket();
    const item=market[i];
    if(money<item.price) return alert("Pas assez d'argent !");
    money-=item.price;
    item.qty++;
    buySound.play();
    if(item.name==="Objet Mystère") alert("🎉 TU AS GAGNÉ !");
    renderMarket();
}


function sellItem(i){
    const market=getMarket();
    const item=market[i];
    if(item.qty<=0) return;
    item.qty--;
    money+=item.price;
    sellSound.play();
    renderMarket();
}


function updatePrices(market){
    market.forEach(item=>{
        let variation = Math.random() * 0.4 - 0.2; // -20% à +20%
        let delta = Math.round(item.price * variation);
        if(delta === 0) delta = (variation > 0 ? 1 : -1); // au moins ±1 pour petits objets
        item.price = Math.max(1, item.price + delta);
    });
}
setInterval(()=>{updatePrices(getMarket());renderMarket();},2000);


function unlockOrChange(marketName, cost){
    if(!unlocked[marketName]){
        if(money>=cost){
            money-=cost;
            unlocked[marketName]=true;
            alert(`Marché ${marketName} débloqué !`);
        } else {
            return alert("Pas assez d'argent pour débloquer ce marché !");
        }
    }
    currentMarket=marketName;
    renderMarket();
}

renderMarket();
