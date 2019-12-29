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
    id: "room_generated_uuid",
    state: {
        in_progress: false,
        players: [],
        score: [0, 0],
        flags: []
    },
    namespace: 'namespace_generated_uuid'
}

let player = {
    position: [0, 0],
    max_stamina: 100,
    current_stamina: 100
}



