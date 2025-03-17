// Nouveau fichier: public/chat.js
document.addEventListener('DOMContentLoaded', function() {
    const messagesContainer = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-btn');

    // Fonction pour ajouter un message à la conversation
    function addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender);
        messageDiv.innerHTML = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Fonction pour extraire les allergènes du message utilisateur
    function extractAllergenes(text) {
        // Mots clés qui peuvent indiquer des allergies
        const allergieKeywords = [
            'allergique', 'allergie', 'intolérant', 'intolérance',
            'éviter', 'sans', 'pas de'
        ];
        
        // Liste des allergènes courants
        const commonAllergenes = [
            'gluten', 'lait', 'lactose', 'arachide', 'soja', 'fruits à coque', 
            'noix', 'noisette', 'amande', 'oeuf', 'œuf', 'poisson', 
            'crustacé', 'fruits de mer', 'céleri', 'moutarde', 'sésame',
            'sulfite', 'lupin', 'mollusque'
        ];
        
        let allergenes = [];
        
        // Chercher des phrases comme "Je suis allergique au gluten"
        for (const keyword of allergieKeywords) {
            if (text.toLowerCase().includes(keyword)) {
                for (const allergene of commonAllergenes) {
                    // Recherche simple
                    if (text.toLowerCase().includes(allergene)) {
                        allergenes.push(allergene);
                    }
                }
            }
        }
        
        // Si aucun mot-clé n'est trouvé mais des allergènes sont mentionnés
        if (allergenes.length === 0) {
            for (const allergene of commonAllergenes) {
                if (text.toLowerCase().includes(allergene)) {
                    allergenes.push(allergene);
                }
            }
        }
        
        // Supprimer les doublons
        return [...new Set(allergenes)];
    }

    // Fonction pour traiter une entrée utilisateur
    async function processUserInput(text) {
        // Ajouter le message de l'utilisateur à la conversation
        addMessage(text, 'user');
        
        // Animation de chargement
        addMessage('<div class="typing-indicator"><span></span><span></span><span></span></div>', 'bot');
        
        try {
            // Extraire les allergènes du texte
            const allergenes = extractAllergenes(text);
            
            if (allergenes.length === 0) {
                // Remplacer l'animation de chargement par la réponse
                messagesContainer.removeChild(messagesContainer.lastChild);
                addMessage(`Je n'ai pas identifié d'allergènes ou d'ingrédients à éviter. Pourriez-vous reformuler ou lister vos allergies plus clairement ?`, 'bot');
                return;
            }
            
            // Appel à l'API de recherche
            const response = await fetch('/rechercher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recherche: allergenes })
            });
            
            if (!response.ok) {
                throw new Error('Erreur serveur');
            }
            
            const data = await response.json();
            
            // Construire la réponse
            let botResponse = `J'ai analysé les plats en fonction de vos contraintes (${allergenes.join(', ')}). Voici ce que je peux vous proposer :<br><br>`;
            
            // Compter les plats par catégorie de compatibilité
            let compatibleCount = 0;
            let modifiableCount = 0;
            let incompatibleCount = 0;
            
            Object.keys(data).forEach(categorie => {
                data[categorie].forEach(plat => {
                    if (plat.status === 'compatible') compatibleCount++;
                    else if (plat.status === 'modifiable') modifiableCount++;
                    else incompatibleCount++;
                });
            });
            
            // Résumé des résultats
            botResponse += `<strong>Résumé:</strong> ${compatibleCount} plats compatibles, ${modifiableCount} plats modifiables (avec retrait d'ingrédients), ${incompatibleCount} plats incompatibles.<br><br>`;
            
            // Afficher les plats compatibles en priorité
            if (compatibleCount > 0) {
                botResponse += `<strong>Plats parfaitement compatibles :</strong><br>`;
                Object.keys(data).forEach(categorie => {
                    const platsCompatibles = data[categorie].filter(p => p.status === 'compatible');
                    if (platsCompatibles.length > 0) {
                        platsCompatibles.forEach(plat => {
                            botResponse += `<div class="plat-card status-compatible">
                                <strong>${plat.nom}</strong> (${categorie})<br>
                                ${plat.description}<br>
                            </div>`;
                        });
                    }
                });
            }
            
            // Afficher les plats modifiables
            if (modifiableCount > 0) {
                botResponse += `<strong>Plats compatibles avec modifications :</strong><br>`;
                Object.keys(data).forEach(categorie => {
                    const platsModifiables = data[categorie].filter(p => p.status === 'modifiable');
                    if (platsModifiables.length > 0) {
                        platsModifiables.forEach(plat => {
                            botResponse += `<div class="plat-card status-modifiable">
                                <strong>${plat.nom}</strong> (${categorie})<br>
                                ${plat.description}<br>
                                À retirer: ${plat.ingredientsModifiables.join(', ')}<br>
                            </div>`;
                        });
                    }
                });
            }
            
            botResponse += `<br>Souhaitez-vous des détails sur un plat en particulier ?`;
            
            // Remplacer l'animation de chargement par la réponse
            messagesContainer.removeChild(messagesContainer.lastChild);
            addMessage(botResponse, 'bot');
            
        } catch (error) {
            console.error('Erreur:', error);
            // Remplacer l'animation de chargement par le message d'erreur
            messagesContainer.removeChild(messagesContainer.lastChild);
            addMessage('Désolé, une erreur est survenue lors de la recherche. Veuillez réessayer.', 'bot');
        }
    }

    // Événements pour envoyer le message
    sendButton.addEventListener('click', function() {
        const text = userInput.value.trim();
        if (text) {
            processUserInput(text);
            userInput.value = '';
        }
    });

    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const text = userInput.value.trim();
            if (text) {
                processUserInput(text);
                userInput.value = '';
            }
        }
    });
});
