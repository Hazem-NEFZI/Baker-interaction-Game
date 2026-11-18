# OPÉRATION BAKER V8 · LE CERCLE DES ESPIONS

**Vraie partie multijoueur en temps réel · Pas de mode démo.**

Quiz interactif en français, conçu pour une présentation scolaire sur Joséphine Baker. Un chef de mission anime la partie, et les joueurs se connectent sur leurs propres téléphones ou navigateurs.

## Nouveau dans la V8 : QR code d’invitation

- Dans le lobby, le chef de mission voit un **QR code** à côté du code de la mission.
- **Toucher le QR code** l’affiche en plein écran, pour le projeter en classe.
- Les joueurs le scannent avec l’appareil photo de leur téléphone : la page du jeu s’ouvre directement sur l’écran d’inscription, **code déjà rempli**. Ils choisissent un nom et un avatar, puis rejoignent. Aucun compte, aucune application.
- Le QR code utilise automatiquement la bonne adresse : l’adresse Wi-Fi locale en mode PC, ou l’adresse publique `https://…` une fois le jeu en ligne.

## Lancer le jeu sur Windows

1. Installer **Node.js 18 ou plus récent** depuis https://nodejs.org/ si nécessaire.
2. Décompresser l'archive ZIP dans un dossier.
3. Double-cliquer sur `LANCER_LE_JEU_WINDOWS.bat`. Ne pas fermer la fenêtre de commande durant la partie.
4. Sur le PC administrateur, ouvrir `http://localhost:3000`.
5. Choisir une capacité de **2 à 40 joueurs**, puis cliquer sur **CRÉER UNE MISSION**.
6. Le panneau de l'administrateur présente un code de mission et un lien de participation. Cliquer sur **COPIER LE LIEN** pour envoyer le lien aux joueurs.
7. Les joueurs choisissent chacun un pseudo d'espion et un avatar. Au moins **2 agents** doivent rejoindre la salle avant de commencer.
8. Cliquer sur **DÉMARRER** et projeter l'écran administrateur en classe.

### Essai avec un PC et un téléphone

- PC : fenêtre habituelle pour l'administrateur, **fenêtre privée** pour le premier joueur.
- Téléphone connecté au même Wi-Fi : ouvrir l'adresse réseau fournie par le jeu pour le deuxième joueur.
- Quand les deux agents apparaissent dans le lobby, démarrer la mission.
- Si le téléphone ne parvient pas à se connecter, vérifier le même réseau Wi-Fi et autoriser Node.js sur le pare-feu **réseau privé** de Windows. Certains réseaux d'établissement bloquent les connexions entre appareils.

## Fonctionnement de la partie

- **10 questions historiques différentes**, dans l'ordre du parcours de Joséphine Baker.
- **10 secondes** de réponse par question, identiques pour tous et contrôlées par le serveur.
- Réponse correcte : points de base + prime de rapidité + éventuelle série de bonnes réponses.
- Réponse correcte uniquement : **un** gadget pour cette question.
- Cliquer sur 🍅, 🖋️, 🍌 ou 🎊 **près de son avatar**, puis sur l'avatar d'un adversaire.
- Le projectile vole d'un avatar à l'autre et produit un effet visuel. Les gadgets ne retirent aucun point.
- Les **trois premiers impacts de chaque question** révèlent les **trois mèmes de chats** fournis, dans un ordre tournant. À partir du quatrième impact, seuls des messages gentils et amusants sont affichés.
- À la fin : podium des trois meilleurs scores, puis onglet **😹 Les malchanceux**, avec les **trois nouvelles images de réaction** fournies par l'utilisateur pour les trois derniers agents (en excluant le gagnant). Avec seulement deux joueurs, la galerie montre un seul agent.
- Le chef de mission peut **télécharger le classement en CSV** après les dix questions.

## Administration et sécurité

- Le chef de mission ne répond pas aux questions, ne gagne pas de points et dispose d'une clé d'administration distincte du code de salle.
- Le serveur valide lui-même l'heure limite, les réponses, les points, les charges de gadgets, la cible et les permissions du chef de mission.
- Les joueurs voient le même compte à rebours et le même classement, par mises à jour temps réel SSE.
- Réactualiser la page sur un même navigateur conserve généralement sa session de jeu tant que le serveur reste actif.
- La salle et les scores sont conservés **en mémoire pendant l'exécution du serveur**. Redémarrer le serveur efface les salles ; exporter le classement à la fin.

## Mettre le jeu en ligne (lien public, gratuit, ~10 minutes)

Pour que n’importe quel téléphone puisse rejoindre, **même sans être sur le même Wi-Fi**, le serveur doit tourner sur Internet. Seul **le chef de mission** crée des comptes (une seule fois). Les joueurs n’ont besoin de rien.

### 1. Mettre les fichiers sur GitHub
1. Créer un compte gratuit sur https://github.com.
2. Cliquer sur **+ → New repository**, nommer le dépôt `operation-baker`, le laisser **Public**, cliquer sur **Create repository**.
3. Cliquer sur **uploading an existing file**, puis glisser **tout le contenu** du dossier `OPERATION_BAKER_V8` (les fichiers `server.js`, `qr.js`, `package.json`, `render.yaml` et les dossiers `public`, `test`…). `server.js` doit être à la racine du dépôt, pas dans un sous-dossier.
4. Cliquer sur **Commit changes**.

### 2. Déployer sur Render
1. Créer un compte gratuit sur https://render.com avec **Sign in with GitHub**.
2. Cliquer sur **New → Web Service** et choisir le dépôt `operation-baker`.
3. Réglages : **Language** `Node` · **Build Command** `npm install` · **Start Command** `node server.js` · **Instance Type** `Free`.
4. Cliquer sur **Deploy Web Service**. Après 1 à 3 minutes, Render affiche une adresse du type `https://operation-baker.onrender.com`.

C’est le **lien public du jeu**. Le chef de mission l’ouvre sur le PC projeté, clique sur **CRÉER UNE MISSION**, et la classe scanne le QR code.

### À savoir avec l’offre gratuite
- Le serveur **s’endort après 15 minutes sans visite**. Le premier chargement peut alors prendre environ **1 minute** : ouvrir le lien quelques minutes avant le cours.
- Les missions sont en mémoire : si le serveur redémarre ou s’endort, les parties en cours sont effacées. **Exporter le CSV** à la fin de la partie.
- Une seule instance suffit (c’est le réglage par défaut).
- Pour mettre à jour le jeu : remplacer les fichiers sur GitHub, Render redéploie automatiquement.

Attention : une simple mise en ligne statique (HTML seul, Netlify sans fonctions serveur, fichier HTML ouvert localement) **ne synchronise pas** les joueurs. Le multijoueur a besoin de `server.js` qui tourne côté serveur.

## Vérification technique

Dans ce dossier, avec Node.js installé :

```bash
npm test
```

Le test `test_qr.js` vérifie aussi que le QR code pointe vers l’adresse publique `https` de la mission.

Les vérifications couvrent 10 questions à 10 secondes, 5 joueurs, les points, le podium, l'autorisation d'administrateur, les 3 réactions photo puis les messages, les images des perdants, et 3 connexions réseau simultanées recevant les mises à jour en temps réel.

**Crédits historiques :** Service historique de la Défense, Archives nationales, Ordre de la Libération, ministère des Armées, ressources éducatives. Images humoristiques fournies par l'utilisateur.
