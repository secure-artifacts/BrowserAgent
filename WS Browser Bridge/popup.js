document.getElementById("btn").onclick=()=>{
  chrome.runtime.sendMessage({cmd:"connect_py"});
};
