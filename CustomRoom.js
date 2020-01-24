const uuid = require("uuid");
const UserManager = require("./UserManager");
const Config = require("./Config");

const CONTROLS_AGE_THRESHOLD = 700; //0.7s
const MAP_WIDTH = 1500;
const MAP_HEIGHT = 2500;
const BASE_MARGIN = 150;

const NewCustomRoom = function(owner_id, room_name, config, io, begin_callback, delete_callback ) {
    let id = uuid.v1();
    let namespace = io.of(id);



    //check config
    config.max_players = config.max_players || 10;
    config.max_score = config.max_score || 10;
    config.game_length = config.game_length || 10;
    

    //creates the room
    let custom_room = {
        id,        
        name: room_name,
        owner_id: owner_id,
        users: [],        
        map: {            
            bounds : {
                width: MAP_WIDTH,
                height: MAP_HEIGHT
            }
        },
        config,
        namespace,
        begin: ()=>{begin_callback(id)},    
        delete: ()=>{delete_callback(id)}    
    }

    namespace.on("connection", client_socket => OnUserJoinCustomRoom(client_socket, custom_room));    

    return custom_room;
}

const OnUserJoinCustomRoom = (client_socket, custom_room) => {
    if(custom_room.users.length == custom_room.config.max_players) {
        client_socket.emit('JOIN_ROOM_FAILED', {
            status: 'ROOM_FULL',
            statusText: 'Room Full',
            message: 'The requested room is full.'
        })
        return;
    }
    client_socket.on('REQUEST_START_CUSTOM_GAME', ({user_id})=> OnRequestStartGame(user_id, client_socket, custom_room));
    client_socket.on('REQUEST_JOIN_TEAM', ({user_id, team})=> OnRequestJoinTeam(user_id, team, client_socket, custom_room));
    client_socket.emit('COMMAND_GET_USER_ID');
    client_socket.on('REQUEST_SET_USER_ID', ({user_id}) => OnUserSetUserId(user_id, client_socket, custom_room));    
}

const OnUserSetUserId = async (user_id, client_socket, custom_room) => {
    try {
        //retrieve username etc
        let user = await UserManager.GetUserFromId(user_id);

        if(!user) {
            return;
        }

        
        let team = 0;
        let team_0_count = custom_room.users.filter((user_package)=>user_package.team == 0);
        let team_1_count = custom_room.users.filter((user_package)=>user_package.team == 1);
        if(team_0_count > team_1_count) {
            team = 1;
        }
        
        let player = {
            id: user.id,
            username: user.username, 
            socket_id: client_socket.id,
            team: team
        }

        custom_room.users.push(player);
        
        //hook up on disconnect
        client_socket.on('disconnect', ()=>OnUserLeaveCustomRoom(client_socket, custom_room));

        DispatchRoomStateUpdate(custom_room);    
    } 
    catch (error) {
        console.log(error);
    }
}

const OnUserLeaveCustomRoom = (client_socket,custom_room) => {
    console.log(`user ${client_socket.id} has left`);
    
    let index = custom_room.users.findIndex((player)=>player.socket_id == client_socket.id);    
    
    if(index != -1) {
        custom_room.users.splice(index, 1);        
        
        if(custom_room.users.length == 0) {
            //clean up room
            custom_room.delete();
        }
        else {
            if(custom_room.owner_id == custom_room.users[index].id) {
                custom_room.owner_id = custom_room.users[0];
            }
        }
    }        
    
}

const DispatchRoomStateUpdate = (custom_room) => {
    
    custom_room.namespace.emit('CUSTOM_ROOM_UPDATE', {
        id: custom_room.id,
        name: custom_room.name,
        owner_id: custom_room.owner_id,
        users: custom_room.users,
        map: custom_room.map,
        config: custom_room.config,
    });
}

const OnRequestJoinTeam = (user_id, team, client_socket, custom_room) => {

    //get this player object
    let user = custom_room.users.find(p=>p.id == user_id);
    let team_players = custom_room.users.filter(p=>p.team == team);
    

    //check if got space
    if(user && team_players.length < custom_room.config.max_players) {
        user.team = team; //change team
    }

    //update all
    DispatchRoomStateUpdate(custom_room);
}

const OnRequestStartGame = (user_id, client_socket, custom_room) => {    
    if(user_id == custom_room.owner_id) {
        custom_room.begin(custom_room);
    }
    //TODO: error not owner
}

module.exports = { NewCustomRoom };