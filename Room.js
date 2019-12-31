const { NewPlayer } = require("./Player");

const ROOM_CAPACITY = 10;
const CONTROLS_AGE_THRESHOLD = 700; //0.7s
const MAP_WIDTH = 1500;
const MAP_HEIGHT = 2500;

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
            flags: [],
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
    let currentPlayer = gameroom.state.players.filter(
        player => player.socket_id == client_socket.id
    )[0];

    if (controls.sprint) {
        if (currentPlayer.current_stamina > 0) {
            currentPlayer.current_speed = currentPlayer.sprint_speed;
            currentPlayer.sprint = true;
        } else {
            currentPlayer.current_speed = currentPlayer.default_speed;
            currentPlayer.sprint = false;
        }
    } else {
        currentPlayer.current_speed = currentPlayer.default_speed;
        currentPlayer.sprint = false;
    }

    if (controls.action) {
        currentPlayer.action = true;
    } else {
        currentPlayer.action = false;
    }

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
        if (player.controls.angle) {
            let x =
                player.position[0] +
                (player.current_speed *
                    Math.cos(player.controls.angle) *
                    deltaTime) /
                    10;
            let y =
                player.position[1] +
                (player.current_speed *
                    Math.sin(player.controls.angle) *
                    deltaTime) /
                    10;
            player.position = [x, y];
        }
    }
};

/**
 * Updates the stamina of players
 * @param {*} gameroom
 * @param {number} deltaTime
 */
// TODO: Determine good number to divide deltaTime by
const UpdatePlayerStaminas = (gameroom, deltaTime) => {
    for (let player of gameroom.state.players) {
        if (player.controls.sprint) {
            if (player.current_stamina > 0) {
                player.current_stamina = Math.max(
                    player.current_stamina - deltaTime / 10,
                    0
                );
            }
        } else {
            if (player.current_stamina < player.max_stamina) {
                player.current_stamina = Math.min(
                    player.current_stamina + deltaTime / 10,
                    player.max_stamina
                );
            }
        }
    }
};

const UpdateActions = function(gameroom) {
    let players = gameroom.state.players;
    let flags = gameroom.state.flags;
    let action_players = players.filter(p => p.action == true);

    for (let player_with_action of action_players) {
        let controls = player.controls;
        let players_in_range = PlayesrInRange(
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
    UpdateActions(gameroom);
    UpdatePlayerPositions(gameroom, deltaTime);
    UpdatePlayerStaminas(gameroom, deltaTime);
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
const PlayesrInRange = function(players, position, radius) {
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

//#region math
/**
 * a - b, where a and b are arrays of length 2
 * @param {Array} a
 * @param {Array} b
 */
const Vector2Subtract = function(a, b) {
    //a - b
    return [a[0] - b[0], a[1] - b[1]];
};

/**
 * a + b, where a and b are arrays of length 2
 * @param {Array} a
 * @param {Array} b
 */
const Vector2Addition = function(a, b) {
    //a - b
    return [a[0] + b[0], a[1] + b[1]];
};

/**
 * v * scale
 * @param {Array} v array of length 2
 * @param {number} scale number
 */
const Vector2Multiply = function(v, scale) {
    return [v[0] * scale, v[1] * scale];
};

const Vector2Magnitude = function(v) {
    return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
};

const Vector2Normalize = function(v) {
    //a - b
    let magnitude = Vector2Magnitude(v);
    return [v[0] / magnitude, v[1] / magnitude];
};

//#endregion

//#endregion

module.exports = {
    NewGameRoom,
    UpdateGameRoom,
    DispatchStateForGameRoom,
    JoinRoom,
    DispatchGameBegin
};
