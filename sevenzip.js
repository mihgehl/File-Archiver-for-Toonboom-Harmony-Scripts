/**
 * @file File zipper and unzipper utility for Toonboom Harmony Scripting Interface
 * @version 23.6
 * @copyright miwgel < github.com/miwgel >
 * @author miwgel < github.com/miwgel >
 */

/**
 * @constructor
 * @param { parent } parentContext
 * @param { string } source Source path to be unzipped or compressed
 * @param { string } destination Destination path where the source will be unzipped or compressed
 * @param { processStartCallback } processStartCallback Optional: Function that gets called when async zipping or unzipping process is started
 * @param { progressCallback } progressCallback Optional: Function that gets called when async zipping or unzipping progress is updated
 * @param { processEndCallback } processEndCallback Optional: Function that gets called when async zipping or unzipping process ends
 * @param { string } filter Optional: For filtering out files or folders
 * @param { bool } debug Optional: Print debugging messages to MessageLog
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

/**
 * Function that gets called when async zipping or unzipping process is started
 * @callback processStartCallback
 */
/**
 * Function that gets called when async zipping or unzipping progress is updated
 * @callback progressCallback
 * @param {int} progressValue Current progress percentage
 */
/**
 * Function that gets called when async zipping or unzipping process ends
 * @callback processStartCallback
 */

/**
 * Get current 7zip version
 */
Object.defineProperty(SevenZip.prototype, "version", {
  /**
   * Returns current 7zip version
   * @returns { float } Current 7zip Version
   */
  get: function () {
    try {
      var getSevenZipVersion = function (binPath) {
        var versionCheckProcess = new QProcess();
        versionCheckProcess.start(binPath);
        versionCheckProcess.waitForFinished(10000);
        var regex = /(7-Zip (\d+\.\d+))|(7-Zip \(z\) (\d+\.\d+)) |(\d+\.\d+)/;
        var match = new QTextStream(versionCheckProcess.readAllStandardOutput())
          .readAll()
          .match(regex);
        if (match) {
          for (var i = 0; i < match.length; i++) {
            var floatValue = parseFloat(match[i]);
            if (!isNaN(floatValue)) return floatValue;
          }
        }
      };
      if (typeof SevenZip.__proto__.version === "undefined") {
        var sevenZipVersion = getSevenZipVersion(this.binPath);
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

/**
 * Get 7zip binary path
 */
Object.defineProperty(SevenZip.prototype, "binPath", {
  /**
   * Returns current 7zip binary path
   * @returns { String } Current 7zip binary path
   */
  get: function () {
    if (typeof SevenZip.__proto__.binPath === "undefined") {
      if (about.isMacArch() || about.isLinuxArch()) {
        var szpath = [
          specialFolders.bin + "/bin_3rdParty/7za",
          specialFolders.bin + "/../../external/macosx/p7zip/7za",
        ];

        for (var i = 0; i < szpath.length; i++) {
          var sevenzipbin = new File(szpath[i]);
          if (sevenzipbin.exists) {
            SevenZip.__proto__.binPath = sevenzipbin.fullName;
            return sevenzipbin.fullName;
          }
        }
      } else if (about.isWindowsArch()) {
        var sevenzipbin = new QFile(
          specialFolders.userScripts + "/packages/7zip/7za.exe"
        );

        if (!sevenzipbin.exists()) {
          var dirPath = new QFileInfo(sevenzipbin.fileName()).dir().path();

          // Clean 7zip folder
          new QDir(dirPath).removeRecursively();
          new QDir(dirPath).mkpath(dirPath);

          var download7zProcess = new QProcess();
          var download7zCommand = [
            "/K",
            "powershell (New-Object Net.WebClient).DownloadFile('https://www.7-zip.org/a/7zr.exe', '7zr.exe') & " +
              "powershell (New-Object Net.WebClient).DownloadFile('https://www.7-zip.org/a/7z2300-extra.7z', '7z-extra.7z') & " +
              "7zr.exe -y e 7z-extra.7z x64/7za.exe & " +
              "if exist 7zr.exe del 7zr.exe & " +
              "if exist 7z-extra.7z del 7z-extra.7z &" +
              "exit",
          ];

          download7zProcess.setWorkingDirectory(dirPath);
          download7zProcess.start("cmd.exe", download7zCommand);
          download7zProcess.waitForFinished(50000);
          if (sevenzipbin.exists()) {
            SevenZip.__proto__.binPath = sevenzipbin.fileName();
            return sevenzipbin.fileName();
          }
        } else {
          SevenZip.__proto__.binPath = sevenzipbin.fileName();
          return sevenzipbin.fileName();
        }
      }
      // MessageBox.critical("cannot find 7zip to compress template. aborting");
      // throw new Error("cannot find 7zip");
    } else {
      return SevenZip.__proto__.binPath;
    }
  },
});

var sizeCalculator = function (sourcePath) {
  totalSize = 0;
  sourceInfo = new QFileInfo(sourcePath);

  if (sourceInfo.isFile()) {
    totalSize = sourceInfo.size();
  } else if (sourceInfo.isDir()) {
    var fileInfoList = new QDir(sourcePath).entryInfoList(
      QDir.Filters(QDir.Files | QDir.Dirs | QDir.NoDotAndDotDot)
    );
    for (var entry in fileInfoList) {
      totalSize += sizeCalculator(fileInfoList[entry].filePath());
    }
  }
  return totalSize;
};

/**
 * Compresses a file or directory without blocking the UI
 */
SevenZip.prototype.zipAsync = function () {
  try {
    this.command = [
      "a",
      this.destination,
      this.source + "/*", // /* is for avoding 7zip to zip the outer folder, TODO: needs to be tested with files
      "-bsp1", // Requires 7zip 15.09 or higher
    ];

    if (this.filter !== undefined && this.filter !== "") {
      this.command.push("-xr!" + this.filter);
    }

    this.process.readyReadStandardOutput.connect(this, function () {
      var output7z = new QTextStream(this.process.readAllStandardOutput())
        .readAll()
        .match(/\d+(?:\.\d+)?%/);
      if (isNaN(output7z)) {
        // Passes the zipping progress as a command to a callback (progressCallback) passed on by the user as a argument
        this.progressCallback.call(this.parentContext, parseInt(output7z));
      }
    });

    // Call a function from outside when the process is started
    if (typeof this.processStartCallback !== "undefined") {
      this.process["started()"].connect(this, function () {
        this.processStartCallback.call(this.parentContext);
      });
    }

    // Call a function from outside when the process ends
    if (typeof this.processEndCallback !== "undefined") {
      this.process["finished(int)"].connect(this, function () {
        this.processEndCallback.call(
          this.parentContext,
          new QFile(this.destination).exists()
        );
      });
    }

    // // This requires progressCallback section to be commented out
    // if (this.debug) {
    //   this.process.setStandardOutputFile(this.destination + ".log");
    //   this.process.setStandardErrorFile(this.destination + ".error.log");
    //   this.process.readyReadStandardOutput.connect(this, function () {
    //     var currentStdOut = new QTextStream(
    //       this.process.readAllStandardOutput()
    //     ).readAll();
    //     this.log(currentStdOut);
    //   });
    //   // this.process.setStandardErrorFile(this.destination + ".error.log");
    //   this.process.readyReadStandardError.connect(this, function () {
    //     var currentErrOut = new QTextStream(
    //       this.process.readAllStandardError()
    //     ).readAll();
    //     this.log(currentErrOut);
    //   });
    // }

    this.process.start(this.binPath, this.command);
  } catch (error) {
    this.log(error);
  }
};

/**
 * Compresses a file or directory blocking the UI
 */
SevenZip.prototype.zip = function () {
  try {
    this.command = [
      "a",
      this.destination,
      this.source + "/*", // /* is for avoding 7zip to zip the outer folder, TODO: needs to be tested with files
      // "-xr!backups",
      "-bsp1",
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

/**
 * Decompresses a file without blocking the UI
 */
SevenZip.prototype.unzipAsync = function () {
  try {
    // Macos seems to have an older version of 7za, so the output folder command -o shouldn't have an space before the path
    this.command = [
      "x",
      "-y", // Overwrites files and folders by default. TODO:
      this.source,
      "-o" + this.destination,
      "-bsp1", // Macos and tbh22 needs -bsp1 to show progress | Needs testing on windows
      // "-aoa",
      // "-r",
    ];

    if (this.filter !== undefined && this.filter !== "") {
      this.command.push(this.filter);
    }

    // Comment this section for receiving debug messages from the process
    if (!this.debug && typeof this.progressCallback !== "undefined") {
      this.process.readyReadStandardOutput.connect(this, function () {
        var output7z = new QTextStream(this.process.readAllStandardOutput())
          .readAll()
          .match(/\d+(?:\.\d+)?%/);
        if (isNaN(output7z)) {
          // Passes the zipping progress as a command to a callback (progressCallback) passed on by the user as a argument
          this.progressCallback.call(this.parentContext, parseInt(output7z));
        }
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

    // This requires progressCallback section to be commented out
    if (this.debug) {
      this.process.readyReadStandardOutput.connect(this, function () {
        var currentStdOut = new QTextStream(
          this.process.readAllStandardOutput()
        ).readAll();
        this.log(currentStdOut);
      });
      this.process.readyReadStandardError.connect(this, function () {
        var currentErrOut = new QTextStream(
          this.process.readAllStandardError()
        ).readAll();
        this.log(currentErrOut);
      });
    }

    this.process.start(this.binPath, this.command);
  } catch (error) {
    this.log(error);
  }
};

function Connection() {
  this.timeout = 50000; // 50 seconds timeout

  this.curlPath = this.bin.split("/").slice(0, -1).join("\\"); // Curl binary full path
  this.curlBin = this.bin.split("/").pop(); // Curl binary file (without path)

  this.process = new QProcess();
  // this.process.setWorkingDirectory(this.curlPath); // Set process working directory to curl folder
  // this.process.waitForFinished(this.timeout);

  this.command = [];

  if (this.curlPath.indexOf("bin_3rdParty") !== -1) {
    this.command = ["--insecure"].concat(this.command);
  }
}

Connection.prototype.download = function (url, destinationPath) {
  try {
    var file = new QFile(destinationPath);
    MessageLog.trace(file.fileName());
    var dirPath = new QFileInfo(file.fileName()).dir().path();

    if (!new QDir(dirPath).exists()) {
      new QDir().mkpath(dirPath);
    }

    if (file.exists()) {
      file.remove();
    }

    this.process.start(
      this.bin,
      ["-L", "-o", destinationPath, url].concat(this.command)
    );
    this.process.waitForFinished(this.timeout);

    // MessageLog.trace(
    //   new QTextStream(this.process.readAllStandardOutput()).readAll()
    // );
    // MessageLog.trace(
    //   new QTextStream(this.process.readAllStandardError()).readAll()
    // );

    if (file.exists()) {
      return file;
    } else {
      throw new Error("File download Failed");
    }
  } catch (error) {
    MessageLog.trace(error);
  }
};

Object.defineProperty(Connection.prototype, "bin", {
  get: function () {
    if (typeof Connection.__proto__.bin === "undefined") {
      if (about.isWindowsArch()) {
        var curls = [
          specialFolders.bin + "/bin_3rdParty/curl.exe",
          System.getenv("ProgramFiles") + "/Git/mingw64/bin/curl.exe",
          System.getenv("windir") + "/system32/curl.exe",
        ];
      } else {
        var curls = [
          "/usr/bin/curl",
          "/usr/local/bin/curl",
          specialFolders.bin + "/bin_3rdParty/curl",
        ];
      }

      for (var curl in curls) {
        if (new File(curls[curl]).exists) {
          Connection.__proto__.bin = curls[curl];
          return curls[curl];
        }
      }

      throw new Error("Please Install CURL");
    } else {
      return Connection.__proto__.bin;
    }
  },
});

SevenZip.prototype.log = function (stuff) {
  if (this.debug) {
    if (typeof stuff === "object" || typeof stuff === "array") {
      stuff = JSON.stringify(stuff);
    }
    MessageLog.trace(stuff);
  }
};

exports.SevenZip = SevenZip;
