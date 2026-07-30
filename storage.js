const savedShiftKey = "HeatSyncActiveShift";


function saveShiftData(shiftData, rotationTime, timersPaused){

let data = {

rotationTime: rotationTime,

shiftData: shiftData,

timersPaused: timersPaused,

savedAt: Date.now()

};


localStorage.setItem(
savedShiftKey,
JSON.stringify(data)
);

}



function loadShiftData(){

let saved =
localStorage.getItem(savedShiftKey);


if(!saved){

return null;

}


try{

return JSON.parse(saved);

}

catch(error){

console.log("Could not load saved shift:", error);

return null;

}

}



function clearShiftData(){

localStorage.removeItem(savedShiftKey);

}
