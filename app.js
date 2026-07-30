tlet rotationTime = 45;
let shiftData = [];
let timerIntervals = {};
let timersPaused = false;
let alertedPositions = [];
let savedShiftKey = "HeatSyncActiveShift";
let announcedSwitches = [];
let audioUnlocked = false;
const positions = [
  "Cash 1",
  "Cash 2",
  "IPOS 1",
  "IPOS 2",
  "IPOS 3",
  "IPOS 4",
  "Expo 1",
  "Expo 2"
];



function loadPositions(){

const container =
document.getElementById("positions");

container.innerHTML="";


positions.forEach(position=>{


let card=document.createElement("div");

card.className="position-card";


card.innerHTML=`

<h3>${position}</h3>

<input id="${position}-outside"
placeholder="Outside Employee">

<input id="${position}-inside"
placeholder="Inside Partner">

`;


container.appendChild(card);


});

}




function setRotation(minutes){

rotationTime = minutes;


document.getElementById("rotationDisplay").innerText =
"Current Rotation: " + minutes + " Minutes";

}






function startShift(){

shiftData=[];


positions.forEach(position=>{


let outside =
document.getElementById(`${position}-outside`).value || "None";


let inside =
document.getElementById(`${position}-inside`).value || "None";



shiftData.push({

position: position,

outside: outside,

inside: inside,

switchTime:
Date.now() + (rotationTime * 60 * 1000)

});


});



document.getElementById("setupCard").style.display="none";

document.getElementById("teamSetup").style.display="none";

document.querySelector(".start-button").style.display="none";


document.getElementById("dashboard").style.display="block";


document.getElementById("dashboardRotation").innerText =
"Current Rotation: " + rotationTime + " Minutes";


renderDashboard();

}






function getSecondsRemaining(person){


let difference =
person.switchTime - Date.now();


return Math.floor(difference / 1000);


}







function renderDashboard(){

const container =
document.getElementById("dashboardPositions");


container.innerHTML="";


updateAttentionBanner();



shiftData.forEach((person,index)=>{


let seconds =
getSecondsRemaining(person);


let status="green";


if(seconds <=300 && seconds >0){

status="yellow";

}


if(seconds <=0){

status="red";

}



let card=document.createElement("div");


card.className =
"position-card " + status;



card.innerHTML=`

<h2>${person.position}</h2>


<p>
Outside:
<b>${person.outside}</b>
</p>


<p>
Inside:
<b>${person.inside}</b>
</p>


<h1>

${
seconds <=0

?

"🔴 SWITCH NOW<br>OVERDUE " +
formatTime(Math.abs(seconds))

:

formatTime(seconds)

}

</h1>


<button onclick="switchConfirm(${index})">

I'M BACK — START PARTNER TIMER

</button>

`;



container.appendChild(card);


});



}




function startTimers(){


clearInterval(timerIntervals.main);



timerIntervals.main =
setInterval(()=>{


if(!timersPaused){

renderDashboard();

}


},1000);


}






function changeShiftRotation(minutes){


let oldRotation =
rotationTime;


let difference =
oldRotation - minutes;



rotationTime = minutes;



shiftData.forEach(person=>{


person.switchTime -=
difference * 60 * 1000;


});



document.getElementById("dashboardRotation").innerText =
"Current Rotation: " + minutes + " Minutes";


document.getElementById("rotationMessage").innerText =

"🔥 Heat increased. Timers adjusted from "
+ oldRotation +
" to "
+ minutes +
" minutes.";



renderDashboard();

}







function pauseTimers(){

timersPaused=true;


document.getElementById("pauseMessage").innerText =
"⏸ HEATSYNC PAUSED";

}



function resumeTimers(){

timersPaused=false;


document.getElementById("pauseMessage").innerText =
"🔥 HEATSYNC ACTIVE";


renderDashboard();

}







function switchConfirm(index){


let person =
shiftData[index];


let answer =
confirm(

"CONFIRM SWITCH\n\n" +

person.outside +

" is back inside.\n\n" +

person.inside +

" is now outside."

);



if(answer){


let oldOutside =
person.outside;


person.outside =
person.inside;


person.inside =
oldOutside;



person.switchTime =
Date.now() +
(rotationTime * 60 * 1000);



alertedPositions =
alertedPositions.filter(
x => x !== person.position
);



renderDashboard();


}


}







function updateAttentionBanner(){


let banner =
document.getElementById("attentionBanner");


if(!banner)return;



let alerts=[];


shiftData.forEach(person=>{


let seconds =
getSecondsRemaining(person);



if(seconds <=0){


alerts.push(

"🚨 " +
person.position +
"<br>" +

person.outside +
" switch with " +
person.inside +

"<br>OVERDUE " +

formatTime(Math.abs(seconds))

);


}


});



if(alerts.length===0){


banner.innerHTML =
"✅ ALL ROTATIONS ON TRACK";

banner.style.background="#dcfce7";


}

else{


banner.innerHTML =
alerts.join("<br><br>");

banner.style.background="#fee2e2";


}



banner.style.padding="25px";

banner.style.borderRadius="18px";

banner.style.fontSize="24px";

banner.style.fontWeight="bold";

banner.style.textAlign="center";


}





function formatTime(seconds){

let minutes =
Math.floor(seconds/60);


let secs =
seconds % 60;


return minutes +
":" +
secs.toString().padStart(2,"0");

}




function saveShift(){

let data = {

rotationTime: rotationTime,

shiftData: shiftData,

timersPaused: timersPaused

};


localStorage.setItem(
savedShiftKey,
JSON.stringify(data)
);
function unlockAudio(){

    if(audioUnlocked){
        return;
    }

    let audio = new Audio();

    audio.volume = 0;

    audio.play()
    .then(()=>{
        audioUnlocked = true;
    })
    .catch(()=>{});

}



function playAlertSound(){

    let sound = new Audio(
    "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
    );

    sound.volume = 1;

    sound.play()
    .catch(()=>{});

}



function speakSwitch(person){

    if(!person){
        return;
    }


    let message =
    person.outside +
    ", it's time to switch with " +
    person.inside +
    " at " +
    person.position;


    let speech =
    new SpeechSynthesisUtterance(message);


    speech.rate = 0.9;
    speech.pitch = 1;


    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(speech);

}



function testAlert(){

    unlockAudio();

    playAlertSound();


    let testPerson = {

        outside:"Sally",

        inside:"Joe",

        position:"Cash 1"

    };


    speakSwitch(testPerson);

}
}
window.onload=function(){

loadPositions();

startTimers();

};
