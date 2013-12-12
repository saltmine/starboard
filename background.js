function getKeepmark() {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "https://keep.com/keepmark_js", true);
  xhr.onreadystatechange = function(resp) {
    if (xhr.readyState == 4) {
      chrome.tabs.executeScript(null, {code: xhr.responseText});
    }
  }
  xhr.send();
}

chrome.browserAction.onClicked.addListener(function(tabs) {
  getKeepmark();
});

chrome.commands.onCommand.addListener(function(command) {
  getKeepmark();
});