/**
 * @file File zipper and unzipper utility for Toonboom Harmony Scripting Interface
 * @version 23.4.5
 * @copyright mihgehl < github.com/mihgehl >
 * @author mihgehl < github.com/mihgehl >
 */

/**
 * 
 */
function SevenZip(parentContext, source, destination, processStartCallback, progressCallback, onFinishCallback, debug) {
    if (typeof parentContext === "undefined") var parentContext = null;
    if (typeof source === "undefined") var source = null;
    if (typeof destination === "undefined") var destination = null;
    if (typeof processStartCallback === "undefined") var progressCallback = null;
    if (typeof onFinishCallback === "undefined") var onFinishCallback = null;
    if (typeof debug === "undefined") var debug = false;

    this.debug = debug;
    this.source = source;
    this.destination = destination;
    this.parentContext = parentContext;
    this.processStartCallback = processStartCallback;
    this.progressCallback = progressCallback;
    this.onFinishCallback = onFinishCallback;
    this.command = [];

    this.process = new QProcess();
}

Object.defineProperty(SevenZip.prototype, "binPath", {
    get: function () {
        if (typeof SevenZip.__proto__.binPath === "undefined") {
            if (about.isMacArch() || about.isLinuxArch()) {
                var sevenzipbin = new File(specialFolders.bin + "/bin_3rdParty/7za");
                if (sevenzipbin.exists) {
                    SevenZip.__proto__.binPath = sevenzipbin.fullName;
                    return sevenzipbin.fullName;
                }
                var sevenzipbin = new File(specialFolders.bin + "/../../external/macosx/p7zip/7za");
                if (sevenzipbin.exists) {
                    SevenZip.__proto__.binPath = sevenzipbin.fullName;
                    return sevenzipbin.fullName;
                }
            } else if (about.isWindowsArch()) {
                var sevenzipbin = new File(specialFolders.bin + "/bin_3rdParty/7z.exe");
                if (sevenzipbin.exists) {
                    SevenZip.__proto__.binPath = sevenzipbin.fullName;
                    return sevenzipbin.fullName;
                }
            }
            // MessageBox.critical("cannot find 7zip to compress template. aborting");
            // throw new Error("cannot find 7zip");
        } else {
            return SevenZip.__proto__.binPath;
        }
    },
});

SevenZip.prototype.zipAsync = function () {
    try {
        this.command = [
            "a",
            this.destination,
            this.source + "/*", // /* is for avoding 7zip to zip the outer folder, TODO: needs to be tested with files
            // "-xr!backups",
            // "-bsp1",
            // "-bse1",
            // "-bso1",
        ];

        this.process.start(this.binPath, this.command);

        if (typeof this.progressCallback !== "undefined") {
            this.process.readyReadStandardOutput.connect(this, function () {
                var output7z = new QTextStream(this.process.readAllStandardOutput()).readAll().match(/\d+(?:\.\d+)?%/);
                this.progressCallback.call(this.parentContext, parseInt(output7z)); // Passes the zipping progress as a command to a callback (progressCallback) passed on by the user as a argument
            });
        }

        if (typeof this.processStartCallback !== "undefined") {
            this.process["started()"].connect(this, function () {
                this.processStartCallback.call(this.parentContext);
            });
        }

        if (this.debug) {
            this.process.readyReadStandardOutput.connect(this, function () {
                try {
                    this.log(new QTextStream(this.process.readAllStandardOutput()).readAll());
                    this.log(new QTextStream(this.process.readAllStandardError()).readAll());
                } catch (error) {
                    this.log(error);
                }
            });
        }

        if (typeof this.onFinishCallback !== "undefined") {
            this.process["finished(int)"].connect(this, function () {
                this.onFinishCallback.call(this.parentContext);
            });
        }
    } catch (error) {
        this.log(error);
    }
};

SevenZip.prototype.zip = function () {
    try {
        this.command = [
            "a",
            this.destination,
            this.source + "/*", // /* is for avoding 7zip to zip the outer folder, TODO: needs to be tested with files
            // "-xr!backups",
            // "-bsp1",
            // "-bse1",
            // "-bso1",
        ];

        if (this.debug) {
            this.process.readyReadStandardOutput.connect(this, function () {
                try {
                    this.log(new QTextStream(this.process.readAllStandardOutput()).readAll());
                    this.log(new QTextStream(this.process.readAllStandardError()).readAll());
                } catch (error) {
                    this.log(error);
                }
            });
        }

        this.process.start(this.binPath, this.command);
        this.process.waitForFinished(10000);
    } catch (error) {
        this.log(error);
    }
};

// SevenZip.prototype.unzipAsync = function () {};

SevenZip.prototype.log = function (stuff) {
    if (this.debug) {
        if (typeof stuff === "object" || typeof stuff === "array") {
            stuff = JSON.stringify(stuff);
        }
        MessageLog.trace(stuff);
    }
};

exports.SevenZip = SevenZip;
