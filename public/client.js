const conn = new WebSocket("wss://projectwoo.hopto.org:2400");
let conn_partner, myname;
const click_call = document.querySelector("#call");
const videos = document.querySelector(".video_container");
const self_video = document.querySelector("#self_video");
const partner_video = document.querySelector("#partner_video");
let input_username = document.querySelector("#username");
const click_username = document.querySelector("#button_username");
let input_Pname = document.querySelector("#partner_name");
const click_hangup = document.querySelector("#hangup");
let myStream;
const RTCpeerconn = new RTCPeerConnection({
    iceServers: [{

        urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302", "stun:stun3.l.google.com:19302", "stun:stun4.l.google.com:19302"]
    }]
});
//fullscren API
videos.requestFullscreen = videos.webkitRequestFullscreen || videos.mozRequestFullscreen || videos.requestFullscreen;
videos.addEventListener('dblclick', () => videos.requestFullscreen());
conn.onopen = () => {
    console.log("Websocket connected with Server")
};
//WebsocketConnection
conn.onmessage = message => {
    console.log("Got message", message.data);
    let msg = JSON.parse(message.data);

    switch (msg.type) {
        case "login":
            msg.success ? alert("user logged in") : alert("new user created");
            break;

        case "sdp-offer":
            alert("call offering from: " + msg.sendFrom);
            console.log("sdp-offer: " + msg.offer);
            onSDPoffer(msg.offer, msg.sendFrom);
            break;

        case "sdp-answer":
            console.log("SDP offer answer back" + msg.answer);
            onSDPanswer(msg.answer);
            break;

        case "ice-candidate":
            console.log("Receive ICE candidates: " + msg.candidate);
            onICE(msg.candidate);
            break;

        case "hangup":
            alert("Communication has been ended by opponent");
            onHangup();
            break;

        default:
            console.log("unrecognized type");
            break;
    };
};

conn.onerror = err => { console.log("error message" + err) };

click_username.addEventListener('click', e => {
    myname = input_username.value;
    alert(myname);
    if (myname.length > 0) {
        sendMsg({
            type: 'login',
            name: myname
        });
    }

    navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
        aspectRatio: 1.7777777778
    }).then(stream => {
        myStream = stream;
        self_video.srcObject = stream;
    }).catch(e => { console.log(e.message); });


});

click_call.addEventListener('click', e => {
    conn_partner = input_Pname.value;
    addMedia();
    createSDPoffer();
});


function addMedia() {
    myStream.getTracks().forEach(track => { RTCpeerconn.addTrack(track, myStream) });
};

function createSDPoffer() {
    RTCpeerconn.createOffer().then(offer => RTCpeerconn.setLocalDescription(offer))
        .then(() => {
            console.log("RTCpeerconn.localDescription: " + RTCpeerconn.localDescription.sdp);
            sendMsg({
                type: "sdp-offer",
                offer: RTCpeerconn.localDescription, //check localDescription
                targetName: conn_partner,
                name: myname
            });
        }).catch(e => { console.log(e.message); });
};


function sendMsg(msg) {
    conn.send(JSON.stringify(msg));
};

function onSDPoffer(offer, partner) {
    conn_partner = partner;
    console.log("receive sdp offer: " + offer);
    RTCpeerconn.setRemoteDescription(offer).then(() => RTCpeerconn.createAnswer())
        .then(answer => RTCpeerconn.setLocalDescription(answer))
        .then(() =>
            sendMsg({
                type: "sdp-answer",
                targetName: partner,
                answer: RTCpeerconn.localDescription // try answer
            })
        ).catch(err => { console.log(err.message); });

    addMedia();
};

function onSDPanswer(answer) {
    RTCpeerconn.setRemoteDescription(answer).then(() => {
        console.log("OnSDPanswer, the answer is : " + answer + "the remoteDescription is:" + RTCpeerconn.remoteDescription);
    });
};

function onICE(candidate) {
    RTCpeerconn.addIceCandidate(candidate).then(() => {
        console.log("onICE,candidate is : " + candidate);
    });
};

function onHangup() {
    conn_partner = null;
    partner_video.srcObject = null;
    RTCpeerconn.close();
    RTCpeerconn.onicecandidate = null;
    RTCpeerconn.ontrack = null;
};

RTCpeerconn.onicecandidate = event => {
    if (event.candidate) {
        sendMsg({
            type: "ice-candidate",
            targetName: conn_partner,
            candidate: event.candidate
        });
    }
};

RTCpeerconn.ontrack = event => {
    partner_video.srcObject = event.streams[0];
};