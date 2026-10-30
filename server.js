const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const registeredUsers = new Map();

function nettoyerTel(tel) {
    if(!tel) return '';
    return tel.replace(/\s+/g, '').trim();
}

io.on('connection', (socket) => {
    socket.on('register_user', (data) => {
        if(data && data.telephone) {
            const cleanTel = nettoyerTel(data.telephone);
            registeredUsers.set(cleanTel, {
                nom: data.nom,
                metier: data.metier,
                socketId: socket.id
            });
            socket.broadcast.emit('contact_registered', {
                nom: data.nom,
                telephone: cleanTel,
                metier: data.metier
            });
        }
    });

    socket.on('query_contacts', (telephones, callback) => {
        const resultats = [];
        if(Array.isArray(telephones)) {
            telephones.forEach(tel => {
                const cleanTel = nettoyerTel(tel);
                if(registeredUsers.has(cleanTel)) {
                    const usr = registeredUsers.get(cleanTel);
                    resultats.push({ telephone: cleanTel, metier: usr.metier, nom: usr.nom });
                }
            });
        }
        if(typeof callback === 'function') callback(resultats);
    });

    socket.on('p2p_signal', (data) => {
        if(data && data.target) {
            const cleanTarget = nettoyerTel(data.target);
            const targetUser = registeredUsers.get(cleanTarget);
            if(targetUser && targetUser.socketId) {
                io.to(targetUser.socketId).emit('p2p_signal', data);
            }
        }
    });

    socket.on('signal', (data) => {
        socket.broadcast.emit('signal', data);
    });

    socket.on('disconnect', () => {
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
    console.log(`Serveur Médical EVAT actif sur le port ${PORT}`);
});
