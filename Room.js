const { NewPlayer } = require("./Player");
const { Vector2Subtract, Vector2Addition, Vector2Multiply, Vector2Magnitude, Vector2Normalize } = require('./helpers/Vectors');
const { NewFlag } = require('./Flag');
const { NewBase } = require('./Base');

// const ROOM_CAPACITY = 10;
const CONTROLS_AGE_THRESHOLD = 700; //0.7s
const MAP_WIDTH = 1500;
const MAP_HEIGHT = 2500;
const BASE_MARGIN = 150;
// TODO: determine good values for these
const POS_FACTOR = 0.1;
const STA_FACTOR_DEFAULT = 0.1;
const STA_FACTOR_FAST = 0.2;

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
        start_time: null,
        delta_time: 0,
        timestamp: Date.now(),
        state: {
            players: [],
            flags: [
                NewFlag(0, BasePositionForTeam(0)),
                NewFlag(1, BasePositionForTeam(1))
            ],
            score: [0, 0],      
            in_progress: false,      
            sudden_death: false,
        },
        map: {
            bases: [
                NewBase(0, BasePositionForTeam(0)),
                NewBase(1, BasePositionForTeam(1))
            ],
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
    };

    namespace.on("connection", client_socket => OnUserJoinRoom(client_socket, gameroom));

    return gameroom;
};

const OnUserJoinRoom = (client_socket, gameroom) => {
    console.log(`${client_socket.id} joined room ${gameroom.id}`);

    //creates the respective player
    //TODO: client_socket is id for now. In the future it should be their user account id
    let team = gameroom.state.players.filter(p=>p.team == 0).length <= gameroom.state.players.filter(p=>p.team == 1) ? 0 : 1;
    let player = NewPlayer(client_socket.id, client_socket, team);
    player.position = SpawnPositionForTeam(player.team, player.radius, gameroom.map.bases[player.team].radius);

    //adds player to the room
    gameroom.state.players.push(player);        

        
    //hooks up controls
    client_socket.on("CONTROLS", controls => OnReceiveControls(controls, client_socket, gameroom));
    client_socket.on('PING', ()=>client_socket.emit('PING'));
    client_socket.emit('BIND_PLAYER', client_socket.id);
    client_socket.emit('INIT_MAP', gameroom.map);

    //check to start game
    if (gameroom.state.players.length == gameroom.config.max_players) {
        DispatchStartGame(gameroom);        
    }
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

const UpdateDeltaTime = function(gameroom) {
    gameroom.delta_time = Date.now() - gameroom.timestamp;
    gameroom.timestamp = Date.now();

    let game_time_millis = Date.now() - gameroom.start_time;
    let game_time_minutes = (game_time_millis/1000)/60;
    //if game has exceed stipulated length
    if(game_time_minutes >= gameroom.config.game_length) {
        //if not sudden death and should
        if(gameroom.state.sudden_death != true && gameroom.state.score[0] == gameroom.state.score[1]) {
            gameroom.state.sudden_death = true;
            OnBeginSuddenDeath(gameroom);
        }
        else {
            let win_team = gameroom.state.score[0] > gameroom.state.score[1] ? 0 : 1;
            OnTeamWin(win_team, gameroom);
        }
    }
}

//#region ================================================= UPDATE =================================================
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
        
        player.angle = player.controls.angle;
        player.action = player.controls.action;
        player.sprint = player.controls.sprint;
    }
};

/**
 * Updates player position
 * @param {*} gameroom
 */
const UpdatePlayerPositions = function(gameroom) {
    let delta_time = gameroom.delta_time;

    for (let player of gameroom.state.players) {

        let x = player.position[0];
        let y = player.position[1];

        if(player.angle) {
            x = x + (player.current_speed * Math.cos(player.controls.angle) * delta_time) * POS_FACTOR;
            y = y + (player.current_speed * Math.sin(player.controls.angle) * delta_time) * POS_FACTOR;
        }

        // Map boundaries
        x = Math.max(x, player.radius); // Left wall
        x = Math.min(x, MAP_WIDTH - player.radius); // Right wall
        y = Math.max(y, player.radius); // Top wall
        y = Math.min(y, MAP_HEIGHT - player.radius) // Bottom wall

        // Prevent player from entering own base. 'Push' the player out radially from the center of the base if he is inside.
        let base_position = BasePositionForTeam(player.team);
        let base_radius = gameroom.map.bases[player.team].radius;
        let vector_base_to_player = Vector2Subtract([x,y], base_position);
        let dist_from_base_center = Vector2Magnitude(vector_base_to_player);
        
        let closest_distance = base_radius + player.radius;
        if(dist_from_base_center < closest_distance) {
            let new_pos_angle = Math.atan2(vector_base_to_player[1], vector_base_to_player[0]);
            y = base_position[1] + Math.sin(new_pos_angle) * closest_distance;
            x = base_position[0] + Math.cos(new_pos_angle) * closest_distance;
        }

        if(player.prison) {
            let opponent_team = player.team == 0 ? 1 : 0;
            let prison_position = BasePositionForTeam(opponent_team);
            let vector_prison_to_player = Vector2Subtract([x,y], prison_position);                
            let dist_from_center = Math.min(base_radius - player.radius, Vector2Magnitude(vector_prison_to_player));                
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
 */
const UpdateFlagPositions = function(gameroom) {
    let delta_time = gameroom.delta_time;

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
 */
const UpdatePlayerSprint = (gameroom) => {
    let delta_time = gameroom.delta_time;

    for (let player of gameroom.state.players) {
        if (player.angle) {
            if (player.sprint) {
                if (player.current_stamina > 0) {
                    player.current_speed = player.sprint_speed;
                    player.current_stamina = Math.max(player.current_stamina - delta_time * STA_FACTOR_DEFAULT, 0);
                }
                else {
                    player.current_speed = player.default_speed;
                }
            } else {
                player.current_speed = player.default_speed;
                player.current_stamina = Math.min(player.current_stamina + delta_time * STA_FACTOR_DEFAULT, player.max_stamina);
            }
        } else {
            player.current_stamina = Math.min(player.current_stamina + delta_time * STA_FACTOR_FAST, player.max_stamina);
        }
    }
};

const UpdateActions = function(gameroom) {
    let players = gameroom.state.players;
    let flags = gameroom.state.flags;
    let action_players = players.filter(p => p.action == true);    

    for (let player_with_action of action_players) {                
        let players_in_range = PlayersInRange(players, player_with_action.position, player_with_action.reach + player_with_action.radius);                
        //1. Catching people
        //2. Freeing teammates
        //3. Capturing the flag
        //4. Passing flag
        
        players_in_range.forEach(other_player => {
            
            if(other_player == player_with_action) {return;} //cannot interact with self
            
            //1. Catching people
            if (player_with_action.team != other_player.team) {                
                //check where point of contact is
                let action_player_to_other_vector = Vector2Subtract(other_player.position, player_with_action.position); //this to other vector
                let normalized_vector = Vector2Normalize(action_player_to_other_vector);
                let point_of_contact = Vector2Addition(player_with_action.position, Vector2Multiply(normalized_vector, player_with_action.reach + player_with_action.radius));                
                let team_territory = TeamTerrirtoryForPosition(point_of_contact);                
                
                //whoever is not in their territory in this interaction goes to jail
                if (player_with_action.team != team_territory) {                    
                    player_with_action.prison = true;
                } 

                if (other_player.team != team_territory) {                    
                    other_player.prison = true;
                }
            } 
            else {
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

const UpdateScoring = function(gameroom) {
    for(let player of gameroom.state.players) {
        let carried_flag = gameroom.state.flags.filter(f=>f.carrier_id == player.id);
        
        if(carried_flag.length == 0) {
            continue;
        }
        else if(TeamTerrirtoryForPosition(player.position) == player.team) //carrying a flag and in my own territory
        {
            OnPlayerScore(player, gameroom)
        }
    }
}

const UpdateGameRoom = function(gameroom) {
    UpdateDeltaTime(gameroom);    
    UpdateControlsAge(gameroom);
    UpdateFlagPositions(gameroom);
    UpdatePlayerSprint(gameroom);
    UpdatePlayerPositions(gameroom);
    UpdateActions(gameroom);
    UpdateScoring(gameroom);
    DispatchStateForGameRoom(gameroom);
};

const ResetPositions = function(gameroom) {
    
    for(let flag of gameroom.state.flags) {
        flag.position = BasePositionForTeam(flag.team);
        flag.carrier_id = null;
    }
    
    for(let player of gameroom.state.players) {        
        player.position = SpawnPositionForTeam(player.team, player.radius, gameroom.map.bases[player.team].radius);
        player.prison = false;
        player.sprint = false;
        player.current_stamina = player.max_stamina;
        player.current_speed = player.default_speed;
    }
}

//#endregion

//#region ================================================= GAME EVENTS =================================================
/**
 * When a player scores a point
 * @param {*} player 
 * @param {*} gameroom 
 */
const OnPlayerScore = function(player, gameroom) {    
    ResetPositions(gameroom);
    gameroom.state.score[player.team] += 1;    

    //check win
    if(gameroom.state.score[player.team] == gameroom.config.max_score) {
        OnTeamWin(player.team, gameroom);
    }
}

const OnTeamWin = function(team, gameroom) {
    gameroom.state.in_progress = false;
    DispatchEndGame(team, gameroom) //kick players to lobby
}

const OnBeginSuddenDeath = function(gameroom) {
    OnBeginSuddenDeath(gameroom);
}
//#endregion

const DispatchStateForGameRoom = function(gameroom) {        
    gameroom.namespace.volatile.emit("GAME_STATE", gameroom.state);
};

const DispatchStartGame = (gameroom) => {
    gameroom.start_time = Date.now();
    gameroom.namespace.emit("GAME_START", gameroom.start_time);
}

const DispatchEndGame = (team, gameroom) => {
    gameroom.namespace.emit("GAME_END", team);
}

//#region helper functions
/**
 * Finds a list of players in the radius from the position given
 * in range meaning, edge of player
 * @param {*} players 
 * @param {*} position 
 * @param {*} radius 
 */
const PlayersInRange = function(players, position, radius) {
    return players.filter(player => {
        let x_dist = player.position[0] - position[0];
        let y_dist = player.position[1] - position[1];
        let dist = Math.sqrt(Math.pow(x_dist, 2) + Math.pow(y_dist, 2));        
        return dist <= radius + player.radius;
    });
};

/**
 * Tells you for this position, whose team's territory you are on
 * @param {Array} position array of length 2
 */
const TeamTerrirtoryForPosition = function(position) {
    if (position[1] >= MAP_HEIGHT / 2) {
        return 0; //team 0 is top half of map
    } else {
        return 1; //team 1 is bottom half of map
    }
};

const BasePositionForTeam = function(team) {
    return team == 0 ? [MAP_WIDTH/2, MAP_HEIGHT - BASE_MARGIN] : [MAP_WIDTH/2, BASE_MARGIN];
}

const SpawnPositionForTeam = function(team, player_radius, base_radius) {
    let base_center = BasePositionForTeam(team);        
    let y_offset = team == 0 ? (base_radius + player_radius) : -(base_radius + player_radius);
    return Vector2Addition(base_center, [0, y_offset]);
}


//#endregion

module.exports = {
    NewGameRoom,
    UpdateGameRoom    
};