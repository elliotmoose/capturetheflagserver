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

    return custom_room;
}

module.exports = { NewCustomRoom };