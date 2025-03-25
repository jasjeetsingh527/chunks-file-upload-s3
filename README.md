# Chunks File Upload to S3

## Description
This project is a Node.js application that allows users to upload files to AWS S3 using multipart uploads. It provides a RESTful API built with Express.

## Installation
1. Clone the repository.
2. Navigate to the project directory.
3. Run `npm install` to install the dependencies.

## Usage
To start the application in development mode, run:
```bash
npm run start:dev
```

The server will run on `http://localhost:5000`.

## API Endpoints
- `GET /`: Overview of available endpoints.
- `POST /start-multipart-upload`: Initiates a multipart upload.
- `POST /get-upload-url`: Retrieves a signed URL for uploading a specific part.
- `POST /complete-multipart-upload`: Completes the multipart upload.

## Dependencies
- `@aws-sdk/client-s3`: AWS SDK for S3 operations.
- `@aws-sdk/s3-request-presigner`: For generating signed URLs.
- `cors`: Middleware for enabling CORS.
- `dotenv`: For managing environment variables.
- `express`: Web framework for Node.js.
- `morgan`: HTTP request logger middleware.

## License
This project is licensed under the ISC License.
