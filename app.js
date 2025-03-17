const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// Structures de données
let ingredients = [];
let plats = [];
let compositions = [];
let accompagnements = [];
let optionsAccompagnement = [];

// Chargement des données
try {
    console.log("Tentative de chargement des données...");
    const dataPath = path.join(__dirname, './data/restaurant_data.json');
    console.log("Chemin du fichier:", dataPath);
    
    const data = require(dataPath);
    console.log("Données chargées avec succès");
    
    ingredients = data.ingredients || [];
    plats = data.plats || [];
    compositions = data.compositions || [];
    accompagnements = data.accompagnements || [];
    optionsAccompagnement = data.optionsAccompagnement || [];
    
    console.log(`Nombre d'ingrédients: ${ingredients.length}`);
    console.log(`Nombre de plats: ${plats.length}`);
    console.log(`Nombre de compositions: ${compositions.length}`);
    console.log(`Nombre d'accompagnements: ${accompagnements.length}`);
    console.log(`Nombre d'options d'accompagnement: ${optionsAccompagnement.length}`);
} catch (e) {
    console.error("Impossible de charger les données", e);
    ingredients = [];
    plats = [];
    compositions = [];
    accompagnements = [];
    optionsAccompagnement = [];
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Fonction simplifiée de comparaison de texte
// Fonction améliorée de comparaison de texte
function contientAllergene(allergenes, terme) {
    // Si pas d'allergènes, retourne false
    if (!allergenes) return false;
    
    // Normaliser les chaînes (supprimer les accents, mettre en minuscules)
    const normaliserTexte = (texte) => {
        return texte.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprimer les accents
            .replace(/[^a-z0-9\s]/g, "") // Garder uniquement lettres, chiffres et espaces
            .trim();
    };
    
    // Convertir la liste d'allergènes en format normalisé
    const listeAllergenes = allergenes.split(',')
        .map(a => normaliserTexte(a.trim()));
    
    // Normaliser le terme recherché
    const termeRecherche = normaliserTexte(terme);
    
    // Gérer les variations singulier/pluriel
    const termeSingulier = termeRecherche.endsWith('s') ? termeRecherche.slice(0, -1) : termeRecherche;
    const termePluriel = termeRecherche.endsWith('s') ? termeRecherche : termeRecherche + 's';
    
    // Gérer les cas spéciaux
    const casSpeciaux = {
        "fruit a coque": "fruits a coque",
        "fruits a coques": "fruits a coque",
        "fruit à coque": "fruits à coque",
        "fruits à coques": "fruits à coque"
    };
    
    // Vérifier les correspondances avec les variations
    return listeAllergenes.some(allergene => {
        // Vérification directe
        if (allergene.includes(termeRecherche) || termeRecherche.includes(allergene)) {
            return true;
        }
        
        // Vérification avec singulier/pluriel
        if (allergene.includes(termeSingulier) || allergene.includes(termePluriel)) {
            return true;
        }
        
        // Vérification des cas spéciaux
        if (casSpeciaux[termeRecherche] && allergene.includes(normaliserTexte(casSpeciaux[termeRecherche]))) {
            return true;
        }
        
        return false;
    });
}

// Obtenir tous les ingrédients d'un plat
function getIngredientsPlat(idPlat) {
    const compsPlat = compositions.filter(comp => comp.idPlat === idPlat);
    
    return compsPlat.map(comp => {
        const ingredient = ingredients.find(ing => ing.id === comp.idIngredient);
        return {
            id: comp.idIngredient,
            nom: ingredient ? ingredient.nom : 'Inconnu',
            allergenes: ingredient ? ingredient.allergenes : '',
            modifiable: comp.modifiable
        };
    });
}

// Obtenir tous les accompagnements d'un plat
function getAccompagnementsPlat(idPlat) {
    const idsAccompagnement = optionsAccompagnement
        .filter(opt => opt.idPlat === idPlat)
        .map(opt => opt.idAccompagnement);
    
    return accompagnements.filter(acc => idsAccompagnement.includes(acc.id));
}

app.post('/rechercher', (req, res) => {
    const recherche = req.body.recherche || [];
    
    console.log("Recherche reçue:", recherche);
    
    if (!recherche || !Array.isArray(recherche) || recherche.length === 0) {
        return res.status(400).json({ erreur: "Critères de recherche invalides." });
    }

    try {
        const resultatParCategorie = {};
        
        // Traiter chaque plat
        plats.forEach(plat => {
            // Récupérer les ingrédients du plat
            const ingredientsPlat = getIngredientsPlat(plat.id);
            
            // Récupérer les allergènes du plat (à partir des ingrédients)
            const allergenes = new Set();
            ingredientsPlat.forEach(ing => {
                if (ing.allergenes) {
                    ing.allergenes.split(',').forEach(all => allergenes.add(all.trim()));
                }
            });
            
            // Vérifier la compatibilité des ingrédients
            let ingredientsModifiables = [];
            let ingredientsNonModifiables = [];
            
            // Vérifier chaque ingrédient par rapport aux critères de recherche
            ingredientsPlat.forEach(ingredient => {
                // Vérifier si l'ingrédient contient un des allergènes recherchés
                const contientUnAllergeneRecherche = recherche.some(terme => 
                    contientAllergene(ingredient.allergenes, terme)
                );
                
                // NOUVEAU: Vérifier si l'ingrédient correspond à un nom recherché
                const estIngredientRecherche = recherche.some(terme => {
                    const normaliserTexte = (texte) => {
                        return texte.toLowerCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^a-z0-9\s]/g, "")
                            .trim();
                    };
                    
                    const nomIngredientNormalise = normaliserTexte(ingredient.nom);
                    const termeRecherche = normaliserTexte(terme);
                    
                    return nomIngredientNormalise.includes(termeRecherche) || 
                           termeRecherche.includes(nomIngredientNormalise);
                });
                
                if (contientUnAllergeneRecherche || estIngredientRecherche) {
                    if (ingredient.modifiable === "Oui") {
                        ingredientsModifiables.push(ingredient.nom);
                        console.log(`Ingrédient modifiable trouvé dans ${plat.nom}: ${ingredient.nom}`);
                    } else {
                        ingredientsNonModifiables.push(ingredient.nom);
                        console.log(`Ingrédient NON modifiable trouvé dans ${plat.nom}: ${ingredient.nom}`);
                    }
                }
            });
            
            // Le reste du code reste inchangé...

app.get('/rechercher', (req, res) => {
    res.status(200).send("🚀 Le serveur fonctionne, mais utilisez POST pour accéder à cette route !");
});

// Route de débogage améliorée
app.get('/debug', (req, res) => {
    // Récupérer tous les allergènes uniques
    const tousLesAllergenes = new Set();
    ingredients.forEach(ing => {
        if (ing.allergenes) {
            ing.allergenes.split(',').forEach(all => tousLesAllergenes.add(all.trim()));
        }
    });
    accompagnements.forEach(acc => {
        if (acc.allergenes) {
            acc.allergenes.split(',').forEach(all => tousLesAllergenes.add(all.trim()));
        }
    });

    res.json({
        stats: {
            ingredients: ingredients.length,
            plats: plats.length,
            compositions: compositions.length,
            accompagnements: accompagnements.length,
            optionsAccompagnement: optionsAccompagnement.length
        },
        allergenes: Array.from(tousLesAllergenes),
        ingredients: ingredients,
        plats: plats,
    });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});

// Ajouter à app.js
app.post('/chat', (req, res) => {
    const userMessage = req.body.message || '';
    
    // Liste des allergènes connus depuis notre base de données
    const tousLesAllergenes = new Set();
    ingredients.forEach(ing => {
        if (ing.allergenes) {
            ing.allergenes.split(',').forEach(all => tousLesAllergenes.add(all.trim()));
        }
    });
    
    // Extraire les allergènes mentionnés dans le message
    const allergenesMentionnes = Array.from(tousLesAllergenes)
        .filter(allergene => userMessage.toLowerCase().includes(allergene.toLowerCase()));
    
    // Si des allergènes sont détectés, on utilise notre fonction de recherche existante
    if (allergenesMentionnes.length > 0) {
        // Utiliser la même logique que dans la route /rechercher
        // ...
        
        // Reformater les résultats pour une présentation conversationnelle
        const resultat = {
            allergenes: allergenesMentionnes,
            reponse: "Voici les plats compatibles avec vos allergies...",
            platsCompatibles: [],
            platsModifiables: [],
            platsIncompatibles: []
            // ...
        };
        
        res.json(resultat);
    } else {
        // Si pas d'allergènes détectés
        res.json({
            allergenes: [],
            reponse: "Je n'ai pas détecté d'allergènes dans votre message. Pourriez-vous préciser vos allergies ou les ingrédients à éviter?"
        });
    }
});

module.exports = app;
