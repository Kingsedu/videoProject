const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { pipeline } = require("node:stream/promises");
const util = require("../../lib/util");
const DB = require("../DB");
const FF = require("../../lib/FF");
const getVideos = (req, res, handleErr) => {
  const name = req.params.get("name");

  if (name) {
    res.json({ message: `Your name is ${name}` });
  } else {
    return handleErr({ status: 400, message: "Please specify a name" });
  }
};

const uploadVideo = async (req, res, handleErr) => {
  const specifiedFileName = req.headers.filename;
  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");

  const FORMATS_SUPPORTED = ["mov", "mp4"];

  if(FORMATS_SUPPORTED.indexOf(extension) == -1){
    return handleErr({
      status: 400,
      message: "Only these formats are allowed: mov,mp4",
    })
  }

  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullPath = `./storage/${videoId}/original.${extension}`;
    const fileHandle = await fs.open(fullPath, "w");
    const fileStream = fileHandle.createWriteStream();
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;

    await pipeline(req, fileStream);

    //?Make a thumbnail for the video file;
    await FF.makeThumbnail(fullPath, thumbnailPath);

    //?Get the dimensions;
    const dimensions = await FF.getDimensions(fullPath);

    DB.update();
    DB.video.unshift({
      id: DB.video.length,
      videoId,
      name,
      extension,
      dimensions,
      userId: req.userId,
      extractedAudio: false,
      resizes: {},
    });

    DB.save();

    res.status(201).json({
      status: "success",
      message: "The file was uploaded successfully",
    });

    console.log(specifiedFileName, extension, name);
  } catch (err) {
    util.deleteFolder(`./storage/${videoId}`);
    if (err.code !== "ECONNRESET") return handleErr(err);
    console.log(err);
  }
};
const controller = {
  getVideos,
  uploadVideo,
};

module.exports = controller;
