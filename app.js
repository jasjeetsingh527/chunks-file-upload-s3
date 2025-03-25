require("dotenv").config();
const logger = require("morgan");
const express = require("express");
const cors = require("cors");
const BUCKET_NAME = "bucket-name";
const PORT = 5000;
const {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
app.use(cors());
app.use(express.json());
app.use(
  logger(
    ":method :url :req[header] :status :res[content-length] - :response-time ms"
  )
);
const s3Client = new S3Client({
  region: "us-east-1",
});

app.get("/", (req, res) => {
  res.status(200).send([
    {
      endPoint: "/start-multipart-upload",
      method: "POST",
      description: "Start multipart upload",
      body: [
        {
          fileName: "file name.png",
          description: "file name with extension",
        },
        {
          fileType: "image/png",
          description: "file type",
        },
      ],
      response: [
        {
          uploadId: "upload id",
          description: "upload id",
        },
        {
          startDateTime: "start date time",
          description: "start date time",
        },
      ],
    },
    {
      endPoint: "/get-upload-url",
      method: "POST",
      description: "get signed url for uploading part",
      body: [
        {
          fileName: "file name.png",
          description: "file name with extension",
        },
        {
          partNumber: 1,
          description: "part number",
        },
        {
          uploadId: "upload id",
          description: "upload id",
        },
      ],
      response: [
        {
          url: "signed url",
          description: "signed url",
        },
      ],
    },
    {
      endPoint: "/complete-multipart-upload",
      method: "POST",
      description: "Complete multipart upload",
      body: [
        {
          fileName: "file name.png",
          description: "file name with extension",
        },
        {
          uploadId: "upload id",
          description: "upload id",
        },
        {
          parts: [
            {
              ETag: "etag",
              PartNumber: 1,
            },
          ],
          description: "parts",
        },
      ],
      response: [
        {
          message: "Upload completed successfully!",
          description: "message",
        },
        {
          endDateTime: "end date time",
          description: "end date time",
        },
      ],
    },
  ]);
});

app.post("/start-multipart-upload", async (req, res) => {
  const { fileName, fileType } = req.body;

  const params = {
    Bucket: BUCKET_NAME,
    Key: `uploads/${fileName}`,
    ContentType: fileType,
  };

  try {
    const command = new CreateMultipartUploadCommand(params);
    const upload = await s3Client.send(command);
    res.json({ uploadId: upload.UploadId, startDateTime: new Date() });
  } catch (error) {
    console.error("Error starting multipart upload", error);
    res.status(500).json({ error: "Failed to start upload" });
  }
});

app.post("/get-upload-url", async (req, res) => {
  const { fileName, partNumber, uploadId } = req.body;

  const params = {
    Bucket: BUCKET_NAME,
    Key: `uploads/${fileName}`,
    PartNumber: partNumber,
    UploadId: uploadId,
  };

  try {
    const command = new UploadPartCommand(params);
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ url });
  } catch (error) {
    console.error("Error getting signed URL", error);
    res.status(500).json({ error: "Failed to get signed URL" });
  }
});

app.post("/complete-multipart-upload", async (req, res) => {
  const { fileName, uploadId, parts } = req.body;

  const params = {
    Bucket: BUCKET_NAME,
    Key: `uploads/${fileName}`,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  };

  try {
    const command = new CompleteMultipartUploadCommand(params);
    await s3Client.send(command);
    res.json({
      message: "Upload completed successfully!",
      endDateTime: new Date(),
    });
  } catch (error) {
    console.error("Error completing upload", error);
    res.status(500).json({ error: "Failed to complete upload" });
  }
});

app.listen(PORT, () => console.log("Server running on port ", PORT));
