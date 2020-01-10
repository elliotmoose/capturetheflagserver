const express = require('express');
const app = express.Router();

// const DB = db.ConnectWithDriver();
const bodyParse = require('body-parser');
const UserManager = require('../UserManager');

app.use(bodyParse.json({limit: '75mb'}));
app.use(bodyParse.urlencoded({limit: '75mb', extended: false }));



app.get('/', async (req,res) =>{
    
})

app.post('/signup', verifyAuth, async (req,res) =>{

    let username = req.body.username;
    // let score = req.body.score;
    // let deviceID = req.body.deviceID;
    let date = Date.now();

    try {
        try {
            CheckRequiredFields({username});
        } catch (error) {
            Error('MISSING_FIELDS','Missing Fields', error,res);
            return;
        }

        try {
            let newUser = await UserManager.CreateNewUser(username);
            console.log(newUser);
            Respond('SUCCESS',newUser,res);
            return;
        } catch (error) {
            Respond('ERROR', error ,res);
            return;
        }

    } catch (error) {
        console.log(error);
        InternalServerError(res, error);
        return
    }    
})


async function verifyAuth(req, res, next) {
    let secret = req.headers.authorization;

    if(secret != 'mooselliot')
    {
        Error('INVALID_AUTHORIZATION', 'Invalid Authorization','The request did not contain the required authorization token',res);
        return;
    }    

    next();
}

function Respond(status='SUCCESS',data=undefined, res, code = 200)
{
    var response = {
        status : status,
        data : data
    }        
    res.status(code);
    res.json(response);
}

function Error(status, statusText, message, res, code = 400)
{
    var response = {
        status : 'ERROR',
        error : {
            status : status,
            statusText : statusText,
            message: message
        }
    }

    res.status(code);
    res.json(response);
}

function CheckRequiredFields(object) {
    for (var key in object) {
        if (object[key] === undefined || object[key] === null || object[key] === '') {
            throw `Required value missing: ${key}`
        }
    }
}

function InternalServerError(res,error)
{
    if(error)
    {
        console.log(error)
    }
    
    res.status(500);
    res.json({status: 'EXCEPTION', error: {
        status: 'SERVER_ERROR',
        statusText: 'Server Error',
        message: 'An internal server error has occured. Please try again later',
        extra: error ? error: null
    }})
}
module.exports = app;