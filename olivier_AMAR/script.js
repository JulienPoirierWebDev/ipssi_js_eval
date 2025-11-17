const audio = document.createElement("audio");
audio.src = "assets/music/introductionost.mp3";
audio.autoplay = true;
audio.loop = true;
audio.id = "music";
document.body.appendChild(audio);

audio.play() // la musique de fond
audio.volume = 0.2; 

let youwin = false 

// les variables les plus bordelique de se code (je suis pas habitué a faire de long projet)
let gametitle 
let todayday =0

const contratdetravail = document.createElement("img");
contratdetravail.src = "assets/pictures/contratdetravail.png";
contratdetravail.style.width = "17%"; 
contratdetravail.style.position = "absolute";
contratdetravail.style.top = "50%";
contratdetravail.style.left = "18%";
contratdetravail.style.transform = "translate(-50%, -50%)";


const boosterpokemonimage = document.createElement("img");
boosterpokemonimage.src = "assets/pictures/boosterpkm.png";
boosterpokemonimage.style.width = "10%"; 
boosterpokemonimage.style.position = "absolute";
boosterpokemonimage.style.top = "50%";
boosterpokemonimage.style.left = "18%";
boosterpokemonimage.style.transform = "translate(-50%, -50%)";


const flecheordinateur = document.createElement("img");
flecheordinateur.src = "assets/pictures/flechevershaut.png";
flecheordinateur.style.width = "22%"; 
flecheordinateur.style.position = "absolute";
flecheordinateur.style.top = "15%";
flecheordinateur.style.left = "85%";
flecheordinateur.style.transform = "translate(-50%, -50%) rotate(-30deg)";

const skipdaypicture = document.createElement("img");
skipdaypicture.src = "assets/pictures/daytimeskip.png";
skipdaypicture.style.width = "5%"; 
skipdaypicture.style.position = "absolute";
skipdaypicture.style.top = "5%";
skipdaypicture.style.left = "10%";
skipdaypicture.style.transform = "translate(-50%, -50%)";






let playerdata = {// les données du joueur 
    money: 150,
    boosters:0,
    boosterstoday:0,
    moneymultiplier:1,
    reductionprix:1,
    unlockskipday:false,
    day:0,
    keptcardsid:[],
    buyeddabug:false
}

const money = document.createElement("div");
money.id = "moneyDisplay";
money.textContent = playerdata.money+"$"; 
money.style.position = "absolute";
money.style.top = "10px";
money.style.left = "10px";
money.style.fontSize = "24px";
money.style.fontWeight = "bold";
money.style.color = "white";
money.style.fontFamily = "Arial, sans-serif";
money.style.textShadow = "2px 2px 4px black";

document.body.appendChild(money);

const nbrboosterposseder = document.createElement("div");
nbrboosterposseder.id = "booster";
nbrboosterposseder.textContent = playerdata.boosters+" en route"; 
nbrboosterposseder.style.position = "absolute";
nbrboosterposseder.style.top = "35px";
nbrboosterposseder.style.left = "10px";
nbrboosterposseder.style.fontSize = "24px";
nbrboosterposseder.style.fontWeight = "bold";
nbrboosterposseder.style.color = "white";
nbrboosterposseder.style.fontFamily = "Arial, sans-serif";
nbrboosterposseder.style.textShadow = "2px 2px 4px black";

document.body.appendChild(nbrboosterposseder);


//-------------------------------------------------------------
//je savait pas faire le script attendre, j'ai du apprendre de google (j'ai pris 1 heure a realiser que mes fonction doivent être async)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//-------------------------------------------------------------
let narratorbeggining = new Audio("assets/NarratorVoicelines/begginingbeforecontract.m4a");
narratorbeggining.play();

let papersfxopen = new Audio("assets/sfx/takingpaper.m4a")
let papersfxclose = new Audio("assets/sfx/removingpaper.m4a")

let firsttime = true

let papierdujour =["contratdetravail","messagedujour1","messagedujour2","messagedujour3","messagedujour4"] // chaque jour un nouveau message du patron

let token =0

let wenttocomputer = false


let jour=0
function daycycle(today){
    playerdata.boosterstoday=playerdata.boosters
    playerdata.boosters=0
    nbrboosterposseder.textContent = playerdata.boosters+" en route"; 
    contratdetravail.src = "assets/pictures/"+papierdujour[today]+".png"
    contratdetravail.style.width = "17%"; 
    contratdetravail.style.top = "50%";
    contratdetravail.style.left = "18%";
    if (playerdata.boosterstoday>0){
        document.body.appendChild(boosterpokemonimage)
    }
    document.body.appendChild(contratdetravail); 
    jour++
    
}



const shopbutton = document.createElement("img");
shopbutton.src = "assets/pictures/Shoplogo.png";
shopbutton.style.width = "20%"; 
shopbutton.style.position = "absolute";
shopbutton.style.top = "30%";
shopbutton.style.left = "30%";
shopbutton.style.transform = "translate(-50%, -50%)";

const experienceofparenthood = document.createElement("img");
experienceofparenthood.src = "assets/pictures/family.png";
experienceofparenthood.style.width = "20%"; 
experienceofparenthood.style.position = "absolute";
experienceofparenthood.style.top = "30%";
experienceofparenthood.style.left = "50%";
experienceofparenthood.style.transform = "translate(-50%, -50%)";

const actualitemshopbutton = document.createElement("img");
actualitemshopbutton.src = "assets/pictures/actualitemshop.png";
actualitemshopbutton.style.width = "20%"; 
actualitemshopbutton.style.position = "absolute";
actualitemshopbutton.style.top = "30%";
actualitemshopbutton.style.left = "70%";
actualitemshopbutton.style.transform = "translate(-50%, -50%)";

let clickarrow = new Audio("assets/sfx/actuallypressingbutton.m4a") //sfx des que tu clique la fleche dorée

function computergraphics(status, fromapplication){
    if (status=="on") {
        document.body.appendChild(shopbutton)
        document.body.appendChild(experienceofparenthood)
        flecheordinateur.style.top = "75%";
        flecheordinateur.style.left = "7%";
        flecheordinateur.style.transform = "translate(-50%, -50%) rotate(-250deg)";
        clickarrow.play()
        if (youwin == true){
            gametitle.textContent="You Win"
            document.body.appendChild(gametitle);
        }
        if (fromapplication==true){
                document.body.appendChild(flecheordinateur)
            return
        }
        if (playerdata.boosterstoday>0){
            boosterpokemonimage.remove()
        }
        if (jour>1){
            document.body.appendChild(actualitemshopbutton)
        }
    } else  {
        shopbutton.remove()
        experienceofparenthood.remove()
        actualitemshopbutton.remove()
        clickarrow.play()
        if (youwin == true){
            gametitle.remove()
        }
        if (fromapplication==true){
            flecheordinateur.remove()
            return
        }
        if (playerdata.boosterstoday>0){
            document.body.appendChild(boosterpokemonimage)
        }
        if (jour>1){
            actualitemshopbutton.remove()
        }
        flecheordinateur.style.top = "15%";
        flecheordinateur.style.left = "85%";
        flecheordinateur.style.transform = "translate(-50%, -50%) rotate(-30deg)";
    }
}

shopbutton.addEventListener("mouseenter", () => {
  shopbutton.style.width = "25%"; 
});

shopbutton.addEventListener("mouseleave", () => {
  shopbutton.style.width = "20%"; 
});

experienceofparenthood.addEventListener("mouseenter", () => {
  experienceofparenthood.style.width = "25%"; 
});

experienceofparenthood.addEventListener("mouseleave", () => {
  experienceofparenthood.style.width = "20%"; 
});

actualitemshopbutton.addEventListener("mouseenter", () => {
    new Audio("assets/sfx/fish.m4a").play();
})



const dabug = document.createElement("img");
dabug.src = "assets/pictures/oopsjaioublierunbug.png";
dabug.style.width = "20%"; 
dabug.style.position = "absolute";
dabug.style.top = "60%";
dabug.style.left = "70%";
dabug.style.transform = "translate(-50%, -50%)";

const toothpick = document.createElement("img");
toothpick.src = "assets/pictures/toothpick.png";
toothpick.style.width = "10%"; 
toothpick.style.position = "absolute";
toothpick.style.top = "30%";
toothpick.style.left = "35%";
toothpick.style.transform = "translate(-50%, -50%)";


function itemshop(){
    computergraphics("off", true)
    gametitle = document.createElement("p");
    gametitle.className = "pixelbaseText";
    gametitle.textContent = "THE ITEM SHOP";
    document.body.append(gametitle)

    document.body.appendChild(toothpick)
    document.body.appendChild(dabug)
}


actualitemshopbutton.addEventListener("click", () => {
    itemshop()
})

const firepng = document.createElement("img");
    firepng.src = "assets/pictures/fire.png";
    firepng.style.width = "20%";
    firepng.style.position = "absolute";
    firepng.style.top = "30%";
    firepng.style.left = "30%";
    firepng.style.transform = "translate(-50%, -50%)";

    const babypng = document.createElement("img");
    babypng.src = "assets/pictures/baby.png";
    babypng.style.width = "10%";
    babypng.style.position = "absolute";
    babypng.style.top = "30%";
    babypng.style.left = "70%"; 
    babypng.style.transform = "translate(-50%, -50%)";

    const redbutonpng = document.createElement("img");
    redbutonpng.src = "assets/pictures/coolredbutton.png";
    redbutonpng.style.width = "10%";
    redbutonpng.style.position = "absolute";
    redbutonpng.style.top = "60%";
    redbutonpng.style.left = "50%";
    redbutonpng.style.cursor = "pointer";
    redbutonpng.style.transform = "translate(-50%, -50%)";

    const closebutton = document.createElement("img");
    closebutton.src = "assets/pictures/closebutton.png";
    closebutton.style.width = "10%";
    closebutton.style.position = "absolute";
    closebutton.style.top = "50%";
    closebutton.style.left = "50%";
    closebutton.style.cursor = "pointer";
    closebutton.style.transform = "translate(-50%, -50%)";

    const buybutton = document.createElement("img");
    buybutton.src = "assets/pictures/buyicon.png";
    buybutton.style.width = "10%";
    buybutton.style.position = "absolute";
    buybutton.style.top = "80%";
    buybutton.style.left = "30%";
    buybutton.style.cursor = "pointer";
    buybutton.style.transform = "translate(-50%, -50%)";

let description
let text

closebutton.addEventListener("click", () => {
    firepng.remove()
    babypng.remove()
    redbutonpng.remove()
    closebutton.remove()
    gametitle.remove()
    description.remove()
    text.remove()
    computergraphics("on", true)
})


let expparenthoodstatus=0
function experienceofparenthoodgameengine(expparenthoodstatus){
    computergraphics("off", true)
    document.body.appendChild(firepng)
    document.body.appendChild(babypng)
    document.body.appendChild(redbutonpng)

    gametitle = document.createElement("p");
    gametitle.className = "pixelbaseText";
    gametitle.textContent = "THE EXPERIENCE OF PARENTHOOD";
    document.body.appendChild(gametitle);

    description = document.createElement("p");
    description.className = "pixelbaseText";
    description.textContent = "the real experience starts 4 hours in";

    description.style.top = "70%";  
    description.style.left = "50%";     

    document.body.appendChild(description)

    text = document.createElement("div");
    text.className = "pixelText";
    text.innerText = "DON'T LET GO";
    document.body.appendChild(text);



    document.body.appendChild(text);
    if (expparenthoodstatus==0){
        narratorbeggining = new Audio("assets/NarratorVoicelines/clickedexperienceofparenthood.m4a");
        narratorbeggining.play();
    }
    if (expparenthoodstatus==1){
        narratorbeggining = new Audio("assets/NarratorVoicelines/clicksagainexperienceofparenthood.m4a");
        narratorbeggining.play();
    }
    document.body.appendChild(firepng);
    document.body.appendChild(babypng);
    document.body.appendChild(redbutonpng);

    let babyPos = 70; 
    let speed = 0.05;    

    redbutonpng.addEventListener("click", () => {
        babyPos = 70;      
        babypng.style.left = babyPos + "%";
    });
    const gameLoop = setInterval(() => {
        babyPos -= speed;
        babypng.style.left = babyPos + "%";
        const babyRect = babypng.getBoundingClientRect(); 
        const fireRect = firepng.getBoundingClientRect();

        if ( babyRect.right > fireRect.left && babyRect.left < fireRect.right ) {
            clearInterval(gameLoop);
            if (expparenthoodstatus==0){
            narratorbeggining = new Audio("assets/NarratorVoicelines/staysinexperienceofparenthood.m4a")
            narratorbeggining.play();}
            document.body.appendChild(closebutton)
        }
    }, 16); 
}



experienceofparenthood.addEventListener("click", ()=>{
    experienceofparenthoodgameengine(expparenthoodstatus)
    expparenthoodstatus++
})


    const boostershop = document.createElement("img");
    boostershop.src = "assets/pictures/boosterpkm.png";
    boostershop.style.width = "15%";
    boostershop.style.position = "absolute";
    boostershop.style.top = "50%";
    boostershop.style.left = "30%";
    boostershop.style.cursor = "pointer";
    boostershop.style.transform = "translate(-50%, -50%)";

function drawPriceGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 3;

    for (let i = 1; i < priceHistory.length; i++) {
        let previousValue = priceHistory[i - 1];
        let currentValue  = priceHistory[i];
        let prevX = (i - 1) * pointSpacing;
        let prevY = canvas.height - previousValue * heightMultiplier;
        let x = i * pointSpacing;
        let y = canvas.height - currentValue * heightMultiplier;
        ctx.strokeStyle = currentValue > previousValue ? "green" : "red";
        ctx.fillStyle = ctx.strokeStyle;

        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}


const price = document.createElement("div");
price.id = "moneyDisplay";

price.style.position = "absolute";
price.style.top = "68%";
price.style.left = "60%";
price.style.fontSize = "40px";
price.style.fontWeight = "bold";
price.style.color = "white";
price.style.fontFamily = "Arial, sans-serif";
price.style.textShadow = "2px 2px 4px black";

const canvas = document.createElement("canvas");
canvas.id = "priceGraph";
canvas.width = 600;
canvas.height = 300;
canvas.style.border = "3px solid white";
canvas.style.position = "absolute";
canvas.style.top = "50%";
canvas.style.left = "60%";
canvas.style.transform = "translate(-50%, -50%)";

let boosterPrice = 50;
let priceHistory = [boosterPrice];
const maxPoints = 30;
const ctx = canvas.getContext("2d");

function randombetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

let marketroof=130
let marketground=20

function updateBoosterPrice() {
    let randomChange 
    if (boosterPrice>marketroof){ // pour eviter que le marché aille trop loin, peut etre un item dans le shop dans le future pour le changer
        randomChange =randombetween(-75, 0)
    }
    if (boosterPrice<marketground){
        randomChange =randombetween(0,75)
    } else {
        randomChange = randombetween(-20, 20)
    }
    boosterPrice = Math.max(1, boosterPrice + randomChange);
    price.textContent = boosterPrice+"$";

    priceHistory.push(boosterPrice);
    if (priceHistory.length > maxPoints) priceHistory.shift();

    drawPriceGraph();
}


function drawPriceGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 3;

    for (let i = 1; i < priceHistory.length; i++) {
        let prev = priceHistory[i - 1];
        let current = priceHistory[i];

        let x1 = ((i - 1) / maxPoints) * canvas.width;
        let y1 = canvas.height - prev * 2;

        let x2 = (i / maxPoints) * canvas.width;
        let y2 = canvas.height - current * 2;

        ctx.strokeStyle = current >= prev ? "lime" : "red";

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(x2, y2, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
let buyboosterstatus=0
function buybooster(){
    if (playerdata.money>=boosterPrice){
        playerdata.money= playerdata.money-boosterPrice
        playerdata.boosters++
        money.textContent = playerdata.money+"$"
        nbrboosterposseder.textContent = playerdata.boosters+" en route"; 
        new Audio("assets/sfx/money.m4a").play();
    }
    if (buyboosterstatus==0){
        playerdata.unlockskipday=true
        new Audio("assets/NarratorVoicelines/skipdaydialogue.m4a").play();
    }

}
buybutton.addEventListener("click", () => {
    buybooster()
    buyboosterstatus++
})

let didnotbuy = false
const funyredarrow = document.createElement("img");
funyredarrow.src = "assets/pictures/redarrow.png";
funyredarrow.style.width = "15%";
funyredarrow.style.position = "absolute";
funyredarrow.style.top = "75%";
funyredarrow.style.left = "20%";
funyredarrow.style.cursor = "pointer";
funyredarrow.style.transform = "translate(-50%, -50%)";

const closebutton2 = document.createElement("img");
closebutton2.src = "assets/pictures/closebutton.png";
closebutton2.style.width = "10%";
closebutton2.style.position = "absolute";
closebutton2.style.top = "30%";
closebutton2.style.left = "70%";
closebutton2.style.cursor = "pointer";
closebutton2.style.transform = "translate(-50%, -50%)";

let left=0
closebutton2.addEventListener("click", () => {
    closebutton2.remove()
    gametitle.remove()
    canvas.remove()
    boostershop.remove()
    buybutton.remove()
    price.remove()
    if (didnotbuy==true){
        funyredarrow.remove()
    }
    left++
    computergraphics("on", true)
})


async function therealactualshop(shopstatus) {
    computergraphics("off", true);
    gametitle = document.createElement("p");
    gametitle.className = "pixelbaseText";
    gametitle.textContent = "THE SHOP";
    
    document.body.appendChild(gametitle);
    document.body.appendChild(canvas);
    document.body.appendChild(boostershop);
    document.body.appendChild(price);

    if (didnotbuy==true){
        document.body.appendChild(funyredarrow);
    }

    drawPriceGraph();

    if (shopstatus == 0 && left==0) {
        new Audio("assets/NarratorVoicelines/shopintroduction.m4a").play();
        setInterval(updateBoosterPrice, 3000);
        await sleep(9000);
        document.body.appendChild(buybutton);
        document.body.appendChild(closebutton2);
    } else {
        document.body.appendChild(buybutton);
        document.body.appendChild(closebutton2);
    }
    await sleep(10000);
    if (buyboosterstatus==0 && left==0){
        new Audio("assets/NarratorVoicelines/doesntbuy.m4a").play();
    }
    await sleep(15000);
    if (buyboosterstatus==0 && left==0){
        new Audio("assets/NarratorVoicelines/doesntbuywait.m4a").play();
            await sleep(4000);
            document.body.appendChild(funyredarrow);
            didnotbuy=true
    }    
}




let shopstatus = 0;
shopbutton.addEventListener("click", () => {
    therealactualshop(shopstatus);
    shopstatus++;
});

let dialoguestatus = 0
let shopflip = 0
function showshop(shopflip) {
    if (shopflip%2==0){
        document.body.style["background-image"] = "url('assets/pictures/screenpart.png')"
        computergraphics("on", false)
        if (playerdata.unlockskipday==true){
            skipdaypicture.remove()
        }
        if (dialoguestatus==0){
            wenttocomputer=true
            narratorbeggining = new Audio("assets/NarratorVoicelines/computermenututorial.m4a");
            narratorbeggining.play();
            dialoguestatus++
            return
        }
    } else {
    document.body.style["background-image"] = "url('assets/pictures/background.png')"
    computergraphics("off", false)

        if (playerdata.unlockskipday==true){
            document.body.appendChild(skipdaypicture)
        }
        if (dialoguestatus==1 && buyboosterstatus==0){
            narratorbeggining = new Audio("assets/NarratorVoicelines/pressedthegoldenarrowagainintutorial.m4a");
            narratorbeggining.play();
            dialoguestatus++
            return
        }
    }
}   

flecheordinateur.addEventListener("click", ()=>{
    showshop(shopflip)
    shopflip++
})


async function hesnotclickingit(wenttocomputer, status, shopstatus){
    if (wenttocomputer==false && status==0){
    narratorbeggining = new Audio("assets/NarratorVoicelines/notgoingtocomputer.m4a");
    narratorbeggining.play();
    }
    if (wenttocomputer==false && status==1){
    narratorbeggining = new Audio("assets/NarratorVoicelines/litteralydonothing.m4a");
    narratorbeggining.play();
    }
    if (wenttocomputer==false && status==2){
    narratorbeggining = new Audio("assets/NarratorVoicelines/waittoomuch.m4a");
    narratorbeggining.play();
    await sleep(5000);
    showshop(shopflip)
    shopflip++
    await sleep(4000);
    new Audio("assets/sfx/retenuedunarrateur.m4a").play();
    await sleep(15000);
    if (shopstatus==0){
        narratorbeggining = new Audio("assets/NarratorVoicelines/youwin.m4a");
        narratorbeggining.play();
        await sleep(3000);
        gametitle = document.createElement("h1");
        gametitle.className = "pixelbaseText";
        gametitle.textContent = "YOU WIN";
        document.body.appendChild(gametitle);
        youwin=true
    }
    
    }
}


async function readpaper(paperdocument,token){
    if (token%2==0){
        paperdocument.style.top = "50%";
        paperdocument.style.left = "50%";
        paperdocument.style.width = "40%";
        papersfxopen.play();
    } else {
        paperdocument.remove()
        papersfxclose.play()
        if (firsttime==true){
            narratorbeggining = new Audio("assets/NarratorVoicelines/begginingaftercontract.m4a");
            narratorbeggining.play();
            firsttime=false
            await sleep(9000);
            document.body.appendChild(flecheordinateur)
            await sleep(10000);
            hesnotclickingit(wenttocomputer, 0, shopstatus)
            await sleep(10000);
            hesnotclickingit(wenttocomputer, 1, shopstatus)
            await sleep(10000);
            hesnotclickingit(wenttocomputer, 2, shopstatus)
            return
        }
        document.body.appendChild(flecheordinateur)
    }

}
    const circlebackground = document.createElement("img");
    circlebackground.src = "assets/pictures/circle.png"
    circlebackground.style.width = "50%"; 
    circlebackground.style.position = "absolute";
    circlebackground.style.top = "50%";
    circlebackground.style.left = "50%";
    circlebackground.style.transform = "translate(-50%, -50%)";

    const keepbutton = document.createElement("img");
    keepbutton.src = "assets/pictures/keepbutton.png"
    keepbutton.style.width = "10%"; 
    keepbutton.style.position = "absolute";
    keepbutton.style.top = "80%";
    keepbutton.style.left = "65%";
    keepbutton.style.transform = "translate(-50%, -50%)";

    const sellbutton = document.createElement("img");
    sellbutton.src = "assets/pictures/sellbutton.png"
    sellbutton.style.width = "10%"; 
    sellbutton.style.position = "absolute";
    sellbutton.style.top = "80%";
    sellbutton.style.left = "50%";
    sellbutton.style.transform = "translate(-50%, -50%)";

let currentdisplayedpokemon
let actionstatus = 0 // pour savoir si l'utilisateur a fais un choix pour le pokemon

let healthstat
let namepokemon
let boosterpullimage
let typeetrareter

function removepkmchoice(){
    boosterpullimage.remove()
    namepokemon.remove()
    typeetrareter.remove()
    circlebackground.remove()
    keepbutton.remove()
    sellbutton.remove()
    healthstat.remove()
    currentdisplayedpokemon=0
}


function sellcard(pokemonid){
    if (pokemons[pokemonid-1].rareté=="1"){
        playerdata["money"] += 30
    }
    if (pokemons[pokemonid-1].rareté=="2"){
        playerdata["money"] += 60
    }
    if (pokemons[pokemonid-1].rareté=="3"){
        playerdata["money"] += 150
    }
    if (pokemons[pokemonid-1].rareté=="4"){
        playerdata["money"] += 100000
    }
    new Audio("assets/sfx/money.m4a").play();
    money.textContent = playerdata.money+"$"
    removepkmchoice()
    actionstatus++
    
}

sellbutton.addEventListener("click", ()=>{
    sellcard(currentdisplayedpokemon)
}
)

function keepcard(pokemonid){
    playerdata.keptcardsid.push(currentdisplayedpokemon)
    removepkmchoice()
    actionstatus++
}

keepbutton.addEventListener("click", ()=>{
    keepcard(currentdisplayedpokemon)
    actionstatus++
})

async function openboosteranimation(boosterpull){
    if (playerdata.boosterstoday>0){
        boosterpokemonimage.remove()
    }
    for(pokemonid of boosterpull ){
        boosterpullimage = document.createElement("img");
        boosterpullimage.src = pokemons[pokemonid-1]["sprites"]["regular"]
        boosterpullimage.style.width = "10%"; 
        boosterpullimage.style.position = "absolute";
        boosterpullimage.style.top = "35%";
        boosterpullimage.style.left = "36%";
        boosterpullimage.style.transform = "translate(-50%, -50%)";

        document.body.appendChild(circlebackground)
        document.body.appendChild(boosterpullimage)
        healthstat = document.createElement("div");
        healthstat.id = "pixelTextblack";
        healthstat.className="pixelTextblack";
        
        healthstat.innerHTML =
            pokemons[pokemonid-1].stats.hp + "/HP <br>" +
            pokemons[pokemonid-1].stats.atk + "/ATK <br>" +
            pokemons[pokemonid-1].stats.def + "/DEF <br>" +
            pokemons[pokemonid-1].stats.spe_atk + "/SPATK <br>" +
            pokemons[pokemonid-1].stats.spe_def + "/SPDEF <br>" +
            pokemons[pokemonid-1].stats.vit + "/VIT";
        healthstat.style.position = "absolute";
        healthstat.style.transform = "translate(-50%, -50%)";
        healthstat.style.top = "77%";
        healthstat.style.left = "31%";
        healthstat.style.fontSize = "130%";
        healthstat.style.textShadow = "2px 2px 4px white";

        namepokemon = document.createElement("div");
                namepokemon.id = "pixelTextblack";
        namepokemon.className="pixelTextblack";
        namepokemon.innerHTML =
            pokemons[pokemonid-1].name.fr + "/HP <br>" +
            pokemons[pokemonid-1].name.en + "/ATK <br>" +
            pokemons[pokemonid-1].name.jp + "/DEF"

        namepokemon.style.position = "absolute";
        namepokemon.style.transform = "translate(-50%, -50%)";
        namepokemon.style.top = "31%";
        namepokemon.style.left = "65%";
        namepokemon.style.fontSize = "125%";
        namepokemon.style.textShadow = "2px 2px 4px white";

        typeetrareter = document.createElement("div");
        typeetrareter.id = "pixelTextblack";
        typeetrareter.className="pixelTextblack";
        
        if(pokemons[pokemonid-1].types[1]!= null){ // aucun pokemon n'a 3 types donc verifie si second type existe
            typeetrareter.innerHTML =
            "type: "+pokemons[pokemonid-1].types[0].name + "<br> et " +
            pokemons[pokemonid-1].types[1].name + "<br>" +
            pokemons[pokemonid-1].rareté+ " rareté";
        }else{
            typeetrareter.innerHTML =
            "type: "+pokemons[pokemonid-1].types[0].name + "<br>" +
            pokemons[pokemonid-1].rareté + " rareté"
        }

        typeetrareter.style.position = "absolute";
        typeetrareter.style.transform = "translate(-50%, -50%)";
        typeetrareter.style.top = "62%";
        typeetrareter.style.left = "65%";
        typeetrareter.style.fontSize = "125%";
        typeetrareter.style.textShadow = "2px 2px 4px white";

        document.body.appendChild(typeetrareter);
        document.body.appendChild(namepokemon);
        document.body.appendChild(healthstat);

        document.body.appendChild(sellbutton);
        document.body.appendChild(keepbutton);
        currentdisplayedpokemon=pokemonid
        while(actionstatus==0){
            await sleep(20); //attend que quelle que chose se passe
        }
        actionstatus=0
        await sleep(500)
    }
    document.body.appendChild(flecheordinateur)
    if (playerdata.boosterstoday>0){
        document.body.appendChild(boosterpokemonimage)
    }
}

let boosterPull
function openbooster(){
    playerdata.boosterstoday -= 1
    flecheordinateur.remove()
    if (playerdata.boosterstoday==0){
        boosterpokemonimage.remove()
    }
    boosterPull=[]
    for(let i=0; i<5; i++){
        pokemonselected = randombetween(0,1025)
        boosterPull.push(pokemonselected)
    }
    openboosteranimation(boosterPull)
}


boosterpokemonimage.addEventListener("click",()=>{
    if (playerdata.boosterstoday>0){
        openbooster()
    }
})




contratdetravail.addEventListener("click", () => {
    readpaper(contratdetravail,token);
    token++
});

skipdaypicture.addEventListener("click", ()=>{
    todayday++
    daycycle(todayday)
})

daycycle(todayday)







