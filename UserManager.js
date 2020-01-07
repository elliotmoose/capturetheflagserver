let users = {
    '12345' : {
        id: '12345',
        username: 'elliotmoose'
    }
}

//TODO: read from db
const GetUserFromId = async (user_id)=> {
    return new Promise((res,rej) => {
        res(users[user_id]);
    });
}

module.exports = { GetUserFromId };