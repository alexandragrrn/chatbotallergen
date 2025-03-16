const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

let plats = [];
try {
    plats = require(path.join(__dirname, './data/plats.json'));
} catch (e) {
    console.error("Impossible de charger plats.json", e);
    // Valeur par défaut au cas où
    plats = [];
}

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Fonction pour normaliser et comparer les chaînes avec tolérance aux fautes
function normaliserEtComparer(source, recherche) {
    // Normaliser: minuscules, retirer accents, espaces supplémentaires
    const normaliser = (texte) => {
        return texte.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlever les accents
            .replace(/[^\w\s]/g, '') // Enlever la ponctuation
            .trim();
    };
    
    source = normaliser(source);
    recherche = normaliser(recherche);
    
    // Vérification exacte ou inclusion
    if (source === recherche) return true;
    if (source.includes(recherche) || recherche.includes(source)) return true;
    
    // Accepter si la différence est de 1-2 caractères pour des mots courts
    const distance = levenshteinDistance(source, recherche);
    return (source.length <= 5 && distance <= 1) || (source.length > 5 && distance <= 2);
}

// Calcul de la distance de Levenshtein pour la tolérance aux fautes
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    
    // Initialisation
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    
    // Remplissage
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cout = a[j - 1] === b[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,     // Suppression
                matrix[i][j - 1] + 1,     // Insertion
                matrix[i - 1][j - 1] + cout  // Substitution
            );
        }
    }
    
    return matrix[b.length][a.length];
}

app.post('/rechercher', (req, res) => {
    const recherche = req.body.recherche || [];
    
    if (!recherche || !Array.isArray(recherche)) {
        return res.status(400).json({ erreur: "Critères de recherche mal envoyés depuis le client." });
    }

    try {
        // Organiser les plats par catégorie pour le résultat final
        const resultatParCategorie = {};
        
        plats.forEach(plat => {
            // Récupérer tous les allergènes du plat principal
            let allergenesTotaux = [...plat.allergenes];
            
            // Statut initial du plat et de ses accompagnements
            let statutPlat = "compatible";
            let accompagnementsCompatibles = [];
            let accompagnementsIncompatibles = [];
            
            // Pour stocker les ingrédients problématiques
            let ingredientsProblematiques = [];
            let ingredientsModifiables = [];
            let ingredientsNonModifiables = [];
            
            // Vérifier les accompagnements si disponibles
            if (plat.accompagnements) {
                plat.accompagnements.forEach(acc => {
                    let accStatus = "compatible";
                    const accAllergenes = acc.allergenes || [];
                    
                    // Vérifier si l'accompagnement contient des allergènes recherchés
                    for (const terme of recherche) {
                        // Vérifier allergènes de l'accompagnement
                        if (accAllergenes.some(all => normaliserEtComparer(all, terme))) {
                            accStatus = "incompatible";
                            break;
                        }
                    }
                    
                    if (accStatus === "compatible") {
                        accompagnementsCompatibles.push(acc.nom);
                    } else {
                        accompagnementsIncompatibles.push(acc.nom);
                    }
                });
            }
            
            // Vérifier le plat principal pour allergènes
            for (const terme of recherche) {
                // Vérifier les allergènes du plat
                if (allergenesTotaux.some(all => normaliserEtComparer(all, terme))) {
                    statutPlat = "incompatible";
                    // Ne pas sortir immédiatement pour pouvoir identifier tous les allergènes problématiques
                }
                
                // Vérifier spécifiquement chaque ingrédient
                for (const ingredient of plat.ingredients) {
                    if (normaliserEtComparer(ingredient.nom, terme)) {
                        // Si l'ingrédient est modifiable, on l'ajoute à la liste des ingrédients modifiables
                        if (ingredient.modifiable) {
                            ingredientsModifiables.push(ingredient.nom);
                        } else {
                            ingredientsNonModifiables.push(ingredient.nom);
                        }
                        ingredientsProblematiques.push(ingredient.nom);
                    }
                }
            }
            
            // Déterminer le statut final du plat
            if (ingredientsProblematiques.length > 0) {
                if (ingredientsNonModifiables.length > 0) {
                    statutPlat = "incompatible"; // Plat incompatible s'il y a des ingrédients non modifiables
                } else if (ingredientsModifiables.length > 0) {
                    statutPlat = "modifiable"; // Plat modifiable si tous les ingrédients problématiques sont modifiables
                }
            }
            
            // Extraire les noms d'ingrédients pour l'affichage
            let ingredientsTotaux = plat.ingredients.map(ing => ing.nom);
            
            // Créer le résultat pour ce plat
            const resultatPlat = {
                nom: plat.nom,
                description: plat.description,
                allergenes: allergenesTotaux,
                ingredients: ingredientsTotaux,
                status: statutPlat,
                ingredientsModifiables: ingredientsModifiables,
                ingredientsNonModifiables: ingredientsNonModifiables
            };
            
            // Ajouter les informations d'accompagnements si disponibles
            if (plat.accompagnements) {
                resultatPlat.accompagnements = {
                    compatibles: accompagnementsCompatibles,
                    incompatibles: accompagnementsIncompatibles
                };
                
                // Si le plat est incompatible mais qu'il y a des accompagnements compatibles
                if (statutPlat === "incompatible" && accompagnementsCompatibles.length > 0 && ingredientsNonModifiables.length === 0) {
                    resultatPlat.status = "modifiable";
                }
            }
            
            // S'assurer que la catégorie existe dans le résultat
            const categorie = plat.categorie || "Non catégorisé";
            if (!resultatParCategorie[categorie]) {
                resultatParCategorie[categorie] = [];
            }
            
            // Ajouter le plat à sa catégorie
            // Ajouter le plat à sa catégorie
            resultatParCategorie[categorie].push(resultatPlat);
        });
        
        res.json(resultatParCategorie);
    } catch (error) {
        res.status(500).json({ erreur: "Erreur serveur : " + error.message });
    }
});

// route GET temporaire pour vérifier le fonctionnement
app.get('/rechercher', (req, res) => {
    res.status(200).send("🚀 Le serveur fonctionne, mais utilise POST pour accéder à cette route !");
});

app.listen(process.env.PORT || 3000);

module.exports = app;

                      
