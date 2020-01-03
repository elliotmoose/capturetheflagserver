const Room = require("./Room");
const uuid = require("uuid");
const Config = require("./Config");
/**
 * Every game room is one instance of the game
 */
var custom_game_rooms = {};

var lobby_rooms = {};

var active_game_rooms = {};

var open_room_id = null;

var io;

/**
 *
 * @param {SocketIO.Server} io_ref
 */
var InitializeLobbyManager = function(io_ref) {
    io = io_ref;
};

/**
 * when someone requests to find a match, they are added here
 * TODO: when they disconnect, they must be removed
 * TODO: when they send a cancel event, they must be removed
 */
let lobby_socket_ids = [];

/**
 * Setup callbacks after user joins lobby
 * Each callback is a potential request they send while they are connected to the lobby
 * @param {SocketIO.Socket} client_socket
 */
var OnUserJoinLobby = function(client_socket) {
    client_socket.on("REQUEST_JOIN_ROOM", room_id =>
        RequestJoinRoom(room_id, client_socket)
    );
    client_socket.on("REQUEST_FIND_MATCH", () =>
        RequestFindMatch(client_socket)
    );
};

/**
 * Handles client requests to joins a room
 * @param {string} room_id
 * @param {SocketIO.Socket} client_socket
 */
var RequestJoinRoom = function(room_id, client_socket) {
    console.log(`user requesting to join room: ${room_id}`);

    //if the room doesnt exist
    if (custom_game_rooms[room_id]) {
        //finds the room
        let gameroom = custom_game_rooms[room_id];
        client_socket.emit("JOIN_ROOM_CONFIRMED", gameroom.id);
    } else {
        let error = {
            status: "ERROR",
            statusText: "Failed to Join",
            message: "The room does not exist anymore"
        };
        console.log(error);
        client_socket.emit("JOIN_ROOM_FAILED", error);
    }
};

/**
 * The client requests to find a match. When the room is full, the client is notified to join the namespace.
 * @param {*} client_socket
 */
var RequestFindMatch = function(client_socket) {
    console.log("user is request match: " + client_socket.id);
    //TODO: receive actual user id
    let user_id = "temp_id";

    //if no open room, create open room
    if (open_room_id == null) {
        open_room_id = CreateRoomInLobby();
    }

    //TODO: clients are added in and immediately told that a match is found (TESTING)
    lobby_socket_ids.push(client_socket.id);
    if(lobby_socket_ids.length == Config.ROOM_SIZE) {
        let new_room_id = PushLobbyToGameRoom();    
        console.log('Lobby pushed to game room');
    }

    // let room = lobby_rooms[open_room_id];
    // let game_started = Room.JoinRoom(room, user_id, client_socket);

    //if this room has been filled, create the next one
    // if(game_started) {
    //     StartGameForRoom(room)
    //     open_room_id = CreateRoomInLobby();
    // }
};

/**
 * Pushes the sockets in lobby into a game room and starts the game
 * @returns {string} room_id
 */
var PushLobbyToGameRoom = function() {
    let room_id = uuid.v1(); //generates random room id
    let gameroom = Room.NewGameRoom(io, room_id);
    active_game_rooms[room_id] = gameroom;

    //notify all players to join this room
    for (let socket_id of lobby_socket_ids) {
        io.to(socket_id).emit("JOIN_ROOM_CONFIRMED", room_id);
    }

    lobby_socket_ids = [];

    return room_id;
};

/**
 * @throws error when room
 * @returns {string} room id
 */
var CreateRoomInLobby = function() {
    console.log("creating room in lobby...");
    let room_id = uuid.v1(); //generates random room id
    let gameroom = Room.NewGameRoom(io, room_id);
    lobby_rooms[room_id] = gameroom;
    return room_id;
};

var UpdateGameRooms = function() {
    for (let room of Object.values(active_game_rooms)) {
        Room.UpdateGameRoom(room, io);
    }
};

module.exports = { InitializeLobbyManager, OnUserJoinLobby, UpdateGameRooms };
