const uuid = require('uuid');

let users = {
    '12345' : {
        id: '12345',
        username: 'elliotmoose'
    },
    '54321' : {
        id: '54321',
        username: 'enyi'
    },
    '12321' : {
        id: '12321',
        username: 'bgourd'
    },
}

//TODO: read from db
const GetUserFromId = async (user_id)=> {
    return new Promise((res,rej) => {
        let user = users[user_id];
        if(!user) {
            console.log('could not find user with id: ' + user_id)
        }
        res(user);
    });
}

//TODO: read/write from/to db
const CreateNewUser = async (username) => {
    return new Promise((res, rej) => {
        let id = uuid.v1();
        if(users[id]) {
            rej({
                status: 'DUPLICATE_USER_ID',
                statusText: 'Error',
                message: 'Internal Error. Please try again',
            });
        }
        
        users[id] = { id, username };        
        res({ id, username });
    });
}

module.exports = { GetUserFromId, CreateNewUser };