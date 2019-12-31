/**
 * Creates a template player
 * @param {*} client_socket 
 */
const NewPlayer = function(user_id, client_socket){
    return {
        username : 'john_doe',
        id: user_id,
        socket_id: client_socket.id,
        position: [0,0], //x, y        
        max_stamina: 100,
        current_stamina: 100,
        sprint_speed: 10,
        default_speed: 4,
        current_speed: 4, 
        size: 20, //player radius
        reach: 10, //action radius = size+reach
        action: false, //catch/take flag/pass flag
        sprint: false,
        team: 0,
        prison: false,
        controls : {
            angle: null,
            action: false,
            sprint: false,
            timestamp: Date.now() 
        }     
    }
}

module.exports = { NewPlayer };