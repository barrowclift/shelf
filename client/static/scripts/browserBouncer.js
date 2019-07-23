if (navigator.userAgent.indexOf("MSIE") != -1) {
    var toHide = document.getElementById("browserSupported");
    toHide.style = "display: none !important";
    var toShow = document.getElementById("browserNotSupported");
    toShow.style = "display: block !important";
    var message = document.getElementById("errorMessage");
    message.innerHTML = "Internet Explorer is not a modern browser, please use literally anything else.";
} else if (navigator.userAgent.indexOf("OPR") != -1) {
    var toHide = document.getElementById("browserSupported");
    toHide.style = "display: none !important";
    var toShow = document.getElementById("browserNotSupported");
    toShow.style = "display: block !important";
    var message = document.getElementById("errorMessage");
    message.innerHTML = "Opera is not a modern browser, please use literally anything else.";
} else if (navigator.userAgent.indexOf("Safari") != -1) {
    var versionIndex = navigator.userAgent.indexOf("Version/") + "Version/".length;
    var majorVersionIndex = parseInt(navigator.userAgent.indexOf("\.", versionIndex));
    var majorVersion = parseInt(navigator.userAgent.substring(versionIndex, majorVersion));
    const MINIMUM_REQUIRED_VERSION = 10;
    if (majorVersion < MINIMUM_REQUIRED_VERSION) {
        var toHide = document.getElementById("browserSupported");
        toHide.style = "display: none !important";
        var toShow = document.getElementById("browserNotSupported");
        toShow.style = "display: block !important";
        var message = document.getElementById("errorMessage");
        message.innerHTML = "Your version of Safari is outdated. Please update to Safari " + MINIMUM_REQUIRED_VERSION + " or newer.<br><br>Alternatively, download the latest version of Chrome or Firefox instead.";
    }
} else if (navigator.userAgent.indexOf("Edge") != -1) {
    var versionIndex = navigator.userAgent.indexOf("Edge/") + "Edge/".length;
    var majorVersionIndex = parseInt(navigator.userAgent.indexOf("\.", versionIndex));
    var majorVersion = parseInt(navigator.userAgent.substring(versionIndex, majorVersion));
    const MINIMUM_REQUIRED_VERSION = 14;
    if (majorVersion < MINIMUM_REQUIRED_VERSION) {
        var toHide = document.getElementById("browserSupported");
        toHide.style = "display: none !important";
        var toShow = document.getElementById("browserNotSupported");
        toShow.style = "display: block !important";
        var message = document.getElementById("errorMessage");
        message.innerHTML = "Your version of Edge is outdated. Please update to Edge " + MINIMUM_REQUIRED_VERSION + " or newer.<br><br>Alternatively, download the latest version of Chrome or Firefox instead.";
    }
} else if (navigator.userAgent.indexOf("Firefox") != -1) {
    var versionIndex = navigator.userAgent.indexOf("Firefox/") + "Firefox/".length;
    var majorVersionIndex = parseInt(navigator.userAgent.indexOf("\.", versionIndex));
    var majorVersion = parseInt(navigator.userAgent.substring(versionIndex, majorVersion));
    const MINIMUM_REQUIRED_VERSION = 51;
    if (majorVersion < MINIMUM_REQUIRED_VERSION) {
        var toHide = document.getElementById("browserSupported");
        toHide.style = "display: none !important";
        var toShow = document.getElementById("browserNotSupported");
        toShow.style = "display: block !important";
        var message = document.getElementById("errorMessage");
        message.innerHTML = "Your version of Firefox is outdated. Please update to Firefox " + MINIMUM_REQUIRED_VERSION + " or newer <a href='https://www.mozilla.org/en-US/firefox/new/'>here</a>.<br><br>Alternatively, download the latest version of Chrome instead.";
    }
}