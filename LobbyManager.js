const Room = require("./Room");
const CustomRoom = require("./CustomRoom");
const uuid = require("uuid");
const Config = require("./Config");
const UserManager = require("./UserManager");
/**
 * Every game room is one instance of the game
 */
let custom_game_rooms = {};
let normal_matchmaking_queue = [];
let active_game_rooms = {};

var io;

/**
 *
 * @param {SocketIO.Server} io_ref
 */
var InitializeLobbyManager = function(io_ref) {
    io = io_ref;
};

/**
 * Setup callbacks after user joins lobby
 * Each callback is a potential request they send while they are connected to the lobby
 * @param {SocketIO.Socket} client_socket
 */
var OnUserJoinLobby = function(client_socket) {
    client_socket.on("disconnect", ()=>OnUserLeaveLobby(client_socket));
    //CUSTOM
    client_socket.on("REQUEST_LOAD_LOBBY_ROOMS", ()=>RequestLoadLobbyRooms(client_socket));
    client_socket.on("REQUEST_CREATE_CUSTOM_ROOM", ({user_id, room_name})=>RequestCreateCustomRoom(user_id, room_name, client_socket));
    client_socket.on("REQUEST_JOIN_CUSTOM_ROOM", room_id => RequestJoinCustomRoom(room_id, client_socket));

    //NORMAL
    client_socket.on("REQUEST_FIND_MATCH", ({user_id, type}) => RequestFindMatch(user_id, type, client_socket));    
};

var OnUserLeaveLobby = function(client_socket) {    
    let index = normal_matchmaking_queue.findIndex((player)=> player.socket_id == client_socket.id);
    if(index != -1) {
        normal_matchmaking_queue.splice(index, 1);
    }
}

//#region CUSTOM
var RequestLoadLobbyRooms = function(client_socket) {        
    let rooms = Object.values(custom_game_rooms).map(room => {
        return {
            id: room.id,
            name: room.name,
            player_count: room.teams[0].length + room.teams[1].length,
            config: room.config,   
        }
    });

    client_socket.emit("LOBBY_ROOMS_UPDATE", rooms);
}

var RequestCreateCustomRoom = function(user_id, room_name, client_socket) {
    console.log(`custom room "${room_name}" created for user: ${user_id}`);
    let delete_room = (room_id)=> {
        console.log(`deleting room with id: ${room_id}`);
        delete custom_game_rooms[room_id];
    }
    let new_room = CustomRoom.NewCustomRoom(user_id, room_name, io, delete_room);
    custom_game_rooms[new_room.id] = new_room;
}
/**
 * Handles client requests to joins a room
 * @param {string} room_id
 * @param {SocketIO.Socket} client_socket
 */
var RequestJoinCustomRoom = function(room_id, client_socket) {
    console.log(`user requesting to join room: ${room_id}`);

    //if the room doesnt exist
    if (custom_game_rooms[room_id]) {
        //finds the room
        let gameroom = custom_game_rooms[room_id];
        client_socket.emit("COMMAND_JOIN_CUSTOM_ROOM", gameroom.id);
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

//#endregion

var RequestFindMatch = function(user_id, type, client_socket) {
    switch (type) {
        case 'NORMAL':
            RequestFindNormalMatch(user_id, client_socket);
            break;
            
        case 'RANKED':            
            break;
            
        default:
            break;
    }
}

/**
 * The client requests to find a match. When the room is full, the client is notified to join the namespace.
 * @param {*} client_socket
 */
var RequestFindNormalMatch = async function(user_id, client_socket) {
    
    let user = await UserManager.GetUserFromId(user_id);
    
    if(!user) {
        return;
    }

    console.log(`${user.username} has joined the queue`);        
    
    let user_package = {
        id: user.id,
        username: user.username,
        socket_id: client_socket.id
    }
    
    normal_matchmaking_queue.push(user_package);


    for(let user_package of normal_matchmaking_queue) {
        io.to(user_package.socket_id).emit('COMMAND_UPDATE_FIND_MATCH', {
            current_players: normal_matchmaking_queue.length,
            max_players: Config.normal.max_players
        });
    }

    UpdateNormalMatchmakingQueue();
};

/**
 * Checks for potential matches
 * TODO: for now is simple, because no parties, just check length
 */
var UpdateNormalMatchmakingQueue = () => {    
        
    if(normal_matchmaking_queue.length == Config.normal.max_players) {
        console.log('Pushing queue to lobby');

        //create game room
        let players = normal_matchmaking_queue;
        let gameroom = Room.NewGameRoom(io, players, Config.normal);

        active_game_rooms[gameroom.id] = gameroom;
        
        //signal users to join room
        for(let user_package of normal_matchmaking_queue) {
            io.to(user_package.socket_id).emit('COMMAND_JOIN_GAME_ROOM', gameroom.id);
        };

        //reset queue
        normal_matchmaking_queue = [];
    }
        
}

var UpdateGameRooms = function() {
    for (let room of Object.values(active_game_rooms)) {
        Room.UpdateGameRoom(room);
    }
};

module.exports = { InitializeLobbyManager, OnUserJoinLobby, UpdateGameRooms };
