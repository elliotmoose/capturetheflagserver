const GameRoom = require("./GameRoom");
const CustomRoom = require("./CustomRoom");
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
    client_socket.on("REQUEST_CREATE_CUSTOM_ROOM", ({user_id, room_name, config})=>RequestCreateCustomRoom(user_id, room_name, config, client_socket));
    client_socket.on("REQUEST_JOIN_CUSTOM_ROOM", room_id => RequestJoinCustomRoom(room_id, client_socket));

    //NORMAL
    client_socket.on("REQUEST_FIND_MATCH", ({user_id, type}) => RequestFindMatch(user_id, type, client_socket));    
};

var OnUserLeaveLobby = function(client_socket) {    
    let index = normal_matchmaking_queue.findIndex((player)=> player.socket_id == client_socket.id);
    if(index != -1) {
        console.log(`${normal_matchmaking_queue[index].username } has left the queue`);        
        normal_matchmaking_queue.splice(index, 1);
    }
}

//#region CUSTOM
var RequestLoadLobbyRooms = function(client_socket) {
    let rooms = Object.values(custom_game_rooms).map(room => {
        return {
            id: room.id,
            name: room.name,
            player_count: room.users.length,
            config: room.config,   
        }
    });

    client_socket.emit("LOBBY_ROOMS_UPDATE", rooms);
}

var RequestCreateCustomRoom = function(user_id, room_name, config, client_socket) {
    console.log(`custom room "${room_name}" created for user: ${user_id} with config: ${JSON.stringify(config)}`);
        
    //convert room from custom_game to active game
    let begin_room = (room_id) => {
        let room = custom_game_rooms[room_id];
        let players = room.users;
            
        let gameroom = GameRoom.NewGameRoom(io, players, room.config, UpdatePlayerStats, DeleteGameRoomWithId);        
        BeginGameForPlayersAndGameRoom(players, gameroom, io.of(room.id));

        //clean up custom room
        delete custom_game_rooms[room_id];        
    }
    
    let delete_room = (room_id) => {
        console.log(`deleting custom room with id: ${room_id}`);
        delete custom_game_rooms[room_id];
    }
    
    let new_room = CustomRoom.NewCustomRoom(user_id, room_name, config, io, begin_room, delete_room);
    custom_game_rooms[new_room.id] = new_room;

    //get user to join room he created
    RequestJoinCustomRoom(new_room.id, client_socket);
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
    
    try {
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

        CheckStartGameForNormalMatchmakingQueue();
    } 
    catch (error) {
        console.log(error);
    }
};

/**
 * Checks for potential matches
 * TODO: for now is simple, because no parties, just check length
 */
var CheckStartGameForNormalMatchmakingQueue = () => {    
        
    if(normal_matchmaking_queue.length == Config.normal.max_players) {
        console.log('Pushing queue to lobby');

        let delete_room = (room_id) => {
            console.log(`deleting game room with id: ${room_id}`);
            delete active_game_rooms[room_id];
        }

        //create game room
        let players = normal_matchmaking_queue;
        let gameroom = GameRoom.NewGameRoom(io, players, Config.normal, UpdatePlayerStats, DeleteGameRoomWithId);
        BeginGameForPlayersAndGameRoom(players, gameroom, io);

        //reset queue
        normal_matchmaking_queue = [];
    }
        
}

/**
 * Tells players to join the game room and kicks start the game
 * @param {*} players 
 * @param {*} gameroom 
 * @param {*} socket_io could be the io, or could be a namespace (custom rooms). both ways we want to tell specific users to join the new game room
 */
var BeginGameForPlayersAndGameRoom = (players, gameroom, socket_io) => {    
    active_game_rooms[gameroom.id] = gameroom;    

    DispatchJoinGameRoom(players, gameroom, socket_io);
}

var UpdatePlayerStats = (winning_team, players)=>{        
    
    players.forEach(player => {       
        if(winning_team == -1) { //draw
            UserManager.AddUserStats(0,0, player.flags_scored, player.id);
        }
        else {
            UserManager.AddUserStats(winning_team == player.team ? 1:0, winning_team == player.team ? 0 : 1, player.flags_scored, player.id);        
        }
    });
}

var DeleteGameRoomWithId = (room_id) => {
    console.log(`deleting game room with id: ${room_id}`);
    delete active_game_rooms[room_id];
}

var UpdateGameRooms = function() {
    for (let room of Object.values(active_game_rooms)) {
        GameRoom.UpdateGameRoom(room);
    }
};

var DispatchJoinGameRoom = (players, gameroom, socket_io) => {
    //signal users to join room
    for(let user_package of players) {        
        socket_io.to(user_package.socket_id).emit('COMMAND_JOIN_GAME_ROOM', gameroom.id);
    };
}

module.exports = { InitializeLobbyManager, OnUserJoinLobby, UpdateGameRooms };
