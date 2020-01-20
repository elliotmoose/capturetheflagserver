const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io").listen(server);
const port = 3000;

const api_v1 = require('./v1/api');

const LobbyManager = require("./LobbyManager");
const UserManager = require('./UserManager');

const { NewPlayer } = require("./Player");

const MySQLDriver = require('mysqldriver');

const db = new MySQLDriver({
    host: '127.0.0.1',
    user: 'anon',
    password: 'anon',
    database: 'capturetheflag',
    port: 3306
});

const FPS = 20; //20; //server frame rate

/**
 * When a client connects to this lobby server
 */
io.on("connect", socket => {
  LobbyManager.OnUserJoinLobby(socket);
});


app.use('/api/v1',api_v1);

/**
 * Kicks of server cycle to run every frame
 */
var InitializeServerClock = function() {
    setInterval(() => {
        LobbyManager.UpdateGameRooms();
    }, 1000 / FPS);
};

/**
 * Main
 */
LobbyManager.InitializeLobbyManager(io); //set io
UserManager.InitializeUserManager(db); //set io
InitializeServerClock(); //start game updates

server.listen(port, () => {
  console.log('===================================================================================================')
  console.log('                                 CTF SERVER STARTED                                ')
  console.log('===================================================================================================')
  console.log(`PORT: ${port}`);
  console.log(`SERVER TICK: ${FPS}`);
}); //starts server on port


// io.on('connection', function(socket){
//     socket.emit('request', /* */); // emit an event to the socket
//     io.emit('broadcast', /* */); // emit an event to all connected sockets
//     socket.on('reply', function(){ /* */ }); // listen to the event
//   });

/*
const nsp = io.of('/my-namespace');
nsp.on('connection', function(socket){
  console.log('someone connected');
});
nsp.emit('hi', 'everyone!');

io.on('connection', function(socket){
  socket.on('say to someone', function(id, msg){
    socket.broadcast.to(id).emit('my message', msg);
  });
});



*/
