/**
 * This is to outline the standard objects that are:
 * 1. Sent across the network.
 * 2. Used on server side
 *
 * 1. GAME_STATE (out)
 * 2. CONTROLS (in)
 * 3.
 */

/**
 * ROOM
 * a game room is a single game instance.
 */
let room = {
    id: "room_generated_uuid", //also the namespace id
    start_time: null,
    delta_time: 0,      
    timestamp: Date.now(), // Timestamp to be updated whenever the room is updated. Used for deltaTime calculation
    time_till_resume: null,
    state: {
        players: [],
        score: [0, 0],
        flags: [],
        in_progress: false,
        sudden_death: false,
        pause: false,
        announcements: [{
            message,
            time,
        }],
    },
    map: {
        bases: [],
        bounds: {
            width: 0,
            height: 0
        }
    },
    config : {
        max_score: 5,
        max_players: 10,
        game_length: 10
    },
    namespace: null //should be the io namespace
};

let player = {
    id: "player_user_id",
    username: "player_user_name",
    position: [0, 0],
    max_stamina: 100,
    current_stamina: 100,
    sprint_speed: 10,
    default_speed: 4,
    current_speed: 4,
    radius: 20, //player radius
    reach: 10, //action radius = size+reach
    action: false, //catch/take flag/pass flag
    sprint: false,
    team: 0,
    prison: false,
    controls: {
        angle: null,
        action: false,
        sprint: false,
        timestamp: Date.now()
    }
};

let flag = {
    id: 'flag_0',
    radius: 15,
    position: [0, 0],
    carrier_id: null,
    team: 0
};

let base = {
    id: 'base_0',
    radius: 24,
    position: [0,0],
    team: 0
}


let user = {
    id: 'asdfgh',
    username: 'elliotmoose',
    socket: null, //user socket           
};

//a list of users/parties in queue
let normal_matchmaking_queue = [
    [user]
]

let custom_room_lobby = {
    id: 'namespace_id',
    name: 'room_name',
    owner_id: 'elliotmoose',
    team_0: [user, user],
    team_1: [user, user],
    map: {
        bounds: {
            width: 0,
            height: 0
        }
    },
    config : {
        max_score: 5,
        max_players: 10,
        game_length: 10
    },
};

let custom_game_rooms = {
    room_id: custom_room_lobby
}
/*
COMMUNICATION
these are the events that can be called by the client/server

IN: REQUEST_FIND_MATCH //call from client to find a match
OUT: JOIN_ROOM_CONFIRMED //call to client to join namespace
IN: CONTROLS
OUT: GAME_STATE




future works:
REQUEST_JOIN_ROOM //custom game rooms




*/
