const uuid = require("uuid");

const CONTROLS_AGE_THRESHOLD = 700; //0.7s
const MAP_WIDTH = 1500;
const MAP_HEIGHT = 2500;
const BASE_MARGIN = 150;

const NewCustomRoom = function(owner_id, room_name, io ) {
    let id = uuid.v1();
    let namespace = io.of(id);
    //creates the room
    let custom_room = {
        id,        
        name: room_name,
        owner_id: owner_id,
        team_0: [],
        team_1: [],
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
        namespace    
    }

    namespace.on("connection", client_socket => OnUserJoinCustomRoom(client_socket, custom_room));

    return custom_room;
}

const OnUserJoinCustomRoom = (client_socket, custom_room) => {
    DispatchRoomStateUpdate(custom_room);    
}

const DispatchRoomStateUpdate = (custom_room) => {
    // console.log(custom_room.namespace);
    custom_room.namespace.emit('CUSTOM_ROOM_UPDATE', {
        id: custom_room.id,
        name: custom_room.name,
        owner_id: custom_room.owner_id,
        team_0: custom_room.team_0,
        team_1: custom_room.team_1,
        map: custom_room.map,
        config: custom_room.config,
    });
}

module.exports = { NewCustomRoom };