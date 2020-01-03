/**
 * Creates a template player
 * @param {*} client_socket 
 */
const NewPlayer = function(user_id, client_socket, team){
    return {
        username : 'john_doe',
        id: user_id,
        socket_id: client_socket.id,
        position: [0,0], //x, y        
        max_stamina: 100,
        current_stamina: 100,
        sprint_speed: 6,
        default_speed: 3,
        current_speed: 3, 
        radius: 20, //player radius
        reach: 20, //action radius = size+reach
        angle : null,
        action: false, //catch/take flag/pass flag
        sprint: false,
        team: team,
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