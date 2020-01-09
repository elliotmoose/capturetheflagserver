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

module.exports = { GetUserFromId };