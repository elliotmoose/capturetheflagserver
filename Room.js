const { NewPlayer } = require("./Player");
const { Vector2Subtract, Vector2Addition, Vector2Multiply, Vector2Magnitude, Vector2Normalize } = require('./helpers/Vectors');
const { NewFlag } = require('./Flag');

const ROOM_CAPACITY = 10;
const CONTROLS_AGE_THRESHOLD = 700; //0.7s
const MAP_WIDTH = 1500;
const MAP_HEIGHT = 2500;
const BASE_MARGIN = 150;
const BASE_RADIUS = 40; //prison radius

/**
 * Creates a game room from an id. Each namespace corresponds to a game room
 * @param {*} io
 * @param {*} id
 */
const NewGameRoom = function(io, id) {
    let namespace = io.of(id);
    //creates the room
    let gameroom = {
        id,
        in_progress: false,
        state: {
            players: [],
            flags: [
                NewFlag(0, BaseCenterForTeam(0)),
                NewFlag(1, BaseCenterForTeam(1))
            ],
            score: [0, 0],
            timestamp: Date.now()
        },
        namespace
    };

    namespace.on("connection", client_socket =>
        OnUserJoinRoom(client_socket, gameroom)
    );

    return gameroom;
};
const OnUserJoinRoom = (client_socket, gameroom) => {
    console.log(`${client_socket.id} joined room ${gameroom.id}`);

    //creates the respective player
    //TODO: client_socket is id for now. In the future it should be their user account id
    let player = NewPlayer(client_socket.id, client_socket);

    //adds player to the room
    gameroom.state.players.push(player);

    //hooks up controls
    client_socket.on("CONTROLS", controls =>
        OnReceiveControls(controls, client_socket, gameroom)
    );
};

/**
 * Updates the player connected by client_socket based on received controls
 * @param {*} controls
 * @param {*} client_socket
 * @param {*} gameroom
 */
const OnReceiveControls = (controls, client_socket, gameroom) => {
    let currentPlayer = gameroom.state.players.filter(player => player.socket_id == client_socket.id)[0];    

    currentPlayer.controls = {
        ...controls,
        timestamp: Date.now()
    };
};

/**
 *
 * @param {*} room
 * @param {*} user_id
 * @param {*} client_socket
 * @returns {boolean} returns if the room was filled and a room needs to be created
 */
const JoinRoom = function(room, user_id, client_socket) {
    let player = NewPlayer(user_id, client_socket);
    room.state.players.push(player);

    if (room.state.players.length == ROOM_CAPACITY) {
        StartGame(room);
        return true;
    }

    return false;
};

const StartGame = function(room) {};

//#region Update
/**
 * Checks if controls are too old
 */
const UpdateControlsAge = function(gameroom) {
    let players = gameroom.state.players;
    for (let player of players) {
        if (Date.now() - player.controls.timestamp <= CONTROLS_AGE_THRESHOLD) {
            //still young            
        } else {
            //too old, reset
            player.controls.angle = null;
            player.controls.action = false;
            player.controls.sprint = false;
        }
        
        player.action = player.controls.action;
        player.sprint = player.controls.sprint;
    }
};

/**
 * Updates player position
 * @param {*} gameroom
 * @param {number} deltaTime
 */
// TODO: Determine good number to divide deltaTime by
const UpdatePlayerPositions = function(gameroom, deltaTime) {
    for (let player of gameroom.state.players) {

        let x = player.position[0];
        let y = player.position[1];

        if(player.controls.angle) {
            x = x + (player.current_speed * Math.cos(player.controls.angle) * deltaTime) / 10;
            y = y + (player.current_speed * Math.sin(player.controls.angle) * deltaTime) / 10;
        }

        // Map boundaries
        x = Math.max(x, player.radius); // Left wall
        x = Math.min(x, MAP_WIDTH - player.radius); // Right wall
        y = Math.max(y, player.radius); // Top wall
        y = Math.min(y, MAP_HEIGHT - player.radius) // Bottom wall

        // Prevent player from entering own base. 'Push' the player out radially from the center of the base if he is inside.
        let base_position = BaseCenterForTeam(player.team);
        let vector_base_to_player = Vector2Subtract([x,y], base_position);
        let dist_from_base_center = Vector2Magnitude(vector_base_to_player);

        if(dist_from_base_center < BASE_RADIUS + player.radius) {
            let new_pos_angle = Math.atan2(vector_base_to_player[1], vector_base_to_player[0]);
            y = base_position[1] + Math.sin(new_pos_angle) * (BASE_RADIUS + player.radius);
            x = base_position[0] + Math.cos(new_pos_angle) * (BASE_RADIUS + player.radius);
        }

        if(player.prison) {
            let opponent_team = player.team == 0 ? 1 : 0;
            let prison_position = BaseCenterForTeam(opponent_team);
            let vector_prison_to_player = Vector2Subtract([x,y], prison_position);                
            let dist_from_center = Math.min(BASE_RADIUS, Vector2Magnitude(vector_prison_to_player));                
            let new_pos_angle = Math.atan2(vector_prison_to_player[1],vector_prison_to_player[0]);
            x = prison_position[0] + dist_from_center * Math.cos(new_pos_angle);
            y = prison_position[1] + dist_from_center * Math.sin(new_pos_angle);
        }

        

        player.position = [x, y];
    }
};

/**
 * Update position for flag
 * Note: This must be run before passing of flags to ensure passing works as expected
 * @param {*} gameroom 
 * @param {*} deltaTime 
 */
const UpdateFlagPositions = function(gameroom, deltaTime) {
    let players = gameroom.state.players;
    for(let flag of gameroom.state.flags) {
        
        //if has a carrier, follow carrier
        if(flag.carrier_id != null) {            
            let player = players.find(p=>p.id == flag.carrier_id);
            if(player) {
                flag.position = player.position;
            }
        }
        else { //check for pickups if no carrier                        
            let pickup_players = PlayersInRange(players, flag.position, flag.radius).filter(p=> p.team != flag.team);            
            if(pickup_players.length != 0) {            
                flag.carrier_id = pickup_players[0].id;
            }            
        }
    }

}

/**
 * Updates the stamina of players
 * @param {*} gameroom
 * @param {number} deltaTime
 */
// TODO: Determine good number to divide deltaTime by
const UpdatePlayerSprint = (gameroom, deltaTime) => {
    for (let player of gameroom.state.players) {
        if (player.sprint) {
            if (player.current_stamina > 0) {
                player.current_speed = player.sprint_speed;
                player.current_stamina = Math.max(player.current_stamina - deltaTime / 10, 0);
            }
            else {
                player.current_speed = player.default_speed;
            }
        } 
        else {
            player.current_speed = player.default_speed;
            player.current_stamina = Math.min(player.current_stamina + deltaTime / 10, player.max_stamina);            
        }
    }
};

const UpdateActions = function(gameroom) {
    let players = gameroom.state.players;
    let flags = gameroom.state.flags;
    let action_players = players.filter(p => p.action == true);

    for (let player_with_action of action_players) {
        let controls = player.controls;
        let players_in_range = PlayersInRange(
            players,
            player_with_action.position,
            player_with_action.reach
        );

        //1. Catching people
        //2. Freeing teammates
        //3. Capturing the flag
        //4. Passing flag

        players_in_range.forEach(other_player => {
            //1. Catching people
            if (other_player.team != action_players.team) {
                //check where point of contact is
                let action_player_to_other_vector = Vector2Subtract(
                    other_player.position,
                    player_with_action.position
                ); //this to other vector
                let normalized_vector = Vector2Normalize(
                    action_player_to_other_vector
                );
                let point_of_contact = Vector2Addition(
                    player_with_action,
                    Vector2Multiply(normalized_vector, player_with_action.reach)
                );
                let team_territory = TeamTerrirtoryForPosition(
                    point_of_contact
                );

                //because we are enemies, somebody must be caught
                if (player_with_action.team == team_territory) {
                    //player who cast action is that catcher
                    other_player.prison = true;
                } else {
                    //player who cast action tried to catch someone in enemy zone
                    player_with_action.prison = true;
                }
            } else {
                //if teammate in prisonm free him
                if (other_player.prison) {
                    other_player.prison = false;
                }

                //4. Passing flag
                //if action player is holding flag, pass flag
                flags.forEach(flag => {
                    if (flag.carrier_id == player_with_action.id) {
                        flag.carrier_id = other_player.id;
                    }
                });
            }
        });
    }
};

const UpdateGameRoom = function(gameroom, io) {
    let deltaTime = Date.now() - gameroom.state.timestamp;
    gameroom.state.timestamp = Date.now();
    UpdateControlsAge(gameroom);
    UpdateFlagPositions(gameroom, deltaTime);
    UpdatePlayerSprint(gameroom, deltaTime);
    UpdatePlayerPositions(gameroom, deltaTime);
    UpdateActions(gameroom);
    DispatchStateForGameRoom(gameroom, io);
};

//#endregion

const DispatchGameBegin = function(gameroom, io) {
    for (let player of gameroom.state.players) {
        io.to(player.socket_id).emit("GAME_BEGIN");
    }
};

const DispatchStateForGameRoom = function(gameroom, io) {        
    io.of(gameroom.id).emit("GAME_STATE", gameroom.state);
};

//#region helper functions
/**
 * Finds a list of players in the radius from the position given
 * @param {*} players 
 * @param {*} position 
 * @param {*} radius 
 */
const PlayersInRange = function(players, position, radius) {
    return players.filter(player => {
        let x_dist = player.position[0] - position[0];
        let y_dist = player.position[1] - position[1];
        let dist = Math.sqrt(Math.pow(x_dist, 2) + Math.pow(y_dist, 2));
        return dist <= radius;
    });
};

/**
 * Tells you for this position, whose team's territory you are on
 * @param {Array} position array of length 2
 */
const TeamTerrirtoryForPosition = function(position) {
    if (position[1] <= MAP_HEIGHT / 2) {
        return 0; //team 0 is bottom half of map
    } else {
        return 1; //team 1 is top half of map
    }
};

const BaseCenterForTeam = function(team) {
    return team == 0 ? [MAP_WIDTH/2, MAP_HEIGHT - BASE_MARGIN] : [MAP_WIDTH/2, BASE_MARGIN];
}


//#endregion

module.exports = {
    NewGameRoom,
    UpdateGameRoom,
    DispatchStateForGameRoom,
    JoinRoom,
    DispatchGameBegin
};
