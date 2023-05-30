/**
 * @file File zipper and unzipper utility for Toonboom Harmony Scripting Interface
 * @version 23.5.30
 * @copyright mihgehl < github.com/mihgehl >
 * @author mihgehl < github.com/mihgehl >
 */

/**
 *
 */
function SevenZip(
  parentContext,
  source,
  destination,
  processStartCallback,
  progressCallback,
  processEndCallback,
  filter,
  debug
) {
  if (typeof parentContext === "undefined") var parentContext = null;
  if (typeof source === "undefined") var source = null;
  if (typeof destination === "undefined") var destination = null;
  if (typeof processStartCallback === "undefined") var progressCallback = null;
  if (typeof processEndCallback === "undefined") var processEndCallback = null;
  if (typeof filter === "undefined") var filter = undefined;
  if (typeof debug === "undefined") var debug = false;

  this.parentContext = parentContext;
  this.source = source;
  this.destination = destination;
  this.processStartCallback = processStartCallback;
  this.progressCallback = progressCallback;
  this.processEndCallback = processEndCallback;
  this.filter = filter;
  this.debug = debug;

  this.command = [];
  this.process = new QProcess();
}

Object.defineProperty(SevenZip.prototype, "version", {
  get: function () {
    try {
      if (typeof SevenZip.__proto__.version === "undefined") {
        this.versionCheckProcess = new QProcess();
        this.versionCheckProcess.start(this.binPath);
        this.versionCheckProcess.waitForReadyRead(10000);
        var regex = /(7-Zip (\d+\.\d+))|(7-Zip \(z\) (\d+\.\d+)) /;
        var match = new QTextStream(
          this.versionCheckProcess.readAllStandardOutput()
        )
          .readAll()
          .match(regex);

        if (match) {
          var sevenZipVersion = parseFloat(match[2] || match[4]);
        }
        SevenZip.__proto__.version = sevenZipVersion;
        return sevenZipVersion;
      } else {
        return SevenZip.__proto__.version;
      }
    } catch (error) {
      MessageLog.trace(error);
    }
  },
});

Object.defineProperty(SevenZip.prototype, "binPath", {
  get: function () {
    if (typeof SevenZip.__proto__.binPath === "undefined") {
      if (about.isMacArch() || about.isLinuxArch()) {
        var sevenzipbin = new File(specialFolders.bin + "/bin_3rdParty/7za");
        if (sevenzipbin.exists) {
          SevenZip.__proto__.binPath = sevenzipbin.fullName;
          return sevenzipbin.fullName;
        }
        var sevenzipbin = new File(
          specialFolders.bin + "/../../external/macosx/p7zip/7za"
        );
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
        var output7z = new QTextStream(this.process.readAllStandardOutput())
          .readAll()
          .match(/\d+(?:\.\d+)?%/);
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
          this.log(
            new QTextStream(this.process.readAllStandardOutput()).readAll()
          );
          this.log(
            new QTextStream(this.process.readAllStandardError()).readAll()
          );
        } catch (error) {
          this.log(error);
        }
      });
    }

    if (typeof this.processEndCallback !== "undefined") {
      this.process["finished(int)"].connect(this, function () {
        this.processEndCallback.call(this.parentContext);
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
          this.log(
            new QTextStream(this.process.readAllStandardOutput()).readAll()
          );
          this.log(
            new QTextStream(this.process.readAllStandardError()).readAll()
          );
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

SevenZip.prototype.unzipAsync = function () {
  try {
    // Macos seems to have an older version of 7za, so the output folder command -o shouldn't have an space before the path
    this.command = [
      "x",
      "-y", // Overwrites files and folders by default. TODO:
      this.source,
      "-o" + this.destination,
      // "-bsp1", // Macos and tbh22 needs -bsp1 to show progress | Needs testing on windows
      // "-aoa",
      // "-r",
      // ">",
      // this.destination + "/log.txt",
    ];

    // if (this.filter !== undefined) {
    //   this.command.push(this.filter);
    // }
    if (this.version >= 15.09) {
      this.command.push("-bsp1");
    }

    this.process.start(this.binPath, this.command);

    // Comment this section for receiving debug messages from the process
    if (typeof this.progressCallback !== "undefined" && this.version >= 15.09) {
      this.process.readyReadStandardOutput.connect(this, function () {
        var output7z = new QTextStream(this.process.readAllStandardOutput())
          .readAll()
          .match(/\d+(?:\.\d+)?%/);
        this.progressCallback.call(this.parentContext, parseInt(output7z)); // Passes the unzipping progress as an argument to a callback function (progressCallback) passed on by the user as a argument of the SevenZip class
      });
    }

    // Call a function from outside when the process is started
    if (typeof this.processStartCallback !== "undefined") {
      this.process["started()"].connect(this, function () {
        this.processStartCallback.call(this.parentContext);
      });
    }

    // Call a function from outside when the process ends
    if (typeof this.processEndCallback !== "undefined") {
      this.process["finished(int)"].connect(this, function () {
        this.processEndCallback.call(this.parentContext);
      });
    }

    // // This requires progressCallback section to be commented out
    // if (this.debug) {
    //   this.process.readyReadStandardOutput.connect(this, function () {
    //     var currentStdOut = new QTextStream(
    //       this.process.readAllStandardOutput()
    //     ).readAll();
    //     var currentErrOut = new QTextStream(
    //       this.process.readAllStandardError()
    //     ).readAll();
    //     this.log(currentStdOut);
    //     this.log(currentErrOut);
    //   });
    // }
  } catch (error) {
    this.log(error);
  }
};

SevenZip.prototype.log = function (stuff) {
  if (this.debug) {
    if (typeof stuff === "object" || typeof stuff === "array") {
      stuff = JSON.stringify(stuff);
    }
    MessageLog.trace(stuff);
  }
};

exports.SevenZip = SevenZip;
