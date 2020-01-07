const uuid = require("uuid");

const CONTROLS_AGE_THRESHOLD = 700; //0.7s
const MAP_WIDTH = 1500;
const MAP_HEIGHT = 2500;
const BASE_MARGIN = 150;

const NewCustomRoom = function(owner_id, room_name, io, delete_callback ) {
    let id = uuid.v1();
    let namespace = io.of(id);
    //creates the room
    let custom_room = {
        id,        
        name: room_name,
        owner_id: owner_id,
        teams: [[],[]],        
        map: {            
            bounds : {
                width: MAP_WIDTH,
                height: MAP_HEIGHT
            }
        },
        config : {
            max_score: 5,
            max_players: 10,
            game_length: 10
        },
        namespace,
        delete: ()=>{delete_callback(id)}    
    }

    namespace.on("connection", client_socket => OnUserJoinCustomRoom(client_socket, custom_room));    

    return custom_room;
}

const OnUserJoinCustomRoom = (client_socket, custom_room) => {
    
    
    let player = {
        id: 'asd',
        username: 'asd', 
        socket: client_socket
    }
    
    let team = 0;
    if(custom_room.teams[0].length > custom_room.teams[1].length) {
        team = 1;
    }
    
    custom_room.teams[0].push(player);
    
    //hook up on disconnect
    client_socket.on('disconnect', ()=>OnUserLeaveCustomRoom(client_socket, custom_room));

    DispatchRoomStateUpdate(custom_room);    
}

const OnUserLeaveCustomRoom = (client_socket,custom_room) => {
    console.log(`user ${client_socket.id} has left`);
    
    for(let team of custom_room.teams) {        
        let index = team.findIndex((player)=>player.socket.id == client_socket.id);
        if(index != -1) {
            team.splice(index, 1);        
        }        
    }

    if(custom_room.teams[0].length == 0 && custom_room.teams[1].length == 0) {
        //clean up room
        custom_room.delete();
    }
}
const DispatchRoomStateUpdate = (custom_room) => {
    // console.log(custom_room.namespace);
    let final_teams = [[],[]];
    for(let i in custom_room.teams) {
        for(let player of custom_room.teams[i]) {
            final_teams[i].push({
                id: player.id,
                username: player.username
            })
        }
    }
    

    custom_room.namespace.emit('CUSTOM_ROOM_UPDATE', {
        id: custom_room.id,
        name: custom_room.name,
        owner_id: custom_room.owner_id,
        teams: final_teams,
        map: custom_room.map,
        config: custom_room.config,
    });
}

module.exports = { NewCustomRoom };