const Room = require('./Room');
const uuid = require('uuid');

/**
 * Every game room is one instance of the game
 */
var custom_game_rooms = {

};

var lobby_rooms = {

}

var active_game_rooms = {

}

var open_room_id = null;

var io;

var InitializeLobbyManager = function (io) {
    io = io;
}

/**
 * Setup callbacks after user joins lobby 
 * Each callback is a potential request they send while they are connected to the lobby
 * @param {SocketIO.Socket} client_socket 
 */
var OnUserJoinLobby = function(client_socket) {
    client_socket.on('REQUEST_JOIN_ROOM', (room_id)=>RequestJoinRoom(room_id, client_socket));    
    client_socket.on('REQUEST_FIND_MATCH', (user_id)=>RequestFindMatch(user_id, client_socket));    
}

/**
 * Handles client requests to joins a room
 * @param {string} room_id 
 * @param {SocketIO.Socket} client_socket 
 */
var RequestJoinRoom = function(room_id, client_socket){
    console.log(`user requesting to join room: ${room_id}`);

    //if the room doesnt exist
    if(custom_game_rooms[room_id])
    {
        //finds the room
        let gameroom = custom_game_rooms[room_id];   
        client_socket.emit('JOIN_ROOM_CONFIRMED', gameroom.id);
    }
    else
    {        
        let error = {status: 'ERROR', statusText: 'Failed to Join', message: 'The room does not exist anymore'}
        console.log(error);
        client_socket.emit('JOIN_ROOM_FAILED', error);
    }
}

/**
 * The client requests to find a match. When the room is full, the client is notified to join the namespace.
 * @param {*} user_id 
 * @param {*} client_socket 
 */
var RequestFindMatch = function(user_id, client_socket) {    
    //if no open room, create open room
    if(open_room_id == null) {
        open_room_id = CreateRoomInLobby();
    }

    let room = lobby_rooms[open_room_id];
    let game_started = Room.JoinRoom(room, user_id, client_socket);
    
    //if this room has been filled, create the next one
    if(game_started) {
        StartGameForRoom(room)
        open_room_id = CreateRoomInLobby();
    }    
}


/**
 * @throws error when room 
 * @returns {string} room id
 */
var CreateRoomInLobby = function() {
    console.log('creating room in lobby...')        
    let room_id = uuid.v1(); //generates random room id    
    let gameroom = Room.NewGameRoom(io, room_id);    
    lobby_rooms[room_id] = gameroom;     
    return room_id;
}

var StartGameForRoom = function(room) {    
    active_game_rooms[room.id] = room;
    room.in_progress = true;    
    Room.DispatchGameBegin(room, io);

}

var UpdateGameRooms = function() {
    for(let room of Object.values(active_game_rooms)) {
        Room.UpdateGameRoom(room);
    }    
}

module.exports = { InitializeLobbyManager, OnUserJoinLobby, UpdateGameRooms}