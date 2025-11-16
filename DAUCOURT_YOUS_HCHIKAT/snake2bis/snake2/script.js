

let compteurTentatives = 0;
const jeu = document.getElementById("jeu");
    const taille = 20;
    const cases = [];

    
    for (let i = 0; i < taille * taille; i++) {
      const cell = document.createElement("div");
      cell.classList.add("case");
      jeu.appendChild(cell);
      cases.push(cell);
    }

    let serpent = [
      {x: 10, y: 10},
      {x: 9, y: 10},
      {x: 8, y: 10},
      {x: 7, y: 10}
    ];
    let direction = {x: 1, y: 0};
    let nourriture = {x: 5, y: 5};

    function afficher() {
      for (let i = 0; i < cases.length; i++) {
        cases[i].className = "case";
      }
      const indexNourriture = nourriture.y * taille + nourriture.x;
      cases[indexNourriture].classList.add("nourriture");

      for (let i = 0; i < serpent.length; i++) {
        const index = serpent[i].y * taille + serpent[i].x;
        cases[index].classList.add(i === 0 ? "teteSerpent" : "serpent");
      }
    }
    document.addEventListener("keydown", event => {
      if (event.key === "ArrowUp" && direction.y !== 1) direction = {x: 0, y: -1};
      if (event.key === "ArrowDown" && direction.y !== -1) direction = {x: 0, y: 1};
      if (event.key === "ArrowLeft" && direction.x !== 1) direction = {x: -1, y: 0};
      if (event.key === "ArrowRight" && direction.x !== -1) direction = {x: 1, y: 0};
    });

    function deplacer() {
      const tete = {x: serpent[0].x + direction.x, y: serpent[0].y + direction.y};

      const collisionMur = tete.x < 0 || tete.x >= taille || tete.y < 0 || tete.y >= taille;
      const collisionCorps = serpent.some(partie => partie.x === tete.x && partie.y === tete.y);


      if (collisionMur || collisionCorps) {
        alert("Perdu :(");
        
        //ici on doit reset le serpent
        serpent = [
          {x: 10, y: 10},
          {x: 9, y: 10},
          {x: 8, y: 10},
          {x: 7, y: 10}
        ];
        direction = {x: 1, y: 0};
        nourriture = {x: Math.floor(Math.random() * taille), y: Math.floor(Math.random() * taille)};

        compteurTentatives++;
        console.log("Nb de tentatives :", compteurTentatives);

        afficher();
        return;
      }
      serpent.unshift(tete);
      if (tete.x === nourriture.x && tete.y === nourriture.y) {
        nourriture = {x: Math.floor(Math.random() * taille), y: Math.floor(Math.random() * taille)};
      } else {
        serpent.pop();
      }
      afficher();
    }
    
    const boutonLancer = document.getElementById("lancerJeu");
    let jeuLance = false;
    boutonLancer.addEventListener("click", () => {
      if (!jeuLance) {
        compteurTentatives++; 
        console.log("Nb de tentatives :", compteurTentatives);
        jeuLance = true;
        afficher(); 
        setInterval(deplacer, 300); 
      }
    });

