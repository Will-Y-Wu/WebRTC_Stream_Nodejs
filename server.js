const https = require('https');
const fs = require('fs');
const express = require('express');
const app = express();
const WebSocketServer = require('ws').Server;


const cred = {
    key: fs.readFileSync('serverkey.pem'),
    cert: fs.readFileSync('server.pem'),
    passphrase:'545723',
    requestCert:false,
    rejectUnauthorized:false,
    ca:[fs.readFileSync('cacert.pem')]
};
const sServer = https.createServer(cred, app).listen(2400);

app.set("view engine",'ejs');
app.use("/assets",express.static(__dirname+"/public"));
app.get('/',(req,res)=>{
	res.render("index");
});

const webSS = new WebSocketServer({ server: sServer});

const user = {}; // using hash-map to store users info
webSS.on('connection', conn => {
    console.log("user connected");

    conn.on("message", message => {
        let client;

        try {
            client = JSON.parse(message);
        } catch (e) {
            console.error(e);
            client = {};
        }

        switch (client.type) {
            case "login":
                if (user[client.name]) {
                    console.log("User logged in: " + client.name);
                    sendMsgTo(conn, {
                        type: "login",
                        success: true
                    });
                } else {
                    user[client.name] = conn;
                    conn.name = client.name;
                    console.log("new user " + client.name);
                    sendMsgTo(conn, { type: "login", success: false });
                }
                break;

            case "sdp-offer":
                console.log("Send offer to" + client.targetName);
                if (user[client.targetName]) {
			conn.targetName=client.targetName;
                    	sendMsgTo(user[client.targetName], {
                        	type: client.type,
                        	offer: client.offer,
                        	sendFrom: client.name
                    	});
                }else{
			console.log("The receiver hasn't logged in :"+client.targetName);
			sendMsgTo(conn,{
				type:"error",
				message:"The other participant hasn't logged in yet "+client.type 
			});
		}
                break;

            case "sdp-answer":
                console.log("Send answer back to " + client.targetName);
                if (user[client.targetName]) {
			conn.targetName=client.targetName;
                    	sendMsgTo(user[client.targetName], {
                        	type: client.type,
                        	answer: client.answer
                    	})
                }else{
			console.log("The sender is offline");
			sendMsgTo(conn,{
				type:'error',
				message:"The other participant is offline "+client.type
			});
		}
            	break;
	    	
	    case "ice-candidate":
		console.log("Start ICE with "+client.targetName);

			if(user[client.targetName]){
				conn.targetName=client.targetName;
				sendMsgTo(user[client.targetName],{
					type:client.type,
					candidate:client.candidate
				});
			
               		 }else{
			console.log("The receiver is offline");
			sendMsgTo(conn,{
				type:'error',
				message:"The other participant is offline "+client.type
			});
			}		
		break;
	  
	    case "hangup":
			console.log("Hang up call from: "+client.name);
			
			if(conn.targetName){
			sendMsgTo(user[conn.targetName],{type:'hangup'});
			conn.targetName=null;
			}

            default:
                sendMsgTo(conn, { type: "error", message: "Unrecognized msg type" + client.type });
            	break;
        }

    });

    conn.on('close', () => {
        if (conn.name) {
            delete user[conn.name];
        }

	if(conn.targetName){
		sendMsgTo(user[conn.targetName],{type:"hangup"});
		conn.targetName=null;
	}
    });
});

function sendMsgTo(target, message) {
    target.send(JSON.stringify(message));
}

webSS.on('listening',()=> console.log("Websocket Server is listening"));
