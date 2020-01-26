const uuid = require('uuid');
const MySQLDriver = require('mysqldriver');

/**
 * Maintains reference to database connection
 * @type {MySQLDriver} db
 */
var db;

// let users = {
//     '12345' : {
//         id: '12345',
//         username: 'elliotmoose'
//     },
//     '54321' : {
//         id: '54321',
//         username: 'enyi'
//     },
//     '12321' : {
//         id: '12321',
//         username: 'bgourd'
//     },
// }

/**
 * 
 * @param {*} user_id 
 */
const GetUserFromId = async (user_id)=> {
    let user = await db.getRecord('users', {id: user_id});

    if(user !== undefined) {
        return user;
    }
    else {
        throw {
            status: 'USER_MISSING',
            statusText: 'User Missing',
            message: 'This user does not exist'
        }
    }    
}

/**
 * 
 * @param {*} username 
 */
const CreateNewUser = async (username, device_id) => {
    let id = uuid.v1();

    let user = await db.getRecord('users', {device_id});

    if(user !== undefined) {
        return user;
    }
    else {        
        let new_user = {id, username, device_id, date_created: Date.now()}
        await db.insertRecord('users', new_user);
        // users[id] = { id, username };        
        return new_user;
    }    
}

const AddUserStats = async (win, lose, flags, user_id) => {
    
    let user = await db.getRecord('users', {id:user_id});

    if(user !== undefined) {
        await db.updateRecords('users', {
            wins: user.wins + win, 
            losses: user.losses + lose, 
            flags: user.flags + flags
        }, {id:user_id});
    }
    else {        
        console.log(`Could not find user with id: ${user_id}`);
    }   
};

const InitializeUserManager = (db_ref) => {
    db = db_ref;
}
module.exports = { InitializeUserManager, CreateNewUser, GetUserFromId, AddUserStats };