require("dotenv").config();
const logger = require("morgan");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit"); // Add rate limiting
const helmet = require("helmet"); // Add security headers

// Constants
const BUCKET_NAME = process.env.BUCKET_NAME;
const PORT = process.env.PORT || 5000;
const UPLOAD_PATH = "uploads/";
const URL_EXPIRATION = 3600;

// AWS SDK imports
const {
  S3Client,
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Initialize Express
const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(logger("combined")); // Use combined format for better logging

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize S3 client once
const s3Client = new S3Client({
  region: process.env.REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  maxAttempts: 3, // Add retry mechanism
});

// Request validation middleware
const validateUploadRequest = (req, res, next) => {
  const { fileName, fileType } = req.body;
  if (!fileName || !fileType) {
    return res.status(400).json({ error: "Missing required parameters" });
  }
  // Add file type validation
  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(fileType)) {
    return res.status(400).json({ error: "Invalid file type" });
  }
  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal server error",
    requestId: req.id,
  });
};

// Cache for active uploads
const uploadCache = new Map();

// Routes
app.get("/", (req, res) => {
  // Your existing route documentation...
});

app.post("/start-multipart-upload", validateUploadRequest, async (req, res) => {
  const { fileName, fileType } = req.body;

  try {
    const key = `${UPLOAD_PATH}${Date.now()}-${fileName}`; // Add timestamp to prevent collisions
    const command = new CreateMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      Metadata: {
        originalName: fileName,
        uploadDate: new Date().toISOString(),
      },
    });

    const upload = await s3Client.send(command);
    const uploadData = {
      uploadId: upload.UploadId,
      key,
      startDateTime: new Date(),
      parts: [],
    };

    // Cache upload data
    uploadCache.set(upload.UploadId, uploadData);

    res.json({
      uploadId: upload.UploadId,
      startDateTime: uploadData.startDateTime,
    });
  } catch (error) {
    console.error("Error starting multipart upload", error);
    res.status(500).json({ error: "Failed to start upload" });
  }
});

app.post("/get-upload-url", async (req, res) => {
  const { fileName, partNumber, uploadId } = req.body;

  if (!uploadCache.has(uploadId)) {
    return res.status(404).json({ error: "Upload not found" });
  }

  const uploadData = uploadCache.get(uploadId);

  try {
    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: uploadData.key,
      PartNumber: partNumber,
      UploadId: uploadId,
    });

    const url = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION,
    });
    res.json({ url });
  } catch (error) {
    console.error("Error getting signed URL", error);
    res.status(500).json({ error: "Failed to get signed URL" });
  }
});

app.post("/complete-multipart-upload", async (req, res) => {
  const { uploadId, parts } = req.body;

  if (!uploadCache.has(uploadId)) {
    return res.status(404).json({ error: "Upload not found" });
  }

  const uploadData = uploadCache.get(uploadId);

  try {
    const command = new CompleteMultipartUploadCommand({
      Bucket: BUCKET_NAME,
      Key: uploadData.key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await s3Client.send(command);

    // Clean up cache
    uploadCache.delete(uploadId);

    res.json({
      message: "Upload completed successfully!",
      endDateTime: new Date(),
      key: uploadData.key,
    });
  } catch (error) {
    console.error("Error completing upload", error);
    res.status(500).json({ error: "Failed to complete upload" });
  }
});

// Apply error handler
app.use(errorHandler);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Performing graceful shutdown...");
  // Clean up resources, close connections, etc.
  process.exit(0);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
