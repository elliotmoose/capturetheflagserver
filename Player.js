/**
 * Creates a template player
 * @param {*} client_socket 
 */
const NewPlayer = function(user_id, client_socket){
    return {
        username : '',
        user_id: user_id,
        socket_id: client_socket.id,
        position: [0,0], //x, y
        max_stamina: 100,
        cur_stamina: 100,
        sprint_speed: 8,
        cur_speed: 4      
    }
}

module.exports = { NewPlayer };