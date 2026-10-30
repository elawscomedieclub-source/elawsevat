
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EVAT Continuum Signalisation Server v3.60 is active.\n');
});

const io = new Server(server, { cors: { origin: "*" } });

io.on('connection', (socket) => {
    console.log(`Client connecté : ${socket.id}`);
    socket.on('signal', (data) => { socket.broadcast.emit('signal', data); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`Serveur Continuum actif sur le port ${PORT}`); });
