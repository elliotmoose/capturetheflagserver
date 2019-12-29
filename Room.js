const { NewPlayer } = require('./Player');

const ROOM_CAPACITY = 10;
/**
 * Creates a game room from an id. Each namespace corresponds to a game room
 * @param {*} io 
 * @param {*} id
 */
const NewGameRoom = function(io, id)
{
    let namespace = io.of(id);
    //creates the room
    var gameroom = {
        id,
        in_progress: false,
        state : {
            players : [],
            score: [0,0]
        },
        namespace
    }

    /**
     * 
     */
    namespace.on('connection', (client_socket)=>{
        console.log(`${client_socket} joined room ${id}`);

        //creates the respective player
        let player = NewPlayer("temp_user_id", client_socket);            

        //adds player to the room        
        gameroom.state.players.push(player);    

        //hooks up controls
        client_socket.on('controls', ()=>{
            console.log(`Room received player's controls ${client_socket.id}`);            
            for(let player of gameroom.state.players)
            {
                player.position[1] += 50;
                player.position[0] = 100;
            }
        });

        client_socket.emit('hello');
    });
    
    return gameroom;
}

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

    if(room.state.players.length == ROOM_CAPACITY) {
        StartGame(room);
        return true;                
    }    

    return false;
}

const StartGame = function(room) {

}

const UpdateGameRoom = function(gameroom, io){
    DispatchStateForGameRoom(gameroom, io);
}

const DispatchGameBegin = function(gameroom, io) {
    for(let player of gameroom.state.players) {
        io.to(player.socket_id).emit("GAME_BEGIN");
    }
}

const DispatchStateForGameRoom = function(gameroom, io)
{        
    console.log(JSON.stringify(gameroom.state));
    io.of(gameroom.id).emit('GAME_STATE', gameroom.state);          
}

module.exports = { NewGameRoom, UpdateGameRoom, DispatchStateForGameRoom, JoinRoom, DispatchGameBegin};