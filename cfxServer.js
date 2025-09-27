// -- node packages
let bigBang = Date.now();
const ws = require('ws');
const fetchUrl = require("fetch").fetchUrl
const got = require('got');
const path = require('path')
const colors = require('colors');
const mysql = require('mysql');
const fs = require('fs');
// -- variables
let mKiwi;
let DBConn_Server = null;
let TwitchClientId = null;
let streamerName = null;
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
function FetchAuth(){
    return new Promise((resolve, reject)=>{
        if(DBConn_Server!=null){                
            DBConn_Server.end();
            DBConn_Server = null;
        }        
        const dbDeets = GetConvar("mysql_connection_string","");
        DBConn_Server = new mysql.createConnection(dbDeets);
        DBConn_Server.connect(function(err) {
            if (err) 
                throw err;
            });
            let qStr = `SELECT * from twitch`
            DBConn_Server.query(qStr, function (error, results, fields) {
            if (error) {
                reject(error)
                return;
            };
            //
            let ta = JSON.parse(results[0].Auth);
            let tid = JSON.parse(results[0].Oauth_owner)
            TwitchClientId = tid.client_id;
            streamerName = tid.username;
            currentTokens = ta;
            resolve(ta)
        });
        DBConn_Server.on('error', function(err) {
            console.log('DB CONNECTION ERROR', err.code); // 'ER_BAD_DB_ERROR'
            DBConn_Server.end();
            let reconn = setTimeout(() => {
                DBConn_Server.connect();
            }, 5000);              
        });
    })
}
getPlayers = () => {
    const num = GetNumPlayerIndices();
    let t = [];
    for (let i = 0; i < num; i++) {
        t[i] = GetPlayerFromIndex(i);
    }
    return t;
}
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
// twitch functions
function TwitchSubcribe(dataObj){
    //
}
function TwitchSubGift(dataObj){
    //
}
function TwitchSubMessage(dataObj){
    //
}
function TwitchFollow(dataObj){
    //
}
function TwitchRaid(dataObj){
    //
}
function TwitchOnline(dataObj){
    //
}
function TwitchBits(dataObj){
    setImmediate(()=>{
        emitNet('chat:addMessage', -1, {
            color: [186, 218, 85],
            args: [`REWARD EVENT:`,`<${dataObj.display_name}> Donated ${dataObj.bits} Bits to everyone's Banks.`]
        });
        let pList = getPlayers() 
        pList.forEach(pObj => {
            emit('mkstats:client:inccash', [pObj, dataObj.bits])
            console.log('Bits Equivalent Delivered:', pObj)
        });
    })
}
function TwitchCPAutoRedemption(dataObj){
    switch(dataObj.event.reward.type){
        case 'send_highlighted_message':
            setImmediate(()=>{
                emitNet('chat:addMessage', -1, {
                    color: [186, 218, 85],
                    args: [`TwitchChat <${dataObj.event.user_name}> `, dataObj.event.message.text]
                });
            })
            console.log(colors.green('Highlighted Text'), dataObj.event.message.text)
        break;
        default:
            // console.log('UNREGISTERED CHANNEL POINT AUTO REDEEM', `${rewardData.title} [${redeemer.display_name}]`, rewardData)                
    }
}
function TwitchCPCustomRedemption(dataObj){
    switch(dataObj.reward.title){
        case 'kiwisdebugbutton':
            if (dataObj.redeemer.login == 'mikethemadkiwi'){                    
                setImmediate(()=>{
                    let pList = getPlayers() 
                    pList.forEach(pObj => {
                        TriggerEvent('mkstats:client:inccash', [pObj, 1000])
                        console.log('Bits Equivalent Delivered:', pObj)
                    });
                })
            }
        break;
        case 'FiveMJumpScare':
            console.log('fivemjumpscareredemption', dataObj.redeemer.login)
            setImmediate(()=>{
                emitNet('chat:addMessage', -1, {
                    color: [186, 218, 85],
                    args: [`JUMPSCARE EVENT:`,`<${dataObj.display_name}> Donated 0 Bits to everyone's Banks.`]
                });
                let pList = getPlayers() 
                pList.forEach(pObj => {
                    TriggerEvent('mkstats:client:inccash', [pObj, 1000])
                    console.log('Bits Equivalent Delivered:', pObj)
                });
            })
        break;
        default:
            // console.log('UNREGISTERED CHANNEL POINT CUSTOM REDEEM', `${dataObj.reward.title} [${dataObj.redeemer.display_name}]`, dataObj)                
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////

  // INITSOCKET COURTESY OF BARRYCARLYON /////////////////////////////////////
 //    https://github.com/BarryCarlyon/twitch_misc/tree/main/eventsub      //
////////////////////////////////////////////////////////////////////////////
class initSocket {
    counter = 0
    closeCodes = {
        4000: 'Internal Server Error',
        4001: 'Client sent inbound traffic',
        4002: 'Client failed ping-pong',
        4003: 'Connection unused',
        4004: 'Reconnect grace time expired',
        4005: 'Network Timeout',
        4006: 'Network error',
        4007: 'Invalid Reconnect'
    }
    constructor(connect) {
        this._events = {};

        if (connect) {
            this.connect();
        }
    }
    connect(url, is_reconnect) {
        this.eventsub = {};
        this.counter++;
        url = url ? url : 'wss://eventsub.wss.twitch.tv/ws';
        is_reconnect = is_reconnect ? is_reconnect : false;
        console.log(`Connecting to ${url}|${is_reconnect}`);
        this.eventsub = new ws(url);
        this.eventsub.is_reconnecting = is_reconnect;
        this.eventsub.counter = this.counter;
        this.eventsub.addEventListener('open', () => {
            console.log(`Opened Connection to Twitch`);
        });
        this.eventsub.addEventListener('close', (close) => {
            if (!this.eventsub.is_reconnecting) {
                this.connect();
            }
            if (close.code == 1006) {
                this.eventsub.is_reconnecting = true;
            }
        });
        this.eventsub.addEventListener('error', (err) => {
            console.log(err);
            console.log(`${this.eventsub.twitch_websocket_id}/${this.eventsub.counter} Connection Error`);
        });
        this.eventsub.addEventListener('message', (message) => {
            let { data } = message;
            data = JSON.parse(data);
            let { metadata, payload } = data;
            let { message_id, message_type, message_timestamp } = metadata;
            switch (message_type) {
                case 'session_welcome':
                    let { session } = payload;
                    let { id, keepalive_timeout_seconds } = session;
                    this.eventsub.twitch_websocket_id = id;
                    if (!this.eventsub.is_reconnecting) {
                        this.emit('connected', id);
                    } else {
                        this.emit('reconnected', id);
                    }
                    this.silence(keepalive_timeout_seconds);
                    break;
                case 'session_keepalive':
                    this.emit('session_keepalive');
                    this.silence();
                    break;
                case 'notification':
                    let { subscription, event } = payload;
                    let { type } = subscription;
                    this.emit('notification', { metadata, payload });
                    this.emit(type, { metadata, payload });
                    this.silence();
                    break;
                case 'session_reconnect':
                    this.eventsub.is_reconnecting = true;
                    let reconnect_url = payload.session.reconnect_url;
                    console.log('Connect to new url', reconnect_url);
                    console.log(`${this.eventsub.twitch_websocket_id}/${this.eventsub.counter} Reconnect request ${reconnect_url}`)
                    this.connect(reconnect_url, true);
                    break;
                case 'websocket_disconnect':
                    console.log(`${this.eventsub.counter} Recv Disconnect`);
                    console.log('websocket_disconnect', payload);
                    break;
                case 'revocation':
                    console.log(`${this.eventsub.counter} Recv Topic Revocation`);
                    console.log('revocation', payload);
                    this.emit('revocation', { metadata, payload });
                    break;
                default:
                    console.log(`${this.eventsub.counter} unexpected`, metadata, payload);
                    break;
            }
        });
    }
    trigger() {
        this.eventsub.send('cat');
    }
    close() {
        this.eventsub.close();
    }
    silenceHandler = false;
    silenceTime = 10;
    silence(keepalive_timeout_seconds) {
        if (keepalive_timeout_seconds) {
            this.silenceTime = keepalive_timeout_seconds;
            this.silenceTime++;
        }
        clearTimeout(this.silenceHandler);
        this.silenceHandler = setTimeout(() => {
            this.emit('session_silenced');
            this.close();
        }, (this.silenceTime * 1000));
    }
    on(name, listener) {
        if (!this._events[name]) {
            this._events[name] = [];
        }
        this._events[name].push(listener);
    }
    emit(name, data) {
        if (!this._events[name]) {
            return;
        }
        const fireCallbacks = (callback) => {
            callback(data);
        };
        this._events[name].forEach(fireCallbacks);
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
class MKUtils {
    fetchUserByName = function(name){
        return new Promise((resolve, reject) => {
            let tmpAuth = currentTokens.access_token;
            let fetchu = fetchUrl(`https://api.twitch.tv/helix/users?login=${name}`,
            {"headers": {
                    "Client-ID": TwitchClientId,
                    "Authorization": "Bearer " + tmpAuth
                    }
            },
            function(error, meta, body){
                    let bs = JSON.parse(body);
                    resolve(bs.data)
            })
        })
    }
    SubscribeToTopic = async function(session_id, type, version, condition){    
        return new Promise((resolve, reject) => {
            console.log("Eventsocket Topic:", session_id, type)
            let tmpAuth = currentTokens.access_token;
            got({
                "url": "https://api.twitch.tv/helix/eventsub/subscriptions",
                "method": 'POST',
                "headers": {                            
                    "Client-ID": TwitchClientId,
                    "Authorization": "Bearer " + tmpAuth,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type,
                    version,
                    condition,
                    transport: {
                        method: "websocket",
                        session_id
                    }
                }),
                "responseType": 'json'
            })
            .then(resp => {
                let msgData = resp.body.data;
                console.log(msgData[0].type, msgData[0].status)
                resolve(resp.body.data)               
            })
            .catch(err => {
                console.error('Error body:', err);
                reject(false)
            });
        })
    }
}
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////////
let startNow = setTimeout(async () => {
    let _mk = new MKUtils;
    let auth = await FetchAuth();
    mKiwi = await _mk.fetchUserByName(streamerName)
    let eventSub = new initSocket(true);
    eventSub.on('session_keepalive', () => {
        lastKeepAlive = new Date();
    });
    eventSub.on('connected', (id) => {
        console.log(`Connected to WebSocket with ${id}`, mKiwi[0].id);  
        _mk.SubscribeToTopic(id, 'stream.online', '1', { broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.follow', '2', { broadcaster_user_id: mKiwi[0].id, moderator_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.raid', '1', { to_broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.bits.use', '1', { broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.channel_points_custom_reward_redemption.add', '1', { broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.channel_points_automatic_reward_redemption.add', '2', { broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.subscribe', '1', { broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.subscription.gift', '1', { broadcaster_user_id: mKiwi[0].id })
        _mk.SubscribeToTopic(id, 'channel.subscription.message', '1', { broadcaster_user_id: mKiwi[0].id })
    });
    eventSub.on('session_silenced', () => {
        let msg = 'Session mystery died due to silence detected';
        console.log(msg)
    });
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
    eventSub.on('channel.subscribe', function({ payload }){
        let subObj = {
            display_name: payload.event.user_name,
            login: payload.event.user_login,
            id: payload.event.user_id,
            tier: payload.event.tier,
            is_gift: payload.event.is_gift
        }
        TwitchSubcribe(subObj)
        emitNet('mad:twitchevents:subscribe', -1, subObj)
    });
    eventSub.on('channel.subscription.gift', function({ payload }){
        let subObj = {
            display_name: payload.event.user_name,
            login: payload.event.user_login,
            id: payload.event.user_id,
            tier: payload.event.tier,
            total: payload.event.total,
            cumulative_total: payload.event.cumulative_total,
            is_anonymous: payload.event.is_anonymous
        }
        TwitchSubGift(subObj)
        emitNet('mad:twitchevents:subgift', -1, subObj)
    });
    eventSub.on('channel.subscription.message', function({ payload }){
        let subObj = {
            display_name: payload.event.user_name,
            login: payload.event.user_login,
            id: payload.event.user_id,
            tier: payload.event.tier,
            cumulative_months: payload.event.cumulative_months,
            streak_months: payload.event.streak_months,
            duration_months: payload.event.duration_months,
            message: payload.event.message
        }
        TwitchSubMessage(subObj)
        emitNet('mad:twitchevents:submessage', -1, subObj)
    });
    eventSub.on('stream.online', function({ payload }){
        console.log('stream.online',payload)
        let onlineObj = {
            type: payload.event.type,
            started_at: payload.event.started_at
        }
        TwitchOnline(onlineObj)
        emitNet('mad:twitchevents:submessage', -1, onlineObj)
    });
    eventSub.on('channel.follow', function({ payload }){
        console.log('channel.follow', payload.event.user_name)
        let followObj = {
            display_name: payload.event.user_name,
            login: payload.event.user_login,
            id: payload.event.user_id,
        }
        TwitchFollow(followObj)
        emitNet('mad:twitchevents:follow', -1, followObj)
    });
    eventSub.on('channel.raid', function({ payload }){
        console.log('channel.raid',payload.event.from_broadcaster_user_name, payload.event.viewers)
        let raidObj = {
            id: payload.event.from_broadcaster_user_id,
            login: payload.event.from_broadcaster_user_login,
            display_name: payload.event.from_broadcaster_user_name,
            viewers: payload.event.viewers
        }
        TwitchRaid(raidObj)
        emitNet('mad:twitchevents:raid', -1, raidObj)
    });
    eventSub.on('channel.bits.use', function({ payload }){
        console.log('channel.bits.use',payload)
        let bitsObj = {
            display_name: payload.event.user_name,
            login: payload.event.user_login,
            id: payload.event.user_id,
            bits: payload.event.bits,
            type: payload.event.type,
            power_up: payload.event.power_up,
            message: payload.event.message,
        }
        TwitchBits(bitsObj)
        emitNet('mad:twitchevents:bits', -1, bitsObj)        
    });
    eventSub.on('channel.channel_points_custom_reward_redemption.add', async function({ payload }){ 
        let tUser = await _mk.fetchUserByName(payload.event.user_login)
        let rewardData = {redeemer: {
            display_name: payload.event.user_name,
            login: payload.event.user_login,
            id: payload.event.user_id,
            user_input: payload.event.user_input
        }, reward: payload.event.reward, user: tUser}
        TwitchCPCustomRedemption(rewardData)
        emitNet('mad:twitchevents:customredemption', -1, rewardData)
    });
    eventSub.on('channel.channel_points_automatic_reward_redemption.add', function({ payload }){
        TwitchCPAutoRedemption(payload)
        emitNet('mad:twitchevents:autoredemption', -1, payload)
    });
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////////////////////////////////
}, 500)