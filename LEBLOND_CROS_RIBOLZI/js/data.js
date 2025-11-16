// DATA.JS (module)
// Pont entre l'ancien fichier de données (5_pokemon-clicker/.../data.js)
// et l'architecture ES6 modules actuelle.
// Exporte pokemonDataDB pour une importation standard dans les modules.

// Préférence: window.pokemonDataDB si l'index a fait le pont après le chargement de data.js
// Fallback: variable globale pokemons si disponible
// Sinon: tableau vide (l'appelant pourra gérer l'absence gracieusement)
export const pokemonDataDB = (typeof window !== 'undefined' && window.pokemonDataDB)
  ? window.pokemonDataDB
  : (typeof pokemons !== 'undefined' ? pokemons : []);
