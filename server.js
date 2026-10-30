
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Base de données en mémoire des utilisateurs enregistrés (numéro -> {nom, metier, socketId})
const registeredUsers = new Map();

io.on('connection', (socket) => {
    console.log('Un opérateur s'est connecté:', socket.id);

    // Enregistrement du profil utilisateur
    socket.on('register_user', (data) => {
        if(data && data.telephone) {
            registeredUsers.set(data.telephone, {
                nom: data.nom,
                metier: data.metier,
                socketId: socket.id
            });
            console.log(`Utilisateur enregistré : ${data.nom} (${data.telephone}) - Métier: ${data.metier}`);
        }
    });

    // Synchronisation des contacts : recherche dans la base des utilisateurs
    socket.on('query_contacts', (telephones, callback) => {
        const resultats = [];
        if(Array.isArray(telephones)) {
            telephones.forEach(tel => {
                if(registeredUsers.has(tel)) {
                    const usr = registeredUsers.get(tel);
                    resultats.push({ telephone: tel, metier: usr.metier, nom: usr.nom });
                }
            });
        }
        if(typeof callback === 'function') {
            callback(resultats);
        }
    });

    // Routage des signaux d'appel direct Pair-à-Pair (P2P) d'un système à un autre
    socket.on('p2p_signal', (data) => {
        // data contient { target, sender, type, offer, answer, candidate }
        const targetUser = registeredUsers.get(data.target);
        if(targetUser && targetUser.socketId) {
            io.to(targetUser.socketId).emit('p2p_signal', data);
        }
    });

    socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
    });

    socket.on('disconnect', () => {
        console.log('Un opérateur s'est déconnecté:', socket.id);
        // Nettoyage de la map des utilisateurs
        for (let [tel, val] of registeredUsers.entries()) {
            if (val.socketId === socket.id) {
                registeredUsers.delete(tel);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur de signalisation EVAT actif sur le port ${PORT}`);
});
