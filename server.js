const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);
const port = 3000;
const LobbyManager = require('./LobbyManager');
const { NewPlayer } = require('./Player');

const FPS = 20; //server frame rate

/**
 * When a client connects to this lobby server
 */
io.on('connection', (socket) => {
    LobbyManager.OnUserJoinLobby(socket);    
});

/**
 * Kicks of server cycle to run every frame
 */
var InitializeServerClock = function(){
    setInterval(() => {
        LobbyManager.UpdateGameRooms();
    }, 1000/FPS);
}

/**
 * Main
 */
LobbyManager.InitializeLobbyManager(); //set io
InitializeServerClock(); //start game updates

server.listen(3000,()=>console.log(`CTF server running on port: ${port}`)); //starts server on port

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
